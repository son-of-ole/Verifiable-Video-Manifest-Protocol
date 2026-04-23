import type {
  RecoveryCardSummary,
  RenditionComparison,
  RenditionObservation,
  RenditionObservationValidationIssue,
  RenditionObservationValidationResult,
  VvmpManifest
} from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function pushIssue(
  issues: RenditionObservationValidationIssue[],
  code: string,
  path: string,
  message: string
) {
  issues.push({ code, path, message });
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

export function validateRenditionObservation(
  value: unknown
): RenditionObservationValidationResult {
  const issues: RenditionObservationValidationIssue[] = [];

  if (!isObject(value)) {
    pushIssue(
      issues,
      "VVMP_RENDITION_SCHEMA_TYPE",
      "$",
      "Rendition observation must be an object."
    );
    return { valid: false, issues };
  }

  if (value.observation_version !== "1.0.0-draft") {
    pushIssue(
      issues,
      "VVMP_RENDITION_REQUIRED_FIELD",
      "observation_version",
      "observation_version must be 1.0.0-draft."
    );
  }

  if (!isNonEmptyString(value.observed_at)) {
    pushIssue(
      issues,
      "VVMP_RENDITION_REQUIRED_FIELD",
      "observed_at",
      "The field observed_at is required."
    );
  }

  if (!isObject(value.asset)) {
    pushIssue(
      issues,
      "VVMP_RENDITION_REQUIRED_FIELD",
      "asset",
      "The field asset is required."
    );
  } else {
    if ("format" in value.asset && !isNonEmptyString(value.asset.format)) {
      pushIssue(
        issues,
        "VVMP_RENDITION_FIELD_INVALID",
        "asset.format",
        "asset.format must be a non-empty string when present."
      );
    }

    if ("sha256" in value.asset && !isNonEmptyString(value.asset.sha256)) {
      pushIssue(
        issues,
        "VVMP_RENDITION_FIELD_INVALID",
        "asset.sha256",
        "asset.sha256 must be a non-empty string when present."
      );
    }

    if (
      "duration_seconds" in value.asset &&
      (typeof value.asset.duration_seconds !== "number" || value.asset.duration_seconds < 0)
    ) {
      pushIssue(
        issues,
        "VVMP_RENDITION_FIELD_INVALID",
        "asset.duration_seconds",
        "asset.duration_seconds must be a non-negative number when present."
      );
    }

    for (const field of ["width", "height"] as const) {
      if (
        field in value.asset &&
        (!Number.isInteger(value.asset[field]) || Number(value.asset[field]) < 1)
      ) {
        pushIssue(
          issues,
          "VVMP_RENDITION_FIELD_INVALID",
          `asset.${field}`,
          `asset.${field} must be an integer greater than or equal to 1 when present.`
        );
      }
    }
  }

  if (!isObject(value.recovery)) {
    pushIssue(
      issues,
      "VVMP_RENDITION_REQUIRED_FIELD",
      "recovery",
      "The field recovery is required."
    );
  } else {
    const knownMethods = new Set([
      "trust_code",
      "qr_url",
      "watermark",
      "fingerprint",
      "manual"
    ]);

    if (!isNonEmptyString(value.recovery.method) || !knownMethods.has(value.recovery.method)) {
      pushIssue(
        issues,
        "VVMP_RENDITION_METHOD_UNKNOWN",
        "recovery.method",
        "recovery.method must be one of the known VVMP recovery methods."
      );
    }

    if ("locator" in value.recovery && !isNonEmptyString(value.recovery.locator)) {
      pushIssue(
        issues,
        "VVMP_RENDITION_FIELD_INVALID",
        "recovery.locator",
        "recovery.locator must be a non-empty string when present."
      );
    }
  }

  const hasIdentifier =
    isNonEmptyString(value.trust_code) ||
    isNonEmptyString(value.trust_page_url) ||
    (isObject(value.recovery) && isNonEmptyString(value.recovery.locator)) ||
    (isObject(value.asset) && isNonEmptyString(value.asset.sha256));

  if (!hasIdentifier) {
    pushIssue(
      issues,
      "VVMP_RENDITION_IDENTIFIER_MISSING",
      "$",
      "Rendition observation must include at least one recovery or asset identifier."
    );
  }

  if ("trust_code" in value && value.trust_code !== undefined && !isNonEmptyString(value.trust_code)) {
    pushIssue(
      issues,
      "VVMP_RENDITION_FIELD_INVALID",
      "trust_code",
      "trust_code must be a non-empty string when present."
    );
  }

  if (
    "trust_page_url" in value &&
    value.trust_page_url !== undefined &&
    !isNonEmptyString(value.trust_page_url)
  ) {
    pushIssue(
      issues,
      "VVMP_RENDITION_FIELD_INVALID",
      "trust_page_url",
      "trust_page_url must be a non-empty string when present."
    );
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export function buildRecoveryCardSummary(
  manifest: VvmpManifest,
  options: { baseUrl?: string } = {}
): RecoveryCardSummary {
  const trustCode = isNonEmptyString(manifest.video.trust_code) ? manifest.video.trust_code : null;
  const explicitTrustPage =
    isNonEmptyString(manifest.links?.trust_page) ? String(manifest.links.trust_page) : null;
  const publicationTrustPage =
    isNonEmptyString(manifest.publication?.registry_url)
      ? String(manifest.publication.registry_url)
      : null;
  const baseUrl = normalizeUrl(options.baseUrl);
  const trustPageUrl =
    explicitTrustPage ??
    publicationTrustPage ??
    (baseUrl && trustCode ? `${baseUrl}/v/${encodeURIComponent(trustCode)}` : null);

  return {
    manifest_id: manifest.manifest_id,
    title: manifest.video.title,
    trust_code: trustCode,
    trust_page_url: trustPageUrl,
    qr_target_url: trustPageUrl,
    badge_text: trustCode ? `Trust: ${trustCode}` : "Trust code unavailable",
    final_asset: manifest.video.final_asset,
    recovery_capable: Boolean(trustCode || trustPageUrl)
  };
}

export function compareRenditionObservation(
  manifest: VvmpManifest,
  observation: RenditionObservation,
  options: { baseUrl?: string; durationToleranceSeconds?: number } = {}
): RenditionComparison {
  const validation = validateRenditionObservation(observation);
  if (!validation.valid) {
    throw new Error(
      `Invalid rendition observation: ${validation.issues
        .map((issue) => `${issue.code}@${issue.path}`)
        .join(", ")}`
    );
  }

  const summary = buildRecoveryCardSummary(manifest, {
    baseUrl: options.baseUrl
  });
  const durationToleranceSeconds = options.durationToleranceSeconds ?? 1;

  const trustCodeMatch = Boolean(
    summary.trust_code &&
      isNonEmptyString(observation.trust_code) &&
      summary.trust_code === observation.trust_code
  );

  const trustPageMatch = Boolean(
    summary.trust_page_url &&
      (
        normalizeUrl(observation.trust_page_url) === normalizeUrl(summary.trust_page_url) ||
        normalizeUrl(observation.recovery.locator) === normalizeUrl(summary.trust_page_url)
      )
  );

  const assetHashMatch = isNonEmptyString(observation.asset.sha256)
    ? observation.asset.sha256 === manifest.video.final_asset.sha256
    : null;
  const formatMatch = isNonEmptyString(observation.asset.format)
    ? observation.asset.format === manifest.video.final_asset.format
    : null;
  const durationDeltaSeconds =
    typeof observation.asset.duration_seconds === "number"
      ? Math.abs(observation.asset.duration_seconds - manifest.video.final_asset.duration_seconds)
      : null;
  const durationMatch =
    durationDeltaSeconds === null ? null : durationDeltaSeconds <= durationToleranceSeconds;

  const recovered = Boolean(assetHashMatch || trustCodeMatch || trustPageMatch);
  const exactBinaryMatch = assetHashMatch === true;

  let matchType: RenditionComparison["match_type"] = "no_match";
  if (exactBinaryMatch) {
    matchType = "exact_asset_match";
  } else if (recovered && (formatMatch !== false || durationMatch !== false)) {
    matchType = "likely_known_rendition";
  } else if (recovered) {
    matchType = "reference_match_only";
  }

  let recommendedFileTrustState = "remote_manifest_not_found";
  if (exactBinaryMatch) {
    recommendedFileTrustState = "remote_manifest_found";
  } else if (recovered) {
    switch (observation.recovery.method) {
      case "qr_url":
        recommendedFileTrustState = "recovered_by_qr";
        break;
      case "watermark":
        recommendedFileTrustState = "recovered_by_watermark";
        break;
      case "fingerprint":
        recommendedFileTrustState = "recovered_by_fingerprint";
        break;
      default:
        recommendedFileTrustState = "remote_manifest_found";
        break;
    }
  }

  const notes: string[] = [];
  if (exactBinaryMatch) {
    notes.push("Observed asset hash matches the manifest final asset hash exactly.");
  } else if (recovered) {
    notes.push(
      "Observed copy was recovered through a reference path, so the exact binary may differ from the original export."
    );
  } else {
    notes.push("Observed copy could not be linked back to the manifest through the provided recovery data.");
  }

  if (durationDeltaSeconds !== null) {
    notes.push(`Observed duration differs from the manifest by ${durationDeltaSeconds.toFixed(2)} seconds.`);
  }

  return {
    recovered,
    exact_binary_match: exactBinaryMatch,
    match_type: matchType,
    recommended_file_trust_state: recommendedFileTrustState,
    manifest_id: manifest.manifest_id,
    trust_code: summary.trust_code,
    trust_page_url: summary.trust_page_url,
    comparison: {
      trust_code_match: trustCodeMatch,
      trust_page_match: trustPageMatch,
      asset_hash_match: assetHashMatch,
      format_match: formatMatch,
      duration_match: durationMatch,
      duration_delta_seconds: durationDeltaSeconds,
      recovery_method: observation.recovery.method,
      locator: observation.recovery.locator ?? null
    },
    notes
  };
}
