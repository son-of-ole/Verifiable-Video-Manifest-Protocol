# VVMP Security, Privacy, and Verification

## Security Goals

VVMP should make provenance tampering difficult, obvious, and independently testable.

Key goals:

- bind manifests to media assets
- prevent silent history rewrites
- preserve proof even when some content must remain private
- distinguish exact-file validation from recovered provenance

## Core Security Rules

### 1. Sign the manifest, not only the database row

The canonical trust artifact is the signed manifest payload and its references, not a mutable database record.

Required signed references should include:

- manifest identifier
- manifest hash
- final asset hash
- signer identity or certificate chain reference
- signing timestamp

### 2. Use append-only history

Published records should be versioned, not silently edited.

Expected model:

```text
manifest_v1 -> manifest_v2 -> manifest_v3
```

Public UI should disclose:

- that an update happened
- when it happened
- why it happened
- which version is current

### 3. Separate public and private provenance

Not all prompts, sources, or assets can be public.

VVMP should support:

- full private storage
- public hash only
- public summary only
- restricted viewer access

### 4. Do not expose hidden safety internals

Expose:

- template name
- template version
- template hash
- public description
- policy pack and version
- review mode

Do not expose:

- private safety prompts
- chain-of-thought
- bypass logic
- secrets

## Trust States

VVMP should use precise trust states rather than one vague badge.

### File Trust State

- valid_embedded_manifest
- embedded_manifest_missing
- embedded_manifest_invalid
- remote_manifest_found
- remote_manifest_not_found
- recovered_by_qr
- recovered_by_watermark
- recovered_by_fingerprint

### Provenance Coverage State

- source_mapped
- partially_source_mapped
- unsourced_ai_generation
- user_authored
- private_redacted_source
- unknown_ingredient

### Guardrail State

- passed_automated_review
- passed_human_review
- warning
- blocked_before_publish
- edited_after_warning
- not_checked

### AI Involvement State

- no_ai
- ai_assisted
- ai_generated_script
- ai_generated_visuals
- ai_generated_narration
- ai_generated_with_human_approval
- fully_autonomous

## Verification Surfaces

VVMP should support three verification surfaces.

### 1. Embedded verification

Best for original exports.

Checks:

- extract embedded provenance
- verify signatures
- verify content binding
- compare asset hash

### 2. Remote verification

Best for public trust pages and registry-backed workflows.

Checks:

- retrieve manifest by trust code or manifest ID
- verify signature metadata
- compare published versions
- inspect redactions and disclosures

### 3. Recovery verification

Best for re-encoded or stripped platform copies.

Checks:

- resolve trust code or visible QR
- compare visible rendition attributes
- later support watermark or fingerprint recovery

Reference implementation note:

- the repository now includes registry-backed watermark and fingerprint lookup hooks
- the repository also now includes a reference PNG trustmark lane for watermark bit generation, embedding, decoding, and registry-backed recovery resolution
- watermarking remains optional at the protocol level, and the current reference adapter is intentionally image-first rather than full video-frame watermarking

Recovery verification must clearly indicate that the exact binary may not match the original signed export.

## Threat Model

VVMP should be designed against at least these threats:

1. Manifest mutation after publication
2. False claims about source usage
3. Missing disclosure of AI-generated content
4. Metadata stripping on social platforms
5. Leakage of sensitive private prompts
6. Fraudulent use of generic "verified" language

## Verification Language Guidelines

VVMP surfaces should say:

- creation record available
- signature valid
- source map available
- AI-assisted
- human reviewed

VVMP surfaces should not say:

- true
- authoritative
- doctrinally correct
- guaranteed accurate

The protocol verifies provenance claims and cryptographic association, not truth in the abstract.

## Privacy Recommendations

### Public by default

Safe high-level data:

- app name
- app version
- creation date
- AI involvement type
- trust code
- signature status

### Opt-in public exposure

Potentially sensitive data:

- original prompts
- full source text
- full edit diffs
- user-uploaded private content

### Always protected

Never publish:

- secret keys
- hidden moderation prompts
- internal chain-of-thought
- credentials

## Rendition Handling

Platforms frequently transcode video.

VVMP should distinguish:

- original signed export
- known derived rendition
- likely recovered copy
- unrelated or unverifiable file

This distinction must be obvious in both the viewer and CLI output.

## Implementation Checklist

- design signing interfaces around immutable payloads
- support version lineage in registry schema
- add field-level redaction capabilities
- implement trust-state calculation as a library, not UI-only logic
- ensure viewer wording avoids overclaiming
