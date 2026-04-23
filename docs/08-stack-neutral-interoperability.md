# VVMP Stack-Neutral Interoperability Plan

## Why This Matters

If VVMP is going to become a real protocol, it cannot be tied to one stack, one SDK, or one vendor-hosted workflow.

A TypeScript reference implementation is useful, but it is not enough.

The protocol should be implementable by:

- a Python backend
- a Rust CLI
- a Go registry
- a Next.js web app
- a Swift mobile app
- a Java or Kotlin enterprise system
- a .NET moderation platform

That means the next improvements should focus on interoperability before convenience.

## Recommended Next Things To Build

These are the highest-leverage additions for improving VVMP right now.

### 1. The Normative Protocol Spec

Build the actual protocol specification before building too many framework-specific packages.

It should define:

- manifest structure
- required and optional fields
- canonical serialization
- hashing rules
- time and identifier formats
- redaction semantics
- extension rules
- validation semantics

Why this matters:

- without this, every SDK risks becoming its own dialect

### 2. Conformance Test Suite

Publish a language-neutral conformance pack.

It should include:

- valid fixture manifests
- invalid fixture manifests
- expected normalized representations
- expected hash outputs
- expected trust-state outputs
- expected validation error families

Why this matters:

- this is how other stacks prove they implemented VVMP correctly

### 3. Interoperability Profiles

Define adoption levels so teams can implement VVMP incrementally.

Recommended profiles:

#### Profile A: Core Manifest

Requires:

- valid VVMP manifest
- deterministic hashing
- timeline provenance
- local validation

Use for:

- offline tools
- local export workflows
- low-complexity apps

#### Profile B: Registry-Backed

Requires everything in Profile A, plus:

- trust code
- remote manifest retrieval
- version history
- verification endpoint support

Use for:

- public trust pages
- creator platforms
- marketplaces

#### Profile C: Embedded Provenance

Requires everything in Profile B, plus:

- C2PA-compatible output
- embedded or sidecar manifest support
- extraction and verification tooling

Use for:

- serious provenance workflows
- original file export
- newsroom and archive use cases

#### Profile D: Recovery-Capable

Requires everything in Profile C, plus one or more recovery paths:

- visible trust code
- QR resolution
- optional watermark or fingerprint hooks

Reference implementation note:

- the repository now includes registry-backed hook registration and lookup for watermark and fingerprint recovery identifiers
- the repository also now includes a reference PNG trustmark adapter so recovery is no longer hook-only in the JavaScript implementation

Use for:

- social distribution
- re-encoded platform uploads

### 4. Reference OpenAPI and Event Envelope Spec

Publish a transport-neutral API description for the registry and a language-neutral event model for capture.

This should include:

- publish manifest request and response
- fetch by manifest ID
- fetch by trust code
- verify request and response
- event envelope fields
- event ordering and idempotency rules

Why this matters:

- apps in any stack should be able to integrate without reverse-engineering the reference server

### 5. Canonicalization and Hashing Rules

Build and freeze deterministic rules for how manifests and sub-objects are serialized before hashing or signing.

This should define:

- canonical JSON
- UTF-8 handling
- ordering behavior
- time precision
- decimal precision for timecodes
- hash algorithm registry

Why this matters:

- cryptographic provenance falls apart if implementations hash the same logical object differently

### 6. Extension Registry Model

Define how VVMP can be extended without fragmenting.

This should include:

- reverse-domain naming guidance
- critical vs non-critical extension behavior
- policy-pack extension shape
- custom assertion labels
- profile declaration rules

Why this matters:

- VVMP needs to be extensible for faith, education, newsroom, and other domains without losing interoperability

### 7. Independent Non-JS Implementation

After the conformance suite exists, build one non-JavaScript implementation.

Best options:

- Python validator
- Rust validator or CLI
- Go registry client

Why this matters:

- it proves the spec is real and not just a JS package design

## What Should Be Built Next

If choosing only one next build step, it should be:

> Build the normative protocol spec plus the conformance suite.

That will improve VVMP more than adding another app or UI right now.

If choosing the next three:

1. normative protocol spec
2. conformance test suite
3. interoperability profiles

That combination makes the rest of the roadmap much stronger.

## Protocol Artifacts VVMP Should Publish

Before calling VVMP ready for broad adoption, publish:

- JSON Schema
- JSON-LD context
- canonical serialization rules
- hash algorithm registry
- validation error catalog
- extension registry rules
- OpenAPI for registry endpoints
- event envelope specification
- conformance fixtures
- example manifests

Reference implementation note:

- the repository now includes an initial event-envelope schema and example event log in `@vvmp/trust-schema`
- this is a starting point for cross-stack capture interoperability, not the final word on long-term event governance

## Language-Neutral Validation Contract

VVMP validators should agree on:

- whether a manifest is valid
- which required fields are missing
- whether identifiers are malformed
- whether timeline segments violate ordering rules
- whether hash declarations are malformed
- whether unknown critical extensions must fail

The exact wording of messages can vary, but error classes should be stable.

## Recommended Error Code Families

VVMP should define standard error families such as:

- `VVMP_SCHEMA_*`
- `VVMP_ID_*`
- `VVMP_HASH_*`
- `VVMP_TIME_*`
- `VVMP_TIMELINE_*`
- `VVMP_EXTENSION_*`
- `VVMP_SIGNATURE_*`
- `VVMP_PROFILE_*`

This helps automation and cross-language tooling stay aligned.

## Registry API Direction

VVMP should specify the registry API in a way that does not require one web framework.

At minimum, define:

- path conventions
- request and response formats
- content types
- status code expectations
- pagination and versioning approach
- auth expectations for private manifests

OpenAPI should be the normative contract, not implementation-specific controller code.

Next.js is a strong reference implementation choice for the hosted registry and public trust viewer, but the protocol must remain framework-neutral so equivalent implementations can be built in Express, FastAPI, Go, Rails, Laravel, Spring, ASP.NET, or other stacks.

## Capture Event Direction

Capture should also be spec-first.

Each event should define:

- event type
- event ID
- session ID
- actor
- timestamp
- payload
- upstream references
- idempotency key when applicable

The protocol should describe how a sequence of events becomes a canonical manifest.

## Interoperability Release Criteria

VVMP should not market itself as cross-stack until:

1. the protocol spec is published
2. canonicalization rules are frozen for v1
3. conformance fixtures are published
4. at least two independent implementations pass the suite
5. one implementation is not JavaScript or TypeScript

## Recommended Documentation Follow-Up

After this document, the next docs to add should be:

1. `docs/09-protocol-spec-outline.md`
2. `docs/10-conformance-suite.md`
3. `docs/11-registry-api-spec.md`
4. `docs/12-extension-and-policy-pack-spec.md`
