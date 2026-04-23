import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRegistryTestServer } from "./lib/registry-test-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryClientModule = await import(
  path.join(repoRoot, "packages", "trust-registry-client", "dist", "index.js")
);

const { RegistryClientError, createRegistryClient } = registryClientModule;

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
  const parts = String(hashValue).split(":");
  if (parts.length === 2) {
    return {
      algorithm: parts[0],
      value: parts[1]
    };
  }

  return {
    algorithm: "sha256",
    value: String(hashValue)
  };
}

async function main() {
  const server = await startRegistryTestServer({
    apiToken: "test-token"
  });

  try {
    const unauthorizedClient = createRegistryClient({
      baseUrl: server.baseUrl,
      connectionClose: true
    });
    const authorizedClient = createRegistryClient({
      baseUrl: server.baseUrl,
      apiToken: server.apiToken,
      connectionClose: true
    });

    const publicManifest = await loadFixture(
      "test-fixtures/conformance/valid/registry/valid-registry-public-001.json"
    );
    const privateFixture = await loadFixture(
      "test-fixtures/conformance/valid/core/valid-core-minimal-001.json"
    );
    const privateManifest = {
      ...privateFixture,
      manifest_id: "urn:vvmp:manifest:registry-client-private-001",
      video: {
        ...privateFixture.video,
        video_id: "vid_registry_client_private_001",
        title: "Registry Client Private View Demo"
      },
      sources: [
        {
          ...privateFixture.sources[0],
          source_id: "src_private_client_001",
          visibility: "redacted_public",
          display_text: "Private source text for registry client smoke."
        }
      ],
      prompts: [
        {
          ...privateFixture.prompts[0],
          prompt_id: "prompt_private_client_001",
          visibility: "redacted_public",
          text: "Private prompt text for registry client smoke."
        }
      ],
      timeline: [
        {
          ...privateFixture.timeline[0],
          source_ids: ["src_private_client_001"],
          prompt_ids: ["prompt_private_client_001"]
        }
      ]
    };

    let unauthorizedStatus = null;
    try {
      await unauthorizedClient.publishManifest({
        manifest: publicManifest,
        profile: "registry_backed",
        visibility: "public"
      });
    } catch (error) {
      if (error instanceof RegistryClientError) {
        unauthorizedStatus = error.status;
      } else {
        throw error;
      }
    }

    const published = await authorizedClient.publishManifest({
      manifest: publicManifest,
      profile: "registry_backed",
      visibility: "public"
    });
    const privatePublished = await authorizedClient.publishManifest({
      manifest: privateManifest,
      profile: "registry_backed",
      visibility: "public"
    });
    const publicEnvelope = await authorizedClient.getManifestById(published.manifest_id);
    const resolution = await authorizedClient.resolveTrustCode(published.trust_code);
    const trustCodeEnvelope = await authorizedClient.getManifestByTrustCode(published.trust_code);
    const versions = await authorizedClient.getManifestVersions(published.manifest_id);
    const verifyResult = await authorizedClient.verify({
      mode: "trust_code",
      trust_code: published.trust_code
    });
    const assetHash = splitHash(publicManifest.video.final_asset.sha256);
    const assetLookup = await authorizedClient.getAssetByHash(assetHash.algorithm, assetHash.value);
    const watermarkBinding = await authorizedClient.registerRecoveryLocator({
      manifest_id: published.manifest_id,
      method: "watermark",
      value: "wm-client-001",
      source: "registry-client-smoke",
      metadata: {
        confidence: 0.91
      }
    });
    const recoveryLookup = await authorizedClient.getRecoveryLocator("watermark", "wm-client-001");
    const recoveryVerify = await authorizedClient.verify({
      mode: "recovery_locator",
      recovery_locator: {
        method: "watermark",
        value: "wm-client-001"
      }
    });
    const privatePublicView = await authorizedClient.getManifestById(privatePublished.manifest_id, {
      view: "public"
    });
    const privateFullView = await authorizedClient.getManifestById(privatePublished.manifest_id, {
      view: "full"
    });

    assert(unauthorizedStatus === 401, "Expected unauthorized publish to return 401.");
    assert(publicEnvelope.manifest_id === published.manifest_id, "Client should fetch published manifest.");
    assert(resolution.manifest_id === published.manifest_id, "Trust code should resolve to manifest lineage.");
    assert(
      trustCodeEnvelope.manifest_id === published.manifest_id,
      "Client trust-code fetch should resolve the manifest envelope."
    );
    assert(versions.versions.length === 1, "Expected one published version in client smoke.");
    assert(verifyResult.matched, "Client verify request should match a published trust code.");
    assert(assetLookup.matched, "Client asset-hash lookup should resolve the manifest.");
    assert(
      watermarkBinding.matched && recoveryLookup.matched && recoveryVerify.matched,
      "Client recovery-locator flows should resolve the manifest."
    );
    assert(
      privatePublicView.manifest.prompts[0]?.text === undefined,
      "Public client manifest view should honor prompt redaction."
    );
    assert(
      privateFullView.manifest.prompts[0]?.text === "Private prompt text for registry client smoke.",
      "Full client manifest view should retain private prompt text with auth."
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: server.baseUrl,
          unauthorizedStatus,
          published,
          resolution,
          versions,
          verifyResult,
          assetLookup,
          watermarkBinding,
          recoveryLookup,
          recoveryVerify,
          privateViewCheck: {
            public_prompt_text: privatePublicView.manifest.prompts[0]?.text ?? null,
            full_prompt_text: privateFullView.manifest.prompts[0]?.text ?? null
          }
        },
        null,
        2
      )
    );
  } finally {
    await server.close();
  }
}

await main();
