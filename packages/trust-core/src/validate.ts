import type {
  GuardrailRecord,
  ProfileSupport,
  TimelineSegment,
  TrustStateSummary,
  ValidateManifestOptions,
  ValidationIssue,
  ValidationResult,
  VvmpManifest
} from "./types";

const KNOWN_EXTENSION_IDS = new Set<string>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^(?:sha256:)?[a-fA-F0-9]{64}$/.test(value);
}

function pushIssue(issues: ValidationIssue[], code: string, path: string, message: string) {
  issues.push({ code, path, message });
}

function resolveValidationProfile(
  manifest: Record<string, unknown>,
  options: ValidateManifestOptions | undefined
): "draft" | "production" {
  if (options?.profile === "draft" || options?.profile === "production") {
    return options.profile;
  }

  const publication = isObject(manifest.publication) ? manifest.publication : {};
  const manifestVersion = typeof manifest.manifest_version === "string" ? manifest.manifest_version : "";
  return publication.status === "draft" || manifestVersion.includes("draft")
    ? "draft"
    : "production";
}

function hasTopLevelShape(manifest: unknown, issues: ValidationIssue[]): manifest is VvmpManifest {
  if (!isObject(manifest)) {
    pushIssue(issues, "VVMP_SCHEMA_TYPE", "$", "Manifest must be a JSON object.");
    return false;
  }

  const requiredFields = [
    "manifest_version",
    "manifest_id",
    "video",
    "creation",
    "sources",
    "prompts",
    "tools",
    "assets",
    "timeline",
    "edits",
    "guardrails",
    "rights",
    "render",
    "publication",
    "redactions",
    "signatures",
    "links",
    "extensions"
  ];

  for (const field of requiredFields) {
    if (!(field in manifest)) {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        field,
        `The field ${field} is required.`
      );
    }
  }

  return true;
}

function validateVideo(
  video: unknown,
  issues: ValidationIssue[],
  profile: "draft" | "production"
) {
  if (!isObject(video)) {
    pushIssue(issues, "VVMP_SCHEMA_TYPE", "video", "video must be an object.");
    return;
  }

  const requiredStrings = ["video_id", "title", "created_at", "creator_type", "visibility"];
  for (const field of requiredStrings) {
    if (!isNonEmptyString(video[field])) {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `video.${field}`,
        `The field video.${field} is required.`
      );
    }
  }

  if (!isObject(video.final_asset)) {
    if (profile === "production") {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        "video.final_asset",
        "The field video.final_asset is required for production manifests."
      );
    }
    return;
  }

  if (!isNonEmptyString(video.final_asset.format)) {
    pushIssue(
      issues,
      "VVMP_SCHEMA_REQUIRED_FIELD",
      "video.final_asset.format",
      "The field video.final_asset.format is required."
    );
  }
  if (typeof video.final_asset.duration_seconds !== "number") {
    pushIssue(
      issues,
      "VVMP_SCHEMA_REQUIRED_FIELD",
      "video.final_asset.duration_seconds",
      "The field video.final_asset.duration_seconds is required."
    );
  }
  if (!isNonEmptyString(video.final_asset.sha256)) {
    if (profile === "production") {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        "video.final_asset.sha256",
        "The field video.final_asset.sha256 is required for production manifests."
      );
    }
  } else if (profile === "production" && !isSha256Digest(video.final_asset.sha256)) {
    pushIssue(
      issues,
      "VVMP_FINAL_ASSET_INVALID_SHA256",
      "video.final_asset.sha256",
      "The field video.final_asset.sha256 must be a 64-character hex SHA-256 digest, optionally prefixed with sha256:."
    );
  }
}

function validateCreation(creation: unknown, issues: ValidationIssue[]) {
  if (!isObject(creation)) {
    pushIssue(issues, "VVMP_SCHEMA_TYPE", "creation", "creation must be an object.");
    return;
  }

  for (const field of ["workflow", "human_oversight_level"]) {
    if (!isNonEmptyString(creation[field])) {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `creation.${field}`,
        `The field creation.${field} is required.`
      );
    }
  }
}

function validateArrayObjects(
  value: unknown,
  path: string,
  requiredFields: string[],
  issues: ValidationIssue[]
) {
  if (!Array.isArray(value)) {
    pushIssue(issues, "VVMP_SCHEMA_TYPE", path, `${path} must be an array.`);
    return;
  }

  value.forEach((entry, index) => {
    if (!isObject(entry)) {
      pushIssue(
        issues,
        "VVMP_SCHEMA_TYPE",
        `${path}[${index}]`,
        `${path}[${index}] must be an object.`
      );
      return;
    }

    requiredFields.forEach((field) => {
      if (!isNonEmptyString(entry[field])) {
        pushIssue(
          issues,
          "VVMP_SCHEMA_REQUIRED_FIELD",
          `${path}[${index}].${field}`,
          `The field ${path}[${index}].${field} is required.`
        );
      }
    });
  });
}

function validateTimelineSegments(timeline: unknown, issues: ValidationIssue[]) {
  if (!Array.isArray(timeline)) {
    pushIssue(issues, "VVMP_SCHEMA_TYPE", "timeline", "timeline must be an array.");
    return;
  }

  timeline.forEach((segment, index) => {
    const path = `timeline[${index}]`;
    if (!isObject(segment)) {
      pushIssue(issues, "VVMP_SCHEMA_TYPE", path, `${path} must be an object.`);
      return;
    }

    for (const field of ["segment_id", "claim_type"]) {
      if (!isNonEmptyString(segment[field])) {
        pushIssue(
          issues,
          "VVMP_SCHEMA_REQUIRED_FIELD",
          `${path}.${field}`,
          `The field ${path}.${field} is required.`
        );
      }
    }

    if (!isObject(segment.time_range)) {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `${path}.time_range`,
        `The field ${path}.time_range is required.`
      );
      return;
    }

    const start = segment.time_range.start;
    const end = segment.time_range.end;

    if (typeof start !== "number") {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `${path}.time_range.start`,
        `The field ${path}.time_range.start is required.`
      );
    }

    if (typeof end !== "number") {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `${path}.time_range.end`,
        `The field ${path}.time_range.end is required.`
      );
    }

    if (typeof start === "number" && start < 0) {
      pushIssue(
        issues,
        "VVMP_TIMELINE_NEGATIVE_START",
        `${path}.time_range.start`,
        `The timeline start for ${path} must be greater than or equal to 0.`
      );
    }

    if (typeof start === "number" && typeof end === "number" && end <= start) {
      pushIssue(
        issues,
        "VVMP_TIMELINE_REVERSED_RANGE",
        `${path}.time_range`,
        `The timeline range for ${path} must have end > start.`
      );
    }

    const provenanceRefs = [
      Array.isArray(segment.source_ids) && segment.source_ids.length > 0,
      Array.isArray(segment.prompt_ids) && segment.prompt_ids.length > 0,
      Array.isArray(segment.generation_event_ids) && segment.generation_event_ids.length > 0
    ];

    if (!provenanceRefs.some(Boolean)) {
      pushIssue(
        issues,
        "VVMP_TIMELINE_MISSING_PROVENANCE_REF",
        path,
        `The segment ${path} must reference at least one provenance source.`
      );
    }
  });
}

function validateSignatures(signatures: unknown, issues: ValidationIssue[]) {
  if (!Array.isArray(signatures)) {
    pushIssue(issues, "VVMP_SCHEMA_TYPE", "signatures", "signatures must be an array.");
    return;
  }

  signatures.forEach((signature, index) => {
    const path = `signatures[${index}]`;
    if (!isObject(signature)) {
      pushIssue(issues, "VVMP_SCHEMA_TYPE", path, `${path} must be an object.`);
      return;
    }

    for (const field of ["signature_id", "type", "signer"]) {
      if (!isNonEmptyString(signature[field])) {
        pushIssue(
          issues,
          "VVMP_SIGNATURE_MISSING_FIELD",
          `${path}.${field}`,
          `The field ${path}.${field} is required for signature records.`
        );
      }
    }
  });
}

function validateExtensions(extensions: unknown, issues: ValidationIssue[]) {
  if (!Array.isArray(extensions)) {
    pushIssue(issues, "VVMP_SCHEMA_TYPE", "extensions", "extensions must be an array.");
    return;
  }

  extensions.forEach((extension, index) => {
    const path = `extensions[${index}]`;
    if (!isObject(extension)) {
      pushIssue(issues, "VVMP_SCHEMA_TYPE", path, `${path} must be an object.`);
      return;
    }

    if (!isNonEmptyString(extension.extension_id)) {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `${path}.extension_id`,
        `The field ${path}.extension_id is required.`
      );
      return;
    }

    if (!isNonEmptyString(extension.version)) {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `${path}.version`,
        `The field ${path}.version is required.`
      );
    }

    if (typeof extension.critical !== "boolean") {
      pushIssue(
        issues,
        "VVMP_SCHEMA_REQUIRED_FIELD",
        `${path}.critical`,
        `The field ${path}.critical is required.`
      );
      return;
    }

    if (extension.critical && !KNOWN_EXTENSION_IDS.has(extension.extension_id)) {
      pushIssue(
        issues,
        "VVMP_EXTENSION_UNKNOWN_CRITICAL",
        `${path}.extension_id`,
        `The critical extension ${String(extension.extension_id)} is not supported.`
      );
    }
  });
}

function computeProfiles(manifest: VvmpManifest, issues: ValidationIssue[]): ProfileSupport {
  const video = isObject(manifest.video) ? manifest.video : ({} as Record<string, unknown>);
  const publication = isObject(manifest.publication)
    ? manifest.publication
    : ({} as Record<string, unknown>);
  const links = isObject(manifest.links) ? manifest.links : ({} as Record<string, unknown>);
  const signatures = Array.isArray(manifest.signatures) ? manifest.signatures : [];

  const wantsRegistryBacked =
    publication["profile_claim"] === "registry_backed" ||
    publication["profile_claim"] === "embedded_provenance" ||
    isNonEmptyString(video["trust_code"]) ||
    isNonEmptyString(publication["registry_url"]) ||
    isNonEmptyString(links["trust_page"]);

  if (wantsRegistryBacked && !isNonEmptyString(video["trust_code"])) {
    pushIssue(
      issues,
      "VVMP_PROFILE_MISSING_TRUST_CODE",
      "video.trust_code",
      "Registry-backed manifests require video.trust_code."
    );
  }

  if (publication["profile_claim"] === "embedded_provenance" && signatures.length === 0) {
    pushIssue(
      issues,
      "VVMP_SIGNATURE_REQUIRED",
      "signatures",
      "Embedded provenance manifests require at least one signature record."
    );
  }

  const coreManifest = issues.length === 0;
  const registryBacked = coreManifest && isNonEmptyString(video["trust_code"]);
  const embeddedProvenance = registryBacked && signatures.length > 0;
  const recoveryCapable =
    embeddedProvenance &&
    (isNonEmptyString(video["trust_code"]) || isNonEmptyString(links["trust_page"]));

  return {
    core_manifest: issues.length === 0,
    registry_backed: registryBacked,
    embedded_provenance: embeddedProvenance,
    recovery_capable: recoveryCapable
  };
}

function deriveFileTrustState(manifest: VvmpManifest): string {
  const video = isObject(manifest.video) ? manifest.video : ({} as Record<string, unknown>);
  const hasRegistryLink =
    isNonEmptyString(video["trust_code"]) ||
    (isObject(manifest.publication) && isNonEmptyString(manifest.publication["registry_url"])) ||
    (isObject(manifest.links) && isNonEmptyString(manifest.links["trust_page"]));

  if (Array.isArray(manifest.signatures) && manifest.signatures.length > 0) {
    return "valid_embedded_manifest";
  }

  if (hasRegistryLink) {
    return "remote_manifest_found";
  }

  return "embedded_manifest_missing";
}

function deriveProvenanceCoverageState(manifest: VvmpManifest): string {
  const hasRedactions =
    (Array.isArray(manifest.redactions) && manifest.redactions.length > 0) ||
    (Array.isArray(manifest.sources) && manifest.sources.some((source) => source.visibility !== "public"));

  if (hasRedactions) {
    return "private_redacted_source";
  }

  const segments = (Array.isArray(manifest.timeline) ? manifest.timeline : []) as TimelineSegment[];
  if (segments.length === 0) {
    return Array.isArray(manifest.tools) && manifest.tools.length > 0
      ? "unsourced_ai_generation"
      : "unknown_ingredient";
  }

  const sourcedCount = segments.filter(
    (segment) => Array.isArray(segment.source_ids) && segment.source_ids.length > 0
  ).length;

  if (sourcedCount === segments.length) {
    return "source_mapped";
  }

  if (sourcedCount > 0) {
    return "partially_source_mapped";
  }

  return Array.isArray(manifest.tools) && manifest.tools.length > 0
    ? "unsourced_ai_generation"
    : "user_authored";
}

function deriveGuardrailState(guardrails: GuardrailRecord[]): string {
  if (guardrails.length === 0) {
    return "not_checked";
  }

  if (guardrails.some((guard) => guard.verdict === "blocked")) {
    return "blocked_before_publish";
  }

  if (guardrails.some((guard) => guard.verdict === "warning")) {
    return "warning";
  }

  if (guardrails.some((guard) => guard.review_mode === "human")) {
    return "passed_human_review";
  }

  if (guardrails.every((guard) => guard.verdict === "approved")) {
    return "passed_automated_review";
  }

  return "not_checked";
}

function deriveAiInvolvementState(manifest: VvmpManifest): string {
  const tools = Array.isArray(manifest.tools) ? manifest.tools : [];
  const creation = isObject(manifest.creation)
    ? manifest.creation
    : ({} as Record<string, unknown>);
  const toolTypes = new Set(tools.map((tool) => tool.tool_type));

  if (toolTypes.size === 0) {
    return "no_ai";
  }

  if (
    toolTypes.has("language_model") &&
    creation["human_oversight_level"] === "human_validated"
  ) {
    return "ai_generated_with_human_approval";
  }

  if (toolTypes.has("language_model")) {
    return "ai_generated_script";
  }

  if (toolTypes.has("image_generator") || toolTypes.has("video_generator")) {
    return "ai_generated_visuals";
  }

  return "ai_assisted";
}

/**
 * @since 0.1.0
 */
export function deriveTrustStates(manifest: VvmpManifest): TrustStateSummary {
  const guardrails = Array.isArray(manifest.guardrails)
    ? (manifest.guardrails as GuardrailRecord[])
    : [];

  return {
    file_trust_state: deriveFileTrustState(manifest),
    provenance_coverage_state: deriveProvenanceCoverageState(manifest),
    guardrail_state: deriveGuardrailState(guardrails),
    ai_involvement_state: deriveAiInvolvementState(manifest)
  };
}

/**
 * @since 0.1.1
 */
export function deriveTrustStatesSafe(manifest: unknown): TrustStateSummary | null {
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    return null;
  }

  return validation.trustStates;
}

/**
 * @since 0.1.0
 */
export function validateManifest(
  manifest: unknown,
  options: ValidateManifestOptions = {}
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const hasShape = hasTopLevelShape(manifest, issues);

  if (!hasShape || !isObject(manifest)) {
    return {
      valid: false,
      issues,
      profiles: {
        core_manifest: false,
        registry_backed: false,
        embedded_provenance: false,
        recovery_capable: false
      },
      trustStates: {
        file_trust_state: "embedded_manifest_missing",
        provenance_coverage_state: "unknown_ingredient",
        guardrail_state: "not_checked",
        ai_involvement_state: "no_ai"
      }
    };
  }

  const profile = resolveValidationProfile(manifest, options);

  validateVideo(manifest.video, issues, profile);
  validateCreation(manifest.creation, issues);
  validateArrayObjects(manifest.sources, "sources", ["source_id", "source_type", "visibility"], issues);
  validateArrayObjects(manifest.prompts, "prompts", ["prompt_id", "prompt_type", "visibility"], issues);
  validateArrayObjects(manifest.tools, "tools", ["tool_id", "tool_type", "purpose"], issues);
  validateTimelineSegments(manifest.timeline, issues);
  validateSignatures(manifest.signatures, issues);
  validateExtensions(manifest.extensions, issues);

  const typedManifest = manifest as VvmpManifest;
  const profiles = computeProfiles(typedManifest, issues);
  const trustStates = deriveTrustStates(typedManifest);

  return {
    valid: issues.length === 0,
    issues,
    profiles,
    trustStates
  };
}
