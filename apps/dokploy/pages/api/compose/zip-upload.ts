import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import {
	findComposeById,
	updateCompose,
	validateRequest,
} from "@dokploy/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { myQueue } from "@/server/queues/queueSetup";
import type { DeploymentJob } from "@/server/queues/queue-types";

export const config = {
	api: {
		bodyParser: false,
		responseLimit: false,
	},
};

const execFileAsync = promisify(execFile);

const COMPOSE_FILENAMES = [
	"docker-compose.yml",
	"docker-compose.yaml",
	"compose.yml",
	"compose.yaml",
];

async function extractComposeFromZip(zipPath: string): Promise<string | null> {
	const extractDir = `${zipPath}-extracted`;

	try {
		await fs.promises.mkdir(extractDir, { recursive: true });

		// Use unzip to list files first (no memory overhead)
		let listing = "";
		try {
			const result = await execFileAsync("unzip", ["-Z1", zipPath]);
			listing = result.stdout;
		} catch (e: unknown) {
			const err = e as { stdout?: string; code?: number };
			// unzip -Z1 exits 1 if there are warnings but still outputs the list
			if (err.stdout) {
				listing = err.stdout;
			} else {
				throw new Error(`Failed to list ZIP contents: ${String(e)}`);
			}
		}

		const lines = listing.split("\n").map((l) => l.trim()).filter(Boolean);

		// Find a compose file entry
		const targetEntry = lines.find((line) => {
			const filename = line.split("/").pop()?.toLowerCase();
			return filename && COMPOSE_FILENAMES.includes(filename);
		});

		if (!targetEntry) {
			return null;
		}

		// Extract only that single file
		await execFileAsync("unzip", ["-o", "-j", zipPath, targetEntry, "-d", extractDir]);

		const extractedFile = path.join(extractDir, path.basename(targetEntry));
		const content = await fs.promises.readFile(extractedFile, "utf-8");

		return content;
	} finally {
		// Cleanup extract directory
		await fs.promises.rm(extractDir, { recursive: true, force: true }).catch(() => {});
	}
}

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

	const { composeId } = req.query as { composeId?: string };
	if (!composeId) {
		return res.status(400).json({ error: "composeId is required" });
	}

	const tmpDir = os.tmpdir();
	const tmpFile = path.join(
		tmpDir,
		`compose-zip-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`,
	);

	const cleanup = () => {
		try {
			if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
		} catch (_) {}
	};

	let aborted = false;

	try {
		const writeStream = fs.createWriteStream(tmpFile);

		req.on("aborted", () => {
			aborted = true;
			writeStream.destroy();
			cleanup();
		});

		try {
			await pipeline(req, writeStream);
		} catch (pipeErr) {
			cleanup();
			if (aborted) {
				return res.status(499).json({ error: "Upload cancelled by client" });
			}
			throw pipeErr;
		}

		if (aborted) {
			return res.status(499).json({ error: "Upload cancelled by client" });
		}

		// Check file size
		const stat = await fs.promises.stat(tmpFile);
		if (stat.size === 0) {
			cleanup();
			return res.status(400).json({ error: "Uploaded file is empty" });
		}

		// Extract compose file using unzip (no memory overhead for large ZIPs)
		const composeContent = await extractComposeFromZip(tmpFile);

		if (!composeContent) {
			cleanup();
			return res.status(400).json({
				error: `No compose file found in ZIP. Expected one of: ${COMPOSE_FILENAMES.join(", ")}`,
			});
		}

		// Save to DB and set source to raw
		await updateCompose(composeId, {
			composeFile: composeContent,
			sourceType: "raw",
		});

		const compose = await findComposeById(composeId);

		// Queue deployment
		const jobData: DeploymentJob = {
			composeId: compose.composeId,
			titleLog: "ZIP Upload deployment",
			descriptionLog: "Deployed from uploaded ZIP file",
			type: "deploy",
			applicationType: "compose",
			server: !!compose.serverId,
		};

		await myQueue.add(
			"deployments",
			{ ...jobData },
			{ removeOnComplete: true, removeOnFail: true },
		);

		cleanup();
		return res.status(200).json({ ok: true });
	} catch (error) {
		cleanup();
		console.error("ZIP upload error:", error);
		return res.status(500).json({
			error: error instanceof Error ? error.message : "Internal server error",
		});
	}
}
