# VVMP CLI and C2PA Prototype

## Purpose

This document describes the first practical tooling layer now present in the repository:

- a `trust` CLI
- a first C2PA-style mapping and signing prototype
- the bridge from that prototype into real C2PA embedding and detached export

## CLI

The CLI is implemented in:

- [packages/trust-cli/src/cli.ts](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/packages/trust-cli/src/cli.ts:1)

Current commands:

- `trust validate <manifest.json>`
- `trust summarize <manifest.json>`
- `trust canonicalize <json-file>`
- `trust extract <asset>`
- `trust generate-trustmark-bits`
- `trust encode-trustmark <image-file>`
- `trust decode-trustmark <image-file>`
- `trust recover-trustmark <image-file>`
- `trust derive-trust-profile <certificate.pem>`
- `trust materialize-signing-profile`
- `trust doctor-trusted-lane`
- `trust sync-trust-program <official-c2pa|interim>`
- `trust verify <asset>`
- `trust sign <asset> <manifest.json>`
- `trust verify-prototype <sidecar.json>`
- `trust export-prototype <manifest.json> --out <file> --signer <name>`
- `trust export-c2pa <manifest.json> --input <asset> --out <asset> --certificate <pem> --private-key <pem>`
- `trust verify-c2pa <asset> [--manifest-data <file>]`

The CLI currently focuses on local protocol workflows rather than registry publishing.

Reference implementation note:

- the generic `extract`, `verify`, and `sign` commands now map onto the same C2PA adapter flows as `verify-c2pa` and `export-c2pa`, preserving the command names used in the original VVMP CLI plan
- the CLI now also includes a reference trustmark lane for image recovery, including locator-bit generation, PNG encoding, decoding, and registry-backed watermark resolution
- the `--settings-file` path for `verify-c2pa` is now exercised in the repository smoke coverage rather than existing as an unverified pass-through
- the CLI now also supports `--vvmp-trust-profile` so local or CI verification can approve known signer metadata without rewriting the raw C2PA trust result
- the CLI now also supports trust-program presets and reusable signing profiles for C2PA-backed signing and verification

## C2PA Prototype Adapter

The prototype adapter is implemented in:

- [packages/trust-c2pa-adapter/src/index.ts](/Users/olson/Software/publication-mcp-studio/Verifiable-Video-Manifest-Protocol/packages/trust-c2pa-adapter/src/index.ts:1)

It currently provides:

- a prototype C2PA-style manifest mapping
- a VVMP custom assertion payload
- an Ed25519 signature envelope over the canonical prototype payload
- a JSON sidecar export shape
- a prototype verification path that checks sidecar structure, canonical hash, and signature validity

## Prototype vs Real C2PA

The prototype sidecar workflow still exists because it is useful for early schema iteration and implementation testing.

It is now complemented by a real C2PA path implemented with `@contentauth/c2pa-node`, which can:

- embed manifests into supported assets
- export detached manifest bytes with `--no-embed`
- read embedded manifests back through the official C2PA reader
- read detached manifest bytes back against an asset

The prototype path still matters because it:

- prove the shape of the mapping layer
- prove the payload can be canonicalized and signed consistently
- gives VVMP a deterministic, testable local signature layer outside media embedding concerns

## Current Real-World Caveat

The main repository smoke path now uses an upstream CAI ES256 test certificate chain so VVMP proves a valid signature lane instead of only a local mismatch lane.

That improves realism for embed/export/read verification, but it still does not produce a trust-anchored production validation result. Real deployment still requires a proper certificate chain and trust configuration under a supported trust program.

The repository also includes a fixture-backed verification matrix spanning both:

- an official ES256 valid-signature but untrusted verification case
- a VVMP local trust-profile case that treats that same signer as locally trusted
- default self-signed verification
- self-signed verification with trust checks disabled through a settings file
- self-signed verification with a supplied trust anchor

It now also includes a trust-program support layer:

- bundled official and interim trust-program artifacts
- a root JSON schema for `vvmp-c2pa-signing-profile/v1`
- `trust materialize-signing-profile` for writing a profile plus PEM files from local files or environment variables
- `trust doctor-trusted-lane` for validating that a configured profile or secret-backed material actually produces a trusted result
- `trust sync-trust-program` for refreshing trust artifacts into a local cache
- `trust export-c2pa --signing-profile <profile.json>` for reusable trusted signing configuration
- `trust verify-c2pa --trust-program <program>` for preset-based verification

That materialization command is what makes the trusted lane practical in CI:

- you can keep the trust-program-issued certificate chain and private key in CI secrets
- the workflow can materialize `signing-profile.json`, `certificate.pem`, and `private-key.pem` into a temp directory during the run
- the repository does not need to vendor any private signing credential in git

## Recommended Next Upgrade

The next upgrades after this phase should be:

1. stronger VVMP-to-C2PA assertion coverage
2. production certificate guidance and trust-anchor configuration
3. additional output fixtures beyond PNG and MP4, especially more supported video formats
4. verification fixtures that distinguish structural validity from trust-chain validity
