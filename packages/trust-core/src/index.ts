export type {
  CreationRecord,
  FinalAsset,
  GuardrailRecord,
  ManifestSummary,
  PromptRecord,
  RecoveryCardSummary,
  RenditionComparison,
  RenditionObservation,
  RenditionObservationAsset,
  RenditionObservationValidationIssue,
  RenditionObservationValidationResult,
  SourceRecord,
  TimelineSegment,
  ToolRecord,
  TrustStateSummary,
  ValidationIssue,
  ValidationResult,
  VideoRecord,
  VvmpAsset,
  VvmpCreation,
  VvmpEdit,
  VvmpExtension,
  VvmpFinalAsset,
  VvmpGuardrail,
  VvmpLinks,
  VvmpManifest,
  VvmpPrompt,
  VvmpPublication,
  VvmpRedaction,
  VvmpRender,
  VvmpRightsRecord,
  VvmpSignature,
  VvmpSource,
  VvmpTimelineSegment,
  VvmpTool,
  VvmpVideo
} from "./types";
export { canonicalizeJson } from "./canonicalize";
export {
  createEmptyManifest,
  withManifestDefaults,
  type ManifestDefaultsInput
} from "./manifest";
export {
  buildRecoveryCardSummary,
  compareRenditionObservation,
  validateRenditionObservation
} from "./recovery";
export {
  appendSignature,
  createManifestSigningPayload,
  createManifestSigningPayloadSha256,
  verifySignatures,
  type AppendSignatureInput,
  type SignatureVerifier,
  type VerifySignatureContext,
  type VerifySignatureResult,
  type VerifySignaturesResult
} from "./signatures";
export { summarizeManifest, summarizeManifestSafe } from "./summary";
export { deriveTrustStates, deriveTrustStatesSafe, validateManifest } from "./validate";
export { VVMP_CORE_VERSION } from "./version";
