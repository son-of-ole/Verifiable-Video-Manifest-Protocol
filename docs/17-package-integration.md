# Package Integration Guide

VVMP is intended to be consumed in two ways:

- as a language-neutral protocol bundle through the schemas, OpenAPI contract, fixtures, error catalog, and conformance tests
- as a set of npm packages that TypeScript and JavaScript projects can install directly

The monorepo root stays private because it contains apps, fixtures, scripts, and test infrastructure. The reusable packages under `packages/*` are publishable package units.

## Package Map

| Package | Use it when another project needs |
| --- | --- |
| `@vvmp/trust-core` | Manifest types, canonical JSON, semantic validation, summaries, and rendition recovery comparison |
| `@vvmp/trust-schema` | Packaged JSON Schemas, JSON-LD context, registries, examples, and schema validation helpers |
| `@vvmp/trust-capture-sdk` | Event-first capture APIs for building deterministic VVMP manifests from app activity |
| `@vvmp/policy-pack-sdk` | Policy-pack definitions and execution against manifests, segments, sources, prompts, tools, and assets |
| `@vvmp/trust-registry` | A file-backed reference registry for manifests, trust codes, asset hashes, and recovery locators |
| `@vvmp/trust-registry-client` | An HTTP client for VVMP-compatible registry APIs |
| `@vvmp/trust-c2pa-adapter` | C2PA export, read, prototype sidecars, trust profiles, trust-program helpers, and trustmark helpers |
| `@vvmp/trust-cli` | The `trust` command for validation, publication, recovery, C2PA export, and verification workflows |

## Install

After the packages are published, consumers can install only the pieces they need:

```sh
npm install @vvmp/trust-core @vvmp/trust-schema
```

Capture-focused projects usually want:

```sh
npm install @vvmp/trust-capture-sdk @vvmp/trust-schema
```

Registry or verification projects usually want:

```sh
npm install @vvmp/trust-registry-client @vvmp/trust-c2pa-adapter @vvmp/trust-cli
```

All packages currently target Node.js 20 or newer. The libraries are CommonJS builds with TypeScript declaration files and package `exports` entries.

## Minimal Consumer Example

```ts
import { validateManifest, summarizeManifest } from "@vvmp/trust-core";
import { readManifestSchema } from "@vvmp/trust-schema";

const schema = await readManifestSchema();
console.log(schema.$id);

const validation = validateManifest(manifest);
if (!validation.valid) {
  throw new Error(validation.issues.map((issue) => issue.code).join(", "));
}

console.log(summarizeManifest(manifest));
```

## Capture SDK Example

```ts
import { createTrustSession } from "@vvmp/trust-capture-sdk";

const trust = createTrustSession({ sessionId: "render-job-123" });

trust.logPrompt({
  prompt_id: "prompt_001",
  prompt_type: "user_prompt",
  visibility: "public",
  text: "Create a short explainer video",
  created_by: "user",
  created_at: new Date().toISOString()
});

trust.logTool({
  tool_id: "tool_001",
  tool_type: "video_model",
  provider: "Example Provider",
  model_identifier: "example-video-v1",
  purpose: "generation"
});

const manifest = trust.buildManifest({
  manifestId: "urn:vvmp:manifest:render-job-123",
  video: {
    video_id: "video_123",
    title: "Example render",
    created_at: new Date().toISOString(),
    creator_type: "ai_assisted",
    visibility: "public",
    final_asset: {
      format: "video/mp4",
      duration_seconds: 30,
      sha256: "sha256:replace-with-real-digest"
    }
  },
  creation: {
    workflow: "chat_to_video",
    human_oversight_level: "human_reviewed"
  }
});
```

## CLI Example

```sh
npx trust validate manifest.json
npx trust summarize manifest.json
npx trust verify-c2pa output.mp4
```

## Local Package Verification

Before publishing, run:

```sh
npm run verify:package-install
```

That command builds the repo, packs every reusable workspace package into tarballs, installs those tarballs into a temporary fresh npm project, imports every public package, reads packaged schema artifacts, constructs a capture session, constructs a file registry, and verifies that the installed `trust` CLI resolves.

To only produce tarballs for inspection:

```sh
npm run pack:packages
```

Set `VVMP_KEEP_PACKAGE_CHECK=1` if you want the temporary package-check workspace to remain on disk.

## Publishing

The repository includes two publish paths:

```sh
npm run publish:packages
```

That script publishes only the reusable `packages/*` workspaces and skips any package version that is already present on npm. The apps under `apps/*` remain private deployable reference applications.

To validate the publish package set without uploading anything:

```sh
node scripts/publish-packages.mjs --dry-run
```

For GitHub Actions trusted publishing, this repo includes `.github/workflows/publish.yml`. Configure each package on npm with:

- Organization or user: `son-of-ole`
- Repository: `Verifiable-Video-Manifest-Protocol`
- Workflow filename: `publish.yml`

The workflow uses GitHub OIDC with `id-token: write`, runs the fresh-project package install smoke test, and then publishes the reusable workspaces. npm automatically attaches provenance for public packages published from a public repository through trusted publishing.

For a local first publish, log in with an npm account that can create or publish under `@vvmp`, then run:

```sh
npm login
npm run verify:package-install
npm run publish:packages
```

## Language-Neutral Integration

Projects that are not JavaScript-based should start with:

- `spec/vvmp-v1-draft.md`
- `schemas/vvmp-manifest.v1.json`
- `schemas/vvmp-event-envelope.v1.json`
- `schemas/vvmp-rendition-observation.v1.json`
- `schemas/vvmp-c2pa-signing-profile.v1.json`
- `openapi/registry-v1.yaml`
- `errors/error-codes.json`
- `test-fixtures/conformance/README.md`

Those artifacts remain the source of interoperability. The npm packages are the reference implementation, not the protocol boundary.
