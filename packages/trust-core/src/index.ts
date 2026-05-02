export type {
  CreationRecord,
  DraftVideoRecord,
  DraftVvmpManifest,
  FinalAsset,
  GuardrailRecord,
  ManifestSummary,
  PromptRecord,
  PublishedVideoRecord,
  PublishedVvmpManifest,
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
  ManifestValidationProfile,
  ValidateManifestOptions,
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
  VvmpManifestWithFinalAsset,
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
  withFinalAsset,
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
export {
  VVMP_CORE_VERSION,
  VVMP_CORE_VERSION_MAJOR,
  VVMP_CORE_VERSION_MINOR,
  VVMP_CORE_VERSION_PATCH,
  meetsMinimumVersion
} from "./version";
