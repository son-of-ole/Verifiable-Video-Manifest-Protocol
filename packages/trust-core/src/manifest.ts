import type {
  CreationRecord,
  FinalAsset,
  VvmpManifest,
  VideoRecord
} from "./types";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type ManifestDefaultsInput = DeepPartial<VvmpManifest>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultFinalAsset(): FinalAsset {
  return {
    format: "",
    duration_seconds: 0,
    sha256: ""
  };
}

function defaultVideo(): VideoRecord {
  return {
    video_id: "",
    title: "",
    created_at: nowIso(),
    creator_type: "",
    visibility: "public",
    final_asset: defaultFinalAsset()
  };
}

function defaultCreation(): CreationRecord {
  return {
    workflow: "",
    human_oversight_level: ""
  };
}

function defaultManifest(): VvmpManifest {
  return {
    manifest_version: "1.0.0-draft",
    manifest_id: "",
    video: defaultVideo(),
    creation: defaultCreation(),
    sources: [],
    prompts: [],
    tools: [],
    assets: [],
    timeline: [],
    edits: [],
    guardrails: [],
    rights: [],
    render: {},
    publication: {},
    redactions: [],
    signatures: [],
    links: {},
    extensions: []
  };
}

function mergeObject<T extends Record<string, unknown>>(base: T, input: unknown): T {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return base;
  }

  return {
    ...base,
    ...(input as Record<string, unknown>)
  } as T;
}

export function withManifestDefaults(input: ManifestDefaultsInput = {}): VvmpManifest {
  const manifest = defaultManifest();

  const withTopLevel = {
    ...manifest,
    ...clone(input),
    video: {
      ...manifest.video,
      ...clone(input.video ?? {}),
      final_asset: mergeObject(manifest.video.final_asset, input.video?.final_asset)
    },
    creation: mergeObject(manifest.creation, input.creation),
    sources: clone(input.sources ?? manifest.sources),
    prompts: clone(input.prompts ?? manifest.prompts),
    tools: clone(input.tools ?? manifest.tools),
    assets: clone(input.assets ?? manifest.assets),
    timeline: clone(input.timeline ?? manifest.timeline),
    edits: clone(input.edits ?? manifest.edits),
    guardrails: clone(input.guardrails ?? manifest.guardrails),
    rights: clone(input.rights ?? manifest.rights),
    render: mergeObject(manifest.render, input.render),
    publication: mergeObject(manifest.publication, input.publication),
    redactions: clone(input.redactions ?? manifest.redactions),
    signatures: clone(input.signatures ?? manifest.signatures),
    links: mergeObject(manifest.links, input.links),
    extensions: clone(input.extensions ?? manifest.extensions)
  };

  return withTopLevel as VvmpManifest;
}

export function createEmptyManifest(input: ManifestDefaultsInput = {}): VvmpManifest {
  return withManifestDefaults(input);
}
