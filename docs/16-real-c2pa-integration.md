# Real C2PA Integration

## Purpose

This document describes the first real C2PA integration in VVMP.

The goal of this phase is not to finish the full production-grade signing story. The goal is to move VVMP from a prototype sidecar-only layer into an implementation that can:

- embed a real C2PA manifest into a supported asset
- export a detached C2PA manifest when embedding is disabled
- read embedded or detached manifest data back through the official reader
- keep the VVMP mapping logic explicit and inspectable

## Current Implementation

The implementation lives in:

- [packages/trust-c2pa-adapter/src/index.ts](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/packages/trust-c2pa-adapter/src/index.ts:1)
- [packages/trust-cli/src/cli.ts](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/packages/trust-cli/src/cli.ts:1)
- [scripts/smoke-c2pa-cli.mjs](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/scripts/smoke-c2pa-cli.mjs:1)

The adapter now exports these high-level capabilities:

- `buildC2paManifestDefinition`
- `exportC2paManifest`
- `readC2paManifest`
- `verifyPrototypeSidecar`

## CLI Commands

The CLI now supports:

- `trust extract <asset>`
- `trust verify <asset>`
- `trust sign <asset> <manifest.json>`
- `trust verify-prototype <sidecar.json>`
- `trust export-c2pa <manifest.json> --input <asset> --out <asset> --certificate <pem> --private-key <pem>`
- `trust verify-c2pa <asset> [--manifest-data <file>]`
- `trust derive-trust-profile <certificate.pem>`
- `trust sync-trust-program <official-c2pa|interim>`

The verification command also supports trust-aware settings inputs such as:

- `--settings-file`
- `--trust-anchors`
- `--user-anchors`
- `--allowed-list`
- `--trust-config`
- `--verify-trust`
- `--verify-trust-list`
- `--verify-timestamp-trust`
- `--remote-manifest-fetch`
- `--ocsp-fetch`
- `--strict-v1-validation`
- `--vvmp-trust-profile`
- `--trust-program`
- `--trust-program-cache-dir`
- `--refresh-trust-program`
- `--signing-profile`
- `--tsa-url`

The reference adapter now reads `--settings-file` directly through VVMP instead of relying on the upstream helper path, so settings-file verification is covered by repository smoke tests.

### Embedded flow

Use `export-c2pa` without `--no-embed`.

This writes a signed output asset with embedded provenance data when the underlying media format supports embedding.

### Detached flow

Use `export-c2pa --no-embed --manifest-data-out <file>`.

This writes:

- a rendered asset copy
- detached manifest bytes in a separate file

You can verify that pair with:

- `trust verify-c2pa <asset> --manifest-data <file>`

## Mapping Approach

The current mapping is intentionally conservative.

It includes:

- `c2pa.actions`
- `org.vvmp.video.ai_disclosure`
- `org.vvmp.video.provenance`
- C2PA `ingredients` generated from VVMP sources, prompts, and identifiable assets
- `org.vvmp.video.source_lineage`
- `org.vvmp.video.segment_lineage`
- `org.vvmp.video.tool_lineage`
- `org.vvmp.video.edit_lineage`
- `org.vvmp.video.guardrail_lineage`

The VVMP custom assertions now carry richer lineage data while the C2PA ingredients list preserves first-class upstream inputs in a format the C2PA reader can expose directly.

When a VVMP source, prompt, or asset record includes a usable local file path, the adapter now upgrades that ingredient from metadata-only to a file-backed C2PA ingredient during export.

## Verification Semantics

VVMP now returns a structured verification summary instead of reducing the result to a single badge.

The current summary includes:

- `manifest_state`
- `content_binding_state`
- `signature_state`
- `trust_state`
- `overall_state`

This is important because a real-world C2PA result can mean:

- the manifest was found
- the content bindings matched
- the signing chain was still not trusted
- or the signature layer itself failed validation

VVMP should preserve those distinctions instead of flattening them into one vague `verified` label.

VVMP now also exposes a separate local trust-profile summary for controlled environments such as CI:

- the raw C2PA `verificationSummary.trust_state` is left unchanged
- a local VVMP trust-profile document can approve specific signer metadata
- that approval only succeeds when the signature is already valid and the embedded signer metadata matches an explicitly listed signer profile

This gives VVMP a practical local or CI trust lane without pretending the upstream C2PA trust program result is stronger than it is.

VVMP now also supports trust-program-aware verification and signing:

- the repository vendors snapshots of the official C2PA trust list and the legacy interim trust list
- `trust verify-c2pa --trust-program <program>` applies those presets directly
- `trust sync-trust-program <program>` refreshes those artifacts into a local cache from their published upstream sources
- `trust export-c2pa --signing-profile <profile.json>` lets a real trust-program-issued signing credential be reused safely across runs
- `trust materialize-signing-profile --out-dir <dir>` can write that signing profile plus PEM files from local files or CI/local environment variables
- `trust doctor-trusted-lane` can then prove whether that configured lane is genuinely trusted under the selected trust program
- `tsa_url` is now supported for signing profiles and direct CLI export so a profile can include RFC3161 timestamping

## Smoke Coverage

The repository now includes a real smoke path:

- generates a valid PNG asset
- uses an upstream CAI ES256 test certificate chain for the main signing lane
- exports and verifies a VVMP prototype sidecar
- exports and verifies an embedded C2PA asset
- exports and verifies an embedded C2PA MP4 asset
- exports and verifies a detached C2PA manifest plus asset pair
- verifies the generic `extract`, `verify`, and `sign` aliases on top of the same real C2PA flows
- uses real PNG, WAV, and MP4 ingredient backing files in the smoke flow
- verifies the trust-toggle behavior of `verify-c2pa`
- verifies the `--settings-file` path for trust-disabled verification
- verifies `trust derive-trust-profile` against the official ES256 signer fixture
- verifies a fixture-backed C2PA verification matrix for the official ES256 untrusted lane, the VVMP local trust-profile lane, and self-signed behavior
- verifies trust-program preset resolution from bundled fixtures and synced cache material
- verifies signing-profile materialization from the public ES256 fixture chain
- verifies `trust doctor-trusted-lane` against the materialized reference profile
- optionally verifies a truly trusted signing lane when `VVMP_TRUSTED_C2PA_SIGNING_PROFILE` is configured or when `VVMP_TRUSTED_C2PA_CERTIFICATE_PEM(_B64)` and `VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM(_B64)` are configured
- verifies that ingredients and VVMP lineage assertions are present in the active manifest
- verifies multi-segment lineage relationships across multiple sources, prompts, and assets
- verifies edit and guardrail lineage references across segments

Run it through:

- `npm run smoke:c2pa`

Or as part of the full repository path:

- `npm run verify:e2e`

## Important Limitation

The main smoke path now intentionally uses upstream public CAI test signing fixtures. That means the C2PA reader can prove that manifest data is present, content bindings match, and the signature itself validates, but the trust-chain result is still not production-grade.

In practice, current smoke results should be interpreted as:

- embed/export/read path works
- custom VVMP assertions land in the C2PA payload
- detached manifest round-trip works
- embedded MP4 output signing and verification work in the reference lane
- file-backed image, audio, and video ingredients round-trip through export and verification
- segment-level lineage survives the embed/read round-trip and still references the right sources, prompts, and assets
- edit and guardrail history also survive the embed/read round-trip as lineage assertions
- signature and content binding can be valid even when trust validation is not
- production trust validation still requires real signer infrastructure

The current verification matrix also makes one subtle point explicit:

- the upstream CAI ES256 test chain gives VVMP a stable valid-signature untrusted reference case
- the same upstream signer can be marked trusted through a VVMP local trust-profile without mutating the raw C2PA trust result
- disabling trust verification removes the `signingCredential.untrusted` failure, but it does not remove `claimSignature.mismatch`
- supplying the self-signed certificate as a trust anchor does not currently change the local smoke outcome

That is useful because it separates the trust problem from the signature-validation problem instead of treating them as one opaque failure.

The repository now handles the next layer as well:

- trust-program presets are real and can be refreshed from the upstream published trust-list locations
- a fully trusted result is now possible through `vvmp-c2pa-signing-profile/v1` when a conforming signing credential is provided
- the repository still does not ship such a credential, so the true trusted lane is optional in smoke coverage rather than vendored
- the GitHub Actions workflow now forwards optional trusted-signing secrets into `verify:e2e`, so CI can activate that lane without adding a checked-in credential

## Trustmark Recovery Lane

The reference repository now also includes a real trustmark-based recovery path for images.

Current reference capabilities:

- generate version-compatible watermark locator bitstrings
- cache official Trustmark models locally
- encode a watermark into a PNG image
- decode that watermark back out of the image
- resolve the decoded watermark through the registry as a `watermark` recovery locator

Current CLI commands:

- `trust generate-trustmark-bits`
- `trust encode-trustmark <image-file> --out <file>`
- `trust decode-trustmark <image-file>`
- `trust recover-trustmark <image-file> --registry-dir <dir>`

Current implementation note:

- the reference trustmark lane is image-first and currently writes PNG output
- the encoded payload is a registry-resolvable bitstring, not a human-readable trust code
- this closes the gap between watermark hooks in the registry and an actual working encode/decode adapter in the repository

## Direction Check

The current implementation is still moving in the intended VVMP direction.

Why:

- it is getting better at segment-level provenance, not just asset-level signing
- it is widening lineage coverage across sources, prompts, tools, edits, guardrails, and media ingredients
- it is preserving plain verification semantics instead of collapsing everything into one badge

What still remains ahead:

- more realistic multi-stage render workflows
- richer render and rights lineage in the C2PA mapping
- access to a stable public or private conforming signing credential for a non-optional trusted smoke lane

## Next Improvements

The best follow-on improvements are:

1. add production certificate and trust-anchor guidance
2. add additional asset fixtures for supported video formats beyond the current MP4 lane
3. extend the trustmark reference lane beyond PNG into richer image and video-oriented workflows
4. replace or complement the VVMP local trust-profile lane with a genuinely C2PA-trusted signer lane under a supported trust program
