import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPackSdk = await import(path.join(repoRoot, "packages", "policy-pack-sdk", "dist", "index.js"));

const {
  buildPolicyExtensionDeclaration,
  createPolicyInputHash,
  definePolicyPack,
  runPolicyPack,
  validatePolicyPackMetadata
} = policyPackSdk;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadFixture(relativePath) {
  const fixturePath = path.join(repoRoot, relativePath);
  const raw = await fs.readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const manifest = await loadFixture("test-fixtures/conformance/valid/core/valid-core-minimal-001.json");
  const segment = manifest.timeline[0];

  const ldsPolicyPack = definePolicyPack({
    policy_pack_id: "org.faith.lds",
    version: "0.1.0",
    display_name: "LDS Source And Tone Guardrails",
    publisher: "VVMP Example Packs",
    output_schema_version: "1.0.0",
    extension_id: "org.faith.lds.policy.v1",
    checks: [
      {
        check_type: "source_grounding",
        display_name: "Source Grounding",
        target_types: ["script_segment"],
        run({ target, target_id, target_type }) {
          const segmentTarget = target;
          const sourceIds = Array.isArray(segmentTarget?.source_ids) ? segmentTarget.source_ids : [];
          return {
            check_type: "source_grounding",
            target_type,
            target_id,
            verdict: sourceIds.length > 0 ? "approved" : "blocked",
            risk_level: sourceIds.length > 0 ? "low" : "high",
            review_mode: "automated",
            public_summary:
              sourceIds.length > 0
                ? "Segment remained grounded in cited source material."
                : "Segment was missing source grounding."
          };
        }
      },
      {
        check_type: "tone_reverence",
        display_name: "Tone Reverence",
        target_types: ["script_segment"],
        run({ target, target_id, target_type }) {
          const text =
            (typeof target?.visible_text === "string" && target.visible_text) ||
            (typeof target?.narration_text === "string" && target.narration_text) ||
            "";
          const lowered = text.toLowerCase();
          const flag = lowered.includes("stupid") || lowered.includes("idiot");

          return {
            check_type: "tone_reverence",
            target_type,
            target_id,
            verdict: flag ? "warning" : "approved",
            risk_level: flag ? "medium" : "low",
            review_mode: "automated",
            public_summary: flag
              ? "Segment may need tone revision before publication."
              : "Segment stayed within the expected respectful tone.",
            input_hash: createPolicyInputHash({ text })
          };
        }
      }
    ]
  });

  const metadataValidation = validatePolicyPackMetadata(ldsPolicyPack);
  assert(metadataValidation.valid, "Expected policy pack metadata to validate.");

  const execution = await runPolicyPack(ldsPolicyPack, {
    manifest,
    review_mode: "automated",
    targets: [
      {
        target_type: "script_segment",
        target_id: segment.segment_id,
        target: segment
      },
      {
        target_type: "script_segment",
        target_id: "seg_warning",
        target: {
          ...segment,
          segment_id: "seg_warning",
          visible_text: "This is a stupid framing for sacred material.",
          narration_text: "This is a stupid framing for sacred material."
        }
      }
    ]
  });

  assert(execution.guardrails.length === 4, "Expected two checks across two targets.");
  assert(
    execution.guardrails.every((guardrail) => guardrail.policy_profile === "org.faith.lds"),
    "Expected generated guardrails to carry the policy pack identifier."
  );
  assert(
    execution.guardrails.some((guardrail) => guardrail.verdict === "warning"),
    "Expected the tone check to emit a warning."
  );
  assert(
    execution.guardrails.every((guardrail) => typeof guardrail.public_summary === "string"),
    "Expected all guardrails to have a public summary."
  );

  const extensionDeclaration = buildPolicyExtensionDeclaration(ldsPolicyPack, false);
  assert(
    extensionDeclaration.extension_id === "org.faith.lds.policy.v1",
    "Expected extension declaration to use the declared policy-pack extension id."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        metadataValidation,
        extensionDeclaration,
        execution
      },
      null,
      2
    )
  );
}

main();
