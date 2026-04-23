# VVMP v1 Draft Specification

## 1. Status

This document is the first working draft of the **Verifiable Video Manifest Protocol (VVMP)**.

It is intended to evolve into the normative v1 protocol specification. Until a v1.0.0 release is declared, this draft should be treated as pre-stable, but it is written to be implementation-oriented rather than aspirational.

## 2. Purpose

VVMP defines a structured provenance format for AI-generated and AI-assisted video.

VVMP exists to make it possible to:

1. record how a video was created
2. map timeline segments to sources, prompts, tools, edits, and guardrail events
3. disclose AI involvement and human oversight
4. support public trust pages and independent verification
5. interoperate with C2PA-compatible signing and embedding workflows

VVMP does not certify truth, official status, safety, or moral quality. It records provenance and verification-relevant metadata.

## 2.1 Normative Source of Truth

The normative protocol surface for VVMP SHOULD be defined by language-neutral artifacts:

- this specification
- JSON Schema documents
- OpenAPI contracts for registry exchange
- conformance fixtures and expected outcomes

Reference SDKs, reference CLIs, and reference web apps are non-normative implementations. They MAY help clarify intended behavior, but they MUST NOT override the written protocol or machine-readable protocol artifacts.

## 3. Conformance Language

The key words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` in this document are to be interpreted as normative requirement words.

## 4. Design Principles

VVMP implementations MUST follow these principles:

1. The protocol MUST remain implementable across multiple languages and stacks.
2. The canonical manifest model MUST be representable as JSON.
3. Hashed or signed VVMP structures MUST use deterministic serialization.
4. Published provenance records MUST support append-only version lineage.
5. Public views MUST support privacy-preserving redaction.
6. Domain-specific review logic MUST be layered as extensions or policy packs, not hardcoded into the core protocol.

## 5. Relationship to C2PA

VVMP is designed to complement C2PA, not replace it.

VVMP provides:

- richer application-layer provenance
- timeline source mapping
- prompt and edit disclosure structures
- guardrail and policy-pack records
- trust-page-oriented semantics

C2PA provides:

- interoperable content provenance packaging
- signed manifests and claims
- content binding
- embedded provenance transport

Implementations MAY publish VVMP manifests without embedded C2PA support. Implementations claiming the `embedded_provenance` profile MUST support the C2PA mapping behavior defined by a future VVMP-to-C2PA mapping section.

## 6. Top-Level Manifest Model

A VVMP manifest MUST be a JSON object with the following top-level fields:

```json
{
  "manifest_version": "1.0.0-draft",
  "manifest_id": "urn:vvmp:manifest:example",
  "video": {},
  "creation": {},
  "sources": [],
  "prompts": [],
  "tools": [],
  "assets": [],
  "timeline": [],
  "edits": [],
  "guardrails": [],
  "rights": [],
  "render": {},
  "publication": {},
  "redactions": [],
  "signatures": [],
  "links": {},
  "extensions": []
}
```

### 6.1 Required Top-Level Fields

The following top-level fields are REQUIRED in the base manifest model:

- `manifest_version`
- `manifest_id`
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
- `extensions`

### 6.2 Empty Collections

Collection fields MAY be empty arrays when no values are present. Object fields SHOULD still be present, even when only minimally populated, to preserve structural consistency across implementations.

## 7. Core Object Rules

## 7.1 `video`

The `video` object defines the canonical identity of the final asset.

Required fields:

- `video_id`
- `title`
- `created_at`
- `creator_type`
- `visibility`
- `final_asset`

Recommended fields:

- `trust_code`
- `content_type`

Example:

```json
{
  "video_id": "vid_demo_001",
  "trust_code": "VV-7N4Q-28XZ",
  "title": "A Sample Provenance-Aware Clip",
  "created_at": "2026-04-20T00:00:00Z",
  "creator_type": "user_assisted_ai",
  "content_type": "education_summary",
  "visibility": "public",
  "final_asset": {
    "format": "video/mp4",
    "duration_seconds": 12.5,
    "sha256": "sha256:demo-video-hash"
  }
}
```

## 7.2 `creation`

The `creation` object describes the workflow and oversight mode.

Required fields:

- `workflow`
- `human_oversight_level`

## 7.3 `sources`

Each source object MUST have:

- `source_id`
- `source_type`
- `visibility`

At least one of the following SHOULD be present:

- `title`
- `canonical_ref`
- `display_text`
- `hash`
- `public_summary`

## 7.4 `prompts`

Each prompt object MUST have:

- `prompt_id`
- `prompt_type`
- `visibility`

A prompt SHOULD include either a public `text`, a `template_hash`, or a public `input_hash`.

## 7.5 `tools`

Each tool object MUST have:

- `tool_id`
- `tool_type`
- `purpose`

Tool records SHOULD disclose `provider` and `model_identifier` when applicable.

## 7.6 `timeline`

Each timeline segment MUST have:

- `segment_id`
- `time_range.start`
- `time_range.end`
- `claim_type`

Each segment MUST reference at least one of:

- `source_ids`
- `prompt_ids`
- `generation_event_ids`
- explicit unsourced or redacted provenance state declared by extension or profile-specific rule

## 7.7 `edits`

Edit records SHOULD identify:

- actor
- timestamp
- target
- before and after hash or equivalent diff evidence

## 7.8 `guardrails`

Guardrail records MUST identify:

- `guardrail_event_id`
- `policy_profile`
- `policy_version`
- `check_type`
- `target_type`
- `target_id`
- `verdict`

## 7.9 `render`

The render object MUST identify the final render output hash and SHOULD identify the render engine or pipeline.

## 7.10 `publication`

The publication object SHOULD describe whether the manifest is private, public, exported, or registry-backed.

## 7.11 `redactions`

Each redaction record MUST identify:

- a `target_ref`
- a `public_mode`
- a `reason`

## 7.12 `signatures`

The `signatures` array MAY be empty in the core profile. It MUST contain at least one signature reference in the `embedded_provenance` profile.

## 7.13 `extensions`

Extensions MUST declare:

- `extension_id`
- `version`
- `critical`

Unknown critical extensions MUST cause validation failure.

## 8. Data Formats

### 8.1 Text Encoding

All JSON exchanged by VVMP implementations MUST be encoded as UTF-8.

### 8.2 Timestamps

Timestamps MUST use RFC 3339 / ISO 8601 UTC format.

Example:

```text
2026-04-20T00:00:00Z
```

### 8.3 Hashes

Hashes MUST declare their algorithm in field naming or companion metadata.

The baseline algorithm for VVMP v1 is:

- `sha256`

### 8.4 Timeline Precision

Timeline offsets MUST be represented in seconds. Implementations SHOULD preserve at least millisecond precision. Implementations comparing timeline values SHOULD treat them as decimal seconds, not as locale-formatted text.

## 9. Identifier Rules

The following rules apply in this draft:

1. `manifest_id` MUST be globally unique.
2. `manifest_id` SHOULD be expressed as a URN.
3. `video_id`, `source_id`, `prompt_id`, `tool_id`, and `segment_id` MUST be unique within a manifest.
4. `trust_code` SHOULD be unique within a registry namespace.

Implementations MAY use ULIDs, UUIDs, or opaque IDs so long as uniqueness requirements are met and the wire format remains string-based.

## 10. Canonical Serialization

Any VVMP structure used as a hash input or signature input MUST be serialized using deterministic canonical JSON rules.

This draft defines the following canonicalization requirements:

1. UTF-8 byte encoding MUST be used.
2. Object keys MUST be sorted lexicographically.
3. Insignificant whitespace MUST be omitted.
4. JSON booleans and null values MUST use standard JSON encoding.
5. Numbers MUST use a deterministic JSON representation with no implementation-specific pretty formatting.
6. Strings MUST use JSON string escaping without implementation-specific slash escaping.
7. Arrays MUST preserve input order.

VVMP SHOULD adopt JCS-compatible canonicalization unless the project later publishes a stricter canonicalization appendix.

### 10.1 Draft Canonical JSON Algorithm

For the current fixture-driven draft, VVMP canonical JSON is defined as:

1. If the value is an object, sort keys lexicographically.
2. Serialize each key as a JSON string.
3. Serialize each value recursively using the same canonical rules.
4. Join object members with `,` and key/value pairs with `:`.
5. Preserve array order exactly as given.
6. Emit no extra whitespace.
7. Encode the final canonical string as UTF-8 before hashing.

### 10.2 Canonicalization Fixture Contract

Implementations SHOULD verify canonicalization behavior against the corpus in `test-fixtures/canonicalization`.

Each canonicalization fixture defines:

- the input JSON value
- the expected canonical JSON string
- the expected SHA-256 hash over the canonical UTF-8 bytes

## 11. Hashing Rules

When a field declares a hash, implementations MUST know which input form was hashed.

Allowed input forms:

- raw file bytes
- canonical JSON bytes
- UTF-8 text bytes

For the current conformance corpus, canonical JSON fixtures use:

- canonical JSON bytes
- `sha256`

Implementations SHOULD document the input form for each hash-bearing field in protocol docs or profile docs.

## 12. Timeline Semantics

VVMP timeline segments follow these rules:

1. `start` MUST be greater than or equal to `0`.
2. `end` MUST be greater than `start`.
3. Segments SHOULD be ordered by ascending start time.
4. Overlaps MAY exist only if the implementation profile or future track rules explicitly allow them.
5. Base profile validators SHOULD reject negative or reversed ranges.

## 13. Redaction Semantics

VVMP supports public and restricted provenance views.

A public manifest view:

- MAY omit sensitive content
- MUST retain the existence of the redaction
- MUST retain a reason or redaction mode
- SHOULD retain a hash or public summary when safe

Implementations MUST NOT claim a fully public provenance trail when critical prompt or source data has been redacted; they SHOULD instead expose an explicit redaction notice and adjusted provenance coverage state.

## 14. Trust-State Semantics

VVMP standardizes the following trust-state groups:

### 14.1 File Trust State

- `valid_embedded_manifest`
- `embedded_manifest_missing`
- `embedded_manifest_invalid`
- `remote_manifest_found`
- `remote_manifest_not_found`
- `recovered_by_qr`
- `recovered_by_watermark`
- `recovered_by_fingerprint`

### 14.2 Provenance Coverage State

- `source_mapped`
- `partially_source_mapped`
- `unsourced_ai_generation`
- `user_authored`
- `private_redacted_source`
- `unknown_ingredient`

### 14.3 Guardrail State

- `passed_automated_review`
- `passed_human_review`
- `warning`
- `blocked_before_publish`
- `edited_after_warning`
- `not_checked`

### 14.4 AI Involvement State

- `no_ai`
- `ai_assisted`
- `ai_generated_script`
- `ai_generated_visuals`
- `ai_generated_narration`
- `ai_generated_with_human_approval`
- `fully_autonomous`

Implementations MAY render these states differently in UI, but they SHOULD preserve the machine-readable values.

## 15. Profiles

VVMP defines these initial interoperability profiles:

### 15.1 `core_manifest`

Requires:

- valid manifest structure
- deterministic hashing rules
- timeline provenance records
- local validation compatibility

### 15.2 `registry_backed`

Requires everything in `core_manifest`, plus:

- trust-code resolution
- registry retrieval support
- version lineage support

### 15.3 `embedded_provenance`

Requires everything in `registry_backed`, plus:

- signature references
- C2PA-compatible or equivalent embedded provenance output

### 15.4 `recovery_capable`

Requires everything in `embedded_provenance`, plus at least one recovery path:

- visible trust code
- QR route
- watermark lookup hook
- fingerprint lookup hook

## 16. Extensions

Extensions MUST use a versioned namespace identifier, typically reverse-domain style.

Example:

```text
org.faith.lds.policy.v1
```

Validator behavior:

1. Unknown non-critical extensions MAY be ignored but SHOULD be preserved.
2. Unknown critical extensions MUST fail validation.
3. Extensions MUST NOT silently redefine core VVMP field meanings.

## 17. Validation Model

VVMP validation occurs at multiple levels:

1. schema validation
2. semantic validation
3. profile validation
4. extension validation
5. trust-state derivation

Implementations SHOULD return machine-readable error codes.

Recommended error families:

- `VVMP_SCHEMA_*`
- `VVMP_ID_*`
- `VVMP_HASH_*`
- `VVMP_TIME_*`
- `VVMP_TIMELINE_*`
- `VVMP_EXTENSION_*`
- `VVMP_SIGNATURE_*`
- `VVMP_PROFILE_*`
- `VVMP_REDACTION_*`

Implementations SHOULD align their machine-readable codes with the project error catalog in `errors/error-codes.json`.

## 18. Registry Exchange Expectations

Registry APIs are defined separately, but a conforming VVMP registry SHOULD:

1. preserve append-only version lineage
2. resolve trust codes
3. serve a public trust view when supported
4. honor redaction rules in public outputs
5. support machine-readable verification-oriented retrieval

## 19. Security and Privacy Considerations

Implementations MUST consider:

- tampering after publication
- metadata stripping
- silent mutation of history
- leakage of private prompts or private sources
- misleading trust-page language
- unsupported critical extension handling

Public trust pages SHOULD describe provenance and verification state, not truth certification.

## 20. First Release Gaps

The following sections still need deeper normative detail before VVMP v1 final:

1. formal canonicalization appendix
2. complete JSON Schema alignment
3. C2PA mapping appendix
4. registry OpenAPI file
5. conformance suite runner spec

## 21. Implementation Notes

Reference implementations may be built in:

- TypeScript
- Rust
- Python
- Go
- Next.js for the hosted trust viewer and registry interface

These are implementation choices, not protocol dependencies.

VVMP SHOULD maintain at least one non-JavaScript implementation over time to reduce the risk of accidental JS-specific semantics becoming the de facto standard.
