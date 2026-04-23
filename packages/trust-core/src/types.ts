export type FinalAsset = {
  format: string;
  duration_seconds: number;
  sha256: string;
};

export type RenditionRecoveryMethod =
  | "trust_code"
  | "qr_url"
  | "watermark"
  | "fingerprint"
  | "manual";

export type RenditionObservationAsset = {
  format?: string;
  sha256?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
};

export type RenditionObservation = {
  observation_version: "1.0.0-draft";
  observed_at: string;
  trust_code?: string;
  trust_page_url?: string;
  asset: RenditionObservationAsset;
  recovery: {
    method: RenditionRecoveryMethod;
    locator?: string;
  };
  notes?: string;
};

export type RenditionObservationValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type RenditionObservationValidationResult = {
  valid: boolean;
  issues: RenditionObservationValidationIssue[];
};

export type RecoveryCardSummary = {
  manifest_id: string;
  title: string;
  trust_code: string | null;
  trust_page_url: string | null;
  qr_target_url: string | null;
  badge_text: string;
  final_asset: FinalAsset;
  recovery_capable: boolean;
};

export type RenditionComparison = {
  recovered: boolean;
  exact_binary_match: boolean;
  match_type:
    | "exact_asset_match"
    | "likely_known_rendition"
    | "reference_match_only"
    | "no_match";
  recommended_file_trust_state: string;
  manifest_id: string;
  trust_code: string | null;
  trust_page_url: string | null;
  comparison: {
    trust_code_match: boolean;
    trust_page_match: boolean;
    asset_hash_match: boolean | null;
    format_match: boolean | null;
    duration_match: boolean | null;
    duration_delta_seconds: number | null;
    recovery_method: RenditionRecoveryMethod;
    locator: string | null;
  };
  notes: string[];
};

export type VideoRecord = {
  video_id: string;
  trust_code?: string;
  title: string;
  created_at: string;
  creator_type: string;
  content_type?: string;
  visibility: string;
  final_asset: FinalAsset;
};

export type CreationRecord = {
  workflow: string;
  human_oversight_level: string;
};

export type SourceRecord = {
  source_id: string;
  source_type: string;
  title?: string;
  canonical_ref?: string;
  display_text?: string;
  visibility: string;
};

export type PromptRecord = {
  prompt_id: string;
  prompt_type: string;
  visibility: string;
  text?: string;
  input_hash?: string;
  created_by?: string;
  created_at?: string;
};

export type ToolRecord = {
  tool_id: string;
  tool_type: string;
  provider?: string;
  model_identifier?: string;
  purpose: string;
  human_oversight_level?: string;
};

export type TimelineSegment = {
  segment_id: string;
  time_range: {
    start: number;
    end: number;
  };
  visible_text?: string;
  narration_text?: string;
  claim_type: string;
  source_ids?: string[];
  prompt_ids?: string[];
  generation_event_ids?: string[];
  edit_event_ids?: string[];
  guardrail_event_ids?: string[];
  visual_asset_ids?: string[];
  audio_asset_ids?: string[];
};

export type GuardrailRecord = {
  guardrail_event_id: string;
  policy_profile: string;
  policy_version: string;
  check_type: string;
  target_type: string;
  target_id: string;
  verdict: string;
  risk_level?: string;
  public_summary?: string;
  review_mode?: string;
};

export type VvmpManifest = {
  manifest_version: string;
  manifest_id: string;
  video: VideoRecord;
  creation: CreationRecord;
  sources: SourceRecord[];
  prompts: PromptRecord[];
  tools: ToolRecord[];
  assets: Array<Record<string, unknown>>;
  timeline: TimelineSegment[];
  edits: Array<Record<string, unknown>>;
  guardrails: GuardrailRecord[];
  rights: Array<Record<string, unknown>>;
  render: Record<string, unknown>;
  publication: Record<string, unknown>;
  redactions: Array<Record<string, unknown>>;
  signatures: Array<Record<string, unknown>>;
  links: Record<string, unknown>;
  extensions: Array<Record<string, unknown>>;
};

export type ManifestSummary = {
  manifestId: string;
  title: string;
  trustCode: string | null;
  durationSeconds: number;
  sourceCount: number;
  promptCount: number;
  toolCount: number;
  segmentCount: number;
  guardrailCount: number;
  visibility: string;
  aiInvolvement: string;
  profileGuess: string;
};

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type ProfileSupport = {
  core_manifest: boolean;
  registry_backed: boolean;
  embedded_provenance: boolean;
  recovery_capable: boolean;
};

export type TrustStateSummary = {
  file_trust_state: string;
  provenance_coverage_state: string;
  guardrail_state: string;
  ai_involvement_state: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  profiles: ProfileSupport;
  trustStates: TrustStateSummary;
};
