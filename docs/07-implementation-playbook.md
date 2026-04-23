# VVMP Implementation Playbook

## Purpose

This document turns the high-level VVMP plan into a concrete engineering sequence.

Use it as the starting point when implementation begins.

## Phase 0: Bootstrap the Monorepo

Create the repository structure first.

Target layout:

```text
.
├── apps
│   ├── trust-registry
│   └── trust-viewer
├── docs
├── examples
│   └── chat-to-video
├── packages
│   ├── policy-pack-sdk
│   ├── trust-c2pa-adapter
│   ├── trust-capture-sdk
│   ├── trust-cli
│   ├── trust-registry-client
│   └── trust-schema
└── test-fixtures
    ├── manifests
    └── media
```

Initial root files:

- `package.json`
- npm workspace configuration in `package.json`
- `tsconfig.base.json`
- `.editorconfig`
- `.gitignore`
- CI workflow files
- optional task-runner config such as `turbo.json` or `nx.json` if the repo later outgrows plain workspace scripts

Reference implementation note:

- the repository now uses npm workspaces directly from the root `package.json`
- the repository now includes `.github/workflows/ci.yml` to execute the end-to-end verification contract in GitHub Actions
- additional examples such as `faith-app` or `newsroom-publish` remain optional future surfaces rather than required bootstrap directories

## Phase 1: Build `trust-schema`

This is the first package that should exist.

### Deliverables

- versioned schema files
- TypeScript exports
- validation helpers
- fixture manifests
- trust-state enums

### Recommended internal structure

```text
packages/trust-schema
├── src
│   ├── index.ts
│   ├── manifest.ts
│   ├── objects
│   │   ├── asset.ts
│   │   ├── edit.ts
│   │   ├── guardrail.ts
│   │   ├── prompt.ts
│   │   ├── render.ts
│   │   ├── source.ts
│   │   ├── timeline.ts
│   │   ├── tool.ts
│   │   └── video.ts
│   └── enums
│       ├── claim-type.ts
│       ├── trust-state.ts
│       └── visibility.ts
└── schemas
    └── vvmp-manifest.v1.json
```

### Engineering tasks

1. Define minimal manifest shape.
2. Add object-by-object validators.
3. Define canonical serialization rules for signed and hashed data.
4. Add schema snapshots in tests.
5. Add three fixture manifests.
6. Add validation error formatting.

### Required fixtures

- `faith-chat-to-video.public.json`
- `newsroom-explainer.public.json`
- `education-lesson.redacted.json`

### Required protocol artifacts

These should ship before VVMP claims real interoperability:

- `docs/specification.md` or equivalent protocol text
- canonicalization test vectors
- hash-input examples
- validation error catalog
- required field profile definitions

## Phase 1.5: Build the Conformance Suite

This is the most important improvement for cross-stack adoption.

The conformance suite should let teams building in Go, Python, Rust, Java, Swift, Kotlin, Ruby, or .NET confirm that they implemented VVMP correctly.

### Deliverables

- fixture manifests that should pass
- fixture manifests that should fail
- expected normalized outputs
- expected hash outputs
- expected trust-state outputs

### Recommended structure

```text
test-fixtures
├── conformance
│   ├── invalid
│   ├── valid
│   ├── normalized
│   └── hashes
└── manifests
```

### Engineering tasks

1. Define canonical serialization examples.
2. Add expected hash outputs for fixture payloads.
3. Add expected validation result files.
4. Add expected trust-state summaries.
5. Document how third-party implementations should run the suite.

## Phase 2: Build `trust-capture-sdk`

The SDK should produce event logs first, manifests second.

### Core interfaces

```ts
type SourceEvent
type PromptEvent
type ToolEvent
type GenerationEvent
type EditEvent
type GuardrailEvent
type RightsEvent
type RenderEvent
type PublicationEvent
```

### Core API

```ts
const trust = createTrustSession(...)

trust.logSource(...)
trust.logPrompt(...)
trust.logTool(...)
trust.logGeneration(...)
trust.logEdit(...)
trust.logGuardrail(...)
trust.logRights(...)
trust.logRender(...)

const manifest = trust.buildManifest(...)
```

### Engineering tasks

1. Implement session lifecycle.
2. Implement append-only in-memory log.
3. Implement deterministic manifest assembly.
4. Implement redaction transforms.
5. Export normalized manifest output.

### Important rule

Do not let apps hand-author final manifests as raw JSON if you can avoid it. Encourage event capture plus builder output so provenance remains internally coherent.

### Stack-neutral rule

The TypeScript SDK is a reference implementation, not the normative interface.

VVMP should also document:

- a language-neutral event envelope
- required event fields
- ordering rules
- idempotency expectations
- how event logs turn into canonical manifests

## Phase 3: Build `trust-cli`

The CLI is the fastest independent verifier surface.

### First commands

```bash
trust validate manifest.json
trust summarize manifest.json
trust inspect manifest.json
```

### Second commands

```bash
trust publish manifest.json
trust compare local.json remote.json
trust extract video.mp4
```

### CLI output goals

- concise summary for humans
- machine-readable JSON output for automation
- clear validation errors
- stable exit codes for automation in any environment

### Engineering tasks

1. Add argument parsing.
2. Wire validation to `trust-schema`.
3. Add summary formatter.
4. Add technical JSON inspection mode.
5. Add fixture-based golden tests.

## Phase 4: Build `trust-viewer`

This app should render fixture manifests before registry integration is complete.

### Must-have routes

- `/v/[trustCode]`
- `/manifest/[manifestId]`

### Must-have sections

- trust summary banner
- source list
- segment timeline
- guardrail summary
- AI disclosure
- technical JSON pane

### UX rule

The trust page should not imply truth certification. It should clearly explain provenance, disclosure, and verification state.

### Engineering tasks

1. Build fixture-backed pages first.
2. Add timeline explorer.
3. Add public redaction indicators.
4. Add technical verifier panel.
5. Add manifest version history UI shell.

Reference implementation note:

- the repository now includes the first fixture-backed `trust-viewer` routes, redaction indicators, verifier panel, version-history shell, and Playwright trust-page coverage

## Phase 5: Build `trust-registry`

This is the publication and lookup surface.

### Minimum data model

- manifests
- manifest_versions
- trust_codes
- asset_hashes
- signers

### Minimum API

- publish manifest
- fetch manifest by ID
- fetch current version by trust code
- verify manifest metadata

### Engineering tasks

1. Define DB schema.
2. Implement publication endpoint.
3. Implement trust code lookup.
4. Implement version lineage.
5. Add auth model for private or restricted manifests later.

## Phase 6: Build `trust-c2pa-adapter`

This package should start after the VVMP schema and fixtures feel stable.

### Responsibilities

- map VVMP records into C2PA assertions
- emit AI disclosure data
- package custom VVMP assertion payload
- sign and embed when supported
- export sidecars when embedding is unavailable

### Engineering tasks

1. Define mapping spec document.
2. Build adapter input model from canonical manifest.
3. Implement sidecar export first.
4. Add embedding integration.
5. Add extraction and comparison tests.

## Phase 7: Build `policy-pack-sdk`

This package standardizes domain-specific review layers without hardcoding them into the core manifest.

### Responsibilities

- define policy pack interface
- define check result format
- define public summary requirements
- define policy metadata fields

### Example pack IDs

- `org.faith.lds`
- `org.news.election-integrity`
- `org.education.k12`

## Suggested Issue Breakdown

Open these as separate issues or milestones:

1. Bootstrap monorepo
2. Define vvmp manifest v1
3. Define canonical serialization rules
4. Add conformance fixtures
5. Build schema validator
6. Build capture session API
7. Build manifest builder
8. Build CLI validate and summarize
9. Build trust viewer fixture pages
10. Build registry publish and lookup
11. Define C2PA mapping spec
12. Add sidecar export
13. Add embedded manifest prototype

## First 2 Weeks Plan

### Week 1

- scaffold repo
- create `trust-schema`
- define canonical JSON and hashing rules
- create fixture manifests
- add validation tests

### Week 2

- create conformance suite
- create `trust-capture-sdk`
- create `trust-cli`
- wire CLI to fixtures
- create first static trust viewer page from fixture data

## Definition of Readiness for C2PA Work

Do not start deep C2PA integration until:

1. the canonical VVMP manifest shape feels stable
2. the fixture manifests cover real workflows
3. canonical serialization inputs are defined and tested
4. the CLI can already validate and summarize manifests
5. the viewer can already explain manifests to users

## Definition of Readiness for Public Release

VVMP is ready for an early developer release when:

1. the schema is versioned
2. the conformance suite is published
3. the capture SDK is usable
4. the CLI validates real manifests
5. the registry publishes and serves manifests
6. the viewer renders public trust pages
7. at least one example app is documented end to end

Reference implementation note:

- the repository now includes the first end-to-end example app flow in `examples/chat-to-video`
