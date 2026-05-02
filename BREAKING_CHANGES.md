# Breaking Changes

VVMP is still pre-1.0. Treat every `0.minor.0` release as a review-required upgrade. Patch releases are intended to preserve the public helper contract unless explicitly noted below.

## 0.1.3

- No intended breaking runtime changes.
- `VvmpManifest.video.final_asset` is restored as required for published manifests after being widened in `0.1.2`.
- Draft/pre-render manifests should use `DraftVvmpManifest`, `validateManifest(manifest, { profile: "draft" })`, or `withFinalAsset()` before accessing `video.final_asset`.

## 0.1.2

- Production validation now requires `video.final_asset.sha256` to be a real 64-character SHA-256 digest, optionally prefixed with `sha256:`.
- Draft/pre-render manifests can validate with `validateManifest(manifest, { profile: "draft" })` before a final render hash exists.
- Consumers that stored placeholder production hashes should replace them with draft validation or real final hashes.

## 0.1.1

- No intended breaking changes.
- Added SDK ergonomics helpers and exported type aliases for manifest sub-objects.

## 0.1.0

- Initial public package release.
