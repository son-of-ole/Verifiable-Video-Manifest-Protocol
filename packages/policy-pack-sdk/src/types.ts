import type { GuardrailRecord, VvmpManifest } from "@vvmp/trust-core";

export type PolicyVerdict = "approved" | "warning" | "blocked";
export type PolicyRiskLevel = "low" | "medium" | "high" | "critical";

export type PolicyPackValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type PolicyExecutionTarget = {
  target_type: string;
  target_id: string;
  target?: unknown;
};

export type PolicyCheckResult = {
  guardrail_event_id?: string;
  check_type: string;
  target_type: string;
  target_id: string;
  verdict: PolicyVerdict;
  risk_level?: PolicyRiskLevel;
  review_mode: string;
  public_summary: string;
  input_hash?: string;
  output_hash?: string;
  changed_due_to_review?: boolean;
  human_reviewer_role?: string;
  metadata?: Record<string, unknown>;
};

export type PolicyCheckExecutionContext = {
  manifest: VvmpManifest;
  policy_pack_id: string;
  policy_version: string;
  check: PolicyCheckDefinition;
  stage?: string;
  now: string;
  target_type: string;
  target_id: string;
  target?: unknown;
  context?: Record<string, unknown>;
};

export type PolicyCheckDefinition = {
  check_type: string;
  display_name: string;
  description?: string;
  target_types: string[];
  run:
    | ((input: PolicyCheckExecutionContext) => PolicyCheckResult | null | Promise<PolicyCheckResult | null>)
    | ((input: PolicyCheckExecutionContext) => PolicyCheckResult[] | Promise<PolicyCheckResult[]>);
};

export type PolicyPackDefinition = {
  policy_pack_id: string;
  version: string;
  display_name: string;
  publisher: string;
  output_schema_version: string;
  checks: PolicyCheckDefinition[];
  extension_id?: string;
  critical_extension?: boolean;
};

export type PolicyExecutionRequest = {
  manifest: VvmpManifest;
  targets: PolicyExecutionTarget[];
  stage?: string;
  now?: string;
  review_mode?: string;
  check_types?: string[];
  context?: Record<string, unknown>;
};

export type PolicyExecutionResult = {
  policy_pack_id: string;
  policy_version: string;
  guardrails: GuardrailRecord[];
};

export type PolicyPackValidationResult = {
  valid: boolean;
  issues: PolicyPackValidationIssue[];
};
