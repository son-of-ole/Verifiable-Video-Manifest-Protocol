import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const captureSdk = await import(path.join(repoRoot, "packages", "trust-capture-sdk", "dist", "index.js"));
const policyPackSdk = await import(path.join(repoRoot, "packages", "policy-pack-sdk", "dist", "index.js"));
const trustCore = await import(path.join(repoRoot, "packages", "trust-core", "dist", "index.js"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const { createTrustSession } = captureSdk;
const { createPolicyInputHash, definePolicyPack } = policyPackSdk;
const { canonicalizeJson, summarizeManifest, validateManifest } = trustCore;

async function main() {
  const trust = createTrustSession({
    sessionId: "sess_capture_demo_001",
    startedAt: "2026-04-21T12:00:00Z"
  });

  trust.logSource(
    {
      source_id: "src_001",
      source_type: "article",
      title: "Open provenance for AI video",
      display_text: "Provenance should survive beyond one hosted UI.",
      visibility: "public"
    },
    { idempotencyKey: "source-src_001" }
  );

  const duplicateSource = trust.logSource(
    {
      source_id: "src_001",
      source_type: "article",
      title: "Open provenance for AI video",
      display_text: "Provenance should survive beyond one hosted UI.",
      visibility: "public"
    },
    { idempotencyKey: "source-src_001" }
  );

  trust.logPrompt({
    prompt_id: "prompt_001",
    prompt_type: "user_creation_prompt",
    visibility: "public",
    text: "Turn this into a 20 second explainer.",
    created_by: "user",
    created_at: "2026-04-21T12:01:00Z"
  });

  trust.logTool({
    tool_id: "tool_script_001",
    tool_type: "language_model",
    provider: "example-provider",
    model_identifier: "example-model-1",
    purpose: "script_generation",
    human_oversight_level: "human_validated"
  });

  trust.logAsset({
    asset_id: "asset_visual_001",
    asset_type: "generated_visual",
    format: "image/png",
    sha256: "sha256:demo-visual-hash"
  });

  trust.logGeneration({
    generation_event_id: "gen_001",
    tool_id: "tool_script_001",
    prompt_ids: ["prompt_001"],
    source_ids: ["src_001"],
    output_asset_ids: ["asset_visual_001"],
    created_at: "2026-04-21T12:02:00Z"
  });

  trust.logEdit({
    edit_event_id: "edit_001",
    actor: "user",
    timestamp: "2026-04-21T12:03:00Z",
    target: "seg_001.narration_text",
    public_summary: "User tightened the opening line."
  });

  trust.logRights({
    rights_event_id: "rights_001",
    asset_id: "asset_visual_001",
    usage_scope: "public_social_export",
    generated: true
  });

  trust.logSegment({
    segment_id: "seg_001",
    time_range: {
      start: 0,
      end: 9.8
    },
    visible_text: "A video should carry an inspectable creation record, not just a label.",
    narration_text: "A video should carry an inspectable creation record, not just a label.",
    claim_type: "summary",
    source_ids: ["src_001"],
    prompt_ids: ["prompt_001"],
    generation_event_ids: ["gen_001"],
    edit_event_ids: ["edit_001"],
    guardrail_event_ids: [],
    visual_asset_ids: ["asset_visual_001"],
    audio_asset_ids: []
  });

  trust.logRender({
    render_id: "render_001",
    engine: "ffmpeg",
    output_hash: "sha256:demo-video-hash"
  });

  trust.logPublication({
    publication_id: "pub_001",
    status: "draft"
  });

  const demoPolicyPack = definePolicyPack({
    policy_pack_id: "org.vvmp.demo",
    version: "0.1.0",
    display_name: "VVMP Demo Guardrails",
    publisher: "VVMP",
    output_schema_version: "1.0.0",
    extension_id: "org.vvmp.demo.policy.v1",
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
                ? "Segment stayed aligned with the cited source."
                : "Segment is missing source grounding.",
            input_hash: createPolicyInputHash({ narration, sourceIds })
          };
        }
      }
    ]
  });

  const policyManifestOptions = {
    manifestId: "urn:vvmp:manifest:capture-sdk-smoke-001",
    video: {
      video_id: "vid_capture_demo_001",
      title: "Capture SDK Smoke Demo",
      created_at: "2026-04-21T12:00:00Z",
      creator_type: "user_assisted_ai",
      content_type: "education_summary",
      visibility: "public",
      final_asset: {
        format: "video/mp4",
        duration_seconds: 9.8,
        sha256: "sha256:demo-video-hash"
      }
    },
    creation: {
      workflow: "chat_to_video",
      human_oversight_level: "human_validated"
    },
    redactionRules: [
      {
        target_collection: "prompts",
        record_id: "prompt_001",
        field: "text",
        mode: "replace_field",
        replacement: "[redacted public prompt]",
        reason: "Prompt contains creator-private context.",
        public_summary: "Prompt text redacted for public view."
      }
    ]
  };

  const policyExecution = await trust.runPolicyPack(demoPolicyPack, {
    manifestOptions: policyManifestOptions,
    targetTypes: ["script_segment"],
    stage: "pre_publish",
    review_mode: "automated"
  });
  const repeatExecution = await trust.runPolicyPack(demoPolicyPack, {
    manifestOptions: policyManifestOptions,
    targetTypes: ["script_segment"],
    stage: "pre_publish",
    review_mode: "automated"
  });

  const manifest = trust.buildManifest(policyManifestOptions);

  const validation = validateManifest(manifest);
  assert(validation.valid, `Expected capture manifest to validate. Issues: ${JSON.stringify(validation.issues)}`);
  assert(
    trust.getSnapshot().event_count === trust.getEventLog().length,
    "Snapshot event count should match exported event log length."
  );
  assert(
    duplicateSource.event_id === trust.getEventLog()[0].event_id,
    "Idempotent duplicate source logging should return the original event."
  );
  assert(manifest.prompts[0]?.text === "[redacted public prompt]", "Prompt text should be redacted.");
  assert(manifest.redactions.length === 1, "Expected one recorded redaction.");
  assert(manifest.publication.status === "draft", "Publication record should be assembled from events.");
  assert(manifest.render.engine === "ffmpeg", "Render record should be assembled from events.");
  assert(policyExecution.loggedGuardrails.length === 1, "Expected one logged guardrail from policy execution.");
  assert(
    repeatExecution.loggedGuardrails.length === 1,
    "Repeated policy execution should still resolve the same guardrail set."
  );
  assert(manifest.guardrails.length === 1, "Policy execution should be reflected in the assembled manifest.");
  assert(
    trust.getEventLog().filter((event) => event.kind === "guardrail").length === 1,
    "Repeated policy execution should not duplicate guardrail events."
  );
  assert(
    manifest.extensions.some((extension) => extension.extension_id === "org.vvmp.demo.policy.v1"),
    "Policy execution should register the policy-pack extension declaration."
  );

  const canonicalA = canonicalizeJson(manifest);
  const canonicalB = canonicalizeJson(trust.buildManifest({
    ...policyManifestOptions,
    video: manifest.video,
    creation: manifest.creation
  }));
  assert(canonicalA === canonicalB, "Manifest assembly should be deterministic.");

  const summary = summarizeManifest(manifest);

  console.log(
    JSON.stringify(
      {
        ok: true,
        session: trust.getSnapshot(),
        summary,
        policyExecution,
        trustStates: validation.trustStates,
        eventKinds: [...new Set(trust.getEventLog().map((event) => event.kind))]
      },
      null,
      2
    )
  );
}

await main();
