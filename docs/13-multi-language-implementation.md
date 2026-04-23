# VVMP Multi-Language Implementation Guide

## Purpose

This guide exists to make one thing explicit:

VVMP is not a TypeScript protocol and it is not a Next.js protocol.

This repository currently includes:

- a TypeScript reference package
- a Next.js reference viewer

Those are reference implementations only. The protocol is intended to be implementable from Python, Rust, Go, Swift, Java, .NET, and other ecosystems without drifting into incompatible dialects.

## Normative vs Reference Layers

### Normative

The parts that other implementations should treat as the protocol source of truth are:

- [spec/vvmp-v1-draft.md](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/spec/vvmp-v1-draft.md:1)
- [schemas/vvmp-manifest.v1.json](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/schemas/vvmp-manifest.v1.json:1)
- [openapi/registry-v1.yaml](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/openapi/registry-v1.yaml:1)
- [errors/error-codes.json](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/errors/error-codes.json:1)
- [test-fixtures/conformance](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/test-fixtures/conformance/README.md:1)

### Reference

The parts that are examples rather than the protocol itself are:

- [packages/trust-core](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/packages/trust-core/src/index.ts:1)
- [apps/trust-viewer](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/apps/trust-viewer/app/page.tsx:1)

## Recommended Implementation Path By Stack

### Python

Recommended starting points:

- generate or hand-author validators from the root JSON Schema
- use the conformance fixtures as test vectors
- consume `openapi/registry-v1.yaml` from FastAPI, Flask, or Django integrations

### Rust

Recommended starting points:

- implement canonicalization and hashing carefully
- use Serde-backed models generated or aligned to the JSON Schema
- use the conformance corpus as compile-time or integration-test fixtures

### Go

Recommended starting points:

- generate registry types from OpenAPI
- define manifest structs against the JSON Schema
- use fixture-driven tests for validation and trust-state derivation

### Swift

Recommended starting points:

- use `Codable` models aligned to the schema
- treat the OpenAPI contract as the registry wire model
- keep signing and canonicalization behavior strictly spec-driven

### Java and Kotlin

Recommended starting points:

- generate models from JSON Schema or define explicit record/data classes
- generate registry clients from OpenAPI
- use JUnit fixture suites against the conformance corpus

### .NET

Recommended starting points:

- use System.Text.Json models aligned with the schema
- generate API clients from OpenAPI
- run fixture-based tests for semantic validation and profile logic

## Anti-Drift Rules

Every implementation should avoid these traps:

1. Do not infer protocol behavior from the Next.js viewer UI.
2. Do not infer protocol behavior from TypeScript types alone.
3. Do not invent stack-specific defaults for canonicalization.
4. Do not silently ignore unknown critical extensions.
5. Do not collapse redacted provenance into “fully sourced” UI labels.

## What Must Stay Aligned Across Stacks

These are the things that cannot drift if VVMP is going to remain interoperable:

- required top-level fields
- field meanings
- identifier expectations
- timeline range semantics
- canonical JSON rules
- hash input rules
- profile requirements
- extension failure behavior
- error-code families
- canonical JSON output
- canonical SHA-256 outputs for published fixtures

## Recommended Cross-Stack Validation Workflow

Each implementation should:

1. validate structure against the JSON Schema
2. validate semantics against the spec
3. run the conformance fixtures
4. compare expected error-code families
5. compare expected trust-state outputs

## Reference App Role

The Next.js app in this repo is useful for:

- trust-page UX exploration
- hosted registry route experimentation
- making fixture data visible to humans

It is not the definition of:

- manifest validity
- canonicalization
- hashing
- registry wire semantics

Those belong to the spec, schema, OpenAPI, and conformance fixtures.

## Recommended Next Technical Step

To make this multi-language promise stronger, the next implementation step should be:

1. add a real validator in `packages/trust-core`
2. add a second validator in a non-JS language
3. run both against the same conformance fixtures

That is the best practical proof that VVMP is staying stack-neutral.

This repository now includes the first version of that proof path:

- a TypeScript validator in [packages/trust-core/src/validate.ts](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/packages/trust-core/src/validate.ts:1)
- a JavaScript conformance runner in [scripts/run-conformance-js.mjs](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/scripts/run-conformance-js.mjs:1)
- a Python conformance runner in [scripts/run_conformance.py](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/scripts/run_conformance.py:1)
- a Swift conformance runner in [scripts/run_conformance.swift](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/scripts/run_conformance.swift:1)

The current validators are still deliberately small, but they establish the fixture-driven cross-stack contract.

That contract now includes:

- manifest validation
- profile validation
- trust-state derivation
- canonical JSON verification
- SHA-256 verification for canonicalization fixtures
- signature record validation
