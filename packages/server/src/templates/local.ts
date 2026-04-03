import type { CompleteTemplate } from "./processors";

export interface LocalTemplateMetadata {
	id: string;
	name: string;
	description: string;
	version: string;
	logo: string;
	tags: string[];
	links: {
		github: string;
		website?: string;
		docs?: string;
	};
	isLocal: true;
}

interface LocalTemplate {
	metadata: Omit<LocalTemplateMetadata, "isLocal">;
	config: CompleteTemplate;
	dockerCompose: string;
}

// ============================================================================
// Registry — add local templates here when needed.
// Each entry key must match the template's metadata.id.
// ============================================================================
const LOCAL_TEMPLATES: Record<string, LocalTemplate> = {};

/**
 * Returns metadata for all bundled local templates.
 * Shape matches fetchTemplatesList() so the UI can merge them with remote ones.
 */
export async function getLocalTemplatesList(): Promise<LocalTemplateMetadata[]> {
	return Object.values(LOCAL_TEMPLATES).map((t) => ({
		...t.metadata,
		isLocal: true as const,
	}));
}

/**
 * Returns the full config + docker-compose string for a local template.
 * Returns null if `id` is not a known local template.
 */
export async function getLocalTemplateFiles(
	id: string,
): Promise<{ config: CompleteTemplate; dockerCompose: string } | null> {
	const template = LOCAL_TEMPLATES[id];
	if (!template) return null;
	return { config: template.config, dockerCompose: template.dockerCompose };
}

/** True if `id` belongs to a bundled local template. */
export function isLocalTemplate(id: string): boolean {
	return id in LOCAL_TEMPLATES;
}
