export const FILE_TRUST_STATES = [
  "valid_embedded_manifest",
  "embedded_manifest_missing",
  "embedded_manifest_invalid",
  "remote_manifest_found",
  "remote_manifest_not_found",
  "recovered_by_qr",
  "recovered_by_watermark",
  "recovered_by_fingerprint"
] as const;

export const PROVENANCE_COVERAGE_STATES = [
  "source_mapped",
  "partially_source_mapped",
  "unsourced_ai_generation",
  "user_authored",
  "private_redacted_source",
  "unknown_ingredient"
] as const;

export const GUARDRAIL_STATES = [
  "passed_automated_review",
  "passed_human_review",
  "warning",
  "blocked_before_publish",
  "edited_after_warning",
  "not_checked"
] as const;

export const AI_INVOLVEMENT_STATES = [
  "no_ai",
  "ai_assisted",
  "ai_generated_visuals",
  "ai_generated_narration",
  "ai_generated_script",
  "ai_generated_with_human_approval",
  "fully_autonomous"
] as const;

export type FileTrustState = (typeof FILE_TRUST_STATES)[number];
export type ProvenanceCoverageState = (typeof PROVENANCE_COVERAGE_STATES)[number];
export type GuardrailState = (typeof GUARDRAIL_STATES)[number];
export type AiInvolvementState = (typeof AI_INVOLVEMENT_STATES)[number];
