# VVMP Protocol Specification Outline

## Purpose

This document defines the structure of the normative VVMP protocol specification.

It is not the final protocol text yet. It is the outline that should be filled in and then versioned as the canonical VVMP v1 specification.

## Normative Goal

The VVMP protocol spec should be sufficient for an implementer to:

1. produce a valid VVMP manifest
2. validate a VVMP manifest
3. derive the same hash inputs as other implementations
4. apply the same trust-state semantics
5. exchange manifests and registry responses across stacks

It should not require one programming language, database, server framework, or UI stack.

## Specification Structure

## 1. Introduction

Define:

- what VVMP is
- what problems it solves
- relationship to C2PA
- protocol scope
- non-goals

Must clarify:

- VVMP records provenance, not truth certification
- VVMP may coexist with private data and redactions
- VVMP supports both embedded and remote provenance workflows

## 2. Terminology

Define all key terms precisely.

Minimum terms:

- manifest
- manifest version
- canonical manifest
- public manifest view
- source
- prompt
- tool
- timeline segment
- guardrail event
- rights record
- publication record
- trust code
- trust state
- profile
- extension
- critical extension
- registry
- rendition

Each term should have one normative definition.

## 3. Conformance Language

Adopt RFC-style requirement words:

- MUST
- MUST NOT
- SHOULD
- SHOULD NOT
- MAY

This section should explain how VVMP uses those words.

## 4. Manifest Model

Define the top-level manifest object and every required child object.

This section should include:

- top-level field definitions
- field data types
- cardinality rules
- required vs optional fields
- cross-reference rules
- profile-specific requirements

Normative output:

- a canonical manifest model section
- links to JSON Schema artifacts

## 5. Object Definitions

Each object should get its own normative subsection.

Required subsections:

- `video`
- `creation`
- `sources`
- `prompts`
- `tools`
- `assets`
- `timeline`
- `edits`
- `guardrails`
- `rights`
- `render`
- `publication`
- `redactions`
- `signatures`
- `links`

Each subsection should define:

- semantic meaning
- required fields
- optional fields
- identifier rules
- validation rules
- profile interactions

## 6. Data Types and Formats

Define wire-level expectations for shared types.

Minimum formats:

- strings
- booleans
- integers
- decimals
- timestamps
- durations
- hashes
- URIs
- URNs
- media types
- enumerations

This section should also define UTF-8 expectations.

## 7. Identifier Rules

Define how VVMP identifiers work.

Questions to resolve in the spec:

- are IDs opaque strings or structured identifiers
- where URNs are required vs allowed
- whether trust codes are globally unique
- whether object IDs must be unique only within a manifest or globally

Recommended direction:

- `manifest_id` should be globally unique
- internal object IDs may be manifest-scoped if clearly documented
- trust codes should be globally unique within a registry namespace

## 8. Canonical Serialization

This is one of the most important sections.

Define:

- canonical JSON rules
- object-key ordering
- whitespace handling
- number formatting
- string encoding
- null handling

This section should name the canonicalization algorithm used by VVMP.

It should also define:

- which objects are canonicalized independently
- which fields are excluded from specific hash inputs
- whether redacted public views have separate canonical forms

## 9. Hashing Rules

Define:

- allowed algorithms
- algorithm identifiers
- canonical input types
- field-level hash semantics
- hash comparison rules

Minimum baseline:

- `sha256`

This section should specify whether a hash is over:

- raw file bytes
- canonical JSON bytes
- text bytes
- normalized media metadata

## 10. Timeline Semantics

Define how timeline segments work.

Must cover:

- start and end semantics
- inclusive vs exclusive boundaries
- ordering
- overlaps
- gaps
- zero-length segments
- multi-track references

The spec should define when overlaps are:

- forbidden
- allowed
- profile-dependent

## 11. Redaction Semantics

Define how VVMP supports privacy-preserving public views.

Must cover:

- what can be redacted
- how redaction is declared
- what public evidence must remain
- how validators treat redacted fields
- how public and restricted manifests relate

This section should also define whether a redacted view can still be signed independently or only referenced from a full manifest lineage.

## 12. Trust-State Semantics

Define standard trust-state vocabularies and how they are computed.

Must cover:

- file trust states
- provenance coverage states
- guardrail states
- AI involvement states

The goal is not to force every UI to look the same, but to keep meaning stable across tools.

## 13. Profiles

Define interoperability profiles in the normative spec.

Minimum profiles:

- Core Manifest
- Registry-Backed
- Embedded Provenance
- Recovery-Capable

Each profile should define:

- required features
- required fields
- optional features
- validation behavior

## 14. Extensions

Define the extension system and namespace rules.

Must cover:

- custom fields
- critical vs non-critical extensions
- reverse-domain naming
- extension declarations
- validator behavior for unknown extensions

## 15. Registry Exchange Model

Define how manifests are exchanged with registries at a protocol level.

This section should point to the registry API spec but still define:

- registry responsibilities
- version lineage requirements
- trust-code resolution expectations
- publication consistency requirements

## 16. Signature and C2PA Mapping Model

This section should define VVMP's relationship to signatures and embedded provenance.

Must cover:

- signature references inside VVMP
- how VVMP records signed artifacts
- how C2PA-compatible output relates to VVMP
- sidecar vs embedded behavior

This section should not duplicate the C2PA spec, but it should define VVMP's mapping and expectations.

## 17. Validation Model

Define how validators behave.

Must cover:

- schema validation
- semantic validation
- profile validation
- extension validation
- trust-state derivation
- error reporting model

Validators should return stable machine-readable error codes even if human-readable strings differ.

## 18. Error Code Families

Publish standard error-code families.

Minimum families:

- `VVMP_SCHEMA_*`
- `VVMP_ID_*`
- `VVMP_HASH_*`
- `VVMP_TIME_*`
- `VVMP_TIMELINE_*`
- `VVMP_EXTENSION_*`
- `VVMP_SIGNATURE_*`
- `VVMP_PROFILE_*`
- `VVMP_REDACTION_*`

## 19. Security and Privacy Considerations

This section should summarize:

- tampering risks
- silent mutation risks
- metadata-stripping risks
- privacy leakage risks
- overclaiming risks
- extension abuse risks

## 20. IANA-Style Registries for VVMP

VVMP should maintain simple internal registries for:

- hash algorithms
- claim types
- source types
- prompt types
- tool types
- trust-state values
- extension namespaces
- profile identifiers

This can be a project-level registry even if not literally registered with IANA.

## 21. Examples

The protocol spec should end with concrete examples.

Required examples:

- simple public manifest
- redacted manifest
- registry-backed manifest
- profile comparison example
- custom extension example

## Reference Implementation Notes

Reference implementations may be built in:

- TypeScript for SDK and CLI
- Rust for verification or signing internals
- Next.js for the trust viewer and hosted registry UI/API

Those reference implementations are helpful, but the spec itself remains the source of truth.

## Recommended Draft Order

Write the spec in this order:

1. terminology and conformance language
2. manifest model and object definitions
3. canonical serialization and hashing
4. timeline and redaction semantics
5. profiles and extensions
6. validation and error codes
7. registry exchange model
8. signature and C2PA mapping notes
9. examples

## Immediate Follow-Up Tasks

1. Turn this outline into `spec/vvmp-v1-draft.md`
2. Publish JSON Schema artifacts alongside spec sections
3. Create fixture examples that map directly to spec sections
4. Freeze canonicalization rules early
