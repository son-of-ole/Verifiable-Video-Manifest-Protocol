import type {
  CreationRecord,
  GuardrailRecord,
  PromptRecord,
  SourceRecord,
  TimelineSegment,
  ToolRecord,
  VideoRecord,
  VvmpManifest
} from "@vvmp/trust-core";
import type {
  PolicyExecutionRequest,
  PolicyExecutionResult,
  PolicyExecutionTarget,
  PolicyPackDefinition
} from "@vvmp/policy-pack-sdk";

export type AssetRecord = {
  asset_id: string;
  asset_type: string;
  [key: string]: unknown;
};

export type GenerationEventRecord = {
  generation_event_id: string;
  tool_id?: string;
  prompt_ids?: string[];
  source_ids?: string[];
  output_asset_ids?: string[];
  output_text?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type EditRecord = {
  edit_event_id: string;
  actor: string;
  timestamp?: string;
  target: string;
  before_hash?: string;
  after_hash?: string;
  public_summary?: string;
  [key: string]: unknown;
};

export type RightsRecord = {
  rights_event_id?: string;
  asset_id?: string;
  [key: string]: unknown;
};

export type RenderRecord = {
  render_id?: string;
  engine: string;
  output_hash?: string;
  [key: string]: unknown;
};

export type PublicationRecord = {
  publication_id?: string;
  status?: string;
  profile_claim?: string;
  registry_url?: string;
  [key: string]: unknown;
};

export type TrustEventKind =
  | "source"
  | "prompt"
  | "tool"
  | "asset"
  | "generation"
  | "segment"
  | "edit"
  | "guardrail"
  | "rights"
  | "render"
  | "publication";

export type TrustEventDataMap = {
  source: SourceRecord;
  prompt: PromptRecord;
  tool: ToolRecord;
  asset: AssetRecord;
  generation: GenerationEventRecord;
  segment: TimelineSegment;
  edit: EditRecord;
  guardrail: GuardrailRecord;
  rights: RightsRecord;
  render: RenderRecord;
  publication: PublicationRecord;
};

export type TrustEventEnvelope<K extends TrustEventKind = TrustEventKind> = {
  event_version: "1.0.0-draft";
  event_id: string;
  session_id: string;
  kind: K;
  recorded_at: string;
  order: number;
  idempotency_key?: string;
  data: TrustEventDataMap[K];
};

export type LogEventOptions = {
  eventId?: string;
  recordedAt?: string;
  idempotencyKey?: string;
};

export type RedactionTargetCollection =
  | "sources"
  | "prompts"
  | "tools"
  | "assets"
  | "timeline"
  | "edits"
  | "guardrails"
  | "rights";

export type RecordRemovalRedactionRule = {
  redaction_id?: string;
  target_collection: RedactionTargetCollection;
  record_id: string;
  mode: "remove_record";
  reason: string;
  public_summary?: string;
};

export type FieldRedactionRule = {
  redaction_id?: string;
  target_collection: RedactionTargetCollection;
  record_id: string;
  field: string;
  mode: "remove_field" | "replace_field";
  replacement?: unknown;
  reason: string;
  public_summary?: string;
};

export type RedactionRule = RecordRemovalRedactionRule | FieldRedactionRule;

export type BuildManifestOptions = {
  manifestId: string;
  manifestVersion?: string;
  video: VideoRecord;
  creation: CreationRecord;
  render?: Record<string, unknown>;
  publication?: Record<string, unknown>;
  links?: Record<string, unknown>;
  signatures?: Array<Record<string, unknown>>;
  extensions?: Array<Record<string, unknown>>;
  redactionRules?: RedactionRule[];
};

export type ExecutePolicyPackOptions = {
  manifestOptions: BuildManifestOptions;
  targets?: PolicyExecutionTarget[];
  targetTypes?: string[];
  stage?: PolicyExecutionRequest["stage"];
  now?: PolicyExecutionRequest["now"];
  review_mode?: PolicyExecutionRequest["review_mode"];
  check_types?: PolicyExecutionRequest["check_types"];
  context?: PolicyExecutionRequest["context"];
  appendExtension?: boolean;
  criticalExtension?: boolean;
};

export type ExecutePolicyPackResult = {
  manifest: VvmpManifest;
  execution: PolicyExecutionResult;
  loggedGuardrails: GuardrailRecord[];
};

export type TrustSessionOptions = {
  sessionId: string;
  startedAt?: string;
};

export type TrustSessionSnapshot = {
  session_id: string;
  started_at: string;
  event_count: number;
};

export type TrustSession = {
  readonly sessionId: string;
  readonly startedAt: string;
  getSnapshot(): TrustSessionSnapshot;
  getEventLog(): TrustEventEnvelope[];
  logSource(record: SourceRecord, options?: LogEventOptions): TrustEventEnvelope<"source">;
  logPrompt(record: PromptRecord, options?: LogEventOptions): TrustEventEnvelope<"prompt">;
  logTool(record: ToolRecord, options?: LogEventOptions): TrustEventEnvelope<"tool">;
  logAsset(record: AssetRecord, options?: LogEventOptions): TrustEventEnvelope<"asset">;
  logGeneration(
    record: GenerationEventRecord,
    options?: LogEventOptions
  ): TrustEventEnvelope<"generation">;
  logSegment(record: TimelineSegment, options?: LogEventOptions): TrustEventEnvelope<"segment">;
  logEdit(record: EditRecord, options?: LogEventOptions): TrustEventEnvelope<"edit">;
  logGuardrail(
    record: GuardrailRecord,
    options?: LogEventOptions
  ): TrustEventEnvelope<"guardrail">;
  logRights(record: RightsRecord, options?: LogEventOptions): TrustEventEnvelope<"rights">;
  logRender(record: RenderRecord, options?: LogEventOptions): TrustEventEnvelope<"render">;
  logPublication(
    record: PublicationRecord,
    options?: LogEventOptions
  ): TrustEventEnvelope<"publication">;
  runPolicyPack(
    policyPack: PolicyPackDefinition,
    options: ExecutePolicyPackOptions
  ): Promise<ExecutePolicyPackResult>;
  buildManifest(options: BuildManifestOptions): VvmpManifest;
};
