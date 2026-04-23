# VVMP Development Plan

## Objective

Build VVMP as an open-source, C2PA-compatible provenance layer for AI-generated and AI-assisted video.

This plan assumes a docs-first, schema-first, SDK-first approach before deep media integration.

## Development Strategy

Build from the inside out:

1. Define the protocol.
2. Validate the data model with examples.
3. Build capture and inspection tooling.
4. Add registry and trust page UX.
5. Add signing and embedding.
6. Add recovery and ecosystem support.

## Recommended Technical Stack

The reference implementation can be opinionated, but the protocol itself must remain stack-neutral.

That means VVMP should always publish language-neutral artifacts before or alongside reference SDKs.

### Monorepo

- `pnpm`
- TypeScript
- Turborepo or Nx

### Runtime

- Node.js for most packages and apps
- Rust for signing, hashing, media inspection, or performance-critical verification later

### Apps

- Next.js for `trust-viewer` and `trust-registry` if a shared web stack is preferred
- PostgreSQL for manifest storage
- Object storage for sidecars, certificates, exported manifests, and media fixtures

### Validation and Testing

- `zod` or `typebox` plus JSON Schema generation
- Vitest for unit tests
- Playwright for end-to-end trust page tests

Reference implementation note:

- the repository now includes Playwright coverage for the fixture-backed trust viewer routes and their core public sections

## Proposed Initial Milestones

## Milestone 0: Repository Bootstrap

Create:

- monorepo scaffolding
- package boundaries
- base TypeScript config
- linting and formatting
- docs site or docs index

Deliverables:

- root workspace config
- package templates
- CI for docs, tests, and type checks

Reference implementation note:

- the repository now includes a GitHub Actions workflow that runs `npm run verify:e2e` on pushes, pull requests, and manual dispatches

## Milestone 1: Schema Foundation

Build `packages/trust-schema`.

Tasks:

- define top-level manifest schema
- define object schemas for sources, prompts, tools, segments, edits, guardrails, rights, render, and publication
- define enums for trust states and visibility states
- create sample manifests
- create a validator API

Deliverables:

- versioned JSON Schema files
- generated TypeScript types
- manifest examples for at least three workflows

Acceptance criteria:

- invalid manifests are rejected with useful field-level errors
- example manifests cover both public and redacted cases

## Milestone 1.5: Interoperability and Conformance

Build the stack-neutral protocol layer that other ecosystems can implement without copying the reference stack.

Tasks:

- define canonical serialization rules for hashed and signed data
- define identifier and timestamp rules
- define interoperability profiles
- define extension and namespace rules
- create conformance fixtures and expected outputs
- publish a language-neutral error catalog

Deliverables:

- protocol specification document
- conformance test vectors
- sample manifests with expected validation results
- capability profile definitions

Acceptance criteria:

- two independent implementations should be able to serialize and validate the same manifest identically
- hash and signature inputs should be reproducible across languages
- validators should classify the same malformed fixture with the same error code family

## Milestone 2: Capture SDK

Build `packages/trust-capture-sdk`.

Tasks:

- create event interfaces
- implement append-only event log format
- implement builder APIs
- support local manifest assembly
- support redaction directives

Initial SDK methods:

```ts
trust.logSource(...)
trust.logPrompt(...)
trust.logTool(...)
trust.logGeneration(...)
trust.logEdit(...)
trust.logGuardrail(...)
trust.logRights(...)
trust.logRender(...)
trust.buildManifest(...)
```

Deliverables:

- ergonomic TypeScript SDK
- example integration in `examples/chat-to-video`
- language-neutral event envelope specification

Reference implementation note:

- the repository now includes an initial packaged event-envelope schema and example event log in `@vvmp/trust-schema`
- the repository now also includes a runnable end-to-end example integration in `examples/chat-to-video`

Acceptance criteria:

- a sample app can log a full workflow and emit a valid manifest
- a non-TypeScript implementation can follow the same event contract from the written spec alone

## Milestone 3: CLI

Build `packages/trust-cli`.

Commands to ship first:

```bash
trust inspect manifest.json
trust validate manifest.json
trust summarize manifest.json
trust extract video.mp4
trust compare local.json remote.json
```

Later commands:

```bash
trust verify video.mp4
trust sign video.mp4 manifest.json
```

Acceptance criteria:

- a developer can inspect and validate manifests without running the web viewer

## Milestone 4: Viewer

Build `apps/trust-viewer`.

Views:

- public summary
- timeline source map
- technical verifier
- redaction notices
- version history

Acceptance criteria:

- a non-technical user can understand where a sample video came from
- a technical user can inspect raw structured data and validation output

Reference implementation note:

- the repository now includes a fixture-backed `trust-viewer` with `/manifest/[manifestId]` and `/v/[trustCode]` routes, verifier-focused sections, and browser-level Playwright tests

## Milestone 5: Registry

Build `apps/trust-registry` and `packages/trust-registry-client`.

Endpoints:

- `POST /api/manifests`
- `GET /api/manifests/{manifestId}`
- `GET /v/{trustCode}`
- `POST /api/verify`
- `GET /api/assets/{assetHash}`

Deliverables:

- manifest publication
- public manifest retrieval
- trust code lookup
- manifest versioning support

Acceptance criteria:

- viewer can load manifests by trust code
- registry retains historical versions

## Milestone 6: C2PA Adapter

Build `packages/trust-c2pa-adapter`.

Tasks:

- define mapping from VVMP objects to C2PA-compatible assertions
- emit AI disclosure information
- emit custom VVMP assertion payload
- embed or sidecar-export manifests
- validate round-trip extraction

Acceptance criteria:

- a sample exported video contains recoverable provenance
- extracted data matches the signed manifest payload

## Milestone 7: Recovery and Rendition Support

Tasks:

- visible trust code and QR generation
- remote manifest lookup by trust code
- rendition comparison support
- optional watermark or fingerprint integration hooks

Acceptance criteria:

- a re-encoded copy can still be associated with a registry record through at least one supported recovery path

Reference implementation note:

- the repository now includes rendition-observation artifacts, CLI rendition comparison, SVG recovery-card generation, registry-backed watermark or fingerprint recovery-locator hooks, and a reference PNG trustmark encode/decode lane for watermark recovery

## Workstreams

### Workstream A: Protocol and Schema

Owner focus:

- manifest design
- versioning
- validation semantics
- trust states
- canonicalization and conformance

### Workstream B: SDK and CLI

Owner focus:

- developer ergonomics
- examples
- local validation and inspection

### Workstream C: Web Surfaces

Owner focus:

- trust page UX
- registry APIs
- public and technical views

### Workstream D: Signing and Interop

Owner focus:

- C2PA mapping
- signature flows
- certificate handling
- embedded and sidecar output
- stack-neutral interoperability profiles

### Workstream E: Security and Privacy

Owner focus:

- redaction model
- append-only history
- trust-state semantics
- abuse resistance

## Development Conventions

### Event sourcing first

Favor raw capture events plus deterministic manifest building over ad hoc mutation of the final manifest object.

### Append-only publication

Published manifests should not be overwritten. Corrections should produce new versions with clear linkage.

### Public and private separation

Design data structures so public outputs are derived views, not the only stored form.

### Example-driven design

Before locking schema details, confirm the model with real examples:

- chat-to-video devotional clip
- newsroom explain-it clip
- educational recap clip

## Suggested Sprint 1 Tasks

1. Bootstrap monorepo and package boundaries.
2. Implement base manifest schema with validation.
3. Define canonical serialization and hash-input rules.
4. Author three realistic manifest examples.
5. Implement `trust validate` and `trust summarize`.
6. Draft the first trust page wireframe using fixture data.

## Definition of Done for the First Usable Release

The first usable release should allow a third-party developer to:

1. record a video creation workflow
2. emit a valid VVMP manifest
3. inspect it locally with a CLI
4. publish it to a registry
5. view it on a public trust page

It does not need full C2PA embedding to be useful, but the schema, canonicalization rules, and event model must be ready for it.
