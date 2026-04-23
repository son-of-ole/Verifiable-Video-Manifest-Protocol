import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(exampleRoot, "..", "..");

const captureSdk = await import(path.join(repoRoot, "packages", "trust-capture-sdk", "dist", "index.js"));
const policyPackSdk = await import(path.join(repoRoot, "packages", "policy-pack-sdk", "dist", "index.js"));
const registryModule = await import(path.join(repoRoot, "packages", "trust-registry", "dist", "index.js"));
const trustCore = await import(path.join(repoRoot, "packages", "trust-core", "dist", "index.js"));
const trustSchema = await import(path.join(repoRoot, "packages", "trust-schema", "dist", "index.js"));

const { createTrustSession } = captureSdk;
const { createPolicyInputHash, definePolicyPack } = policyPackSdk;
const { createFileRegistry } = registryModule;
const { canonicalizeJson, summarizeManifest, validateManifest } = trustCore;
const { validateEventLog } = trustSchema;

function readOption(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function sha256(input) {
  return `sha256:${crypto.createHash("sha256").update(input).digest("hex")}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureCleanDirectory(directoryPath) {
  await fs.rm(directoryPath, { recursive: true, force: true });
  await fs.mkdir(directoryPath, { recursive: true });
}

async function readInputFile(fileName) {
  return fs.readFile(path.join(exampleRoot, "inputs", fileName), "utf8");
}

function createExampleReport({
  publishResult,
  publicManifest,
  fullManifest,
  summary,
  eventCount
}) {
  const timelineLines = publicManifest.timeline.map((segment) => {
    const text = segment.narration_text ?? segment.visible_text ?? "(no text)";
    return `- ${segment.segment_id} ${segment.time_range.start.toFixed(1)}-${segment.time_range.end.toFixed(1)}s: ${text}`;
  });

  return `# VVMP Chat-to-Video Example Report

Trust code: ${publishResult.trust_code}

Trust page: ${publishResult.links.trust_page}

Manifest ID: ${publishResult.manifest_id}

Version ID: ${publishResult.version_id}

Event count: ${eventCount}

Public summary:

- title: ${summary.title}
- visibility: ${summary.visibility}
- sources: ${summary.sourceCount}
- prompts: ${summary.promptCount}
- tools: ${summary.toolCount}
- segments: ${summary.segmentCount}
- guardrails: ${summary.guardrailCount}

Timeline:
${timelineLines.join("\n")}

Redaction check:

- full manifest prompt text present: ${Boolean(fullManifest.prompts[0]?.text)}
- public manifest prompt text present: ${Boolean(publicManifest.prompts[0]?.text)}
- full manifest private source text present: ${Boolean(fullManifest.sources[0]?.display_text)}
- public manifest private source text present: ${Boolean(publicManifest.sources[0]?.display_text)}
`;
}

async function main() {
  const args = process.argv.slice(2);
  const outDir = path.resolve(readOption(args, "--out-dir") ?? path.join(exampleRoot, "generated"));
  const registryDir = path.join(outDir, "registry");
  const baseUrl = readOption(args, "--base-url") ?? "https://trust.vvmp.example";

  await ensureCleanDirectory(outDir);
  await fs.mkdir(registryDir, { recursive: true });

  const [selectedChat, supportingSource, userPrompt] = await Promise.all([
    readInputFile("selected-chat.md"),
    readInputFile("supporting-source.md"),
    readInputFile("user-prompt.txt")
  ]);

  const trust = createTrustSession({
    sessionId: "sess_chat_to_video_example_001",
    startedAt: "2026-04-22T16:00:00Z"
  });

  trust.logSource({
    source_id: "src_chat_001",
    source_type: "private_chat",
    title: "Selected creator chat excerpt",
    display_text: selectedChat.trim(),
    visibility: "redacted_public"
  });
  trust.logSource({
    source_id: "src_source_001",
    source_type: "article",
    title: "Supporting source on inspectable provenance",
    canonical_ref: "vvmp://examples/chat-to-video/supporting-source",
    display_text: supportingSource.trim(),
    visibility: "public"
  });

  trust.logPrompt({
    prompt_id: "prompt_user_001",
    prompt_type: "user_creation_prompt",
    visibility: "redacted_public",
    text: userPrompt.trim(),
    input_hash: sha256(userPrompt),
    created_by: "user",
    created_at: "2026-04-22T16:01:00Z"
  });

  trust.logTool({
    tool_id: "tool_script_001",
    tool_type: "language_model",
    provider: "vvmp-demo",
    model_identifier: "script-model-v1",
    purpose: "script_generation",
    human_oversight_level: "human_validated"
  });
  trust.logTool({
    tool_id: "tool_render_001",
    tool_type: "render_engine",
    provider: "vvmp-demo",
    model_identifier: "render-pipeline-v1",
    purpose: "final_video_render",
    human_oversight_level: "human_validated"
  });

  trust.logAsset({
    asset_id: "asset_visual_001",
    asset_type: "generated_visual",
    format: "image/png",
    sha256: sha256("vvmp-chat-to-video-visual-001")
  });
  trust.logAsset({
    asset_id: "asset_audio_001",
    asset_type: "synthetic_voiceover",
    format: "audio/wav",
    sha256: sha256("vvmp-chat-to-video-audio-001")
  });

  trust.logGeneration({
    generation_event_id: "gen_script_001",
    tool_id: "tool_script_001",
    prompt_ids: ["prompt_user_001"],
    source_ids: ["src_chat_001", "src_source_001"],
    output_text:
      "Inspectable provenance shows what shaped an AI video, what a human changed, and how the final record can be checked.",
    created_at: "2026-04-22T16:02:00Z"
  });

  trust.logEdit({
    edit_event_id: "edit_001",
    actor: "user",
    timestamp: "2026-04-22T16:03:00Z",
    target: "seg_003.narration_text",
    before_hash: sha256("Provenance is a truth badge."),
    after_hash: sha256("Provenance is an inspectable creation record."),
    public_summary: "User rewrote the closing line to avoid implying truth certification."
  });

  trust.logRights({
    rights_event_id: "rights_001",
    asset_id: "asset_audio_001",
    generated: true,
    usage_scope: "public_demo_export"
  });

  trust.logSegment({
    segment_id: "seg_001",
    time_range: {
      start: 0,
      end: 5.8
    },
    visible_text: "AI video needs more than a label.",
    narration_text: "AI video needs more than a label.",
    claim_type: "summary",
    source_ids: ["src_chat_001"],
    prompt_ids: ["prompt_user_001"],
    generation_event_ids: ["gen_script_001"],
    visual_asset_ids: ["asset_visual_001"],
    audio_asset_ids: ["asset_audio_001"]
  });
  trust.logSegment({
    segment_id: "seg_002",
    time_range: {
      start: 5.8,
      end: 12.4
    },
    visible_text: "It should show the sources, tools, and edits behind the clip.",
    narration_text: "It should show the sources, tools, and edits behind the clip.",
    claim_type: "ai_assisted_summary",
    source_ids: ["src_source_001"],
    prompt_ids: ["prompt_user_001"],
    generation_event_ids: ["gen_script_001"],
    visual_asset_ids: ["asset_visual_001"],
    audio_asset_ids: ["asset_audio_001"]
  });
  trust.logSegment({
    segment_id: "seg_003",
    time_range: {
      start: 12.4,
      end: 18.7
    },
    visible_text: "Provenance is an inspectable creation record.",
    narration_text: "Provenance is an inspectable creation record.",
    claim_type: "ai_assisted_explanation",
    source_ids: ["src_chat_001", "src_source_001"],
    prompt_ids: ["prompt_user_001"],
    generation_event_ids: ["gen_script_001"],
    edit_event_ids: ["edit_001"],
    visual_asset_ids: ["asset_visual_001"],
    audio_asset_ids: ["asset_audio_001"]
  });

  trust.logRender({
    render_id: "render_001",
    engine: "ffmpeg",
    output_hash: sha256("vvmp-chat-to-video-final-asset")
  });
  trust.logPublication({
    publication_id: "pub_001",
    status: "draft"
  });

  const examplePolicyPack = definePolicyPack({
    policy_pack_id: "org.vvmp.example-chat-to-video",
    version: "0.1.0",
    display_name: "Example Chat-to-Video Guardrails",
    publisher: "VVMP",
    output_schema_version: "1.0.0",
    extension_id: "org.vvmp.example.chat_to_video.policy.v1",
    checks: [
      {
        check_type: "source_grounding",
        display_name: "Source Grounding",
        target_types: ["script_segment"],
        run({ target, target_id, target_type }) {
          const sourceIds = Array.isArray(target?.source_ids) ? target.source_ids : [];
          const narration =
            typeof target?.narration_text === "string" ? target.narration_text : "";

          return {
            check_type: "source_grounding",
            target_type,
            target_id,
            verdict: sourceIds.length > 0 ? "approved" : "blocked",
            risk_level: sourceIds.length > 0 ? "low" : "high",
            review_mode: "automated",
            public_summary:
              sourceIds.length > 0
                ? "Segment keeps a visible source linkage."
                : "Segment is missing a source linkage.",
            input_hash: createPolicyInputHash({
              narration,
              sourceIds
            })
          };
        }
      }
    ]
  });

  const manifestOptions = {
    manifestId: "urn:vvmp:manifest:example:chat-to-video:001",
    video: {
      video_id: "vid_example_chat_to_video_001",
      title: "Why AI Video Needs Inspectable Provenance",
      created_at: "2026-04-22T16:00:00Z",
      creator_type: "user_assisted_ai",
      content_type: "education_explainer",
      visibility: "private",
      final_asset: {
        format: "video/mp4",
        duration_seconds: 18.7,
        sha256: sha256("vvmp-chat-to-video-final-asset")
      }
    },
    creation: {
      workflow: "chat_to_video",
      human_oversight_level: "human_validated"
    }
  };

  const policyExecution = await trust.runPolicyPack(examplePolicyPack, {
    manifestOptions,
    targetTypes: ["script_segment"],
    stage: "pre_publish",
    review_mode: "automated"
  });
  assert(
    policyExecution.loggedGuardrails.length === 3,
    "Expected one guardrail per script segment in the example policy run."
  );

  const eventLog = trust.getEventLog();
  const eventValidation = validateEventLog(eventLog);
  assert(
    eventValidation.valid,
    `Expected event log to validate. Issues: ${JSON.stringify(eventValidation.issues)}`
  );

  const fullManifest = trust.buildManifest(manifestOptions);
  const validation = validateManifest(fullManifest);
  assert(
    validation.valid,
    `Expected full example manifest to validate. Issues: ${JSON.stringify(validation.issues)}`
  );
  assert(
    fullManifest.prompts[0]?.text === userPrompt.trim(),
    "Full manifest should retain the private prompt text."
  );
  assert(
    fullManifest.sources[0]?.display_text === selectedChat.trim(),
    "Full manifest should retain the private chat source text."
  );

  const registry = createFileRegistry({
    rootDir: registryDir,
    baseUrl
  });
  const publishResult = await registry.publishManifest({
    manifest: fullManifest,
    profile: "registry_backed",
    visibility: "public"
  });

  const publicEnvelope = await registry.getManifestById(fullManifest.manifest_id, {
    view: "public"
  });
  const fullEnvelope = await registry.getManifestById(fullManifest.manifest_id, {
    view: "full"
  });
  const trustCodeResolution = await registry.resolveTrustCode(publishResult.trust_code);
  const versionHistory = await registry.getManifestVersions(fullManifest.manifest_id);
  const summary = summarizeManifest(publicEnvelope.manifest);

  assert(publicEnvelope.manifest.prompts[0]?.text === undefined, "Public manifest should hide private prompt text.");
  assert(
    publicEnvelope.manifest.sources[0]?.display_text === undefined,
    "Public manifest should hide private source text."
  );
  assert(fullEnvelope.manifest.prompts[0]?.text === userPrompt.trim(), "Full registry view should retain prompt text.");
  assert(
    fullEnvelope.manifest.sources[0]?.display_text === selectedChat.trim(),
    "Full registry view should retain private source text."
  );
  assert(
    publicEnvelope.manifest.guardrails.length === 3,
    "Published public manifest should keep the generated guardrails."
  );
  assert(
    trustCodeResolution.current_version_id === publishResult.version_id,
    "Trust code should resolve to the current example version."
  );
  assert(versionHistory.versions.length === 1, "The first example publish should create one version history entry.");

  const report = createExampleReport({
    publishResult,
    publicManifest: publicEnvelope.manifest,
    fullManifest: fullEnvelope.manifest,
    summary,
    eventCount: eventLog.length
  });

  const files = {
    event_log: path.join(outDir, "event-log.json"),
    manifest_full: path.join(outDir, "manifest.full.json"),
    manifest_public: path.join(outDir, "manifest.public.json"),
    manifest_public_canonical: path.join(outDir, "manifest.public.canonical.json"),
    summary: path.join(outDir, "summary.json"),
    publish_result: path.join(outDir, "publish-result.json"),
    trust_code_resolution: path.join(outDir, "trust-code-resolution.json"),
    version_history: path.join(outDir, "version-history.json"),
    report: path.join(outDir, "example-report.md")
  };

  await Promise.all([
    fs.writeFile(files.event_log, JSON.stringify(eventLog, null, 2)),
    fs.writeFile(files.manifest_full, JSON.stringify(fullEnvelope.manifest, null, 2)),
    fs.writeFile(files.manifest_public, JSON.stringify(publicEnvelope.manifest, null, 2)),
    fs.writeFile(files.manifest_public_canonical, `${canonicalizeJson(publicEnvelope.manifest)}\n`),
    fs.writeFile(files.summary, JSON.stringify(summary, null, 2)),
    fs.writeFile(files.publish_result, JSON.stringify(publishResult, null, 2)),
    fs.writeFile(files.trust_code_resolution, JSON.stringify(trustCodeResolution, null, 2)),
    fs.writeFile(files.version_history, JSON.stringify(versionHistory, null, 2)),
    fs.writeFile(files.report, report)
  ]);

  console.log(
    JSON.stringify(
      {
        example: "chat-to-video",
        outDir,
        manifestId: publishResult.manifest_id,
        trustCode: publishResult.trust_code,
        trustPageUrl: publishResult.links.trust_page,
        eventCount: eventLog.length,
        segmentCount: publicEnvelope.manifest.timeline.length,
        guardrailCount: publicEnvelope.manifest.guardrails.length,
        files
      },
      null,
      2
    )
  );
}

await main();
