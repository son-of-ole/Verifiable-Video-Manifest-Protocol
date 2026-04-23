# VVMP Manifest Schema and Data Model

## Purpose

The VVMP manifest is the canonical structured record of how a video was created, reviewed, rendered, and signed.

It should be:

- machine-readable
- versioned
- append-friendly
- privacy-aware
- mappable into C2PA assertions

## Top-Level Structure

```json
{
  "manifest_version": "1.0.0",
  "manifest_id": "urn:vvmp:manifest:01J...",
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
  "links": {}
}
```

## Design Goals

- stable identifiers for every record
- explicit relationships between records
- segment-level provenance
- support for public redaction
- compatibility with JSON Schema and JSON-LD
- deterministic serialization and hashing across languages

## Stack-Neutral Requirements

VVMP should be implementable in any language and on any platform.

That means the protocol cannot depend on:

- TypeScript-only types
- Node-specific runtime assumptions
- one database engine
- one hosted registry vendor
- one web framework

The canonical specification should be expressed in language-neutral artifacts first:

- JSON Schema
- JSON-LD context
- canonical serialization rules
- hashing rules
- identifier rules
- conformance fixtures
- protocol examples

SDKs are important, but they should be adapters to the protocol, not the protocol itself.

## Core Objects

### 1. Video Record

The `video` object defines the identity of the rendered asset.

Suggested fields:

```json
{
  "video_id": "vid_01J...",
  "trust_code": "FC-8K3X-22AP",
  "title": "Why Mosiah 3:19 Still Hits Today",
  "created_at": "2026-04-19T18:22:00Z",
  "creator_type": "user_assisted_ai",
  "content_type": "faith_based_summary",
  "visibility": "public",
  "final_asset": {
    "format": "video/mp4",
    "duration_seconds": 34.2,
    "sha256": "sha256:..."
  }
}
```

### 2. Source Record

Every input source should become a source object.

Suggested source types:

- scripture
- article
- transcript
- private_chat
- uploaded_document
- newsroom_note
- user_text
- image
- audio
- video

Example:

```json
{
  "source_id": "src_001",
  "source_type": "scripture",
  "title": "Mosiah 3:19",
  "canonical_ref": "Book of Mormon / Mosiah 3:19",
  "retrieved_at": "2026-04-19T18:10:00Z",
  "quoted_text_hash": "sha256:...",
  "display_text": "For the natural man is an enemy to God...",
  "usage": ["quoted", "paraphrased", "context"],
  "visibility": "public"
}
```

Redacted example:

```json
{
  "source_id": "src_private_chat_01",
  "source_type": "private_chat",
  "visibility": "redacted_public",
  "hash": "sha256:...",
  "public_summary": "Original user conversation that initiated the clip."
}
```

### 3. Prompt Record

Prompts must support differing visibility levels.

Recommended visibility states:

- `public`
- `redacted_public`
- `template_hash_only`
- `private_internal`

Example:

```json
{
  "prompt_id": "prompt_001",
  "prompt_type": "user_creation_prompt",
  "visibility": "public",
  "text": "Turn this chat answer into a 30-second inspiring vertical video.",
  "input_hash": "sha256:...",
  "created_by": "user",
  "created_at": "2026-04-19T18:12:00Z"
}
```

Template-hash example:

```json
{
  "prompt_id": "prompt_template_lds_clip_v3",
  "prompt_type": "system_template",
  "visibility": "template_hash_only",
  "template_name": "lds_clip_generator",
  "template_version": "3.1.0",
  "template_hash": "sha256:...",
  "public_description": "Transforms approved chat content into a short LDS-focused video script."
}
```

### 4. Tool and Model Record

Each generator, renderer, checker, or transformation tool should be a first-class record.

Suggested tool types:

- language_model
- image_generator
- video_generator
- voice_synthesizer
- music_generator
- captioner
- guardrail_engine
- render_engine
- editor

Example:

```json
{
  "tool_id": "tool_script_001",
  "tool_type": "language_model",
  "provider": "model_provider",
  "model_identifier": "model-name-or-version",
  "purpose": "script_generation",
  "input_prompt_ids": ["prompt_001"],
  "input_source_ids": ["src_001", "src_002"],
  "output_hash": "sha256:...",
  "human_oversight_level": "human_validated"
}
```

### 5. Timeline Segment Record

This is the most important VVMP object.

Every segment should support:

- time range
- visible text
- narration text
- claim type
- source references
- prompt references
- generation references
- edit references
- guardrail references
- asset references

Example:

```json
{
  "segment_id": "seg_003",
  "time_range": {
    "start": 8.4,
    "end": 14.7
  },
  "visible_text": "The point is not perfection. It is becoming willing to change.",
  "narration_text": "The point is not perfection. It is becoming willing to change.",
  "claim_type": "ai_assisted_paraphrase",
  "source_ids": ["src_001"],
  "prompt_ids": ["prompt_001"],
  "generation_event_ids": ["gen_script_001"],
  "edit_event_ids": ["edit_004"],
  "guardrail_event_ids": ["guard_007", "guard_008"],
  "visual_asset_ids": ["vis_002"],
  "audio_asset_ids": ["aud_001"]
}
```

Recommended claim types:

- quoted
- paraphrase
- summary
- explanation
- opinion
- humor
- ai_generated
- ai_assisted_paraphrase
- user_authored

### 6. Edit Record

Example:

```json
{
  "edit_event_id": "edit_004",
  "actor": "user",
  "timestamp": "2026-04-19T18:17:00Z",
  "target": "seg_003.narration_text",
  "before_hash": "sha256:...",
  "after_hash": "sha256:...",
  "public_summary": "User softened wording from 'God demands change' to 'becoming willing to change'."
}
```

### 7. Guardrail Record

Example:

```json
{
  "guardrail_event_id": "guard_008",
  "policy_profile": "org.faith.lds",
  "policy_version": "2.6.0",
  "check_type": "doctrinal_alignment",
  "target_type": "script_segment",
  "target_id": "seg_003",
  "input_hash": "sha256:...",
  "verdict": "approved",
  "risk_level": "low",
  "public_summary": "Segment stayed within approved LDS-focused source framing.",
  "review_mode": "automated",
  "model_or_ruleset": "policy-engine-v2"
}
```

Recommended verdicts:

- approved
- warning
- blocked
- requires_human_review
- overridden_with_human_approval

### 8. Rights and Consent Record

Example:

```json
{
  "asset_id": "voice_001",
  "asset_type": "synthetic_voice",
  "voice_type": "platform_default",
  "impersonates_real_person": false,
  "consent_required": false
}
```

## Relationships

The schema should support graph-like references rather than a flat list of disconnected metadata.

Minimum relationship rules:

1. Every timeline segment must reference at least one provenance state.
2. Every public claim segment should reference either a source, a prompt, or an explicit unsourced state.
3. Every render record must reference the final asset hash.
4. Every guardrail record must identify both target and policy version.
5. Every redaction must describe what was hidden and why.

## Canonical Serialization and Hashing

To make manifests portable across stacks, VVMP needs deterministic byte-level rules for any content that will be hashed, signed, or compared.

The spec should define:

### Canonical JSON

- UTF-8 encoding
- normalized object key ordering
- deterministic number formatting
- deterministic boolean and null encoding
- no implementation-defined pretty-printing assumptions

Recommended direction:

- adopt a published JSON canonicalization approach such as JCS
- document any VVMP-specific constraints if stricter behavior is needed

### Hashing Rules

Every hashed field should declare:

- algorithm name
- canonical input form
- whether the hash is over raw bytes, canonical JSON, plain text, or media bytes

Recommended baseline:

- `sha256`

Future-proofing:

- support an algorithm registry so new algorithms can be added without rewriting the core schema

### Time and Numeric Rules

To prevent cross-language drift, the spec should define:

- timestamps in RFC 3339 / ISO 8601 UTC form
- timeline offsets in seconds
- decimal precision rules for time ranges
- explicit rounding or truncation behavior where relevant

### Identifier Rules

Every object identifier should follow a documented format.

Examples:

- `manifest_id`
- `video_id`
- `source_id`
- `segment_id`

The spec should define whether these are:

- UUIDs
- ULIDs
- URNs
- app-scoped opaque IDs

Different deployment choices are acceptable, but the wire format rules must be explicit.

## Required vs Optional Fields

VVMP should publish normative profiles that define which fields are required for interoperability.

At minimum, each field should be classified as:

- required
- recommended
- optional
- profile-specific

This matters because many stacks will start small and still need to emit valid manifests.

## Redaction Model

Each sensitive field should support either:

- full value
- public hash only
- public summary only
- fully private internal value

Example redaction entry:

```json
{
  "redaction_id": "red_001",
  "target_ref": "prompts.prompt_002.text",
  "public_mode": "hash_and_summary",
  "reason": "contains personal religious question"
}
```

## JSON-LD Direction

VVMP should define a JSON-LD context after the JSON Schema stabilizes.

Reference implementation note:

- the repository now includes a reference JSON-LD context in `@vvmp/trust-schema`
- it is still intentionally lightweight and should evolve with the normative schema

Proposed namespace examples:

- `https://vvmp.org/context/v1`
- `urn:vvmp:manifest`

This should happen after the core JSON Schema is validated against real examples.

## C2PA Mapping Strategy

VVMP should map into C2PA in two ways:

1. Standard C2PA assertions for creation, actions, ingredients, and AI disclosures.
2. A custom VVMP assertion for rich timeline provenance and policy metadata.

Proposed custom assertion label:

```text
org.vvmp.video.provenance.v1
```

## Versioning Rules

- `manifest_version` governs the VVMP data model version.
- object schemas should be backward-compatible within minor versions when possible.
- breaking changes require a new major version.
- published manifests should never be silently rewritten in place.

## Extension Rules

VVMP should support extension without letting implementations fragment the protocol.

The spec should define:

- namespace conventions for custom fields
- reverse-domain labels for extension packages
- how unknown extensions must be treated by validators
- which extensions may affect signature-critical behavior
- how profile declarations advertise required extensions

Recommended rule:

- unknown non-critical extensions should be ignored but preserved
- unknown critical extensions should cause validation to fail unless explicitly supported
