import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trustCore = await import(path.join(repoRoot, "packages", "trust-core", "dist", "index.js"));
const trustCorePackage = await import(path.join(repoRoot, "packages", "trust-core", "package.json"), {
  with: { type: "json" }
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = trustCore.withManifestDefaults({
  manifest_id: "urn:vvmp:manifest:core-dx-smoke",
  video: {
    video_id: "vid_core_dx_smoke",
    title: "Core DX Smoke",
    created_at: "2026-05-02T00:00:00Z",
    creator_type: "user_assisted_ai",
    visibility: "unlisted",
    final_asset: {
      format: "video/mp4",
      duration_seconds: 1,
      sha256: `sha256:${"a".repeat(64)}`
    }
  },
  creation: {
    workflow: "test",
    human_oversight_level: "human_validated"
  },
  prompts: [
    {
      prompt_id: "prompt_001",
      prompt_type: "user_creation_prompt",
      visibility: "private",
      text: "Create a test clip."
    }
  ],
  timeline: [
    {
      segment_id: "seg_001",
      time_range: {
        start: 0,
        end: 1
      },
      claim_type: "summary",
      prompt_ids: ["prompt_001"]
    }
  ]
});

const validation = trustCore.validateManifest(manifest);
assert(validation.valid, `Manifest with defaults should validate: ${JSON.stringify(validation.issues)}`);

const draftManifest = trustCore.withManifestDefaults({
  ...manifest,
  video: {
    ...manifest.video,
    final_asset: {
      format: "video/mp4",
      duration_seconds: 1,
      sha256: ""
    }
  },
  publication: {
    status: "draft"
  }
});
assert(
  trustCore.validateManifest(draftManifest, { profile: "draft" }).valid,
  "Draft profile should allow a pre-render manifest without a final sha256."
);

const invalidProduction = trustCore.validateManifest(draftManifest, { profile: "production" });
assert(
  invalidProduction.issues.some((issue) => issue.code === "VVMP_SCHEMA_REQUIRED_FIELD" && issue.path === "video.final_asset.sha256"),
  "Production profile should reject missing final asset sha256."
);

const placeholderProduction = trustCore.validateManifest(
  trustCore.withManifestDefaults({
    ...manifest,
    video: {
      ...manifest.video,
      final_asset: {
        format: "video/mp4",
        duration_seconds: 1,
        sha256: "sha256:not-a-real-hash"
      }
    }
  }),
  { profile: "production" }
);
assert(
  placeholderProduction.issues.some((issue) => issue.code === "VVMP_FINAL_ASSET_INVALID_SHA256"),
  "Production profile should reject placeholder final asset hashes."
);

assert(trustCore.summarizeManifestSafe(manifest)?.manifestId === manifest.manifest_id, "Safe summary should return a summary for valid manifests.");
assert(trustCore.summarizeManifestSafe({}) === null, "Safe summary should return null for invalid manifests.");
assert(trustCore.deriveTrustStatesSafe({}) === null, "Safe trust-state derivation should return null for invalid manifests.");
assert(trustCore.VVMP_CORE_VERSION === trustCorePackage.default.version, "Version constant should match package.json.");

const payloadSha256 = trustCore.createManifestSigningPayloadSha256(manifest);
const signatureValue = crypto
  .createHash("sha256")
  .update(trustCore.createManifestSigningPayload(manifest))
  .digest("hex");

const signedManifest = trustCore.appendSignature(manifest, {
  type: "test-hash",
  signer: "core-dx-smoke",
  algorithm: "sha256-test",
  key_id: "test-key",
  value: signatureValue
});

assert(signedManifest.signatures.length === 1, "appendSignature should append a signature record.");
assert(signedManifest.signatures[0].payload_sha256 === payloadSha256, "Signature payload hash should match unsigned manifest payload.");

const signatureResult = await trustCore.verifySignatures(signedManifest, ({ signature, canonicalPayload }) => {
  const expected = crypto.createHash("sha256").update(canonicalPayload).digest("hex");
  return {
    signature_id: signature.signature_id,
    valid: signature.value === expected
  };
});

assert(signatureResult.valid, "verifySignatures should pass with a matching verifier.");

console.log(JSON.stringify({ ok: true, version: trustCore.VVMP_CORE_VERSION }, null, 2));
