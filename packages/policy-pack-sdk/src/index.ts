import crypto from "node:crypto";
import { canonicalizeJson, type GuardrailRecord, type VvmpManifest } from "@vvmp/trust-core";
import type {
  PolicyCheckDefinition,
  PolicyCheckExecutionContext,
  PolicyCheckResult,
  PolicyExecutionRequest,
  PolicyExecutionResult,
  PolicyExecutionTarget,
  PolicyPackDefinition,
  PolicyPackValidationIssue,
  PolicyPackValidationResult
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function pushIssue(
  issues: PolicyPackValidationIssue[],
  code: string,
  path: string,
  message: string
) {
  issues.push({ code, path, message });
}

export function validatePolicyPackMetadata(
  policyPack: PolicyPackDefinition
): PolicyPackValidationResult {
  const issues: PolicyPackValidationIssue[] = [];

  for (const field of [
    "policy_pack_id",
    "version",
    "display_name",
    "publisher",
    "output_schema_version"
  ] as const) {
    if (!isNonEmptyString(policyPack[field])) {
      pushIssue(
        issues,
        "VVMP_POLICY_PACK_REQUIRED_FIELD",
        field,
        `The field ${field} is required for policy packs.`
      );
    }
  }

  if (!Array.isArray(policyPack.checks) || policyPack.checks.length === 0) {
    pushIssue(
      issues,
      "VVMP_POLICY_PACK_REQUIRED_FIELD",
      "checks",
      "Policy packs must declare at least one check."
    );
  } else {
    const seenCheckTypes = new Set<string>();

    policyPack.checks.forEach((check, index) => {
      const path = `checks[${index}]`;

      if (!isNonEmptyString(check.check_type)) {
        pushIssue(
          issues,
          "VVMP_POLICY_PACK_REQUIRED_FIELD",
          `${path}.check_type`,
          `The field ${path}.check_type is required.`
        );
      }

      if (!isNonEmptyString(check.display_name)) {
        pushIssue(
          issues,
          "VVMP_POLICY_PACK_REQUIRED_FIELD",
          `${path}.display_name`,
          `The field ${path}.display_name is required.`
        );
      }

      if (!Array.isArray(check.target_types) || check.target_types.length === 0) {
        pushIssue(
          issues,
          "VVMP_POLICY_PACK_REQUIRED_FIELD",
          `${path}.target_types`,
          `The field ${path}.target_types must contain at least one target type.`
        );
      }

      if (typeof check.run !== "function") {
        pushIssue(
          issues,
          "VVMP_POLICY_PACK_REQUIRED_FIELD",
          `${path}.run`,
          `The field ${path}.run must be a function.`
        );
      }

      if (isNonEmptyString(check.check_type)) {
        if (seenCheckTypes.has(check.check_type)) {
          pushIssue(
            issues,
            "VVMP_POLICY_PACK_DUPLICATE_CHECK_TYPE",
            `${path}.check_type`,
            `Duplicate check_type ${check.check_type} is not allowed.`
          );
        }
        seenCheckTypes.add(check.check_type);
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export function definePolicyPack(policyPack: PolicyPackDefinition): PolicyPackDefinition {
  const validation = validatePolicyPackMetadata(policyPack);
  if (!validation.valid) {
    throw new Error(
      `Invalid policy pack metadata: ${validation.issues
        .map((issue) => `${issue.code}@${issue.path}`)
        .join(", ")}`
    );
  }

  return policyPack;
}

export function createPolicyInputHash(value: unknown): string {
  const canonical = canonicalizeJson(value);
  const digest = crypto.createHash("sha256").update(canonical).digest("hex");
  return `sha256:${digest}`;
}

export function createExecutionTargetsFromManifest(
  manifest: VvmpManifest,
  targetTypes: string[] = ["script_segment"]
): PolicyExecutionTarget[] {
  const requested = new Set(targetTypes);
  const targets: PolicyExecutionTarget[] = [];

  if (requested.has("manifest")) {
    targets.push({
      target_type: "manifest",
      target_id: manifest.manifest_id,
      target: manifest
    });
  }

  if (requested.has("script_segment")) {
    manifest.timeline.forEach((segment) => {
      targets.push({
        target_type: "script_segment",
        target_id: segment.segment_id,
        target: segment
      });
    });
  }

  if (requested.has("source")) {
    manifest.sources.forEach((source) => {
      targets.push({
        target_type: "source",
        target_id: source.source_id,
        target: source
      });
    });
  }

  if (requested.has("prompt")) {
    manifest.prompts.forEach((prompt) => {
      targets.push({
        target_type: "prompt",
        target_id: prompt.prompt_id,
        target: prompt
      });
    });
  }

  if (requested.has("tool")) {
    manifest.tools.forEach((tool) => {
      targets.push({
        target_type: "tool",
        target_id: tool.tool_id,
        target: tool
      });
    });
  }

  if (requested.has("asset")) {
    manifest.assets.forEach((asset, index) => {
      const assetId =
        typeof asset.asset_id === "string" && asset.asset_id.length > 0
          ? asset.asset_id
          : `asset_${index}`;
      targets.push({
        target_type: "asset",
        target_id: assetId,
        target: asset
      });
    });
  }

  return targets;
}

function createGuardrailEventId(
  policyPack: PolicyPackDefinition,
  result: PolicyCheckResult,
  index: number
): string {
  const input = `${policyPack.policy_pack_id}:${policyPack.version}:${result.check_type}:${result.target_id}:${index}`;
  const digest = crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `guard_${digest}`;
}

function assertPublicSummary(result: PolicyCheckResult, check: PolicyCheckDefinition) {
  if (!isNonEmptyString(result.public_summary)) {
    throw new Error(
      `Policy check ${check.check_type} must return a non-empty public_summary.`
    );
  }
}

function normalizeCheckResults(
  rawResult: PolicyCheckResult | PolicyCheckResult[] | null,
  check: PolicyCheckDefinition
): PolicyCheckResult[] {
  if (rawResult == null) {
    return [];
  }

  const results = Array.isArray(rawResult) ? rawResult : [rawResult];
  results.forEach((result) => assertPublicSummary(result, check));
  return results;
}

export function createGuardrailRecord(
  policyPack: PolicyPackDefinition,
  result: PolicyCheckResult,
  fallbackReviewMode?: string,
  index = 0
): GuardrailRecord {
  return {
    guardrail_event_id:
      result.guardrail_event_id ?? createGuardrailEventId(policyPack, result, index),
    policy_profile: policyPack.policy_pack_id,
    policy_version: policyPack.version,
    check_type: result.check_type,
    target_type: result.target_type,
    target_id: result.target_id,
    verdict: result.verdict,
    risk_level: result.risk_level,
    public_summary: result.public_summary,
    review_mode: result.review_mode ?? fallbackReviewMode ?? "automated",
    ...(result.input_hash ? { input_hash: result.input_hash } : {}),
    ...(result.output_hash ? { output_hash: result.output_hash } : {}),
    ...(result.changed_due_to_review !== undefined
      ? { changed_due_to_review: result.changed_due_to_review }
      : {}),
    ...(result.human_reviewer_role ? { human_reviewer_role: result.human_reviewer_role } : {}),
    ...(result.metadata ? { metadata: result.metadata } : {})
  } as GuardrailRecord;
}

export async function runPolicyPack(
  policyPack: PolicyPackDefinition,
  request: PolicyExecutionRequest
): Promise<PolicyExecutionResult> {
  definePolicyPack(policyPack);

  const now = request.now ?? nowIso();
  const allowedCheckTypes = request.check_types
    ? new Set(request.check_types)
    : null;

  const guardrails: GuardrailRecord[] = [];

  for (const target of request.targets) {
    const applicableChecks = policyPack.checks.filter(
      (check) =>
        check.target_types.includes(target.target_type) &&
        (!allowedCheckTypes || allowedCheckTypes.has(check.check_type))
    );

    for (const check of applicableChecks) {
      const context: PolicyCheckExecutionContext = {
        manifest: request.manifest,
        policy_pack_id: policyPack.policy_pack_id,
        policy_version: policyPack.version,
        check,
        stage: request.stage,
        now,
        target_type: target.target_type,
        target_id: target.target_id,
        target: target.target,
        context: request.context
      };

      const rawResult = await check.run(context as PolicyCheckExecutionContext & {
        manifest: VvmpManifest;
      });
      const results = normalizeCheckResults(rawResult, check);

      results.forEach((result, index) => {
        guardrails.push(
          createGuardrailRecord(policyPack, result, request.review_mode, index)
        );
      });
    }
  }

  return {
    policy_pack_id: policyPack.policy_pack_id,
    policy_version: policyPack.version,
    guardrails
  };
}

export function appendPolicyExecutionToManifest(
  manifest: VvmpManifest,
  policyPack: PolicyPackDefinition,
  execution: PolicyExecutionResult,
  options: {
    appendExtension?: boolean;
    criticalExtension?: boolean;
  } = {}
): VvmpManifest {
  const nextManifest = JSON.parse(JSON.stringify(manifest)) as VvmpManifest;
  const existingGuardrailIds = new Set(
    nextManifest.guardrails.map((guardrail) => guardrail.guardrail_event_id)
  );

  execution.guardrails.forEach((guardrail) => {
    if (!existingGuardrailIds.has(guardrail.guardrail_event_id)) {
      nextManifest.guardrails.push(guardrail);
      existingGuardrailIds.add(guardrail.guardrail_event_id);
    }
  });

  if (options.appendExtension !== false) {
    const declaration = buildPolicyExtensionDeclaration(
      policyPack,
      options.criticalExtension ?? false
    );
    const exists = nextManifest.extensions.some(
      (extension) =>
        extension.extension_id === declaration.extension_id &&
        extension.version === declaration.version
    );

    if (!exists) {
      nextManifest.extensions.push(declaration);
    }
  }

  return nextManifest;
}

export function buildPolicyExtensionDeclaration(
  policyPack: PolicyPackDefinition,
  critical = false
) {
  return {
    extension_id:
      policyPack.extension_id ?? `${policyPack.policy_pack_id}.policy.v1`,
    critical,
    version: policyPack.version
  };
}

export type {
  PolicyCheckDefinition,
  PolicyCheckExecutionContext,
  PolicyCheckResult,
  PolicyExecutionRequest,
  PolicyExecutionResult,
  PolicyExecutionTarget,
  PolicyPackDefinition,
  PolicyPackValidationIssue,
  PolicyPackValidationResult,
  PolicyRiskLevel,
  PolicyVerdict
} from "./types";
