import type { ManifestSummary, VvmpManifest } from "./types";
import { validateManifest } from "./validate";

function guessAiInvolvement(manifest: VvmpManifest): string {
  const toolTypes = new Set(manifest.tools.map((tool) => tool.tool_type));

  if (toolTypes.size === 0) {
    return "no_ai";
  }

  if (toolTypes.has("language_model")) {
    return "ai_generated_with_human_approval";
  }

  return "ai_assisted";
}

function guessProfile(manifest: VvmpManifest): string {
  if (manifest.video.trust_code || manifest.links.trust_page) {
    if (Array.isArray(manifest.signatures) && manifest.signatures.length > 0) {
      return "embedded_provenance";
    }

    return "registry_backed";
  }

  return "core_manifest";
}

export function summarizeManifest(manifest: VvmpManifest): ManifestSummary {
  return {
    manifestId: manifest.manifest_id,
    title: manifest.video.title,
    trustCode: manifest.video.trust_code ?? null,
    durationSeconds: manifest.video.final_asset?.duration_seconds ?? 0,
    sourceCount: manifest.sources.length,
    promptCount: manifest.prompts.length,
    toolCount: manifest.tools.length,
    segmentCount: manifest.timeline.length,
    guardrailCount: manifest.guardrails.length,
    visibility: manifest.video.visibility,
    aiInvolvement: guessAiInvolvement(manifest),
    profileGuess: guessProfile(manifest)
  };
}

export function summarizeManifestSafe(manifest: unknown): ManifestSummary | null {
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    return null;
  }

  return summarizeManifest(manifest as VvmpManifest);
}
