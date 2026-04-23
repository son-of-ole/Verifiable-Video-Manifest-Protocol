# VVMP Extension and Policy-Pack Specification

## Purpose

VVMP needs to be extensible without fragmenting.

This document defines the direction for:

- extension namespaces
- critical and non-critical extensions
- policy-pack declarations
- validator behavior

## Design Goals

- keep the core protocol domain-neutral
- allow domain-specific additions
- prevent silent incompatibility
- preserve cross-stack validation

## Extension Model

VVMP should allow custom extension data in a controlled way.

Each extension should declare:

- extension identifier
- namespace owner
- version
- criticality
- affected objects

Example:

```json
{
  "extension_id": "org.faith.lds.source-grounding.v1",
  "critical": false,
  "version": "1.0.0"
}
```

## Namespace Rules

Recommended naming rule:

- reverse-domain style

Examples:

- `org.vvmp.timeline.annotations.v1`
- `org.faith.lds.policy.v1`
- `org.news.elections.claim-review.v1`

Rules:

- namespaces should be globally unique
- extension versions should be explicit
- extension identifiers should not collide with core VVMP field names

## Critical vs Non-Critical Extensions

### Non-Critical Extensions

Behavior:

- validators may ignore unknown non-critical extensions
- validators should preserve them if re-serializing manifests
- trust pages may omit them if not supported

Use for:

- extra annotations
- experimental UI metadata
- non-essential domain hints

### Critical Extensions

Behavior:

- validators must fail when they do not understand a critical extension
- profile conformance must fail if required critical extensions are unsupported

Use for:

- semantics that change interpretation
- domain rules required for correct verification
- mandatory policy declarations

## Extension Declaration Location

VVMP should define a top-level extension declaration area.

Suggested shape:

```json
{
  "extensions": [
    {
      "extension_id": "org.faith.lds.policy.v1",
      "critical": false,
      "version": "1.0.0"
    }
  ]
}
```

The spec should define whether this lives:

- at top level
- inside profile declarations
- both

## Policy Packs

Policy packs are structured domain-specific review packages that operate on VVMP workflows.

Examples:

- `org.faith.lds`
- `org.news.election-integrity`
- `org.education.k12-safety`
- `org.health.medical-explainer`

Policy packs are not the protocol itself. They are interoperable extensions layered on top of the core protocol.

## Policy-Pack Metadata

Each policy pack should declare:

- `policy_pack_id`
- `version`
- `display_name`
- `publisher`
- `checks`
- `output_schema_version`

Suggested example:

```json
{
  "policy_pack_id": "org.faith.lds",
  "version": "2.6.0",
  "display_name": "LDS Source and Tone Guardrails",
  "publisher": "Example Publisher",
  "checks": [
    "source_grounding",
    "doctrinal_boundary",
    "tone_reverence",
    "misleading_quote_detection"
  ],
  "output_schema_version": "1.0.0"
}
```

Reference implementation note:

- the repository now includes a reference `@vvmp/policy-pack-sdk` package
- the package validates policy-pack metadata, runs target-based checks, and converts results into VVMP guardrail records
- the package also derives execution targets from manifests and appends policy output back into manifests
- it is a reference implementation, not the normative cross-stack contract

## Guardrail Result Contract

VVMP should standardize the minimum result shape emitted by policy checks.

Suggested minimum fields:

- `guardrail_event_id`
- `policy_profile`
- `policy_version`
- `check_type`
- `target_type`
- `target_id`
- `verdict`
- `risk_level`
- `review_mode`
- `public_summary`

Optional fields:

- `input_hash`
- `output_hash`
- `changed_due_to_review`
- `human_reviewer_role`

## Validator Expectations

Validators should:

- validate the shape of declared extensions
- fail on unknown critical extensions
- warn or ignore unknown non-critical extensions according to spec
- validate declared policy-pack metadata when the relevant extension is understood

Validators should not:

- pretend to understand a domain-specific extension they do not implement

## Profile Interactions

Profiles may require specific extensions or policy declarations.

Example:

- a faith-specific app profile might require `org.faith.lds.policy.v1`
- the base Core Manifest profile should not

This allows VVMP to stay domain-neutral at the base layer while still supporting domain-specific ecosystems.

## Registry Handling

Registries should:

- preserve extensions in stored manifests
- optionally run configured publish-time policy packs before storing a new version
- expose declared extensions in public or restricted views as allowed
- surface unsupported critical extensions during validation

Registries should not:

- strip unknown extensions silently

## Viewer Handling

Viewers may:

- display supported extensions richly
- collapse unsupported non-critical extensions into a technical section

Viewers must:

- avoid implying unsupported critical extensions were successfully interpreted

## Next.js Reference Implementation Note

A Next.js-based trust viewer can render policy-pack sections and extension panels nicely, but extension semantics must come from the spec and validation libraries, not from Next.js UI assumptions.

## Recommended Extension Registries

VVMP should maintain project-level registries for:

- extension IDs
- policy-pack IDs
- claim types
- tool types
- source types

These can begin as files in the repository before becoming a more formal registry service.

Reference implementation note:

- the repository now includes initial machine-readable registry files in `@vvmp/trust-schema`
- they are a starting point for protocol consumers, not yet a final governance model

## Immediate Follow-Up Tasks

1. Define the top-level `extensions` structure in the manifest model
2. Define the unknown-critical-extension failure rule formally
3. Draft one example faith policy-pack extension
4. Draft one example newsroom policy-pack extension

The reference SDK now covers part of this follow-up path by providing:

- policy-pack metadata validation
- executable policy checks
- guardrail-record conversion
- manifest-derived target selection
- manifest append helpers for policy execution output

## Current Integration Direction

The repository is now moving in the intended direction here:

- `trust-capture-sdk` can execute policy packs against the current session-derived manifest and automatically log the resulting guardrails
- the capture SDK can also register the policy-pack extension declaration so the built manifest reflects that review history
- `trust-registry` can be configured with publish-time policy packs so a hosted registry can enforce or record review during publication

That keeps policy packs as optional, domain-specific layers on top of the protocol while still making them usable in real capture and publish workflows.
- extension declaration helpers
