# VVMP Error Catalog

## Purpose

This document is the human-readable companion to the machine-readable catalog in:

- [errors/error-codes.json](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/errors/error-codes.json:1)

VVMP implementations should align to these codes so cross-stack tooling can compare results without relying on exact wording.

## Current Error Codes

### `VVMP_SCHEMA_TYPE`

Meaning:

- a field had the wrong structural type

### `VVMP_SCHEMA_REQUIRED_FIELD`

Meaning:

- a required field was missing or empty

### `VVMP_TIMELINE_NEGATIVE_START`

Meaning:

- a timeline segment start was below zero

### `VVMP_TIMELINE_REVERSED_RANGE`

Meaning:

- a timeline segment end was less than or equal to its start

### `VVMP_TIMELINE_MISSING_PROVENANCE_REF`

Meaning:

- a timeline segment declared no source, prompt, or generation provenance reference

### `VVMP_EXTENSION_UNKNOWN_CRITICAL`

Meaning:

- a critical extension was present but unsupported

### `VVMP_PROFILE_MISSING_TRUST_CODE`

Meaning:

- a registry-backed or embedded-provenance manifest was missing `video.trust_code`

### `VVMP_SIGNATURE_REQUIRED`

Meaning:

- an embedded-provenance profile claim required at least one signature record

### `VVMP_SIGNATURE_MISSING_FIELD`

Meaning:

- a signature record was present but missing a required field such as `signature_id`, `type`, or `signer`

## Maintenance Rule

New validator logic should add error codes to both:

1. `errors/error-codes.json`
2. this document

That keeps the machine-readable and human-readable catalogs aligned.
