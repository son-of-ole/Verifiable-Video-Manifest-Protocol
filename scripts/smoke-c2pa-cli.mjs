import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "packages", "trust-cli", "dist", "cli.js");
const fixturePath = path.join(
  repoRoot,
  "test-fixtures",
  "conformance",
  "valid",
  "registry",
  "valid-signed-manifest-001.json"
);
const signingFixturesDir = path.join(
  repoRoot,
  "test-fixtures",
  "c2pa-verification",
  "signing"
);

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout.trim(),
        result.stderr.trim()
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return result;
}

function runCli(args) {
  return runCommand("node", [cliPath, ...args]);
}

function getActiveManifest(result) {
  const activeLabel = result?.manifestStore?.active_manifest;
  if (!activeLabel) {
    return null;
  }

  return result?.manifestStore?.manifests?.[activeLabel] ?? null;
}

function getAssertionData(activeManifest, label) {
  if (!Array.isArray(activeManifest?.assertions)) {
    return null;
  }

  const assertion = activeManifest.assertions.find((candidate) => candidate?.label === label);
  return assertion?.data ?? null;
}

function createPngBuffer() {
  const width = 2;
  const height = 2;
  const rows = [
    [255, 0, 0, 255, 0, 255, 0, 255],
    [0, 0, 255, 255, 255, 255, 255, 255]
  ];
  const imageData = Buffer.concat(
    rows.map((row) => Buffer.concat([Buffer.from([0]), Buffer.from(row)]))
  );

  function pngChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of crcInput) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        const mask = -(crc & 1);
        crc = (crc >>> 1) ^ (0xedb88320 & mask);
      }
    }
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([length, Buffer.from(type), data, crcBuffer]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(imageData)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createWavBuffer({
  durationSeconds = 0.25,
  sampleRate = 8000,
  frequencyHz = 440
} = {}) {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const pcm = Buffer.alloc(sampleCount * 2);

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleRate;
    const sample = Math.round(Math.sin(2 * Math.PI * frequencyHz * t) * 0x2fff);
    pcm.writeInt16LE(sample, index * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

async function main() {
  await fs.access(cliPath);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-c2pa-smoke-"));
  const inputAssetPath = path.join(tempDir, "input.png");
  const embeddedOutputPath = path.join(tempDir, "output-embedded.png");
  const videoManifestPath = path.join(tempDir, "smoke-video-manifest.json");
  const videoEmbeddedOutputPath = path.join(tempDir, "output-embedded.mp4");
  const signedAliasOutputPath = path.join(tempDir, "output-signed-alias.png");
  const detachedOutputPath = path.join(tempDir, "output-detached.png");
  const detachedManifestPath = path.join(tempDir, "output-detached.c2pa");
  const extractedManifestPath = path.join(tempDir, "extracted-manifest.json");
  const prototypeSidecarPath = path.join(tempDir, "prototype-sidecar.json");
  const derivedTrustProfilePath = path.join(tempDir, "official-trust-profile.json");
  const certificatePath = path.join(signingFixturesDir, "es256-test-cert-chain.pem");
  const privateKeyPath = path.join(signingFixturesDir, "es256-test-private.key");
  const manifestPath = path.join(tempDir, "smoke-manifest.json");
  const sourceTextPath = path.join(tempDir, "source.txt");
  const sourceTextPath2 = path.join(tempDir, "source-2.txt");
  const promptTextPath = path.join(tempDir, "prompt.txt");
  const promptTextPath2 = path.join(tempDir, "prompt-2.txt");
  const visualAssetPath = path.join(tempDir, "visual.png");
  const visualAssetPath2 = path.join(tempDir, "visual-2.png");
  const audioAssetPath = path.join(tempDir, "audio.wav");
  const videoAssetPath = path.join(tempDir, "clip.mp4");

  const manifestFixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const pngBuffer = createPngBuffer();
  await fs.writeFile(inputAssetPath, pngBuffer);
  await fs.writeFile(sourceTextPath, "VVMP source text for ingredient backing.\n");
  await fs.writeFile(sourceTextPath2, "Second VVMP source text for segment lineage.\n");
  await fs.writeFile(promptTextPath, "Create a signed manifest example.\n");
  await fs.writeFile(promptTextPath2, "Reframe the clip around a second takeaway.\n");
  await fs.writeFile(visualAssetPath, createPngBuffer());
  await fs.writeFile(visualAssetPath2, createPngBuffer());
  await fs.writeFile(audioAssetPath, createWavBuffer());
  runCommand("swift", [path.join(repoRoot, "scripts", "generate-video-fixture.swift"), videoAssetPath]);
  const videoBytes = await fs.readFile(videoAssetPath);

  const assetSha256 = crypto.createHash("sha256").update(pngBuffer).digest("hex");
  const videoSha256 = crypto.createHash("sha256").update(videoBytes).digest("hex");
  const smokeManifest = {
    ...manifestFixture,
    video: {
      ...manifestFixture.video,
      title: "VVMP C2PA Smoke Asset",
      final_asset: {
        ...manifestFixture.video.final_asset,
        format: "image/png",
        sha256: assetSha256
      }
    },
    prompts: [
      ...manifestFixture.prompts.map((prompt, index) =>
        index === 0 ? { ...prompt, local_path: "prompt.txt" } : prompt
      ),
      {
        prompt_id: "prompt_002",
        prompt_type: "user_creation_prompt",
        visibility: "public",
        text: "Reframe the clip around a second takeaway.",
        created_by: "user",
        created_at: "2026-04-20T00:41:30Z",
        local_path: "prompt-2.txt"
      }
    ],
    sources: [
      ...manifestFixture.sources.map((source, index) =>
        index === 0 ? { ...source, local_path: "source.txt" } : source
      ),
      {
        source_id: "src_002",
        source_type: "article",
        title: "Second source example",
        visibility: "public",
        local_path: "source-2.txt"
      }
    ],
    tools: [
      ...manifestFixture.tools,
      {
        tool_id: "tool_visual_001",
        tool_type: "video_generator",
        purpose: "visual_generation"
      },
      {
        tool_id: "tool_audio_001",
        tool_type: "voice_synthesizer",
        purpose: "audio_generation"
      }
    ],
    assets: [
      {
        asset_id: "asset_visual_001",
        asset_type: "generated_visual",
        title: "Smoke visual backing asset",
        format: "image/png",
        local_path: "visual.png",
        source: "smoke_fixture"
      },
      {
        asset_id: "asset_audio_001",
        asset_type: "generated_audio",
        title: "Smoke audio backing asset",
        format: "audio/wav",
        local_path: "audio.wav",
        source: "smoke_fixture"
      },
      {
        asset_id: "asset_video_001",
        asset_type: "source_video",
        title: "Smoke video backing asset",
        format: "video/mp4",
        local_path: "clip.mp4",
        source: "smoke_fixture"
      },
      {
        asset_id: "asset_visual_002",
        asset_type: "generated_visual",
        title: "Second smoke visual backing asset",
        format: "image/png",
        local_path: "visual-2.png",
        source: "smoke_fixture"
      }
    ],
    edits: [
      {
        edit_event_id: "edit_001",
        actor: "user",
        timestamp: "2026-04-20T00:42:00Z",
        target: "seg_002.narration_text",
        public_summary: "User adjusted comparison wording."
      },
      {
        edit_event_id: "edit_002",
        actor: "user",
        timestamp: "2026-04-20T00:42:30Z",
        target: "seg_003.visible_text",
        public_summary: "User softened the closing reflection."
      }
    ],
    guardrails: [
      {
        guardrail_event_id: "guard_001",
        policy_profile: "org.vvmp.smoke.policy",
        policy_version: "1.0.0",
        check_type: "source_grounding",
        target_type: "segment",
        target_id: "seg_002",
        verdict: "approved",
        review_mode: "automated",
        public_summary: "Segment remained grounded in cited sources."
      },
      {
        guardrail_event_id: "guard_002",
        policy_profile: "org.vvmp.smoke.policy",
        policy_version: "1.0.0",
        check_type: "tone_review",
        target_type: "segment",
        target_id: "seg_003",
        verdict: "approved",
        review_mode: "automated",
        public_summary: "Closing tone stayed within policy."
      }
    ],
    timeline: [
      {
        ...manifestFixture.timeline[0],
        segment_id: "seg_001",
        time_range: { start: 0, end: 7.5 },
        source_ids: ["src_001"],
        prompt_ids: ["prompt_001"],
        visual_asset_ids: ["asset_visual_001"],
        audio_asset_ids: ["asset_audio_001"],
        generation_event_ids: ["gen_script_001"],
        edit_event_ids: [],
        guardrail_event_ids: []
      },
      {
        ...manifestFixture.timeline[0],
        segment_id: "seg_002",
        time_range: { start: 7.5, end: 15.0 },
        claim_type: "comparison",
        source_ids: ["src_001", "src_002"],
        prompt_ids: ["prompt_002"],
        visual_asset_ids: ["asset_video_001"],
        audio_asset_ids: [],
        generation_event_ids: ["gen_script_002"],
        edit_event_ids: ["edit_001"],
        guardrail_event_ids: ["guard_001"]
      },
      {
        ...manifestFixture.timeline[0],
        segment_id: "seg_003",
        time_range: { start: 15.0, end: 22.5 },
        claim_type: "reflection",
        source_ids: ["src_002"],
        prompt_ids: ["prompt_001", "prompt_002"],
        visual_asset_ids: ["asset_visual_002"],
        audio_asset_ids: ["asset_audio_001"],
        generation_event_ids: ["gen_script_003"],
        edit_event_ids: ["edit_002"],
        guardrail_event_ids: ["guard_002"]
      }
    ]
  };

  await fs.writeFile(manifestPath, JSON.stringify(smokeManifest, null, 2));
  const videoSmokeManifest = {
    ...smokeManifest,
    video: {
      ...smokeManifest.video,
      title: "VVMP C2PA Smoke Video Asset",
      final_asset: {
        ...smokeManifest.video.final_asset,
        format: "video/mp4",
        sha256: videoSha256
      }
    }
  };
  await fs.writeFile(videoManifestPath, JSON.stringify(videoSmokeManifest, null, 2));

  runCli(["export-prototype", manifestPath, "--out", prototypeSidecarPath, "--signer", "VVMP Demo"]);
  const prototypeVerification = JSON.parse(
    runCli(["verify-prototype", prototypeSidecarPath]).stdout
  );

  if (!prototypeVerification.valid) {
    throw new Error("Prototype sidecar verification failed during smoke test.");
  }

  const embeddedExport = JSON.parse(
    runCli([
      "export-c2pa",
      manifestPath,
      "--input",
      inputAssetPath,
      "--out",
      embeddedOutputPath,
      "--certificate",
      certificatePath,
      "--private-key",
      privateKeyPath,
      "--alg",
      "es256"
    ]).stdout
  );

  if ((embeddedExport.ingredient_summary?.fileBacked ?? 0) < 8) {
    throw new Error("Embedded export did not report file-backed ingredients.");
  }

  const derivedTrustProfile = JSON.parse(
    runCli([
      "derive-trust-profile",
      certificatePath,
      "--out",
      derivedTrustProfilePath,
      "--profile-id",
      "vvmp-smoke-official-es256",
      "--signer-id",
      "smoke_official_es256_signer",
      "--environment",
      "smoke"
    ]).stdout
  );
  const embeddedVerification = JSON.parse(runCli(["verify-c2pa", embeddedOutputPath]).stdout);
  const embeddedVerificationWithProfile = JSON.parse(
    runCli([
      "verify-c2pa",
      embeddedOutputPath,
      "--vvmp-trust-profile",
      derivedTrustProfilePath
    ]).stdout
  );
  const genericVerification = JSON.parse(runCli(["verify", embeddedOutputPath]).stdout);
  const extracted = JSON.parse(
    runCli(["extract", embeddedOutputPath, "--out", extractedManifestPath]).stdout
  );
  const extractedPayload = JSON.parse(await fs.readFile(extractedManifestPath, "utf8"));
  const embeddedActiveManifest = getActiveManifest(embeddedVerification);
  const embeddedAssertionLabels = Array.isArray(embeddedActiveManifest?.assertions)
    ? embeddedActiveManifest.assertions.map((assertion) => assertion?.label).filter(Boolean)
    : [];
  const embeddedIngredients = Array.isArray(embeddedActiveManifest?.ingredients)
    ? embeddedActiveManifest.ingredients
    : [];
  const embeddedSourceLineage = getAssertionData(
    embeddedActiveManifest,
    "org.vvmp.video.source_lineage"
  );
  const embeddedSegmentLineage = getAssertionData(
    embeddedActiveManifest,
    "org.vvmp.video.segment_lineage"
  );
  const embeddedToolLineage = getAssertionData(
    embeddedActiveManifest,
    "org.vvmp.video.tool_lineage"
  );
  const embeddedEditLineage = getAssertionData(
    embeddedActiveManifest,
    "org.vvmp.video.edit_lineage"
  );
  const embeddedGuardrailLineage = getAssertionData(
    embeddedActiveManifest,
    "org.vvmp.video.guardrail_lineage"
  );

  const sourceTwoLineage = embeddedSourceLineage?.sources?.find?.(
    (source) => source?.source_id === "src_002"
  );
  const promptTwoLineage = embeddedSourceLineage?.prompts?.find?.(
    (prompt) => prompt?.prompt_id === "prompt_002"
  );
  const segmentTwoLineage = embeddedSegmentLineage?.timeline?.find?.(
    (segment) => segment?.segment_id === "seg_002"
  );
  const segmentThreeLineage = embeddedSegmentLineage?.timeline?.find?.(
    (segment) => segment?.segment_id === "seg_003"
  );
  const editOneLineage = embeddedEditLineage?.edits?.find?.(
    (edit) => edit?.edit_event_id === "edit_001"
  );
  const guardTwoLineage = embeddedGuardrailLineage?.guardrails?.find?.(
    (guardrail) => guardrail?.guardrail_event_id === "guard_002"
  );

  if (
    !embeddedVerification.found ||
    !genericVerification.found ||
    embeddedVerification.embedded !== true ||
    genericVerification.embedded !== true ||
    typeof extracted.written !== "string" ||
    extractedPayload.found !== true ||
    !extractedPayload.activeManifest ||
    embeddedVerification.validationState !== "Valid" ||
    embeddedVerification.verificationSummary?.manifest_state !== "found" ||
    embeddedVerification.verificationSummary?.content_binding_state !== "valid" ||
    embeddedVerification.verificationSummary?.signature_state !== "valid" ||
    embeddedVerification.verificationSummary?.overall_state !== "content_bound_but_untrusted" ||
    embeddedIngredients.length < 8 ||
    !embeddedAssertionLabels.includes("org.vvmp.video.source_lineage") ||
    !embeddedAssertionLabels.includes("org.vvmp.video.segment_lineage") ||
    !embeddedAssertionLabels.includes("org.vvmp.video.tool_lineage") ||
    !embeddedAssertionLabels.includes("org.vvmp.video.edit_lineage") ||
    !embeddedAssertionLabels.includes("org.vvmp.video.guardrail_lineage") ||
    !Array.isArray(embeddedSourceLineage?.sources) ||
    embeddedSourceLineage.sources.length < 2 ||
    !Array.isArray(embeddedSourceLineage?.prompts) ||
    embeddedSourceLineage.prompts.length < 2 ||
    !Array.isArray(embeddedSegmentLineage?.timeline) ||
    embeddedSegmentLineage.timeline.length < 3 ||
    !Array.isArray(embeddedToolLineage?.tools) ||
    embeddedToolLineage.tools.length < 3 ||
    !Array.isArray(embeddedEditLineage?.edits) ||
    embeddedEditLineage.edits.length < 2 ||
    !Array.isArray(embeddedGuardrailLineage?.guardrails) ||
    embeddedGuardrailLineage.guardrails.length < 2 ||
    !Array.isArray(sourceTwoLineage?.referenced_by_segments) ||
    !sourceTwoLineage.referenced_by_segments.includes("seg_002") ||
    !sourceTwoLineage.referenced_by_segments.includes("seg_003") ||
    !Array.isArray(promptTwoLineage?.referenced_by_segments) ||
    !promptTwoLineage.referenced_by_segments.includes("seg_002") ||
    !promptTwoLineage.referenced_by_segments.includes("seg_003") ||
    !Array.isArray(segmentTwoLineage?.visual_asset_ids) ||
    !segmentTwoLineage.visual_asset_ids.includes("asset_video_001") ||
    !Array.isArray(segmentThreeLineage?.visual_asset_ids) ||
    !segmentThreeLineage.visual_asset_ids.includes("asset_visual_002") ||
    !Array.isArray(editOneLineage?.referenced_by_segments) ||
    !editOneLineage.referenced_by_segments.includes("seg_002") ||
    !Array.isArray(guardTwoLineage?.referenced_by_segments) ||
    !guardTwoLineage.referenced_by_segments.includes("seg_003") ||
    embeddedVerificationWithProfile.verificationSummary?.trust_state !== "untrusted" ||
    embeddedVerificationWithProfile.localTrustProfileSummary?.trust_state !== "trusted" ||
    embeddedVerificationWithProfile.localTrustProfileSummary?.matched_signer_id !==
      "smoke_official_es256_signer"
  ) {
    throw new Error("Embedded C2PA smoke verification did not find an embedded manifest.");
  }

  const embeddedWithoutTrustCheck = JSON.parse(
    runCli(["verify-c2pa", embeddedOutputPath, "--verify-trust", "false"]).stdout
  );

  if (embeddedWithoutTrustCheck.verificationSummary?.trust_state !== "not_checked") {
    throw new Error("Embedded C2PA smoke verification did not honor --verify-trust false.");
  }

  const videoEmbeddedExport = JSON.parse(
    runCli([
      "export-c2pa",
      videoManifestPath,
      "--input",
      videoAssetPath,
      "--out",
      videoEmbeddedOutputPath,
      "--certificate",
      certificatePath,
      "--private-key",
      privateKeyPath,
      "--alg",
      "es256"
    ]).stdout
  );
  const videoEmbeddedVerification = JSON.parse(
    runCli(["verify-c2pa", videoEmbeddedOutputPath]).stdout
  );

  if (
    !videoEmbeddedVerification.found ||
    videoEmbeddedVerification.embedded !== true ||
    videoEmbeddedVerification.validationState !== "Valid" ||
    videoEmbeddedVerification.verificationSummary?.content_binding_state !== "valid" ||
    videoEmbeddedVerification.verificationSummary?.signature_state !== "valid" ||
    videoEmbeddedVerification.verificationSummary?.overall_state !== "content_bound_but_untrusted" ||
    !Array.isArray(videoEmbeddedVerification.verificationSummary?.success_codes) ||
    !videoEmbeddedVerification.verificationSummary.success_codes.includes("assertion.bmffHash.match") ||
    videoEmbeddedExport.embedded !== true
  ) {
    throw new Error("Embedded C2PA smoke verification did not prove the MP4 output lane.");
  }

  const detachedExport = JSON.parse(
    runCli([
      "export-c2pa",
      manifestPath,
      "--input",
      inputAssetPath,
      "--out",
      detachedOutputPath,
      "--certificate",
      certificatePath,
      "--private-key",
      privateKeyPath,
      "--alg",
      "es256",
      "--no-embed",
      "--manifest-data-out",
      detachedManifestPath
    ]).stdout
  );

  if ((detachedExport.ingredient_summary?.fileBacked ?? 0) < 8) {
    throw new Error("Detached export did not report file-backed ingredients.");
  }

  const detachedVerification = JSON.parse(
    runCli(["verify-c2pa", detachedOutputPath, "--manifest-data", detachedManifestPath]).stdout
  );
  const signAliasExport = JSON.parse(
    runCli([
      "sign",
      inputAssetPath,
      manifestPath,
      "--out",
      signedAliasOutputPath,
      "--certificate",
      certificatePath,
      "--private-key",
      privateKeyPath,
      "--alg",
      "es256"
    ]).stdout
  );
  const detachedActiveManifest = getActiveManifest(detachedVerification);

  if (
    !detachedVerification.found ||
    detachedVerification.embedded !== false ||
    signAliasExport.embedded !== true ||
    signAliasExport.written_asset !== signedAliasOutputPath ||
    detachedVerification.validationState !== "Valid" ||
    detachedVerification.verificationSummary?.manifest_state !== "found" ||
    detachedVerification.verificationSummary?.content_binding_state !== "valid" ||
    detachedVerification.verificationSummary?.signature_state !== "valid" ||
    !Array.isArray(detachedActiveManifest?.ingredients) ||
    detachedActiveManifest.ingredients.length < 8
  ) {
    throw new Error("Detached C2PA smoke verification did not find the detached manifest.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        prototype: {
          valid: prototypeVerification.valid
        },
        embedded: {
          export: embeddedExport,
          found: embeddedVerification.found,
          embedded: embeddedVerification.embedded,
          validationState: embeddedVerification.validationState,
          verificationSummary: embeddedVerification.verificationSummary
        },
        localTrustProfile: {
          derived: derivedTrustProfile,
          summary: embeddedVerificationWithProfile.localTrustProfileSummary
        },
        video: {
          export: videoEmbeddedExport,
          found: videoEmbeddedVerification.found,
          embedded: videoEmbeddedVerification.embedded,
          validationState: videoEmbeddedVerification.validationState,
          verificationSummary: videoEmbeddedVerification.verificationSummary
        },
        extracted: {
          found: extractedPayload.found,
          activeLabel: extractedPayload.activeLabel,
          hasActiveManifest: Boolean(extractedPayload.activeManifest)
        },
        genericVerify: {
          found: genericVerification.found,
          embedded: genericVerification.embedded
        },
        detached: {
          export: detachedExport,
          found: detachedVerification.found,
          embedded: detachedVerification.embedded,
          validationState: detachedVerification.validationState,
          verificationSummary: detachedVerification.verificationSummary
        },
        signAlias: {
          embedded: signAliasExport.embedded,
          written_asset: signAliasExport.written_asset
        },
        trustToggle: {
          verifyTrustFalseState: embeddedWithoutTrustCheck.verificationSummary?.trust_state
        },
        tempDir
      },
      null,
      2
    )
  );
}

void main();
