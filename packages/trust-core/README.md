# @vvmp/trust-core

Core TypeScript/JavaScript helpers for VVMP manifests.

Use this package for manifest types, canonical JSON, semantic validation, manifest defaults, manifest summaries, safe helper variants, manifest signature records, trust-state derivation, and rendition recovery comparison.

```sh
npm install @vvmp/trust-core
```

```ts
import {
  VVMP_CORE_VERSION,
  appendSignature,
  summarizeManifestSafe,
  validateManifest,
  withManifestDefaults
} from "@vvmp/trust-core";

const manifest = withManifestDefaults({
  manifest_id: "urn:vvmp:manifest:example",
  video: {
    video_id: "video_001",
    title: "Example video",
    created_at: new Date().toISOString(),
    creator_type: "ai_assisted",
    visibility: "public",
    final_asset: {
      format: "video/mp4",
      duration_seconds: 30,
      sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  },
  creation: {
    workflow: "chat_to_video",
    human_oversight_level: "human_reviewed"
  }
});

const validation = validateManifest(manifest);
if (validation.valid) {
  console.log(VVMP_CORE_VERSION, summarizeManifestSafe(manifest));
}

const signed = appendSignature(manifest, {
  signer: "example-service",
  value: "external-signature-value"
});
```

`summarizeManifest()` and `deriveTrustStates()` assume `validateManifest(...).valid === true`. Use `summarizeManifestSafe()` and `deriveTrustStatesSafe()` when consuming incomplete or user-authored manifests.

Timeline segments must reference at least one of `source_ids`, `prompt_ids`, or `generation_event_ids`. `visibility` is intentionally a string in `trust-core`; integrations may pass product values such as `unlisted`, but should document how those map to public trust-page behavior.

Use `validateManifest(manifest, { profile: "draft" })` while a render is still pending. Draft validation allows an empty or omitted `video.final_asset.sha256`; `validateManifest(manifest, { profile: "production" })` requires a real 64-character SHA-256 digest, optionally prefixed with `sha256:`.

See the root repository package integration guide for the full package map.
