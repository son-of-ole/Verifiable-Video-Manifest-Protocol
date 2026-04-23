import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import zlib from "node:zlib";
import {
  Builder,
  LocalSigner,
  Reader,
  Trustmark,
  createTrustSettings,
  createVerifySettings,
  mergeSettings
} from "@contentauth/c2pa-node";
import { canonicalizeJson, type VvmpManifest } from "@vvmp/trust-core";

export type PrototypeC2paManifest = {
  format: "vvmp-c2pa-prototype/v1";
  profile: string;
  manifest_id: string;
  title: string;
  asset: {
    format: string;
    sha256: string;
  };
  c2pa: {
    claim_generator: string;
    title: string;
    format: string;
    assertions: Array<Record<string, unknown>>;
  };
  vvmp_assertion: {
    label: string;
    manifest: VvmpManifest;
  };
};

export type PrototypeSignatureEnvelope = {
  format: "vvmp-prototype-signature/v1";
  signer: string;
  algorithm: "ed25519";
  payload_sha256: string;
  signature_base64: string;
  public_key_pem: string;
  signed_at: string;
};

export type PrototypeSidecar = {
  format: "vvmp-c2pa-sidecar-prototype/v1";
  generated_at: string;
  manifest_id: string;
  trust_code: string | null;
  prototype_manifest: PrototypeC2paManifest;
  signature: PrototypeSignatureEnvelope;
};

export type SignPrototypeOptions = {
  manifest: VvmpManifest;
  signer: string;
  privateKeyPem?: string;
};

export type PrototypeVerificationResult = {
  valid: boolean;
  checks: Array<{
    code: string;
    ok: boolean;
    message: string;
  }>;
  signer: string;
  algorithm: string;
  payload_sha256: string;
  recomputed_payload_sha256: string;
  manifest_id: string;
  trust_code: string | null;
};

export type C2paManifestDefinition = {
  title: string;
  format: string;
  claim_generator: string;
  vendor?: string;
  ingredients: Array<Record<string, unknown>>;
  assertions: Array<{
    label: string;
    data: Record<string, unknown>;
  }>;
};

export type ExportC2paOptions = {
  manifest: VvmpManifest;
  inputAssetPath: string;
  outputAssetPath: string;
  certificatePem: string;
  privateKeyPem: string;
  manifestBaseDir?: string;
  algorithm?: "es256" | "es384" | "es512" | "ps256" | "ps384" | "ps512" | "ed25519";
  tsaUrl?: string;
  remoteUrl?: string;
  noEmbed?: boolean;
};

export type ExportC2paResult = {
  manifest_id: string;
  trust_code: string | null;
  outputAssetPath: string;
  embedded: boolean;
  manifestBytes: Buffer;
  manifestDefinition: C2paManifestDefinition;
  ingredientSummary: {
    total: number;
    fileBacked: number;
  };
};

export type ReadC2paOptions = {
  assetPath: string;
  manifestData?: Buffer;
  settingsFilePath?: string;
  trustProgram?: TrustProgramId;
  trustProgramCacheDir?: string;
  refreshTrustProgram?: boolean;
  trustAnchorsPem?: string;
  userAnchorsPem?: string;
  allowedListPem?: string;
  trustConfigPath?: string;
  verifyTrustList?: boolean;
  verifyTrust?: boolean;
  verifyTimestampTrust?: boolean;
  remoteManifestFetch?: boolean;
  ocspFetch?: boolean;
  strictV1Validation?: boolean;
  localTrustProfile?: LocalTrustProfileDocument;
};

export type C2paVerificationSummary = {
  manifest_state: "missing" | "found";
  content_binding_state: "valid" | "invalid" | "unknown";
  signature_state: "valid" | "invalid" | "unknown";
  trust_state: "trusted" | "untrusted" | "not_checked" | "unknown";
  overall_state:
    | "missing"
    | "trusted_valid"
    | "content_bound_but_untrusted"
    | "content_bound_but_signature_invalid"
    | "content_binding_invalid"
    | "present_unknown";
  success_codes: string[];
  failure_codes: string[];
};

export type ReadC2paResult = {
  found: boolean;
  embedded: boolean;
  remoteUrl: string | null;
  activeLabel: string | null;
  validationState: string | null;
  validationStatus: Array<Record<string, unknown>>;
  verificationSummary: C2paVerificationSummary;
  localTrustProfileSummary: LocalTrustProfileSummary;
  trustProgramSummary: TrustProgramSummary;
  manifestStore: Record<string, unknown> | null;
};

export type TrustedSignerProfile = {
  signer_id: string;
  algorithm?: string;
  issuer: string;
  common_name?: string;
  cert_serial_number: string;
  environment?: string;
  note?: string;
};

export type LocalTrustProfileDocument = {
  format: "vvmp-local-trust-profile/v1";
  profile_id: string;
  created_at: string;
  signers: TrustedSignerProfile[];
};

export type LocalTrustProfileSummary = {
  enabled: boolean;
  profile_id: string | null;
  trust_state: "trusted" | "untrusted" | "not_checked";
  matched_signer_id: string | null;
  matched_fields: string[];
  reason:
    | "not_checked"
    | "signature_invalid"
    | "signature_info_missing"
    | "no_match"
    | "trusted_profile_match";
};

export type CreateLocalTrustProfileOptions = {
  certificatePem: string;
  profileId?: string;
  signerId?: string;
  algorithm?: string;
  environment?: string;
  note?: string;
  createdAt?: string;
};

export type TrustProgramId = "official-c2pa" | "interim";

export type ResolveTrustProgramOptions = {
  trustProgram: TrustProgramId;
  cacheDir?: string;
  refresh?: boolean;
};

export type ResolvedTrustProgram = {
  trust_program: TrustProgramId;
  label: string;
  source: "bundled_fixture" | "cache";
  trustAnchorsPem?: string;
  allowedListPem?: string;
  trustConfigPath?: string;
  tsaTrustAnchorsPem?: string;
  paths: {
    trustAnchorsPath?: string;
    allowedListPath?: string;
    trustConfigPath?: string;
    tsaTrustAnchorsPath?: string;
  };
  remote_sources: Partial<Record<"trustAnchors" | "allowedList" | "trustConfig" | "tsaTrustAnchors", string>>;
  node_support: {
    trustAnchors: boolean;
    allowedList: boolean;
    trustConfig: boolean;
    tsaTrustAnchors: boolean;
    verifyTimestampTrust: boolean;
  };
};

export type TrustProgramSummary = {
  enabled: boolean;
  trust_program: TrustProgramId | null;
  source: "bundled_fixture" | "cache" | null;
  trust_anchors_path: string | null;
  allowed_list_path: string | null;
  trust_config_path: string | null;
  tsa_trust_anchors_path: string | null;
  node_supports_tsa_trust_anchors: boolean;
};

export type TrustedC2paSigningProfile = {
  format: "vvmp-c2pa-signing-profile/v1";
  profile_id: string;
  trust_program: TrustProgramId;
  certificate_pem_path: string;
  private_key_pem_path: string;
  algorithm: "es256" | "es384" | "es512" | "ps256" | "ps384" | "ps512" | "ed25519";
  tsa_url?: string;
  note?: string;
};

type TrustProgramFileKey = "trustAnchors" | "allowedList" | "trustConfig" | "tsaTrustAnchors";
type TrustProgramFileMap = Partial<Record<TrustProgramFileKey, string>>;

export const TRUSTMARK_VERSION_BIT_LENGTHS = {
  BCH_SUPER: 40,
  BCH_5: 61,
  BCH_4: 68,
  BCH_3: 75
} as const;

export type TrustmarkVersionName = keyof typeof TRUSTMARK_VERSION_BIT_LENGTHS;
export type TrustmarkVariantName = "B" | "C" | "P" | "Q";

export type EnsureTrustmarkModelsOptions = {
  variant?: TrustmarkVariantName;
  modelDir?: string;
  modelRootUrl?: string;
};

export type EncodeTrustmarkOptions = {
  inputAssetPath: string;
  outputAssetPath: string;
  watermarkBits?: string;
  variant?: TrustmarkVariantName;
  version?: TrustmarkVersionName;
  strength?: number;
  modelDir?: string;
  modelRootUrl?: string;
};

export type EncodeTrustmarkResult = {
  outputAssetPath: string;
  watermark_bits: string;
  variant: TrustmarkVariantName;
  version: TrustmarkVersionName;
  bit_length: number;
  strength: number;
  model_dir: string;
  image: {
    width: number;
    height: number;
    format: "image/png";
  };
};

export type DecodeTrustmarkOptions = {
  assetPath: string;
  variant?: TrustmarkVariantName;
  version?: TrustmarkVersionName;
  modelDir?: string;
  modelRootUrl?: string;
};

export type DecodeTrustmarkResult = {
  watermark_bits: string;
  bit_length: number;
  variant: TrustmarkVariantName;
  version: TrustmarkVersionName;
  model_dir: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toOptionalStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const TRUST_PROGRAM_PRESETS = {
  "official-c2pa": {
    label: "Official C2PA trust list",
    bundledFiles: {
      trustAnchors: path.resolve(
        __dirname,
        "../../../test-fixtures/c2pa-trust-programs/official-c2pa/C2PA-TRUST-LIST.pem"
      ),
      tsaTrustAnchors: path.resolve(
        __dirname,
        "../../../test-fixtures/c2pa-trust-programs/official-c2pa/C2PA-TSA-TRUST-LIST.pem"
      )
    },
    remoteSources: {
      trustAnchors:
        "https://raw.githubusercontent.com/c2pa-org/conformance-public/main/trust-list/C2PA-TRUST-LIST.pem",
      tsaTrustAnchors:
        "https://raw.githubusercontent.com/c2pa-org/conformance-public/main/trust-list/C2PA-TSA-TRUST-LIST.pem"
    }
  },
  interim: {
    label: "Legacy interim trust list",
    bundledFiles: {
      trustAnchors: path.resolve(
        __dirname,
        "../../../test-fixtures/c2pa-trust-programs/interim/anchors.pem"
      ),
      allowedList: path.resolve(
        __dirname,
        "../../../test-fixtures/c2pa-trust-programs/interim/allowed.sha256.txt"
      ),
      trustConfig: path.resolve(
        __dirname,
        "../../../test-fixtures/c2pa-trust-programs/interim/store.cfg"
      )
    },
    remoteSources: {
      trustAnchors: "https://contentcredentials.org/trust/anchors.pem",
      allowedList: "https://contentcredentials.org/trust/allowed.sha256.txt",
      trustConfig: "https://contentcredentials.org/trust/store.cfg"
    }
  }
} satisfies Record<
  TrustProgramId,
  {
    label: string;
    bundledFiles: TrustProgramFileMap;
    remoteSources: TrustProgramFileMap;
  }
>;

function getDefaultTrustProgramCacheRoot(trustProgram: TrustProgramId): string {
  return path.join(os.homedir(), ".vvmp", "trust-programs", trustProgram);
}

function getTrustProgramCachePaths(
  trustProgram: TrustProgramId,
  cacheDir?: string
): TrustProgramFileMap {
  const rootDir = path.resolve(cacheDir ?? getDefaultTrustProgramCacheRoot(trustProgram));
  const preset = TRUST_PROGRAM_PRESETS[trustProgram];
  const paths: TrustProgramFileMap = {};

  for (const [key, bundledPath] of Object.entries(preset.bundledFiles) as Array<
    [TrustProgramFileKey, string]
  >) {
    paths[key] = path.join(rootDir, path.basename(bundledPath));
  }

  return paths;
}

function buildTrustProgramSummary(
  resolvedTrustProgram: ResolvedTrustProgram | undefined
): TrustProgramSummary {
  if (!resolvedTrustProgram) {
    return {
      enabled: false,
      trust_program: null,
      source: null,
      trust_anchors_path: null,
      allowed_list_path: null,
      trust_config_path: null,
      tsa_trust_anchors_path: null,
      node_supports_tsa_trust_anchors: false
    };
  }

  return {
    enabled: true,
    trust_program: resolvedTrustProgram.trust_program,
    source: resolvedTrustProgram.source,
    trust_anchors_path: resolvedTrustProgram.paths.trustAnchorsPath ?? null,
    allowed_list_path: resolvedTrustProgram.paths.allowedListPath ?? null,
    trust_config_path: resolvedTrustProgram.paths.trustConfigPath ?? null,
    tsa_trust_anchors_path: resolvedTrustProgram.paths.tsaTrustAnchorsPath ?? null,
    node_supports_tsa_trust_anchors: resolvedTrustProgram.node_support.tsaTrustAnchors
  };
}

function normalizeForMatch(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

function extractFirstCertificatePem(certificatePem: string): string {
  const match = certificatePem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/
  );

  if (!match) {
    throw new Error("No certificate PEM block found.");
  }

  return match[0];
}

function parseDistinguishedNameAttributes(dnText: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const normalized = dnText.replace(/\n+/g, "/").trim();
  const slashParts = normalized.split("/").filter(Boolean);

  if (slashParts.length > 0) {
    for (const part of slashParts) {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key && value) {
        attributes[key] = value;
      }
    }

    return attributes;
  }

  for (const line of normalized.split(",")) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && value) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function inferSigningAlgorithmFromCertificate(
  certificate: crypto.X509Certificate
): string | undefined {
  const publicKey = certificate.publicKey;
  const keyType = publicKey.asymmetricKeyType;

  if (keyType === "ed25519") {
    return "ed25519";
  }

  if (keyType === "ec") {
    const namedCurve = publicKey.asymmetricKeyDetails?.namedCurve?.toLowerCase();
    if (namedCurve === "prime256v1" || namedCurve === "secp256r1") {
      return "es256";
    }

    if (namedCurve === "secp384r1") {
      return "es384";
    }

    if (namedCurve === "secp521r1") {
      return "es512";
    }
  }

  return undefined;
}

function toDecimalSerial(serialHex: string): string {
  return BigInt(`0x${serialHex.replace(/[^0-9a-f]/gi, "")}`).toString(10);
}

function isTrustedSignerProfile(value: unknown): value is TrustedSignerProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.signer_id === "string" &&
    typeof value.issuer === "string" &&
    typeof value.cert_serial_number === "string"
  );
}

function getNormalizedTrustedSigners(profile: LocalTrustProfileDocument | undefined): TrustedSignerProfile[] {
  return Array.isArray(profile?.signers) ? profile.signers.filter(isTrustedSignerProfile) : [];
}

function extractActiveSignatureInfo(
  manifestStore: Record<string, unknown> | null
): TrustedSignerProfile | null {
  if (!manifestStore || typeof manifestStore.active_manifest !== "string") {
    return null;
  }

  const manifests = manifestStore.manifests;
  if (!isRecord(manifests)) {
    return null;
  }

  const activeManifest = manifests[manifestStore.active_manifest];
  if (!isRecord(activeManifest) || !isRecord(activeManifest.signature_info)) {
    return null;
  }

  const signatureInfo = activeManifest.signature_info;
  const issuer = toOptionalString(signatureInfo.issuer);
  const certSerialNumber = toOptionalString(signatureInfo.cert_serial_number);

  if (!issuer || !certSerialNumber) {
    return null;
  }

  return {
    signer_id: "embedded_signature",
    algorithm: toOptionalString(signatureInfo.alg),
    issuer,
    common_name: toOptionalString(signatureInfo.common_name),
    cert_serial_number: certSerialNumber
  };
}

function summarizeLocalTrustProfile(
  verificationSummary: C2paVerificationSummary,
  manifestStore: Record<string, unknown> | null,
  localTrustProfile?: LocalTrustProfileDocument
): LocalTrustProfileSummary {
  if (!localTrustProfile) {
    return {
      enabled: false,
      profile_id: null,
      trust_state: "not_checked",
      matched_signer_id: null,
      matched_fields: [],
      reason: "not_checked"
    };
  }

  const trustedSigners = getNormalizedTrustedSigners(localTrustProfile);
  if (verificationSummary.signature_state !== "valid") {
    return {
      enabled: true,
      profile_id: localTrustProfile.profile_id,
      trust_state: "untrusted",
      matched_signer_id: null,
      matched_fields: [],
      reason: "signature_invalid"
    };
  }

  const observedSigner = extractActiveSignatureInfo(manifestStore);
  if (!observedSigner) {
    return {
      enabled: true,
      profile_id: localTrustProfile.profile_id,
      trust_state: "untrusted",
      matched_signer_id: null,
      matched_fields: [],
      reason: "signature_info_missing"
    };
  }

  for (const signer of trustedSigners) {
    if (normalizeForMatch(signer.cert_serial_number) !== normalizeForMatch(observedSigner.cert_serial_number)) {
      continue;
    }

    if (normalizeForMatch(signer.issuer) !== normalizeForMatch(observedSigner.issuer)) {
      continue;
    }

    if (
      signer.common_name &&
      normalizeForMatch(signer.common_name) !== normalizeForMatch(observedSigner.common_name)
    ) {
      continue;
    }

    if (
      signer.algorithm &&
      normalizeForMatch(signer.algorithm) !== normalizeForMatch(observedSigner.algorithm)
    ) {
      continue;
    }

    const matched_fields = ["cert_serial_number", "issuer"];
    if (signer.common_name) {
      matched_fields.push("common_name");
    }

    if (signer.algorithm) {
      matched_fields.push("algorithm");
    }

    return {
      enabled: true,
      profile_id: localTrustProfile.profile_id,
      trust_state: "trusted",
      matched_signer_id: signer.signer_id,
      matched_fields,
      reason: "trusted_profile_match"
    };
  }

  return {
    enabled: true,
    profile_id: localTrustProfile.profile_id,
    trust_state: "untrusted",
    matched_signer_id: null,
    matched_fields: [],
    reason: "no_match"
  };
}

export function createLocalTrustProfileFromCertificatePem({
  certificatePem,
  profileId = "vvmp-local-trust-profile",
  signerId = "local_signer",
  algorithm,
  environment,
  note,
  createdAt
}: CreateLocalTrustProfileOptions): LocalTrustProfileDocument {
  const certificate = new crypto.X509Certificate(extractFirstCertificatePem(certificatePem));
  const subjectAttributes = parseDistinguishedNameAttributes(certificate.subject);
  const inferredAlgorithm = algorithm ?? inferSigningAlgorithmFromCertificate(certificate);

  return {
    format: "vvmp-local-trust-profile/v1",
    profile_id: profileId,
    created_at: createdAt ?? new Date().toISOString(),
    signers: [
      {
        signer_id: signerId,
        algorithm: inferredAlgorithm,
        issuer: subjectAttributes.O ?? subjectAttributes.CN ?? certificate.subject,
        common_name: subjectAttributes.CN,
        cert_serial_number: toDecimalSerial(certificate.serialNumber),
        environment,
        note
      }
    ]
  };
}

type C2paIngredientDescriptor = {
  ingredient: Record<string, unknown>;
  filePath?: string;
  mimeType?: string;
};

function resolveOptionalFilePath(
  record: Record<string, unknown>,
  manifestBaseDir?: string
): string | undefined {
  const rawPath =
    toOptionalString(record.local_path) ??
    toOptionalString(record.file_path) ??
    toOptionalString(record.path) ??
    toOptionalString(record.asset_path) ??
    toOptionalString(record.source_path);

  if (!rawPath) {
    return undefined;
  }

  return path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(manifestBaseDir ?? process.cwd(), rawPath);
}

function inferMimeTypeFromPath(filePath: string): string | undefined {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".txt":
    case ".md":
    case ".json":
      return "text/plain";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".pdf":
      return "application/pdf";
    default:
      return undefined;
  }
}

function isTrustmarkVersionName(value: string): value is TrustmarkVersionName {
  return value in TRUSTMARK_VERSION_BIT_LENGTHS;
}

function getTrustmarkModelDir(
  variant: TrustmarkVariantName,
  modelDir?: string
): string {
  if (modelDir) {
    return path.resolve(modelDir);
  }

  return path.join(os.homedir(), ".vvmp", "trustmark-models", variant);
}

function getTrustmarkModelRootUrl(modelRootUrl?: string): string {
  return (
    modelRootUrl ??
    process.env.VVMP_TRUSTMARK_MODEL_ROOT ??
    "https://cc-assets.netlify.app/watermarking/trustmark-models"
  ).replace(/\/+$/, "");
}

async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${url} (${response.status})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.writeFile(destinationPath, bytes);
}

async function readFileIfPresent(filePath: string | undefined): Promise<string | undefined> {
  if (!filePath || !(await fileExists(filePath))) {
    return undefined;
  }

  return fs.readFile(filePath, "utf8");
}

async function ensureTrustProgramCache(
  trustProgram: TrustProgramId,
  cacheDir?: string
): Promise<TrustProgramFileMap> {
  const preset = TRUST_PROGRAM_PRESETS[trustProgram];
  const cachePaths = getTrustProgramCachePaths(trustProgram, cacheDir);

  await Promise.all(
    (Object.entries(preset.remoteSources) as Array<[TrustProgramFileKey, string]>).map(
      async ([key, url]) => {
        const destinationPath = cachePaths[key];
        if (!destinationPath) {
          return;
        }

        await downloadFile(url, destinationPath);
      }
    )
  );

  return cachePaths;
}

export async function resolveTrustProgram({
  trustProgram,
  cacheDir,
  refresh = false
}: ResolveTrustProgramOptions): Promise<ResolvedTrustProgram> {
  const preset = TRUST_PROGRAM_PRESETS[trustProgram];
  if (!preset) {
    throw new Error(`Unknown trust program: ${trustProgram}`);
  }

  const cachePaths =
    cacheDir || refresh ? await ensureTrustProgramCache(trustProgram, cacheDir) : undefined;
  const useCache =
    Boolean(cachePaths?.trustAnchors && (await fileExists(cachePaths.trustAnchors))) ||
    Boolean(cachePaths?.allowedList && (await fileExists(cachePaths.allowedList))) ||
    Boolean(cachePaths?.trustConfig && (await fileExists(cachePaths.trustConfig)));
  const selectedPaths = (useCache && cachePaths ? cachePaths : preset.bundledFiles) as TrustProgramFileMap;

  return {
    trust_program: trustProgram,
    label: preset.label,
    source: useCache ? "cache" : "bundled_fixture",
    trustAnchorsPem: await readFileIfPresent(selectedPaths.trustAnchors),
    allowedListPem: await readFileIfPresent(selectedPaths.allowedList),
    trustConfigPath:
      selectedPaths.trustConfig && (await fileExists(selectedPaths.trustConfig))
        ? selectedPaths.trustConfig
        : undefined,
    tsaTrustAnchorsPem: await readFileIfPresent(selectedPaths.tsaTrustAnchors),
    paths: {
      trustAnchorsPath:
        selectedPaths.trustAnchors && (await fileExists(selectedPaths.trustAnchors))
          ? selectedPaths.trustAnchors
          : undefined,
      allowedListPath:
        selectedPaths.allowedList && (await fileExists(selectedPaths.allowedList))
          ? selectedPaths.allowedList
          : undefined,
      trustConfigPath:
        selectedPaths.trustConfig && (await fileExists(selectedPaths.trustConfig))
          ? selectedPaths.trustConfig
          : undefined,
      tsaTrustAnchorsPath:
        selectedPaths.tsaTrustAnchors && (await fileExists(selectedPaths.tsaTrustAnchors))
          ? selectedPaths.tsaTrustAnchors
          : undefined
    },
    remote_sources: preset.remoteSources,
    node_support: {
      trustAnchors: true,
      allowedList: true,
      trustConfig: true,
      tsaTrustAnchors: false,
      verifyTimestampTrust: true
    }
  };
}

async function ensureFileWithDownload(
  filePath: string,
  url: string
): Promise<void> {
  if (await fileExists(filePath)) {
    return;
  }

  await downloadFile(url, filePath);
}

function buildTrustmarkModelFileName(
  kind: "encoder" | "decoder",
  variant: TrustmarkVariantName
): string {
  return `${kind}_${variant}.onnx`;
}

function assertValidTrustmarkBits(
  watermarkBits: string,
  version: TrustmarkVersionName
): void {
  if (!/^[01]+$/.test(watermarkBits)) {
    throw new Error("Trustmark payloads must contain only 0 and 1 characters.");
  }

  const maxBits = TRUSTMARK_VERSION_BIT_LENGTHS[version];
  if (watermarkBits.length > maxBits) {
    throw new Error(
      `Trustmark payload is too long for ${version}: received ${watermarkBits.length} bits, max ${maxBits}.`
    );
  }
}

function generateRandomTrustmarkBits(version: TrustmarkVersionName = "BCH_5"): string {
  const maxBits = TRUSTMARK_VERSION_BIT_LENGTHS[version];
  const bytes = crypto.randomBytes(Math.ceil(maxBits / 8));
  let bits = "";
  for (const value of bytes) {
    bits += value.toString(2).padStart(8, "0");
  }
  return bits.slice(0, maxBits);
}

function assertPngSignature(buffer: Buffer): void {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, signature.length).equals(signature)) {
    throw new Error("VVMP trustmark encoding currently supports PNG input assets only.");
  }
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  assertPngSignature(buffer);

  if (buffer.length < 24) {
    throw new Error("PNG asset is too small to contain width and height metadata.");
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    throw new Error("PNG asset is missing the IHDR chunk required for trustmark encoding.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function buildPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuffer, data]);
  let crc = 0xffffffff;
  for (const byte of crcInput) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function wrapRawRgbAsPng(rgb: Buffer, width: number, height: number): Buffer {
  if (rgb.length !== width * height * 3) {
    throw new Error(
      `Encoded trustmark image byte length did not match expected RGB size (${width}x${height}).`
    );
  }

  const rows: Buffer[] = [];
  for (let row = 0; row < height; row += 1) {
    const rgba = Buffer.alloc(width * 4);
    for (let column = 0; column < width; column += 1) {
      const rgbIndex = (row * width + column) * 3;
      const rgbaIndex = column * 4;
      rgba[rgbaIndex] = rgb[rgbIndex];
      rgba[rgbaIndex + 1] = rgb[rgbIndex + 1];
      rgba[rgbaIndex + 2] = rgb[rgbIndex + 2];
      rgba[rgbaIndex + 3] = 255;
    }

    rows.push(Buffer.concat([Buffer.from([0]), rgba]));
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  return Buffer.concat([
    signature,
    buildPngChunk("IHDR", ihdr),
    buildPngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    buildPngChunk("IEND", Buffer.alloc(0))
  ]);
}

async function fileExists(filePath: string | undefined): Promise<boolean> {
  if (!filePath) {
    return false;
  }

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function collectValidationEntries(
  manifestStore: Record<string, unknown> | null,
  bucket: "success" | "failure" | "informational"
): Array<Record<string, unknown>> {
  if (!manifestStore) {
    return [];
  }

  const validationResults = manifestStore.validation_results;
  if (!isRecord(validationResults)) {
    return [];
  }

  const activeManifest = validationResults.activeManifest;
  if (!isRecord(activeManifest)) {
    return [];
  }

  const entries = activeManifest[bucket];
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter(isRecord);
}

function collectValidationCodes(entries: Array<Record<string, unknown>>): string[] {
  return entries.flatMap((entry) => (typeof entry.code === "string" ? [entry.code] : []));
}

function summarizeVerification(
  found: boolean,
  manifestStore: Record<string, unknown> | null,
  validationStatus: Array<Record<string, unknown>>,
  verifyTrust: boolean
): C2paVerificationSummary {
  if (!found) {
    return {
      manifest_state: "missing",
      content_binding_state: "unknown",
      signature_state: "unknown",
      trust_state: verifyTrust ? "unknown" : "not_checked",
      overall_state: "missing",
      success_codes: [],
      failure_codes: []
    };
  }

  const successCodes = collectValidationCodes(collectValidationEntries(manifestStore, "success"));
  const failureCodes = [
    ...new Set([
      ...collectValidationCodes(collectValidationEntries(manifestStore, "failure")),
      ...validationStatus.flatMap((entry) => (typeof entry.code === "string" ? [entry.code] : []))
    ])
  ];

  const hasContentBindingSuccess = successCodes.some(
    (code) => code === "assertion.hashedURI.match" || code === "assertion.dataHash.match"
  );
  const hasContentBindingFailure = failureCodes.some(
    (code) =>
      code.includes("hashedURI.mismatch") ||
      code.includes("dataHash.mismatch") ||
      code.includes("assertion.mismatch")
  );
  const hasSignatureFailure = failureCodes.some(
    (code) => code.startsWith("claimSignature.") || code.startsWith("signingCredential.invalid")
  );
  const hasSignatureSuccess = successCodes.some(
    (code) => code === "claimSignature.validated" || code === "claimSignature.insideValidity"
  );
  const hasTrustFailure = failureCodes.some(
    (code) =>
      code.includes("untrusted") ||
      code.includes("revoked") ||
      code.includes("expired") ||
      code.includes("notTrusted")
  );

  const content_binding_state: C2paVerificationSummary["content_binding_state"] =
    hasContentBindingFailure ? "invalid" : hasContentBindingSuccess ? "valid" : "unknown";

  const signature_state: C2paVerificationSummary["signature_state"] = hasSignatureFailure
    ? "invalid"
    : hasSignatureSuccess
      ? "valid"
      : "unknown";

  const trust_state: C2paVerificationSummary["trust_state"] = !verifyTrust
    ? "not_checked"
    : hasTrustFailure
      ? "untrusted"
      : typeof manifestStore?.validation_state === "string" && manifestStore.validation_state === "Valid"
        ? "trusted"
        : "unknown";

  let overall_state: C2paVerificationSummary["overall_state"] = "present_unknown";
  if (content_binding_state === "invalid") {
    overall_state = "content_binding_invalid";
  } else if (signature_state === "invalid") {
    overall_state = "content_bound_but_signature_invalid";
  } else if (content_binding_state === "valid" && trust_state === "trusted") {
    overall_state = "trusted_valid";
  } else if (content_binding_state === "valid") {
    overall_state = "content_bound_but_untrusted";
  }

  return {
    manifest_state: "found",
    content_binding_state,
    signature_state,
    trust_state,
    overall_state,
    success_codes: successCodes,
    failure_codes: failureCodes
  };
}

type ReadC2paSettingsOptions = Omit<
  ReadC2paOptions,
  "assetPath" | "manifestData" | "localTrustProfile" | "trustProgram" | "trustProgramCacheDir" | "refreshTrustProgram"
>;

async function loadSettingsFileText(
  settingsFilePath?: string
): Promise<string | undefined> {
  return settingsFilePath ? fs.readFile(settingsFilePath, "utf8") : undefined;
}

function inferVerifyTrustFromSettingsText(
  settingsText: string | undefined
): boolean | undefined {
  if (!settingsText) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(settingsText) as Record<string, unknown>;
    if (isRecord(parsed.verify)) {
      if (typeof parsed.verify.verify_trust === "boolean") {
        return parsed.verify.verify_trust;
      }

      if (typeof parsed.verify.verifyTrust === "boolean") {
        return parsed.verify.verifyTrust;
      }
    }
  } catch {
    const match = settingsText.match(/verify_trust\s*=\s*(true|false)/i);
    if (match) {
      return match[1].toLowerCase() === "true";
    }
  }

  return undefined;
}

async function buildReaderSettings(
  options: ReadC2paSettingsOptions,
  loadedSettingsText?: string
): Promise<string | object | undefined> {
  if (options.settingsFilePath) {
    return loadedSettingsText ?? loadSettingsFileText(options.settingsFilePath);
  }

  const settings: object[] = [];
  const hasTrustConfig =
    options.trustAnchorsPem ||
    options.userAnchorsPem ||
    options.allowedListPem ||
    options.trustConfigPath ||
    typeof options.verifyTrustList === "boolean";

  if (hasTrustConfig) {
    settings.push(
      createTrustSettings({
        verifyTrustList: options.verifyTrustList ?? false,
        trustAnchors: options.trustAnchorsPem,
        userAnchors: options.userAnchorsPem,
        allowedList: options.allowedListPem,
        trustConfig: options.trustConfigPath
      })
    );
  }

  const hasVerifyConfig =
    typeof options.verifyTrust === "boolean" ||
    typeof options.verifyTimestampTrust === "boolean" ||
    typeof options.remoteManifestFetch === "boolean" ||
    typeof options.ocspFetch === "boolean" ||
    typeof options.strictV1Validation === "boolean";

  if (hasVerifyConfig) {
    settings.push(
      createVerifySettings({
        verifyAfterReading: true,
        verifyTrust: options.verifyTrust,
        verifyTimestampTrust: options.verifyTimestampTrust,
        remoteManifestFetch: options.remoteManifestFetch,
        ocspFetch: options.ocspFetch,
        strictV1Validation: options.strictV1Validation
      })
    );
  }

  if (settings.length === 0) {
    return undefined;
  }

  return mergeSettings(...settings);
}

export function getTrustmarkBitLength(
  version: TrustmarkVersionName = "BCH_5"
): number {
  return TRUSTMARK_VERSION_BIT_LENGTHS[version];
}

export function createTrustmarkBits(
  version: TrustmarkVersionName = "BCH_5"
): string {
  return generateRandomTrustmarkBits(version);
}

export async function ensureTrustmarkModels({
  variant = "Q",
  modelDir,
  modelRootUrl
}: EnsureTrustmarkModelsOptions = {}): Promise<string> {
  const resolvedModelDir = getTrustmarkModelDir(variant, modelDir);
  const rootUrl = getTrustmarkModelRootUrl(modelRootUrl);
  const encoderPath = path.join(
    resolvedModelDir,
    buildTrustmarkModelFileName("encoder", variant)
  );
  const decoderPath = path.join(
    resolvedModelDir,
    buildTrustmarkModelFileName("decoder", variant)
  );

  await Promise.all([
    ensureFileWithDownload(
      encoderPath,
      `${rootUrl}/${buildTrustmarkModelFileName("encoder", variant)}`
    ),
    ensureFileWithDownload(
      decoderPath,
      `${rootUrl}/${buildTrustmarkModelFileName("decoder", variant)}`
    )
  ]);

  return resolvedModelDir;
}

export async function encodeTrustmarkImage({
  inputAssetPath,
  outputAssetPath,
  watermarkBits,
  variant = "Q",
  version = "BCH_5",
  strength = 0.95,
  modelDir,
  modelRootUrl
}: EncodeTrustmarkOptions): Promise<EncodeTrustmarkResult> {
  const inputBytes = await fs.readFile(inputAssetPath);
  const { width, height } = readPngDimensions(inputBytes);
  const modelPath = await ensureTrustmarkModels({
    variant,
    modelDir,
    modelRootUrl
  });
  const payload = watermarkBits ?? createTrustmarkBits(version);
  assertValidTrustmarkBits(payload, version);

  const trustmark = await Trustmark.newTrustmark({
    variant,
    version,
    modelPath
  });
  const encodedRgb = await trustmark.encode(inputBytes, strength, payload);
  const outputBytes = wrapRawRgbAsPng(encodedRgb, width, height);
  await fs.writeFile(outputAssetPath, outputBytes);

  return {
    outputAssetPath,
    watermark_bits: payload,
    variant,
    version,
    bit_length: payload.length,
    strength,
    model_dir: modelPath,
    image: {
      width,
      height,
      format: "image/png"
    }
  };
}

export async function decodeTrustmarkImage({
  assetPath,
  variant = "Q",
  version = "BCH_5",
  modelDir,
  modelRootUrl
}: DecodeTrustmarkOptions): Promise<DecodeTrustmarkResult> {
  const imageBytes = await fs.readFile(assetPath);
  const modelPath = await ensureTrustmarkModels({
    variant,
    modelDir,
    modelRootUrl
  });
  const trustmark = await Trustmark.newTrustmark({
    variant,
    version,
    modelPath
  });
  const watermarkBits = await trustmark.decode(imageBytes);

  return {
    watermark_bits: watermarkBits,
    bit_length: watermarkBits.length,
    variant,
    version,
    model_dir: modelPath
  };
}

export function buildPrototypeC2paManifest(manifest: VvmpManifest): PrototypeC2paManifest {
  const aiAssertion = {
    label: "c2pa.ai-disclosure",
    data: {
      human_oversight_level: manifest.creation.human_oversight_level,
      tools: manifest.tools.map((tool) => ({
        tool_type: tool.tool_type,
        provider: tool.provider ?? null,
        model_identifier: tool.model_identifier ?? null,
        purpose: tool.purpose
      }))
    }
  };

  const actionsAssertion = {
    label: "c2pa.actions",
    data: manifest.timeline.map((segment) => ({
      action: "vvmp.segment",
      segment_id: segment.segment_id,
      start: segment.time_range.start,
      end: segment.time_range.end,
      claim_type: segment.claim_type
    }))
  };

  const ingredientsAssertion = {
    label: "c2pa.ingredients",
    data: manifest.sources.map((source) => ({
      source_id: source.source_id,
      source_type: source.source_type,
      title: source.title ?? null,
      visibility: source.visibility
    }))
  };

  return {
    format: "vvmp-c2pa-prototype/v1",
    profile: manifest.video.trust_code ? "registry_backed" : "core_manifest",
    manifest_id: manifest.manifest_id,
    title: manifest.video.title,
    asset: {
      format: manifest.video.final_asset.format,
      sha256: manifest.video.final_asset.sha256
    },
    c2pa: {
      claim_generator: "VVMP Prototype Adapter",
      title: manifest.video.title,
      format: manifest.video.final_asset.format,
      assertions: [aiAssertion, actionsAssertion, ingredientsAssertion]
    },
    vvmp_assertion: {
      label: "org.vvmp.video.provenance.v1",
      manifest
    }
  };
}

export function signPrototypeSidecar({
  manifest,
  signer,
  privateKeyPem
}: SignPrototypeOptions): PrototypeSidecar {
  const prototypeManifest = buildPrototypeC2paManifest(manifest);
  const canonicalPayload = canonicalizeJson(prototypeManifest);
  const payloadSha256 = crypto.createHash("sha256").update(canonicalPayload, "utf8").digest("hex");

  const keyPair = privateKeyPem
    ? {
        privateKey: crypto.createPrivateKey(privateKeyPem),
        publicKey: crypto.createPublicKey(privateKeyPem)
      }
    : crypto.generateKeyPairSync("ed25519");

  const signature = crypto.sign(null, Buffer.from(canonicalPayload, "utf8"), keyPair.privateKey);

  return {
    format: "vvmp-c2pa-sidecar-prototype/v1",
    generated_at: new Date().toISOString(),
    manifest_id: manifest.manifest_id,
    trust_code: manifest.video.trust_code ?? null,
    prototype_manifest: prototypeManifest,
    signature: {
      format: "vvmp-prototype-signature/v1",
      signer,
      algorithm: "ed25519",
      payload_sha256: payloadSha256,
      signature_base64: signature.toString("base64"),
      public_key_pem: keyPair.publicKey.export({ format: "pem", type: "spki" }).toString(),
      signed_at: new Date().toISOString()
    }
  };
}

export function verifyPrototypeSidecar(sidecar: PrototypeSidecar): PrototypeVerificationResult {
  const canonicalPayload = canonicalizeJson(sidecar.prototype_manifest);
  const recomputedPayloadSha256 = crypto
    .createHash("sha256")
    .update(canonicalPayload, "utf8")
    .digest("hex");
  const publicKey = crypto.createPublicKey(sidecar.signature.public_key_pem);
  const signatureBuffer = Buffer.from(sidecar.signature.signature_base64, "base64");
  const signatureValid = crypto.verify(
    null,
    Buffer.from(canonicalPayload, "utf8"),
    publicKey,
    signatureBuffer
  );

  const checks = [
    {
      code: "VVMP_PROTOTYPE_FORMAT_VALID",
      ok:
        sidecar.format === "vvmp-c2pa-sidecar-prototype/v1" &&
        sidecar.signature.format === "vvmp-prototype-signature/v1",
      message: "Prototype sidecar and signature formats are recognized."
    },
    {
      code: "VVMP_PROTOTYPE_MANIFEST_ID_MATCH",
      ok: sidecar.manifest_id === sidecar.prototype_manifest.manifest_id,
      message: "Top-level sidecar manifest ID matches the prototype payload."
    },
    {
      code: "VVMP_PROTOTYPE_PAYLOAD_HASH_MATCH",
      ok: recomputedPayloadSha256 === sidecar.signature.payload_sha256,
      message: "Recomputed canonical payload SHA-256 matches the recorded digest."
    },
    {
      code: "VVMP_PROTOTYPE_SIGNATURE_VALID",
      ok: signatureValid,
      message: "Recorded Ed25519 signature verifies against the canonical payload."
    }
  ];

  return {
    valid: checks.every((check) => check.ok),
    checks,
    signer: sidecar.signature.signer,
    algorithm: sidecar.signature.algorithm,
    payload_sha256: sidecar.signature.payload_sha256,
    recomputed_payload_sha256: recomputedPayloadSha256,
    manifest_id: sidecar.manifest_id,
    trust_code: sidecar.trust_code
  };
}

export function buildC2paManifestDefinition(manifest: VvmpManifest): C2paManifestDefinition {
  const actions = manifest.timeline.map((segment) => ({
    action: "vvmp.segment",
    parameters: {
      segment_id: segment.segment_id,
      start: segment.time_range.start,
      end: segment.time_range.end,
      claim_type: segment.claim_type
    }
  }));

  const segmentSourceIndex = Object.fromEntries(
    manifest.timeline.map((segment) => [segment.segment_id, segment.source_ids ?? []])
  );
  const segmentPromptIndex = Object.fromEntries(
    manifest.timeline.map((segment) => [segment.segment_id, segment.prompt_ids ?? []])
  );
  const segmentAssetIndex = Object.fromEntries(
    manifest.timeline.map((segment) => [
      segment.segment_id,
      [...(segment.visual_asset_ids ?? []), ...(segment.audio_asset_ids ?? [])]
    ])
  );

  const ingredients: Array<Record<string, unknown>> = [
    ...manifest.sources.map((source) => ({
      title: source.title ?? source.canonical_ref ?? source.source_id,
      format: "text/plain",
      instance_id: source.source_id,
      relationship: "componentOf",
      document_id: source.canonical_ref ?? source.source_id,
      source_type: source.source_type,
      visibility: source.visibility
    })),
    ...manifest.prompts.map((prompt) => ({
      title: prompt.prompt_type,
      format: "text/plain",
      instance_id: prompt.prompt_id,
      relationship: "componentOf",
      prompt_type: prompt.prompt_type,
      visibility: prompt.visibility,
      created_by: prompt.created_by ?? null
    })),
    ...manifest.assets.flatMap((asset) => {
      if (!isRecord(asset)) {
        return [];
      }

      const assetId = toOptionalString(asset.asset_id) ?? toOptionalString(asset.id);
      if (!assetId) {
        return [];
      }

      return [
        {
          title: toOptionalString(asset.title) ?? toOptionalString(asset.asset_type) ?? assetId,
          format:
            toOptionalString(asset.format) ??
            toOptionalString(asset.mime_type) ??
            "application/octet-stream",
          instance_id: assetId,
          relationship: "componentOf",
          asset_type: toOptionalString(asset.asset_type) ?? "unknown",
          source: toOptionalString(asset.source) ?? null
        }
      ];
    })
  ];

  const disclosure = {
    human_oversight_level: manifest.creation.human_oversight_level,
    workflow: manifest.creation.workflow,
    tools: manifest.tools.map((tool) => ({
      tool_id: tool.tool_id,
      tool_type: tool.tool_type,
      provider: tool.provider ?? null,
      model_identifier: tool.model_identifier ?? null,
      purpose: tool.purpose
    }))
  };

  const vvmpAssertion = {
    manifest_id: manifest.manifest_id,
    trust_code: manifest.video.trust_code ?? null,
    profile_claim: manifest.publication.profile_claim ?? null,
    title: manifest.video.title,
    asset_sha256: manifest.video.final_asset.sha256,
    source_count: manifest.sources.length,
    prompt_count: manifest.prompts.length,
    tool_count: manifest.tools.length,
    segment_count: manifest.timeline.length,
    edit_count: manifest.edits.length,
    guardrail_count: manifest.guardrails.length
  };

  const sourceLineage = {
    sources: manifest.sources.map((source) => ({
      source_id: source.source_id,
      source_type: source.source_type,
      title: source.title ?? null,
      canonical_ref: source.canonical_ref ?? null,
      visibility: source.visibility,
      referenced_by_segments: Object.entries(segmentSourceIndex)
        .filter(([, sourceIds]) => toOptionalStringArray(sourceIds).includes(source.source_id))
        .map(([segmentId]) => segmentId)
    })),
    prompts: manifest.prompts.map((prompt) => ({
      prompt_id: prompt.prompt_id,
      prompt_type: prompt.prompt_type,
      visibility: prompt.visibility,
      created_by: prompt.created_by ?? null,
      input_hash: prompt.input_hash ?? null,
      referenced_by_segments: Object.entries(segmentPromptIndex)
        .filter(([, promptIds]) => toOptionalStringArray(promptIds).includes(prompt.prompt_id))
        .map(([segmentId]) => segmentId)
    })),
    assets: manifest.assets.flatMap((asset) => {
      if (!isRecord(asset)) {
        return [];
      }

      const assetId = toOptionalString(asset.asset_id) ?? toOptionalString(asset.id);
      if (!assetId) {
        return [];
      }

      return [
        {
          asset_id: assetId,
          asset_type: toOptionalString(asset.asset_type) ?? "unknown",
          source: toOptionalString(asset.source) ?? null,
          referenced_by_segments: Object.entries(segmentAssetIndex)
            .filter(([, assetIds]) => toOptionalStringArray(assetIds).includes(assetId))
            .map(([segmentId]) => segmentId)
        }
      ];
    })
  };

  const segmentLineage = {
    timeline: manifest.timeline.map((segment) => ({
      segment_id: segment.segment_id,
      time_range: segment.time_range,
      claim_type: segment.claim_type,
      source_ids: segment.source_ids ?? [],
      prompt_ids: segment.prompt_ids ?? [],
      visual_asset_ids: segment.visual_asset_ids ?? [],
      audio_asset_ids: segment.audio_asset_ids ?? [],
      generation_event_ids: segment.generation_event_ids ?? [],
      edit_event_ids: segment.edit_event_ids ?? [],
      guardrail_event_ids: segment.guardrail_event_ids ?? []
    }))
  };

  const toolLineage = {
    tools: manifest.tools.map((tool) => ({
      tool_id: tool.tool_id,
      tool_type: tool.tool_type,
      provider: tool.provider ?? null,
      model_identifier: tool.model_identifier ?? null,
      purpose: tool.purpose,
      human_oversight_level: tool.human_oversight_level ?? null
    }))
  };

  const editLineage = {
    edits: manifest.edits.flatMap((edit) => {
      if (!isRecord(edit)) {
        return [];
      }

      const editEventId = toOptionalString(edit.edit_event_id) ?? toOptionalString(edit.id);
      if (!editEventId) {
        return [];
      }

      return [
        {
          edit_event_id: editEventId,
          actor: toOptionalString(edit.actor) ?? null,
          timestamp:
            toOptionalString(edit.timestamp) ??
            toOptionalString(edit.created_at) ??
            null,
          target: toOptionalString(edit.target) ?? null,
          public_summary: toOptionalString(edit.public_summary) ?? null,
          referenced_by_segments: manifest.timeline
            .filter((segment) => (segment.edit_event_ids ?? []).includes(editEventId))
            .map((segment) => segment.segment_id)
        }
      ];
    })
  };

  const guardrailLineage = {
    guardrails: manifest.guardrails.map((guardrail) => ({
      guardrail_event_id: guardrail.guardrail_event_id,
      policy_profile: guardrail.policy_profile,
      policy_version: guardrail.policy_version,
      check_type: guardrail.check_type,
      target_type: guardrail.target_type,
      target_id: guardrail.target_id,
      verdict: guardrail.verdict,
      review_mode: guardrail.review_mode ?? null,
      public_summary: guardrail.public_summary ?? null,
      referenced_by_segments: manifest.timeline
        .filter((segment) => (segment.guardrail_event_ids ?? []).includes(guardrail.guardrail_event_id))
        .map((segment) => segment.segment_id)
    }))
  };

  return {
    title: manifest.video.title,
    format: manifest.video.final_asset.format,
    claim_generator: "VVMP C2PA Adapter",
    vendor: "VVMP",
    ingredients,
    assertions: [
      {
        label: "c2pa.actions",
        data: {
          actions
        }
      },
      {
        label: "org.vvmp.video.ai_disclosure",
        data: disclosure
      },
      {
        label: "org.vvmp.video.provenance",
        data: vvmpAssertion
      },
      {
        label: "org.vvmp.video.source_lineage",
        data: sourceLineage
      },
      {
        label: "org.vvmp.video.segment_lineage",
        data: segmentLineage
      },
      {
        label: "org.vvmp.video.tool_lineage",
        data: toolLineage
      },
      {
        label: "org.vvmp.video.edit_lineage",
        data: editLineage
      },
      {
        label: "org.vvmp.video.guardrail_lineage",
        data: guardrailLineage
      }
    ]
  };
}

async function buildIngredientDescriptors(
  manifest: VvmpManifest,
  manifestBaseDir?: string
): Promise<C2paIngredientDescriptor[]> {
  const sourceDescriptors = await Promise.all(
    manifest.sources.map(async (source) => {
      const sourceRecord = source as unknown as Record<string, unknown>;
      const filePath = resolveOptionalFilePath(sourceRecord, manifestBaseDir);
      const ingredient = {
        title: source.title ?? source.canonical_ref ?? source.source_id,
        format:
          toOptionalString(sourceRecord.format) ??
          inferMimeTypeFromPath(filePath ?? "") ??
          "text/plain",
        instance_id: source.source_id,
        relationship: "componentOf",
        document_id: source.canonical_ref ?? source.source_id,
        source_type: source.source_type,
        visibility: source.visibility
      };

      return {
        ingredient,
        filePath: (await fileExists(filePath)) ? filePath : undefined,
        mimeType:
          toOptionalString(sourceRecord.mime_type) ??
          toOptionalString(sourceRecord.format) ??
          inferMimeTypeFromPath(filePath ?? "")
      } satisfies C2paIngredientDescriptor;
    })
  );

  const promptDescriptors = await Promise.all(
    manifest.prompts.map(async (prompt) => {
      const promptRecord = prompt as unknown as Record<string, unknown>;
      const filePath = resolveOptionalFilePath(promptRecord, manifestBaseDir);
      const ingredient = {
        title: prompt.prompt_type,
        format:
          toOptionalString(promptRecord.format) ??
          inferMimeTypeFromPath(filePath ?? "") ??
          "text/plain",
        instance_id: prompt.prompt_id,
        relationship: "componentOf",
        prompt_type: prompt.prompt_type,
        visibility: prompt.visibility,
        created_by: prompt.created_by ?? null
      };

      return {
        ingredient,
        filePath: (await fileExists(filePath)) ? filePath : undefined,
        mimeType:
          toOptionalString(promptRecord.mime_type) ??
          toOptionalString(promptRecord.format) ??
          inferMimeTypeFromPath(filePath ?? "")
      } satisfies C2paIngredientDescriptor;
    })
  );

  const assetDescriptors = await Promise.all(
    manifest.assets.flatMap((asset) => {
      if (!isRecord(asset)) {
        return [];
      }

      const assetId = toOptionalString(asset.asset_id) ?? toOptionalString(asset.id);
      if (!assetId) {
        return [];
      }

      return [
        (async () => {
          const filePath = resolveOptionalFilePath(asset, manifestBaseDir);
          const ingredient = {
            title: toOptionalString(asset.title) ?? toOptionalString(asset.asset_type) ?? assetId,
            format:
              toOptionalString(asset.format) ??
              toOptionalString(asset.mime_type) ??
              inferMimeTypeFromPath(filePath ?? "") ??
              "application/octet-stream",
            instance_id: assetId,
            relationship: "componentOf",
            asset_type: toOptionalString(asset.asset_type) ?? "unknown",
            source: toOptionalString(asset.source) ?? null
          };

          return {
            ingredient,
            filePath: (await fileExists(filePath)) ? filePath : undefined,
            mimeType:
              toOptionalString(asset.mime_type) ??
              toOptionalString(asset.format) ??
              inferMimeTypeFromPath(filePath ?? "")
          } satisfies C2paIngredientDescriptor;
        })()
      ];
    })
  );

  return [...sourceDescriptors, ...promptDescriptors, ...assetDescriptors];
}

export async function exportC2paManifest({
  manifest,
  inputAssetPath,
  outputAssetPath,
  certificatePem,
  privateKeyPem,
  manifestBaseDir,
  algorithm = "ps256",
  tsaUrl,
  remoteUrl,
  noEmbed = false
}: ExportC2paOptions): Promise<ExportC2paResult> {
  const manifestDefinition = buildC2paManifestDefinition(manifest);
  const ingredientDescriptors = await buildIngredientDescriptors(manifest, manifestBaseDir);
  const builder = Builder.withJson({
    ...manifestDefinition,
    ingredients: []
  });

  builder.setIntent({
    create: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
  });

  if (remoteUrl) {
    builder.setRemoteUrl(remoteUrl);
  }

  if (noEmbed) {
    builder.setNoEmbed(true);
  }

  for (const descriptor of ingredientDescriptors) {
    if (descriptor.filePath) {
      await builder.addIngredient(JSON.stringify(descriptor.ingredient), {
        path: descriptor.filePath,
        mimeType: descriptor.mimeType
      });
    } else {
      await builder.addIngredient(JSON.stringify(descriptor.ingredient));
    }
  }

  const signer = LocalSigner.newSigner(
    Buffer.from(certificatePem, "utf8"),
    Buffer.from(privateKeyPem, "utf8"),
    algorithm,
    tsaUrl
  );

  const manifestBytes = builder.sign(
    signer,
    { path: inputAssetPath },
    { path: outputAssetPath }
  );

  return {
    manifest_id: manifest.manifest_id,
    trust_code: manifest.video.trust_code ?? null,
    outputAssetPath,
    embedded: !noEmbed,
    manifestBytes,
    manifestDefinition,
    ingredientSummary: {
      total: ingredientDescriptors.length,
      fileBacked: ingredientDescriptors.filter((descriptor) => Boolean(descriptor.filePath)).length
    }
  };
}

export async function readC2paManifest({
  assetPath,
  manifestData,
  ...options
}: ReadC2paOptions): Promise<ReadC2paResult> {
  const resolvedTrustProgram = options.trustProgram
    ? await resolveTrustProgram({
        trustProgram: options.trustProgram,
        cacheDir: options.trustProgramCacheDir,
        refresh: options.refreshTrustProgram
      })
    : undefined;
  const effectiveOptions: ReadC2paSettingsOptions = {
    ...options,
    trustAnchorsPem: options.trustAnchorsPem ?? resolvedTrustProgram?.trustAnchorsPem,
    allowedListPem: options.allowedListPem ?? resolvedTrustProgram?.allowedListPem,
    trustConfigPath: options.trustConfigPath ?? resolvedTrustProgram?.trustConfigPath,
    verifyTrustList:
      options.verifyTrustList ?? (resolvedTrustProgram ? true : undefined)
  };
  const loadedSettingsText = await loadSettingsFileText(options.settingsFilePath);
  const settings = await buildReaderSettings(effectiveOptions, loadedSettingsText);
  const effectiveVerifyTrust =
    options.verifyTrust ?? inferVerifyTrustFromSettingsText(loadedSettingsText) ?? true;
  const reader = manifestData
    ? await Reader.fromManifestDataAndAsset(manifestData, { path: assetPath }, settings)
    : await Reader.fromAsset({ path: assetPath }, settings);

  if (!reader) {
    return {
      found: false,
      embedded: false,
      remoteUrl: null,
      activeLabel: null,
      validationState: null,
      validationStatus: [],
      verificationSummary: summarizeVerification(
        false,
        null,
        [],
        effectiveVerifyTrust
      ),
      localTrustProfileSummary: summarizeLocalTrustProfile(
        summarizeVerification(false, null, [], effectiveVerifyTrust),
        null,
        options.localTrustProfile
      ),
      trustProgramSummary: buildTrustProgramSummary(resolvedTrustProgram),
      manifestStore: null
    };
  }

  const manifestStore = reader.json() as Record<string, unknown>;
  const validationStatus = Array.isArray(manifestStore.validation_status)
    ? (manifestStore.validation_status as Array<Record<string, unknown>>)
    : [];
  const verificationSummary = summarizeVerification(
    true,
    manifestStore,
    validationStatus,
    effectiveVerifyTrust
  );

  return {
    found: true,
    embedded: reader.isEmbedded(),
    remoteUrl: reader.remoteUrl() || null,
    activeLabel: reader.activeLabel() ?? null,
    validationState:
      typeof manifestStore.validation_state === "string" ? manifestStore.validation_state : null,
    validationStatus,
    verificationSummary,
    localTrustProfileSummary: summarizeLocalTrustProfile(
      verificationSummary,
      manifestStore,
      options.localTrustProfile
    ),
    trustProgramSummary: buildTrustProgramSummary(resolvedTrustProgram),
    manifestStore
  };
}
