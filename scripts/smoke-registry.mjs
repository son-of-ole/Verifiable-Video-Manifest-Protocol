import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPackModule = await import(path.join(repoRoot, "packages", "policy-pack-sdk", "dist", "index.js"));
const registryModule = await import(path.join(repoRoot, "packages", "trust-registry", "dist", "index.js"));

const { createPolicyInputHash, definePolicyPack } = policyPackModule;
const { createFileRegistry, RegistryError } = registryModule;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadFixture(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function splitHash(hashValue) {
  if (typeof hashValue !== "string" || hashValue.length === 0) {
    throw new Error("Expected hash value.");
  }

  const parts = hashValue.split(":");
  if (parts.length === 2) {
    return {
      algorithm: parts[0],
      value: parts[1]
    };
  }

  return {
    algorithm: "sha256",
    value: hashValue
  };
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-registry-smoke-"));
  const registryPolicyPack = definePolicyPack({
    policy_pack_id: "org.vvmp.registry.demo",
    version: "0.1.0",
    display_name: "Registry Publish Guardrails",
    publisher: "VVMP",
    output_schema_version: "1.0.0",
    extension_id: "org.vvmp.registry.demo.policy.v1",
    checks: [
      {
        check_type: "registry_source_grounding",
        display_name: "Registry Source Grounding",
        target_types: ["script_segment"],
        run({ target, target_id, target_type }) {
          const sourceIds = Array.isArray(target?.source_ids) ? target.source_ids : [];

          return {
            check_type: "registry_source_grounding",
            target_type,
            target_id,
            verdict: sourceIds.length > 0 ? "approved" : "blocked",
            risk_level: sourceIds.length > 0 ? "low" : "high",
            review_mode: "automated",
            public_summary:
              sourceIds.length > 0
                ? "Registry publish confirmed source grounding for this segment."
                : "Registry publish detected a segment without source grounding.",
            input_hash: createPolicyInputHash({
              target_id,
              sourceIds
            })
          };
        }
      }
    ]
  });
  const registry = createFileRegistry({
    rootDir: tempDir,
    baseUrl: "https://registry.example",
    publishPolicyPacks: [
      {
        policyPack: registryPolicyPack,
        targetTypes: ["script_segment"],
        stage: "publish",
        review_mode: "automated"
      }
    ]
  });

  const manifestV1 = await loadFixture(
    "test-fixtures/conformance/valid/registry/valid-registry-public-001.json"
  );
  const privateFixture = await loadFixture(
    "test-fixtures/conformance/valid/core/valid-core-minimal-001.json"
  );
  const manifestV2 = {
    ...manifestV1,
    video: {
      ...manifestV1.video,
      title: "Registry-Backed Trust Demo v2"
    },
    timeline: [
      ...manifestV1.timeline,
      {
        segment_id: "seg_002",
        time_range: {
          start: 9,
          end: 15.5
        },
        claim_type: "summary",
        source_ids: ["src_001"],
        prompt_ids: ["prompt_001"],
        generation_event_ids: ["gen_script_001"],
        edit_event_ids: [],
        guardrail_event_ids: []
      }
    ]
  };
  const privateManifest = {
    ...privateFixture,
    manifest_id: "urn:vvmp:manifest:registry-private-view-001",
    video: {
      ...privateFixture.video,
      video_id: "vid_registry_private_001",
      title: "Registry Private View Demo"
    },
    sources: [
      {
        ...privateFixture.sources[0],
        source_id: "src_private_001",
        visibility: "redacted_public",
        display_text: "Private source text that should not show in public view.",
        canonical_ref: "private://source/1"
      }
    ],
    prompts: [
      {
        ...privateFixture.prompts[0],
        prompt_id: "prompt_private_001",
        visibility: "redacted_public",
        text: "Private prompt text that should not show in public view."
      }
    ],
    timeline: [
      {
        ...privateFixture.timeline[0],
        source_ids: ["src_private_001"],
        prompt_ids: ["prompt_private_001"]
      }
    ]
  };

  const publishV1 = await registry.publishManifest({
    manifest: manifestV1,
    profile: "registry_backed",
    visibility: "public"
  });
  const publishV2 = await registry.publishManifest({
    manifest: manifestV2,
    profile: "registry_backed",
    visibility: "public",
    changeReason: "Expanded the timeline with a second segment."
  });
  const privatePublish = await registry.publishManifest({
    manifest: privateManifest,
    profile: "registry_backed",
    visibility: "public"
  });

  assert(publishV1.manifest_id === manifestV1.manifest_id, "First publish should preserve manifest lineage ID.");
  assert(publishV1.trust_code === publishV2.trust_code, "Versions in the same lineage should share one trust code.");
  assert(publishV1.version_id !== publishV2.version_id, "Each publish should create a new version record.");

  const currentEnvelope = await registry.getManifestById(manifestV1.manifest_id);
  assert(
    currentEnvelope.version_id === publishV2.version_id,
    "Current manifest lookup should resolve to the latest version."
  );
  assert(
    currentEnvelope.manifest.video.title === "Registry-Backed Trust Demo v2",
    "Current manifest lookup should return the latest manifest body."
  );

  const history = await registry.getManifestVersions(manifestV1.manifest_id);
  assert(history.versions.length === 2, "Expected two manifest versions in the lineage.");
  assert(
    history.versions[0]?.superseded_by === publishV2.version_id,
    "Version history should preserve append-only supersession."
  );

  const trustCodeResolution = await registry.resolveTrustCode(publishV1.trust_code);
  assert(
    trustCodeResolution.current_version_id === publishV2.version_id,
    "Trust code resolution should point at the latest published version."
  );

  const trustCodeManifest = await registry.getManifestByTrustCode(publishV1.trust_code);
  assert(
    trustCodeManifest.manifest.video.title === "Registry-Backed Trust Demo v2",
    "Trust code manifest lookup should resolve the latest public manifest."
  );
  assert(
    currentEnvelope.manifest.guardrails.length === 2,
    "Registry publish policy execution should add one guardrail per timeline segment."
  );
  assert(
    currentEnvelope.manifest.guardrails.every(
      (guardrail) => guardrail.policy_profile === "org.vvmp.registry.demo"
    ),
    "Registry policy-generated guardrails should carry the registry policy profile."
  );
  assert(
    currentEnvelope.manifest.extensions.some(
      (extension) => extension.extension_id === "org.vvmp.registry.demo.policy.v1"
    ),
    "Registry publish should append the policy-pack extension declaration."
  );

  const privatePublicView = await registry.getManifestById(privateManifest.manifest_id, {
    view: "public"
  });
  const privateFullView = await registry.getManifestById(privateManifest.manifest_id, {
    view: "full"
  });
  assert(
    privatePublicView.manifest.sources[0]?.display_text === undefined,
    "Public manifest view should strip private source text."
  );
  assert(
    privatePublicView.manifest.prompts[0]?.text === undefined,
    "Public manifest view should strip private prompt text."
  );
  assert(
    privateFullView.manifest.sources[0]?.display_text ===
      "Private source text that should not show in public view.",
    "Full manifest view should retain private source text."
  );
  assert(
    privateFullView.manifest.prompts[0]?.text ===
      "Private prompt text that should not show in public view.",
    "Full manifest view should retain private prompt text."
  );
  assert(
    privateFullView.manifest.guardrails.some(
      (guardrail) => guardrail.policy_profile === "org.vvmp.registry.demo"
    ),
    "Registry policy execution should also run for private/full manifest views."
  );

  const assetHash = splitHash(manifestV1.video.final_asset.sha256);
  const assetLookup = await registry.getAssetByHash(assetHash.algorithm, assetHash.value);
  assert(assetLookup.matched, "Asset hash lookup should find the published manifest.");
  assert(
    assetLookup.manifest_id === manifestV1.manifest_id,
    "Asset hash lookup should point back to the manifest lineage."
  );

  const watermarkResolution = await registry.registerRecoveryLocator({
    manifest_id: manifestV1.manifest_id,
    method: "watermark",
    value: "wm-demo-001",
    source: "vvmp-smoke-watermark-indexer",
    metadata: {
      confidence: 0.98
    }
  });
  const fingerprintResolution = await registry.registerRecoveryLocator({
    manifest_id: manifestV1.manifest_id,
    method: "fingerprint",
    value: "fp-demo-001",
    source: "vvmp-smoke-fingerprint-indexer"
  });
  const recoveryLookup = await registry.getRecoveryLocator("watermark", "wm-demo-001");
  assert(recoveryLookup.matched, "Recovery locator lookup should resolve a published manifest.");
  assert(
    recoveryLookup.manifest_id === manifestV1.manifest_id,
    "Recovery locator lookup should point back to the manifest lineage."
  );

  const verifyByManifestId = await registry.verify({
    mode: "manifest_id",
    manifest_id: manifestV1.manifest_id
  });
  assert(verifyByManifestId.matched, "Manifest ID verification should match.");

  const verifyByTrustCode = await registry.verify({
    mode: "trust_code",
    trust_code: publishV1.trust_code
  });
  assert(verifyByTrustCode.matched, "Trust code verification should match.");

  const verifyByRecoveryLocator = await registry.verify({
    mode: "recovery_locator",
    recovery_locator: {
      method: "fingerprint",
      value: "fp-demo-001"
    }
  });
  assert(verifyByRecoveryLocator.matched, "Recovery-locator verification should match.");

  const verifyByPayload = await registry.verify({
    mode: "manifest_payload",
    manifest: manifestV2
  });
  assert(verifyByPayload.matched, "Published manifest payload should verify as matched.");

  let conflictCode = null;
  try {
    const conflictingManifest = {
      ...manifestV1,
      manifest_id: "urn:vvmp:manifest:registry-conflict-001",
      video: {
        ...manifestV1.video,
        video_id: "vid_registry_conflict_001",
        trust_code: publishV1.trust_code,
        title: "Conflicting trust code manifest"
      }
    };

    await registry.publishManifest({
      manifest: conflictingManifest,
      profile: "registry_backed",
      visibility: "public"
    });
  } catch (error) {
    if (error instanceof RegistryError) {
      conflictCode = error.code;
    } else {
      throw error;
    }
  }

  assert(
    conflictCode === "VVMP_REGISTRY_TRUST_CODE_CONFLICT",
    "Publishing a different lineage with the same trust code should conflict."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        tempDir,
        publishV1,
        publishV2,
        privatePublish,
        history,
        trustCodeResolution,
        registryGuardrailCount: currentEnvelope.manifest.guardrails.length,
        assetLookup,
        watermarkResolution,
        fingerprintResolution,
        recoveryLookup,
        verifyByManifestId,
        verifyByTrustCode,
        verifyByRecoveryLocator,
        privateViewCheck: {
          public_prompt_text: privatePublicView.manifest.prompts[0]?.text ?? null,
          full_prompt_text: privateFullView.manifest.prompts[0]?.text ?? null
        }
      },
      null,
      2
    )
  );
}

main();
