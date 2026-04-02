import {
	createVolumeBackup,
	findVolumeBackupById,
	IS_CLOUD,
	removeVolumeBackup,
	removeVolumeBackupJob,
	restoreVolume,
	runVolumeBackup,
	scheduleVolumeBackup,
	updateVolumeBackup,
} from "@dokploy/server";
import { db } from "@dokploy/server/db";
import {
	createVolumeBackupSchema,
	updateVolumeBackupSchema,
	volumeBackups,
} from "@dokploy/server/db/schema";
import { checkServicePermissionAndAccess } from "@dokploy/server/services/permission";
import {
	execAsync,
	execAsyncRemote,
	execAsyncStream,
} from "@dokploy/server/utils/process/execAsync";
import {
	getS3Credentials,
	normalizeS3Path,
} from "@dokploy/server/utils/backups/utils";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { removeJob, schedule, updateJob } from "@/server/utils/backup";
import { createTRPCRouter, protectedProcedure, withPermission } from "../trpc";

interface RcloneFile {
	Path: string;
	Name: string;
	Size: number;
	IsDir: boolean;
	ModTime?: string;
	Hashes?: Record<string, string>;
}

export const volumeBackupsRouter = createTRPCRouter({
	list: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1),
				volumeBackupType: z.enum([
					"application",
					"postgres",
					"mysql",
					"mariadb",
					"mongo",
					"redis",
					"compose",
					"libsql",
				]),
			}),
		)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.id, {
				volumeBackup: ["read"],
			});
			return await db.query.volumeBackups.findMany({
				where: eq(volumeBackups[`${input.volumeBackupType}Id`], input.id),
				with: {
					application: true,
					postgres: true,
					mysql: true,
					mariadb: true,
					mongo: true,
					redis: true,
					compose: true,
					libsql: true,
				},
				orderBy: [desc(volumeBackups.createdAt)],
			});
		}),
	create: protectedProcedure
		.input(createVolumeBackupSchema)
		.mutation(async ({ input, ctx }) => {
			const serviceId =
				input.applicationId ||
				input.postgresId ||
				input.mysqlId ||
				input.mariadbId ||
				input.mongoId ||
				input.redisId ||
				input.libsqlId ||
				input.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volumeBackup: ["create"],
				});
			}
			const newVolumeBackup = await createVolumeBackup(input);

			if (newVolumeBackup?.enabled) {
				if (IS_CLOUD) {
					await schedule({
						cronSchedule: newVolumeBackup.cronExpression,
						volumeBackupId: newVolumeBackup.volumeBackupId,
						type: "volume-backup",
					});
				} else {
					await scheduleVolumeBackup(newVolumeBackup.volumeBackupId);
				}
			}
			await audit(ctx, {
				action: "create",
				resourceType: "volumeBackup",
				resourceId: newVolumeBackup?.volumeBackupId,
			});
			return newVolumeBackup;
		}),
	one: protectedProcedure
		.input(
			z.object({
				volumeBackupId: z.string().min(1),
			}),
		)
		.query(async ({ input, ctx }) => {
			const vb = await findVolumeBackupById(input.volumeBackupId);
			const serviceId =
				vb.applicationId ||
				vb.postgresId ||
				vb.mysqlId ||
				vb.mariadbId ||
				vb.mongoId ||
				vb.redisId ||
				vb.libsqlId ||
				vb.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volumeBackup: ["read"],
				});
			}
			return vb;
		}),
	delete: protectedProcedure
		.input(
			z.object({
				volumeBackupId: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const vb = await findVolumeBackupById(input.volumeBackupId);
			const serviceId =
				vb.applicationId ||
				vb.postgresId ||
				vb.mysqlId ||
				vb.mariadbId ||
				vb.mongoId ||
				vb.redisId ||
				vb.libsqlId ||
				vb.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volumeBackup: ["delete"],
				});
			}
			const result = await removeVolumeBackup(input.volumeBackupId);
			await audit(ctx, {
				action: "delete",
				resourceType: "volumeBackup",
				resourceId: input.volumeBackupId,
			});
			return result;
		}),
	update: protectedProcedure
		.input(updateVolumeBackupSchema)
		.mutation(async ({ input, ctx }) => {
			const existingVb = await findVolumeBackupById(input.volumeBackupId);
			const serviceId =
				existingVb.applicationId ||
				existingVb.postgresId ||
				existingVb.mysqlId ||
				existingVb.mariadbId ||
				existingVb.mongoId ||
				existingVb.redisId ||
				existingVb.libsqlId ||
				existingVb.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volumeBackup: ["update"],
				});
			}
			const updatedVolumeBackup = await updateVolumeBackup(
				input.volumeBackupId,
				input,
			);

			if (!updatedVolumeBackup) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Volume backup not found",
				});
			}

			if (IS_CLOUD) {
				if (updatedVolumeBackup.enabled) {
					await updateJob({
						cronSchedule: updatedVolumeBackup.cronExpression,
						volumeBackupId: updatedVolumeBackup.volumeBackupId,
						type: "volume-backup",
					});
				} else {
					await removeJob({
						cronSchedule: updatedVolumeBackup.cronExpression,
						volumeBackupId: updatedVolumeBackup.volumeBackupId,
						type: "volume-backup",
					});
				}
			} else {
				if (updatedVolumeBackup?.enabled) {
					removeVolumeBackupJob(updatedVolumeBackup.volumeBackupId);
					scheduleVolumeBackup(updatedVolumeBackup.volumeBackupId);
				} else {
					removeVolumeBackupJob(updatedVolumeBackup.volumeBackupId);
				}
			}
			await audit(ctx, {
				action: "update",
				resourceType: "volumeBackup",
				resourceId: updatedVolumeBackup.volumeBackupId,
			});
			return updatedVolumeBackup;
		}),

	runManually: protectedProcedure
		.input(z.object({ volumeBackupId: z.string().min(1) }))
		.mutation(async ({ input, ctx }) => {
			const vb = await findVolumeBackupById(input.volumeBackupId);
			const serviceId =
				vb.applicationId ||
				vb.postgresId ||
				vb.mysqlId ||
				vb.mariadbId ||
				vb.mongoId ||
				vb.redisId ||
				vb.libsqlId ||
				vb.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volumeBackup: ["create"],
				});
			}
			try {
				const result = await runVolumeBackup(input.volumeBackupId);
				await audit(ctx, {
					action: "run",
					resourceType: "volumeBackup",
					resourceId: input.volumeBackupId,
				});
				return result;
			} catch (error) {
				console.error(error);
				return false;
			}
		}),
	listFiles: protectedProcedure
		.input(
			z.object({
				volumeBackupId: z.string().min(1),
				serverId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const vb = await findVolumeBackupById(input.volumeBackupId);
			const serviceId =
				vb.applicationId ||
				vb.postgresId ||
				vb.mysqlId ||
				vb.mariadbId ||
				vb.mongoId ||
				vb.redisId ||
				vb.libsqlId ||
				vb.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volumeBackup: ["read"],
				});
			}

			const destination = vb.destination;
			const rcloneFlags = getS3Credentials(destination);
			const s3AppName =
				vb.compose?.appName ||
				vb.application?.appName ||
				vb.postgres?.appName ||
				vb.mysql?.appName ||
				vb.mariadb?.appName ||
				vb.mongo?.appName ||
				vb.redis?.appName ||
				vb.libsql?.appName ||
				vb.appName;
			const bucketPath = `:s3:${destination.bucket}/${s3AppName}/${normalizeS3Path(vb.prefix || "")}`;
			const listCommand = `rclone lsjson ${rcloneFlags.join(" ")} --include "${vb.volumeName}-*.tar" "${bucketPath}" --no-mimetype 2>/dev/null`;

			try {
				let stdout = "";
				const serverId = input.serverId || vb.application?.serverId || vb.compose?.serverId;
				if (serverId) {
					const result = await execAsyncRemote(serverId, listCommand);
					stdout = result.stdout;
				} else {
					const result = await execAsync(listCommand);
					stdout = result.stdout;
				}

				let files: RcloneFile[] = [];
				try {
					files = JSON.parse(stdout) as RcloneFile[];
				} catch {
					files = [];
				}

				return files
					.map((file) => ({
						...file,
						FullPath: `${s3AppName}/${normalizeS3Path(vb.prefix || "")}${file.Path}`,
					}))
					.sort((a, b) => (b.ModTime || "").localeCompare(a.ModTime || ""));
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error ? error.message : "Error listing backup files",
					cause: error,
				});
			}
		}),

	generateDownloadUrl: protectedProcedure
		.input(
			z.object({
				volumeBackupId: z.string().min(1),
				filePath: z.string().min(1),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const vb = await findVolumeBackupById(input.volumeBackupId);
			const serviceId =
				vb.applicationId ||
				vb.postgresId ||
				vb.mysqlId ||
				vb.mariadbId ||
				vb.mongoId ||
				vb.redisId ||
				vb.libsqlId ||
				vb.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volumeBackup: ["read"],
				});
			}

			const destination = vb.destination;
			const rcloneFlags = getS3Credentials(destination);
			const bucketPath = `:s3:${destination.bucket}/${input.filePath}`;
			const linkCommand = `rclone link ${rcloneFlags.join(" ")} "${bucketPath}"`;

			try {
				const serverId = input.serverId || vb.application?.serverId || vb.compose?.serverId;
				let stdout = "";
				if (serverId) {
					const result = await execAsyncRemote(serverId, linkCommand);
					stdout = result.stdout;
				} else {
					const result = await execAsync(linkCommand);
					stdout = result.stdout;
				}

				const url = stdout.trim();
				if (!url || !url.startsWith("http")) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Could not generate download URL. Your S3 provider may not support presigned URLs. Try downloading directly from your S3 bucket.",
					});
				}
				return { url };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error generating download URL",
					cause: error,
				});
			}
		}),

	restoreVolumeBackupWithLogs: withPermission("volumeBackup", "restore")
		.meta({
			openapi: {
				enabled: false,
				path: "/restore-volume-backup-with-logs",
				method: "POST",
				override: true,
			},
		})
		.input(
			z.object({
				backupFileName: z.string().min(1),
				destinationId: z.string().min(1),
				volumeName: z.string().min(1),
				id: z.string().min(1),
				serviceType: z.enum(["application", "compose"]),
				serverId: z.string().optional(),
			}),
		)
		.subscription(async ({ input }) => {
			return observable<string>((emit) => {
				const runRestore = async () => {
					try {
						emit.next("🚀 Starting volume restore process...");
						emit.next(`📂 Backup File: ${input.backupFileName}`);
						emit.next(`🔧 Volume Name: ${input.volumeName}`);
						emit.next(`🏷️ Service Type: ${input.serviceType}`);
						emit.next(""); // Empty line for better readability

						// Generate the restore command
						const restoreCommand = await restoreVolume(
							input.id,
							input.destinationId,
							input.volumeName,
							input.backupFileName,
							input.serverId || "",
							input.serviceType,
						);

						emit.next("📋 Generated restore command:");
						emit.next("▶️ Executing restore...");
						emit.next(""); // Empty line

						// Execute the restore command with real-time output
						if (input.serverId) {
							emit.next(`🌐 Executing on remote server: ${input.serverId}`);
							await execAsyncRemote(input.serverId, restoreCommand, (data) => {
								emit.next(data);
							});
						} else {
							emit.next("🖥️ Executing on local server");
							await execAsyncStream(restoreCommand, (data) => {
								emit.next(data);
							});
						}

						emit.next("");
						emit.next("✅ Volume restore completed successfully!");
						emit.next(
							"🎉 All containers/services have been restarted with the restored volume.",
						);
					} catch {
						emit.next("");
						emit.next("❌ Volume restore failed!");
					} finally {
						emit.complete();
					}
				};

				// Start the restore process
				runRestore();
			});
		}),
});
