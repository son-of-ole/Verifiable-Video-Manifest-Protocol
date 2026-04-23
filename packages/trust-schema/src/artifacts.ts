import { promises as fs } from "node:fs";
import path from "node:path";

export const VVMP_MANIFEST_SCHEMA_FILE = "vvmp-manifest.v1.json";
export const VVMP_EVENT_ENVELOPE_SCHEMA_FILE = "vvmp-event-envelope.v1.json";
export const VVMP_RENDITION_OBSERVATION_SCHEMA_FILE = "vvmp-rendition-observation.v1.json";
export const VVMP_JSONLD_CONTEXT_FILE = "vvmp-context.v1.jsonld";

export const REGISTRY_ARTIFACT_FILES = [
  "claim-types.v1.json",
  "extension-ids.v1.json",
  "hash-algorithms.v1.json",
  "policy-pack-ids.v1.json",
  "source-types.v1.json",
  "tool-types.v1.json"
] as const;

export type RegistryArtifactFile = (typeof REGISTRY_ARTIFACT_FILES)[number];

function packageRoot() {
  return path.resolve(__dirname, "..");
}

export function getManifestSchemaPath() {
  return path.join(packageRoot(), "schemas", VVMP_MANIFEST_SCHEMA_FILE);
}

export function getEventEnvelopeSchemaPath() {
  return path.join(packageRoot(), "schemas", VVMP_EVENT_ENVELOPE_SCHEMA_FILE);
}

export function getRenditionObservationSchemaPath() {
  return path.join(packageRoot(), "schemas", VVMP_RENDITION_OBSERVATION_SCHEMA_FILE);
}

export function getJsonLdContextPath() {
  return path.join(packageRoot(), "contexts", VVMP_JSONLD_CONTEXT_FILE);
}

export function getRegistryArtifactPath(fileName: RegistryArtifactFile) {
  return path.join(packageRoot(), "registries", fileName);
}

export async function readJsonArtifact<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function readManifestSchema<T = Record<string, unknown>>() {
  return readJsonArtifact<T>(getManifestSchemaPath());
}

export async function readEventEnvelopeSchema<T = Record<string, unknown>>() {
  return readJsonArtifact<T>(getEventEnvelopeSchemaPath());
}

export async function readRenditionObservationSchema<T = Record<string, unknown>>() {
  return readJsonArtifact<T>(getRenditionObservationSchemaPath());
}

export async function readJsonLdContext<T = Record<string, unknown>>() {
  return readJsonArtifact<T>(getJsonLdContextPath());
}

export async function readRegistryArtifact<T = Record<string, unknown>>(
  fileName: RegistryArtifactFile
) {
  return readJsonArtifact<T>(getRegistryArtifactPath(fileName));
}
