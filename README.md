# Verifiable Video Manifest Protocol (VVMP)

VVMP is an open-source provenance and trust layer for AI-generated and AI-assisted video.

Its purpose is not to judge whether a video is good, bad, true, official, or trustworthy in a moral sense. Its purpose is to make a video's creation record inspectable, portable, cryptographically verifiable, and useful to both humans and software.

## Install The SDK

For most JavaScript or TypeScript integrations, start with `@vvmp/trust-core`:

```sh
npm install @vvmp/trust-core
```

```ts
import {
  VVMP_CORE_VERSION,
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

console.log(`vvmp-trust-core@${VVMP_CORE_VERSION}`, validateManifest(manifest));
```

Install `@vvmp/trust-schema` only when your app needs packaged JSON Schemas, JSON-LD context, examples, registries, or schema-tooling artifacts. If you only need runtime semantic validation, canonical JSON, summaries, defaults, and signature helpers, `@vvmp/trust-core` is enough.

Pre-render pipelines can validate draft manifests before the final video hash exists:

```ts
validateManifest(manifest, { profile: "draft" });
```

Before publishing a production trust page, use `validateManifest(manifest, { profile: "production" })`; production validation requires a real 64-character SHA-256 digest, optionally prefixed with `sha256:`.

VVMP is designed to build on top of C2PA rather than compete with it:

- C2PA provides interoperable content provenance, manifests, assertions, claims, signatures, and content bindings.
- VVMP adds rich video-specific provenance for timecoded source mapping, prompt history, edit history, guardrail events, model and tool disclosure, rights metadata, and public trust page rendering.

## What VVMP Should Answer

For any supported video, VVMP should help answer:

1. Where did this video come from?
2. What sources were used?
3. What prompt created it?
4. Which models and tools generated each part?
5. What did a human edit?
6. Which guardrails reviewed it?
7. What parts are quoted, paraphrased, AI-generated, or user-authored?
8. Was the final asset changed after signing?
9. Can an independent verifier validate it?

## Project Principles

- Use C2PA as the base provenance and signing layer.
- Keep the core protocol domain-neutral.
- Treat faith, newsroom, education, marketplace, and safety rules as optional policy packs.
- Support both public transparency and privacy-preserving redaction.
- Design for both embedded provenance and metadata-loss recovery.
- Make verification possible without trusting a single hosted UI.

## Planned Monorepo Modules

- `packages/trust-schema`
  JSON Schema, JSON-LD context, TypeScript types, manifest validation rules
- `packages/trust-capture-sdk`
  App SDK for logging sources, prompts, generations, edits, guardrails, and renders
- `packages/trust-c2pa-adapter`
  Conversion from VVMP manifest data into C2PA assertions and signed manifests
- `packages/trust-registry-client`
  Client library for publishing to and querying a manifest registry
- `apps/trust-viewer`
  Public trust page UI and technical verifier UX
- `apps/trust-registry`
  Remote manifest repository and verification API
- `packages/trust-cli`
  Independent CLI for inspect, verify, extract, compare, and sign flows
- `packages/policy-pack-sdk`
  Policy pack interface for domain-specific checks

## Documentation Map

- [Product vision](docs/01-product-vision.md)
- [System architecture](docs/02-system-architecture.md)
- [Manifest schema and data model](docs/03-manifest-schema.md)
- [Development plan](docs/04-development-plan.md)
- [MVP roadmap](docs/05-mvp-roadmap.md)
- [Security, privacy, and trust states](docs/06-security-privacy-and-verification.md)
- [Implementation playbook](docs/07-implementation-playbook.md)
- [Stack-neutral interoperability plan](docs/08-stack-neutral-interoperability.md)
- [Protocol spec outline](docs/09-protocol-spec-outline.md)
- [Conformance suite](docs/10-conformance-suite.md)
- [Registry API spec](docs/11-registry-api-spec.md)
- [Extension and policy-pack spec](docs/12-extension-and-policy-pack-spec.md)
- [Multi-language implementation guide](docs/13-multi-language-implementation.md)
- [Error catalog](docs/14-error-catalog.md)
- [CLI and C2PA prototype](docs/15-cli-and-c2pa-prototype.md)
- [Real C2PA integration](docs/16-real-c2pa-integration.md)
- [Package integration guide](docs/17-package-integration.md)
- [Changelog](CHANGELOG.md)

## Examples

- [Examples index](examples/README.md)
- [Chat-to-video end-to-end example](examples/chat-to-video/README.md)

## Language-Neutral Artifacts

VVMP is intended to be implementable across stacks. The reference TypeScript and Next.js code in this repo is helpful, but it is not the protocol definition.

The primary cross-stack artifacts are:

- [Draft protocol spec](spec/vvmp-v1-draft.md)
- [Root JSON Schema](schemas/vvmp-manifest.v1.json)
- [Root event-envelope schema](schemas/vvmp-event-envelope.v1.json)
- [Root rendition-observation schema](schemas/vvmp-rendition-observation.v1.json)
- [Root C2PA signing-profile schema](schemas/vvmp-c2pa-signing-profile.v1.json)
- [Registry OpenAPI draft](openapi/registry-v1.yaml)
- [Machine-readable error catalog](errors/error-codes.json)
- [Conformance fixtures](test-fixtures/conformance/README.md)

These artifacts are the intended starting point for Python, Rust, Go, Swift, Java, .NET, and other implementations.

The reference `@vvmp/trust-schema` package now also ships:

- the packaged manifest schema
- the packaged event-envelope schema
- a JSON-LD context
- example manifests for faith, newsroom, and education workflows
- an example capture event log
- an example rendition-observation payload for recovery comparisons
- machine-readable registries for claim types, source types, tool types, policy-pack IDs, extension IDs, and hash algorithms

That package is intended to make the protocol artifacts easier to consume without requiring callers to know the repo layout.

## Package Consumption

The reusable TypeScript/JavaScript libraries under `packages/*` are configured as publishable npm packages. The monorepo root remains private because it contains reference apps, fixtures, and verification infrastructure.

The main install surfaces are:

- `@vvmp/trust-core` for manifest validation, canonicalization, summaries, and recovery comparison
- `@vvmp/trust-schema` for packaged schemas, examples, registries, and schema validation helpers
- `@vvmp/trust-capture-sdk` for event-first capture and manifest assembly
- `@vvmp/policy-pack-sdk` for domain-specific policy packs
- `@vvmp/trust-registry` and `@vvmp/trust-registry-client` for local and remote registry integration
- `@vvmp/trust-c2pa-adapter` for C2PA export, read, trust-profile, and trustmark helpers
- `@vvmp/trust-cli` for the `trust` command

Run `npm run verify:package-install` before publishing or embedding. It builds the repo, packs the reusable workspaces, installs them into a fresh temporary npm project, imports every public package, reads packaged schema artifacts, constructs a capture session, constructs a file registry, and verifies that the installed `trust` CLI resolves.

See [Package integration guide](docs/17-package-integration.md) for install examples, package roles, and publishing notes.

## Current Working Surface

The repository now includes a first working reference stack:

- a draft protocol spec
- a language-neutral JSON Schema and OpenAPI contract
- a packaged `trust-schema` surface with manifest and event-envelope schemas, a JSON-LD context, example artifacts, and registry artifacts
- manifest, canonicalization, and signed-manifest fixtures
- three independent conformance runners
- a TypeScript validator and summary layer
- an event-first capture SDK that assembles deterministic manifests
- a file-backed reference registry plus a Next.js registry app
- a transport-level registry client for HTTP-based registry implementations
- a policy-pack SDK for domain-specific review logic and guardrail emission
- a Next.js trust viewer reference app
- a `trust` CLI
- a prototype sidecar signer and verifier
- a first real C2PA embed/export/read integration
- a runnable end-to-end `examples/chat-to-video` workflow that captures events, assembles a manifest, publishes it, and resolves a trust code
- recovery support for QR recovery cards and rendition comparison
- optional registry-backed recovery hooks for watermark and fingerprint locators
- a reference PNG trustmark recovery lane with model caching, locator-bit generation, encode/decode, and registry-backed watermark resolution
- a GitHub Actions CI workflow that runs the repository verification contract
- publish-ready package metadata and a fresh-project package install smoke test
- integrator-focused `trust-core` helpers for package version access, manifest defaults, safe summaries, field-level types, and manifest signature records

## Current CLI Surface

The `trust` CLI currently supports:

- `trust validate <manifest.json>`
- `trust summarize <manifest.json>`
- `trust inspect <manifest.json>`
- `trust canonicalize <json-file>`
- `trust extract <asset>`
- `trust generate-trustmark-bits`
- `trust encode-trustmark <image-file>`
- `trust decode-trustmark <image-file>`
- `trust recover-trustmark <image-file>`
- `trust derive-trust-profile <certificate.pem>`
- `trust materialize-signing-profile`
- `trust doctor-trusted-lane`
- `trust sync-trust-program <official-c2pa|interim>`
- `trust publish <manifest.json>`
- `trust compare <local.json> [remote.json]`
- `trust register-recovery-locator <manifest.json> --method <watermark|fingerprint> --value <locator>`
- `trust resolve-recovery-locator <method> <value>`
- `trust compare-rendition <manifest.json> <observation.json>`
- `trust render-recovery-card <manifest.json> --out <file>`
- `trust verify <asset>`
- `trust sign <asset> <manifest.json>`
- `trust verify-prototype <sidecar.json>`
- `trust export-prototype <manifest.json> --out <file> --signer <name>`
- `trust export-c2pa <manifest.json> --input <asset> --out <asset> --certificate <pem> --private-key <pem>`
- `trust export-c2pa <manifest.json> --input <asset> --out <asset> --signing-profile <profile.json>`
- `trust verify-c2pa <asset> [--manifest-data <file>]`

The generic `extract`, `verify`, and `sign` commands are convenience aliases over the underlying C2PA read and export flows so the CLI still matches the simpler docs-facing command shape.

The C2PA verification command now returns a structured verification summary that separates:

- manifest presence
- content-binding validity
- signature validity
- trust-chain status

VVMP now also supports an opt-in local trust-profile layer for CI or controlled environments:

- `trust derive-trust-profile <certificate.pem>` derives a VVMP trust-profile document from a signer certificate
- `trust verify-c2pa <asset> --vvmp-trust-profile <json-file>` evaluates that approved signer profile alongside raw C2PA verification

That local trust-profile result is intentionally separate from the raw C2PA `trust_state`. The repository keeps the upstream C2PA result honest and only marks the VVMP local profile as trusted when the validated signer metadata matches an explicitly approved signer record.

The reference CLI also now supports `--settings-file` correctly for C2PA verification settings, and the repository includes a verification-matrix smoke path that locks in:

- a known-good official ES256 valid-signature untrusted C2PA lane
- a VVMP local trust-profile lane that marks that same signer as locally trusted
- the current self-signed negative cases

VVMP now also includes trust-program-aware C2PA support:

- bundled snapshots of the official C2PA trust list and the legacy interim trust list under [test-fixtures/c2pa-trust-programs/README.md](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/test-fixtures/c2pa-trust-programs/README.md:1)
- `trust sync-trust-program <program>` to refresh trust artifacts into a local cache
- `trust verify-c2pa <asset> --trust-program <official-c2pa|interim>` to use a preset trust-program configuration
- `trust export-c2pa <manifest> --signing-profile <profile.json>` to sign through a reusable C2PA signing profile, including optional TSA configuration
- `trust materialize-signing-profile --out-dir <dir>` to write a reusable signing profile plus PEM files from local files or CI/local environment variables
- `trust doctor-trusted-lane` to sign and verify a sample asset through the configured trusted lane and report whether the result is actually trusted

The real trusted lane is intentionally BYO-credential:

- the repository can now drive a true trust-program-backed signing and verification flow when you supply a trust-program-issued signing profile
- the repository does not vendor a conforming private key or end-entity cert chain
- the default smoke path proves the trust-program preset and cache wiring and also proves profile materialization using the public ES256 fixture chain
- the fully trusted result activates when either `VVMP_TRUSTED_C2PA_SIGNING_PROFILE` is configured or the repository can materialize one from `VVMP_TRUSTED_C2PA_CERTIFICATE_PEM(_B64)` and `VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM(_B64)`

The GitHub Actions workflow now forwards those optional environment variables into `npm run verify:e2e`, so the trusted lane can turn on in CI without checking any credential material into the repository. GitHub documents that an unset secret resolves to an empty string in Actions, which keeps this lane safely optional. [GitHub Docs](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions)

The current C2PA export path also maps VVMP lineage into:

- C2PA `ingredients` for sources, prompts, and identifiable assets
- VVMP lineage assertions for sources, segments, and tools

When local file paths are present in those records, export upgrades them to file-backed ingredients instead of metadata-only placeholders.

The current smoke path now proves that with real PNG, WAV, and MP4 ingredient files, and it now also verifies real embedded MP4 output signing in addition to image output signing.

It also now checks multi-segment lineage across multiple sources, prompts, and assets so the implementation stays aligned with VVMP’s segment-level provenance goal.

That coverage now includes edit and guardrail lineage as part of the signed C2PA-side payload too.

The CLI now supports both:

- local file-backed registry workflows through `--registry-dir`
- remote HTTP registry workflows through `--registry-url` and optional `--api-token`

It also now supports recovery-focused workflows:

- rendering a visible trust-code and QR SVG card for a manifest
- comparing a reposted or re-encoded observed copy to a manifest through a rendition-observation record
- generating trustmark-compatible watermark locator bitstrings
- encoding and decoding reference PNG trustmarks through the official C2PA Trustmark runtime
- decoding a trustmark from an image and resolving it through the registry as a `watermark` locator

## Current Capture SDK Surface

The reference `@vvmp/trust-capture-sdk` package now supports:

- append-only event logging
- idempotent event ingestion via idempotency keys
- event export through a language-neutral envelope
- deterministic manifest assembly from captured events
- simple public redaction transforms during manifest build
- policy-pack execution against the current manifest state
- automatic guardrail logging from policy results
- automatic policy-extension registration during manifest build

The primary session API is:

```ts
const trust = createTrustSession({ sessionId: "sess_001" });

trust.logSource(...)
trust.logPrompt(...)
trust.logTool(...)
trust.logAsset(...)
trust.logGeneration(...)
trust.logSegment(...)
trust.logEdit(...)
trust.logGuardrail(...)
trust.logRights(...)
trust.logRender(...)
trust.logPublication(...)
await trust.runPolicyPack(...)

const manifest = trust.buildManifest(...)
```

## Current Schema Surface

The reference `@vvmp/trust-schema` package now supports:

- packaged access to the VVMP manifest schema
- packaged access to the VVMP event-envelope schema
- packaged access to the VVMP JSON-LD context
- machine-readable registry files for core protocol enumerations
- example manifests for common workflow shapes
- an example event log for capture-session interoperability
- an example rendition-observation payload for recovery interoperability
- validation helpers layered over the reference validator
- event-envelope validation helpers
- rendition-observation validation and recovery helpers
- trust-state, visibility, and claim-type enums for adapter authors

## Current Registry Surface

The reference registry now supports:

- publish manifest lineage versions
- optional publish-time policy-pack execution
- resolve trust codes to current versions
- fetch manifest records by manifest ID or trust code
- public-view sanitization for redacted or non-public prompt and source fields
- restricted full-manifest access in the reference app through bearer-token auth
- return append-only version history
- verify by manifest payload, manifest ID, trust code, or asset hash
- register and resolve watermark or fingerprint recovery locators
- serve a basic public trust-page route at `/v/[trustCode]`

The current trustmark reference lane is intentionally scoped:

- it targets image recovery first, with PNG output in the current reference implementation
- it uses registry-resolvable watermark bitstrings rather than human-readable text payloads
- it keeps watermarking optional at the protocol level while still providing a real working recovery adapter

The reference API routes are:

- `POST /api/v1/manifests`
- `GET /api/v1/manifests/[manifestId]`
- `GET /api/v1/manifests/[manifestId]/versions`
- `POST /api/v1/recovery-locators`
- `GET /api/v1/recovery-locators/[method]/[value]`
- `GET /api/v1/trust-codes/[trustCode]`
- `POST /api/v1/verify`
- `GET /api/v1/assets/[algorithm]/[value]`
- `GET /v/[trustCode]`

When `VVMP_REGISTRY_API_TOKEN` is configured in the reference Next.js registry app:

- `POST /api/v1/manifests` requires `Authorization: Bearer <token>`
- `POST /api/v1/recovery-locators` requires `Authorization: Bearer <token>`
- `GET /api/v1/manifests/[manifestId]?view=full` requires `Authorization: Bearer <token>`

## Current Registry Client Surface

The reference `@vvmp/trust-registry-client` package now supports:

- HTTP publish to a VVMP registry
- manifest fetch by manifest ID
- manifest history lookup
- trust-code resolution
- manifest fetch by trust code
- asset-hash lookup
- watermark and fingerprint recovery-locator registration and lookup
- verify requests across the registry API
- bearer-token auth for restricted registry operations

It is implemented as a transport client over the registry API contract, so the same package can be used against the Next.js reference registry or another compatible implementation in a different stack.

## Current Viewer Surface

The reference `apps/trust-viewer` app now supports:

- a fixture index at `/`
- manifest routes at `/manifest/[manifestId]`
- trust-code routes at `/v/[trustCode]`
- trust summary banners
- source lists
- timeline source-map rendering
- guardrail summaries
- redaction notices
- version history cards
- technical verifier panes with validation output and raw JSON
- recovery panels with visible trust codes, QR target URLs, and rendition caveats
- browser-level Playwright coverage for fixture index, trust-code pages, and redacted manifest pages

## Current Policy-Pack SDK Surface

The reference `@vvmp/policy-pack-sdk` package now supports:

- policy-pack metadata validation
- a standard policy-pack definition interface
- executable target-based policy checks
- conversion of policy check results into VVMP guardrail records
- policy extension declaration helpers for manifest integration
- manifest-derived execution targets for sources, prompts, tools, assets, segments, and whole-manifest checks
- helpers for appending policy execution output back into manifests

The reference smoke path currently proves:

- one example faith-oriented pack definition
- per-target execution across multiple checks
- public-summary requirements
- generation of VVMP-compatible guardrail records
- integration into `trust-capture-sdk`
- integration into registry publish flow

## End-to-End Verification

The full repository verification path is:

- `npm run verify:e2e`

The browser trust-page suite can also be run directly with:

- `npm run test:viewer:e2e`

On a machine that has not used Playwright before, install Chromium once with:

- `npx playwright install chromium`

That currently runs:

- cross-runtime conformance
- workspace builds
- trust-schema smoke verification
- fixture-backed viewer route build verification
- end-to-end example smoke verification
- recovery smoke verification
- policy-pack smoke verification
- registry smoke verification
- registry-client smoke verification
- registry CLI smoke verification
- capture-sdk smoke verification
- a smoke test that exercises prototype verification plus real C2PA embedded and detached flows
- Playwright trust-page tests against the built `trust-viewer` app
