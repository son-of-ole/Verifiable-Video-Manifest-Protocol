import path from "node:path";
import type { VvmpManifest } from "@vvmp/trust-core";
import { readJsonArtifact } from "./artifacts";

export const EXAMPLE_MANIFEST_FILES = [
  "education-lesson.redacted.json",
  "faith-chat-to-video.public.json",
  "newsroom-explainer.public.json"
] as const;

export const EXAMPLE_EVENT_LOG_FILES = [
  "chat-to-video.event-log.json"
] as const;

export const EXAMPLE_RENDITION_OBSERVATION_FILES = [
  "recovered-copy.rendition-observation.json"
] as const;

export type ExampleManifestFile = (typeof EXAMPLE_MANIFEST_FILES)[number];
export type ExampleEventLogFile = (typeof EXAMPLE_EVENT_LOG_FILES)[number];
export type ExampleRenditionObservationFile =
  (typeof EXAMPLE_RENDITION_OBSERVATION_FILES)[number];

function examplesRoot() {
  return path.resolve(__dirname, "..", "examples");
}

export function getExampleManifestPath(fileName: ExampleManifestFile) {
  return path.join(examplesRoot(), fileName);
}

export function getExampleEventLogPath(fileName: ExampleEventLogFile) {
  return path.join(examplesRoot(), fileName);
}

export function getExampleRenditionObservationPath(fileName: ExampleRenditionObservationFile) {
  return path.join(examplesRoot(), fileName);
}

export async function readExampleManifest(fileName: ExampleManifestFile): Promise<VvmpManifest> {
  return readJsonArtifact<VvmpManifest>(getExampleManifestPath(fileName));
}

export async function readExampleEventLog(fileName: ExampleEventLogFile) {
  return readJsonArtifact<Array<Record<string, unknown>>>(getExampleEventLogPath(fileName));
}

export async function readExampleRenditionObservation(fileName: ExampleRenditionObservationFile) {
  return readJsonArtifact<Record<string, unknown>>(getExampleRenditionObservationPath(fileName));
}
