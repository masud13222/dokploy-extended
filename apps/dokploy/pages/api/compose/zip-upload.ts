import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import {
	findComposeById,
	updateCompose,
	validateRequest,
} from "@dokploy/server";
import AdmZip from "adm-zip";
import type { NextApiRequest, NextApiResponse } from "next";
import { myQueue } from "@/server/queues/queueSetup";
import type { DeploymentJob } from "@/server/queues/queue-types";

export const config = {
	api: {
		bodyParser: false,
		responseLimit: false,
	},
};

const COMPOSE_FILENAMES = [
	"docker-compose.yml",
	"docker-compose.yaml",
	"compose.yml",
	"compose.yaml",
];

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

	// Stream ZIP to a temp file
	const tmpDir = os.tmpdir();
	const tmpFile = path.join(tmpDir, `compose-zip-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);

	const cleanup = () => {
		try {
			if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
		} catch (_) {}
	};

	// Cleanup on client disconnect
	req.on("close", cleanup);

	try {
		const writeStream = fs.createWriteStream(tmpFile);
		await pipeline(req, writeStream);

		// Parse ZIP and find docker-compose file
		const zip = new AdmZip(tmpFile);
		const entries = zip.getEntries();

		let composeContent: string | null = null;

		for (const entry of entries) {
			if (entry.isDirectory) continue;
			const filename = entry.entryName.split("/").filter(Boolean).pop()?.toLowerCase();
			if (filename && COMPOSE_FILENAMES.includes(filename)) {
				composeContent = entry.getData().toString("utf-8");
				break;
			}
		}

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
