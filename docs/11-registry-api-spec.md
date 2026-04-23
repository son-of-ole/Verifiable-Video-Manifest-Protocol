# VVMP Registry API Specification

## Purpose

This document defines the protocol contract for VVMP registries.

It is intentionally framework-neutral. A registry may be implemented with:

- Next.js route handlers
- Express
- FastAPI
- Rails
- Laravel
- Go
- Spring Boot
- ASP.NET

OpenAPI should become the normative machine-readable version of this contract.

Reference implementation note:

- the repository now includes `@vvmp/trust-registry-client`
- it is a transport client over this API contract, not the normative protocol definition
- the client is intended to work against the Next.js reference registry and other compatible implementations

## Registry Responsibilities

A VVMP registry should:

- accept published manifests
- assign or resolve trust codes
- return current and historical manifest versions
- support verification-oriented lookups
- preserve append-only version lineage
- distinguish public and restricted access paths

## Core Resources

Minimum resource concepts:

- manifests
- manifest versions
- trust codes
- assets by hash
- recovery locators
- verification results

## Content Types

Recommended content types:

- `application/json`
- `application/problem+json` for errors

Later optional content types:

- `application/ld+json`

## Versioning Strategy

Recommended API base path:

```text
/api/v1
```

The registry API version is not the same as the manifest version.

Example:

- API version controls transport contract
- manifest version controls VVMP data model

## Endpoints

## 1. Publish Manifest

```text
POST /api/v1/manifests
```

Purpose:

- publish a new manifest or a new version of an existing manifest lineage

Request body:

```json
{
  "manifest": {},
  "profile": "registry_backed",
  "visibility": "public"
}
```

Response:

```json
{
  "manifest_id": "urn:vvmp:manifest:01J...",
  "version_id": "ver_01J...",
  "trust_code": "FC-8K3X-22AP",
  "published_at": "2026-04-20T12:00:00Z",
  "links": {
    "manifest": "/api/v1/manifests/urn:vvmp:manifest:01J...",
    "trust_page": "/v/FC-8K3X-22AP"
  }
}
```

Status codes:

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `409 Conflict`
- `422 Unprocessable Entity`

## 2. Get Manifest by ID

```text
GET /api/v1/manifests/{manifestId}
```

Purpose:

- retrieve the current manifest record or a directly addressed manifest object

Query parameters:

- `view=public|full`
- `version=current|{versionId}`

Response:

- VVMP manifest JSON or public view representation

## 3. Get Manifest by Trust Code

```text
GET /api/v1/trust-codes/{trustCode}
```

Purpose:

- resolve a short code into the current public manifest record

Response:

```json
{
  "trust_code": "FC-8K3X-22AP",
  "manifest_id": "urn:vvmp:manifest:01J...",
  "current_version_id": "ver_01J...",
  "trust_page_url": "/v/FC-8K3X-22AP"
}
```

## 4. Public Trust Page Resolution

```text
GET /v/{trustCode}
```

Purpose:

- human-facing trust page resolution

Notes:

- this may render HTML in a hosted viewer
- this route is not the normative API response surface, but it is part of the registry product contract

Next.js is a strong fit for this route in the reference implementation.

## 5. Get Manifest History

```text
GET /api/v1/manifests/{manifestId}/versions
```

Purpose:

- return append-only version lineage for a manifest

Response:

```json
{
  "manifest_id": "urn:vvmp:manifest:01J...",
  "versions": [
    {
      "version_id": "ver_01J1",
      "published_at": "2026-04-20T12:00:00Z",
      "superseded_by": "ver_01J2",
      "change_reason": "source citation correction"
    }
  ]
}
```

## 6. Verify by Manifest or Asset

```text
POST /api/v1/verify
```

Purpose:

- request verification or comparison results

Possible request modes:

- manifest payload submission
- manifest ID lookup
- trust code lookup
- asset hash lookup
- recovery locator lookup

Suggested request:

```json
{
  "mode": "asset_hash",
  "asset_hash": {
    "algorithm": "sha256",
    "value": "..."
  }
}
```

Suggested response:

```json
{
  "matched": true,
  "match_type": "exact_asset_hash",
  "manifest_id": "urn:vvmp:manifest:01J...",
  "trust_code": "FC-8K3X-22AP",
  "file_trust_state": "remote_manifest_found"
}
```

## 7. Lookup by Asset Hash

```text
GET /api/v1/assets/{algorithm}/{value}
```

Purpose:

- resolve a known asset hash to manifest references

## 8. Register Recovery Locator

```text
POST /api/v1/recovery-locators
```

Purpose:

- register a watermark or fingerprint locator emitted by an external recovery system

Suggested request:

```json
{
  "manifest_id": "urn:vvmp:manifest:01J...",
  "method": "watermark",
  "value": "wm_demo_001",
  "source": "soft-binding-service"
}
```

Suggested response:

```json
{
  "matched": true,
  "match_type": "watermark_locator",
  "manifest_id": "urn:vvmp:manifest:01J...",
  "trust_code": "FC-8K3X-22AP",
  "file_trust_state": "remote_manifest_found",
  "recovery_locator": {
    "method": "watermark",
    "value": "wm_demo_001"
  }
}
```

Notes:

- this route is the registry-side hook point, not the watermarking system itself
- registries may accept locators from invisible watermark systems, fingerprint services, or moderation tooling

## 9. Resolve Recovery Locator

```text
GET /api/v1/recovery-locators/{method}/{value}
```

Purpose:

- resolve a watermark or fingerprint locator to manifest references

Supported methods:

- `watermark`
- `fingerprint`

## Public vs Restricted Views

Registries should support at least two output views:

- public
- restricted

Public views:

- must honor redaction rules
- must not expose secrets or internal prompts

Restricted views:

- may require authentication and authorization
- may expose fuller provenance records

Reference implementation note:

- the current Next.js registry app treats `view=full` as the restricted manifest view
- when `VVMP_REGISTRY_API_TOKEN` is configured, `POST /api/v1/manifests` and `GET /api/v1/manifests/{manifestId}?view=full` require a bearer token

## Error Format

Use `application/problem+json`.

Suggested shape:

```json
{
  "type": "https://vvmp.org/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "code": "VVMP_SCHEMA_REQUIRED_FIELD",
  "detail": "The field video.video_id is required.",
  "instance": "/api/v1/manifests"
}
```

## Idempotency

Publish endpoints should support idempotency when clients retry.

Recommended request header:

```text
Idempotency-Key: <opaque value>
```

This is especially important for hosted registries and webhook-driven publishing.

## Auth Model

The core protocol should not hardcode one auth vendor.

It should define requirements abstractly:

- how private manifests are protected
- how restricted views are authorized
- how publication rights are checked

Reference implementations may use:

- session auth
- OAuth
- API keys
- signed service tokens

## Pagination

Endpoints returning lists should support:

- cursor pagination
- deterministic ordering

This matters for:

- version history
- audit logs later
- registry browsing later

## OpenAPI Deliverable

This document should eventually become:

- `openapi/registry-v1.yaml`

That file should be treated as the machine-readable contract for registry implementations.

## Next.js Reference Implementation Guidance

Next.js is a strong reference choice for:

- trust-page routes
- route handlers for registry APIs
- admin interfaces

Recommended separation:

- OpenAPI remains normative
- Next.js handlers are one implementation
- shared validation should live in protocol libraries, not inside route code only

## Immediate Follow-Up Tasks

1. Translate this doc into OpenAPI
2. Define public vs restricted response schemas
3. Add error-schema definitions
4. Add verification request-mode schemas
