import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execAsync, paths, validateRequest } from "@dokploy/server";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
	api: {
		bodyParser: false,
		responseLimit: false,
	},
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { user } = await validateRequest(req);
	if (!user) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const { volumeBackupId, volumeName } = req.query as {
		volumeBackupId: string;
		volumeName: string;
	};

	if (!volumeBackupId || !volumeName) {
		return res
			.status(400)
			.json({ error: "volumeBackupId and volumeName are required" });
	}

	const { VOLUME_BACKUPS_PATH } = paths(false);
	const backupDir = path.join(VOLUME_BACKUPS_PATH, volumeBackupId);
	const fileName = `local-upload-${Date.now()}.tar`;
	const filePath = path.join(backupDir, fileName);

	try {
		await fs.promises.mkdir(backupDir, { recursive: true });

		const writeStream = fs.createWriteStream(filePath);

		req.on("aborted", () => {
			writeStream.destroy();
			fs.unlink(filePath, () => {});
		});

		try {
			await pipeline(req, writeStream);
		} catch {
			try {
				await fs.promises.unlink(filePath);
			} catch {}
			return res
				.status(500)
				.json({ error: "Upload failed or was interrupted" });
		}

		const stat = await fs.promises.stat(filePath);
		if (stat.size === 0) {
			await fs.promises.unlink(filePath);
			return res.status(400).json({ error: "Uploaded file is empty" });
		}

		// Restore the volume from the uploaded tar
		const restoreCommand = `
set -e
echo "Volume name: ${volumeName}"
echo "Backup file: ${filePath}"
echo "Creating/restoring volume..."
docker run --rm \\
  -v ${volumeName}:/volume_data \\
  -v ${backupDir}:/backup \\
  ubuntu \\
  bash -c "cd /volume_data && tar xvf /backup/${fileName} ."
echo "Volume restore completed"
`;
		await execAsync(restoreCommand);

		// Cleanup the uploaded file after restore
		await fs.promises.unlink(filePath).catch(() => {});

		return res
			.status(200)
			.json({ success: true, message: "Volume restored successfully" });
	} catch (error) {
		// Cleanup on error
		try {
			await fs.promises.unlink(filePath);
		} catch {}
		console.error("Volume upload restore error:", error);
		return res.status(500).json({
			error:
				error instanceof Error ? error.message : "Failed to restore volume",
		});
	}
}
