# Changelog

## 0.1.3 - 2026-05-02

- Restore `VvmpManifest.video.final_asset` as a required published-manifest field, and add explicit `DraftVideoRecord`, `PublishedVideoRecord`, `DraftVvmpManifest`, `PublishedVvmpManifest`, and `VvmpManifestWithFinalAsset` types for pre-render flows.
- Add `withFinalAsset()` as a type guard for consumers that accept draft or unknown manifests before accessing `video.final_asset`.
- Add numeric version exports `VVMP_CORE_VERSION_MAJOR`, `VVMP_CORE_VERSION_MINOR`, `VVMP_CORE_VERSION_PATCH`, plus `meetsMinimumVersion()`.
- Add JSDoc `@since` annotations to public helper exports so editors can surface minimum SDK versions.
- Add a `@vvmp/trust-schema` peer dependency on `@vvmp/trust-core` to make mismatched installs visible to package managers.
- Document the `ValidationResult.profiles` and `ValidationResult.trustStates` stability contract and add release-audit notes in `BREAKING_CHANGES.md`.

## 0.1.2 - 2026-05-02

- Add `validateManifest(manifest, { profile: "draft" | "production" | "auto" })` so pre-render manifests can validate before the final asset hash exists.
- Tighten production validation for `video.final_asset.sha256`; production manifests now require a real 64-character SHA-256 digest, with an optional `sha256:` prefix.
- Update the packaged manifest schemas and consumer smoke tests to cover draft and production validation behavior.

## 0.1.1 - 2026-05-02

- Add `VVMP_CORE_VERSION` and expose `@vvmp/trust-core/package.json` for programmatic version reporting.
- Add `createEmptyManifest()` and `withManifestDefaults()` to fill structurally required arrays and objects for integrators.
- Add field-level TypeScript aliases for manifest sub-objects such as `VvmpSource`, `VvmpPrompt`, `VvmpTool`, `VvmpTimelineSegment`, `VvmpAsset`, and `VvmpSignature`.
- Add `summarizeManifestSafe()` and `deriveTrustStatesSafe()` for pre-validation and partial-manifest flows.
- Add `appendSignature()`, `createManifestSigningPayload()`, `createManifestSigningPayloadSha256()`, and `verifySignatures()` to help integrations place signature records in `manifest.signatures[]`.
- Clarify npm install guidance, `@vvmp/trust-schema` audience, timeline provenance requirements, visibility mapping, and pre-render final-asset handling.

## 0.1.0 - 2026-04-24

- Initial public npm package release for the VVMP reference packages.
- Published `@vvmp/trust-core`, `@vvmp/trust-schema`, `@vvmp/policy-pack-sdk`, `@vvmp/trust-capture-sdk`, `@vvmp/trust-registry`, `@vvmp/trust-registry-client`, `@vvmp/trust-c2pa-adapter`, and `@vvmp/trust-cli`.

## Expected Breaking Changes Before 1.0

- The manifest schema may tighten final asset hash validation once draft/pre-render manifest profiles are defined.
- Visibility vocabulary may become more explicit after additional product integrations validate `public`, `private`, `unlisted`, and redacted modes.
- Signature record fields may become stricter as the C2PA mapping and detached-signature profile mature.
- Timeline provenance requirements may be refined for narration-only and purely user-authored segments.
