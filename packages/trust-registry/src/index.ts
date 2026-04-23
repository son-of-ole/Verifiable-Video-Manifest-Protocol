import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { validateManifest, type VvmpManifest } from "@vvmp/trust-core";
import {
  appendPolicyExecutionToManifest,
  createExecutionTargetsFromManifest,
  runPolicyPack as executePolicyPack
} from "@vvmp/policy-pack-sdk";
import type {
  FileRegistry,
  FileRegistryConfig,
  GetManifestOptions,
  ManifestEnvelope,
  ManifestVersionHistory,
  PublishManifestInput,
  PublishManifestResponse,
  RegistryAssetRecord,
  RegistryAssetReference,
  RegistryDatabase,
  RecoveryLocatorMethod,
  RecoveryLocatorResolution,
  RegisterRecoveryLocatorInput,
  TrustCodeResolution,
  VerifyRequest,
  VerifyResponse
} from "./types";

const DEFAULT_DATABASE: RegistryDatabase = {
  manifests: {},
  versions: {},
  trust_codes: {},
  assets: {},
  recovery_locators: {},
  signers: {}
};

export class RegistryError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RegistryError";
    this.status = status;
    this.code = code;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createVersionId(): string {
  return `ver_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

function createDatabasePath(rootDir: string): string {
  return path.join(rootDir, "registry.json");
}

async function ensureDirectory(rootDir: string) {
  await fs.mkdir(rootDir, { recursive: true });
}

async function readDatabase(rootDir: string): Promise<RegistryDatabase> {
  const filePath = createDatabasePath(rootDir);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      ...clone(DEFAULT_DATABASE),
      ...JSON.parse(raw)
    } as RegistryDatabase;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return clone(DEFAULT_DATABASE);
    }

    throw error;
  }
}

async function writeDatabase(rootDir: string, database: RegistryDatabase) {
  await ensureDirectory(rootDir);
  const filePath = createDatabasePath(rootDir);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(database, null, 2));
  await fs.rename(tempPath, filePath);
}

function normalizeHashString(input: string): { algorithm: string; value: string } | null {
  if (typeof input !== "string" || input.length === 0) {
    return null;
  }

  const parts = input.split(":");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      algorithm: parts[0].toLowerCase(),
      value: parts[1]
    };
  }

  return {
    algorithm: "sha256",
    value: input
  };
}

function normalizeHashInput(algorithm: string, value: string): { algorithm: string; value: string } {
  const normalized = normalizeHashString(value);
  if (normalized) {
    return normalized;
  }

  return {
    algorithm: algorithm.toLowerCase(),
    value
  };
}

function normalizeRecoveryLocatorMethod(method: string): RecoveryLocatorMethod {
  const normalized = method.trim().toLowerCase();
  if (normalized === "watermark" || normalized === "fingerprint") {
    return normalized;
  }

  throw new RegistryError(
    400,
    "VVMP_REGISTRY_RECOVERY_METHOD_INVALID",
    `Recovery method ${method} is not supported.`
  );
}

function normalizeRecoveryLocatorValue(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RegistryError(
      400,
      "VVMP_REGISTRY_RECOVERY_VALUE_INVALID",
      "Recovery locator value must be a non-empty string."
    );
  }

  return normalized;
}

function createRecoveryLocatorKey(method: RecoveryLocatorMethod, value: string): string {
  return `${method}:${value}`;
}

function createTrustCode(existing: Set<string>): string {
  while (true) {
    const raw = crypto.randomBytes(5).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const padded = raw.padEnd(10, "X").slice(0, 10);
    const trustCode = `VV-${padded.slice(0, 4)}-${padded.slice(4, 8)}`;
    if (!existing.has(trustCode)) {
      return trustCode;
    }
  }
}

function buildBaseUrl(baseUrl?: string): string {
  return baseUrl?.replace(/\/+$/, "") ?? "";
}

function buildTrustPageUrl(baseUrl: string, trustCode: string): string {
  return `${baseUrl}/v/${encodeURIComponent(trustCode)}`;
}

function buildManifestUrl(baseUrl: string, manifestId: string): string {
  return `${baseUrl}/api/v1/manifests/${encodeURIComponent(manifestId)}`;
}

function collectAssetReferences(
  manifest: VvmpManifest,
  manifestId: string,
  versionId: string,
  trustCode?: string
): Array<{ key: string; record: RegistryAssetRecord }> {
  const references: Array<{ key: string; record: RegistryAssetRecord }> = [];

  const finalAsset = normalizeHashString(manifest.video.final_asset.sha256);
  if (finalAsset) {
    references.push({
      key: `${finalAsset.algorithm}:${finalAsset.value}`,
      record: {
        algorithm: finalAsset.algorithm,
        value: finalAsset.value,
        references: [
          {
            manifest_id: manifestId,
            version_id: versionId,
            trust_code: trustCode,
            match_type: "exact_asset_hash"
          }
        ]
      }
    });
  }

  const renderHash = typeof manifest.render.output_hash === "string"
    ? normalizeHashString(manifest.render.output_hash)
    : null;
  if (renderHash) {
    references.push({
      key: `${renderHash.algorithm}:${renderHash.value}`,
      record: {
        algorithm: renderHash.algorithm,
        value: renderHash.value,
        references: [
          {
            manifest_id: manifestId,
            version_id: versionId,
            trust_code: trustCode,
            match_type: "render_output_hash"
          }
        ]
      }
    });
  }

  return references;
}

function mergeAssetReference(existing: RegistryAssetRecord | undefined, incoming: RegistryAssetRecord): RegistryAssetRecord {
  const references = [...(existing?.references ?? [])];

  for (const reference of incoming.references) {
    if (
      !references.some(
        (candidate) =>
          candidate.manifest_id === reference.manifest_id &&
          candidate.version_id === reference.version_id &&
          candidate.match_type === reference.match_type
      )
    ) {
      references.push(reference);
    }
  }

  return {
    algorithm: incoming.algorithm,
    value: incoming.value,
    references
  };
}

function mergeRecoveryLocatorRecord(
  existing: RegistryDatabase["recovery_locators"][string] | undefined,
  incoming: RegistryDatabase["recovery_locators"][string]
): RegistryDatabase["recovery_locators"][string] {
  const references = [...(existing?.references ?? [])];

  for (const reference of incoming.references) {
    if (
      !references.some(
        (candidate) =>
          candidate.manifest_id === reference.manifest_id &&
          candidate.version_id === reference.version_id &&
          candidate.match_type === reference.match_type &&
          candidate.source === reference.source
      )
    ) {
      references.push(reference);
    }
  }

  return {
    method: incoming.method,
    value: incoming.value,
    references
  };
}

function parseTargetRef(targetRef: string): { collection: string; index: number } | null {
  const match = /^([a-z_]+)\[(\d+)\]$/i.exec(targetRef);
  if (!match) {
    return null;
  }

  return {
    collection: match[1],
    index: Number(match[2])
  };
}

function sanitizeVisibilityScopedRecord(record: Record<string, unknown>) {
  const visibility = typeof record.visibility === "string" ? record.visibility : "public";
  if (visibility === "public") {
    return;
  }

  delete record.text;
  delete record.display_text;
  delete record.canonical_ref;
  delete record.local_path;
  delete record.file_path;
  delete record.asset_path;
  delete record.source_path;
  delete record.path;
}

function applyExplicitRedactions(publicManifest: VvmpManifest) {
  for (const redaction of publicManifest.redactions) {
    if (
      typeof redaction.target_collection === "string" &&
      typeof redaction.record_id === "string" &&
      typeof redaction.mode === "string"
    ) {
      const collectionName = redaction.target_collection;
      const collection = publicManifest[collectionName as keyof VvmpManifest];
      if (!Array.isArray(collection)) {
        continue;
      }

      const recordIndex = collection.findIndex((entry) => {
        if (typeof entry !== "object" || entry === null) {
          return false;
        }

        const record = entry as Record<string, unknown>;
        return (
          record.source_id === redaction.record_id ||
          record.prompt_id === redaction.record_id ||
          record.tool_id === redaction.record_id ||
          record.asset_id === redaction.record_id ||
          record.segment_id === redaction.record_id ||
          record.edit_event_id === redaction.record_id ||
          record.guardrail_event_id === redaction.record_id ||
          record.rights_event_id === redaction.record_id
        );
      });

      if (recordIndex === -1) {
        continue;
      }

      if (redaction.mode === "remove_record") {
        collection.splice(recordIndex, 1);
        continue;
      }

      const record = collection[recordIndex] as Record<string, unknown>;
      if (redaction.mode === "remove_field" && typeof redaction.field === "string") {
        delete record[redaction.field];
      }

      if (redaction.mode === "replace_field" && typeof redaction.field === "string") {
        record[redaction.field] = clone(redaction.replacement);
      }

      continue;
    }

    if (typeof redaction.target_ref === "string") {
      const parsed = parseTargetRef(redaction.target_ref);
      if (!parsed) {
        continue;
      }

      const collection = publicManifest[parsed.collection as keyof VvmpManifest];
      if (!Array.isArray(collection)) {
        continue;
      }

      const record = collection[parsed.index];
      if (typeof record !== "object" || record === null) {
        continue;
      }

      sanitizeVisibilityScopedRecord(record as Record<string, unknown>);
    }
  }
}

function sanitizeManifestForView(manifest: VvmpManifest, view: "public" | "full"): VvmpManifest {
  const copy = clone(manifest);
  if (view === "full") {
    return copy;
  }

  copy.sources.forEach((record) => sanitizeVisibilityScopedRecord(record as Record<string, unknown>));
  copy.prompts.forEach((record) => sanitizeVisibilityScopedRecord(record as Record<string, unknown>));
  copy.assets.forEach((record) => sanitizeVisibilityScopedRecord(record as Record<string, unknown>));
  applyExplicitRedactions(copy);

  return copy;
}

function getCurrentVersionId(database: RegistryDatabase, manifestId: string): string {
  const manifestRecord = database.manifests[manifestId];
  if (!manifestRecord) {
    throw new RegistryError(404, "VVMP_REGISTRY_MANIFEST_NOT_FOUND", `Manifest ${manifestId} was not found.`);
  }

  return manifestRecord.current_version_id;
}

async function applyPublishPolicyPacks(
  manifest: VvmpManifest,
  config: FileRegistryConfig
): Promise<VvmpManifest> {
  const publishPolicyPacks = config.publishPolicyPacks ?? [];
  let nextManifest = clone(manifest);

  for (const publishPolicyPack of publishPolicyPacks) {
    try {
      const execution = await executePolicyPack(publishPolicyPack.policyPack, {
        manifest: nextManifest,
        targets: createExecutionTargetsFromManifest(
          nextManifest,
          publishPolicyPack.targetTypes ?? ["script_segment"]
        ),
        stage: publishPolicyPack.stage ?? "publish",
        review_mode: publishPolicyPack.review_mode ?? "automated",
        check_types: publishPolicyPack.check_types,
        context: publishPolicyPack.context
      });

      nextManifest = appendPolicyExecutionToManifest(
        nextManifest,
        publishPolicyPack.policyPack,
        execution,
        {
          appendExtension: publishPolicyPack.appendExtension,
          criticalExtension:
            publishPolicyPack.criticalExtension ??
            publishPolicyPack.policyPack.critical_extension ??
            false
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown policy-pack error.";
      throw new RegistryError(
        500,
        "VVMP_REGISTRY_POLICY_EXECUTION_FAILED",
        `Registry policy execution failed: ${message}`
      );
    }
  }

  const validation = validateManifest(nextManifest);
  if (!validation.valid) {
    throw new RegistryError(
      500,
      "VVMP_REGISTRY_POLICY_OUTPUT_INVALID",
      `Registry policy execution produced an invalid manifest: ${validation.issues
        .map((issue) => issue.code)
        .join(", ")}`
    );
  }

  return nextManifest;
}

export function createFileRegistry(config: FileRegistryConfig): FileRegistry {
  const rootDir = config.rootDir;

  return {
    async publishManifest(input: PublishManifestInput): Promise<PublishManifestResponse> {
      const validation = validateManifest(input.manifest);
      if (!validation.valid) {
        throw new RegistryError(
          422,
          "VVMP_REGISTRY_INVALID_MANIFEST",
          `Manifest failed validation: ${validation.issues.map((issue) => issue.code).join(", ")}`
        );
      }

      const database = await readDatabase(rootDir);
      const manifestId = input.manifest.manifest_id;
      const existingManifest = database.manifests[manifestId];
      const publishedAt = input.publishedAt ?? nowIso();
      const baseUrl = buildBaseUrl(config.baseUrl);
      let manifestCopy = clone(input.manifest);

      manifestCopy.video.visibility = input.visibility;
      manifestCopy.publication = {
        ...manifestCopy.publication,
        status: "published",
        profile_claim: input.profile
      };

      let trustCode =
        manifestCopy.video.trust_code ??
        existingManifest?.trust_code ??
        createTrustCode(new Set(Object.keys(database.trust_codes)));

      const conflictingTrustCode = database.trust_codes[trustCode];
      if (conflictingTrustCode && conflictingTrustCode.manifest_id !== manifestId) {
        throw new RegistryError(
          409,
          "VVMP_REGISTRY_TRUST_CODE_CONFLICT",
          `Trust code ${trustCode} is already assigned to a different manifest lineage.`
        );
      }

      if (existingManifest?.trust_code && existingManifest.trust_code !== trustCode) {
        throw new RegistryError(
          409,
          "VVMP_REGISTRY_LINEAGE_TRUST_CODE_MISMATCH",
          `Manifest ${manifestId} already uses trust code ${existingManifest.trust_code}.`
        );
      }

      manifestCopy.video.trust_code = trustCode;
      manifestCopy.links = {
        ...manifestCopy.links,
        trust_page: buildTrustPageUrl(baseUrl, trustCode)
      };

      manifestCopy = await applyPublishPolicyPacks(manifestCopy, config);

      const versionId = createVersionId();
      const previousVersionId = existingManifest?.current_version_id;

      database.versions[versionId] = {
        version_id: versionId,
        manifest_id: manifestId,
        trust_code: trustCode,
        published_at: publishedAt,
        profile: input.profile,
        visibility: input.visibility,
        manifest: manifestCopy,
        previous_version_id: previousVersionId,
        change_reason: input.changeReason
      };

      if (previousVersionId && database.versions[previousVersionId]) {
        database.versions[previousVersionId].superseded_by = versionId;
      }

      database.manifests[manifestId] = {
        manifest_id: manifestId,
        trust_code: trustCode,
        current_version_id: versionId,
        version_ids: [...(existingManifest?.version_ids ?? []), versionId],
        created_at: existingManifest?.created_at ?? publishedAt,
        updated_at: publishedAt
      };

      database.trust_codes[trustCode] = {
        trust_code: trustCode,
        manifest_id: manifestId,
        current_version_id: versionId,
        trust_page_url: buildTrustPageUrl(baseUrl, trustCode),
        created_at: conflictingTrustCode?.created_at ?? publishedAt,
        updated_at: publishedAt
      };

      const assetReferences = collectAssetReferences(manifestCopy, manifestId, versionId, trustCode);
      for (const assetReference of assetReferences) {
        database.assets[assetReference.key] = mergeAssetReference(
          database.assets[assetReference.key],
          assetReference.record
        );
      }

      for (const signature of manifestCopy.signatures) {
        const signer = typeof signature.signer === "string" ? signature.signer : null;
        if (!signer) {
          continue;
        }

        const existingSigner = database.signers[signer];
        const versionIds = new Set(existingSigner?.version_ids ?? []);
        versionIds.add(versionId);
        database.signers[signer] = {
          signer,
          version_ids: [...versionIds]
        };
      }

      await writeDatabase(rootDir, database);

      return {
        manifest_id: manifestId,
        version_id: versionId,
        trust_code: trustCode,
        published_at: publishedAt,
        links: {
          manifest: buildManifestUrl(baseUrl, manifestId),
          trust_page: buildTrustPageUrl(baseUrl, trustCode)
        }
      };
    },

    async registerRecoveryLocator(
      input: RegisterRecoveryLocatorInput
    ): Promise<RecoveryLocatorResolution> {
      const database = await readDatabase(rootDir);
      const manifestRecord = database.manifests[input.manifest_id];
      if (!manifestRecord) {
        throw new RegistryError(
          404,
          "VVMP_REGISTRY_MANIFEST_NOT_FOUND",
          `Manifest ${input.manifest_id} was not found.`
        );
      }

      const method = normalizeRecoveryLocatorMethod(input.method);
      const value = normalizeRecoveryLocatorValue(input.value);
      const versionId = input.version_id ?? manifestRecord.current_version_id;
      const version = database.versions[versionId];

      if (!version || version.manifest_id !== input.manifest_id) {
        throw new RegistryError(
          404,
          "VVMP_REGISTRY_VERSION_NOT_FOUND",
          `Version ${versionId} was not found for manifest ${input.manifest_id}.`
        );
      }

      const trustCode = manifestRecord.trust_code ?? version.trust_code;
      if (input.trust_code && trustCode && input.trust_code !== trustCode) {
        throw new RegistryError(
          409,
          "VVMP_REGISTRY_RECOVERY_TRUST_CODE_MISMATCH",
          `Recovery locator trust code ${input.trust_code} does not match manifest lineage trust code ${trustCode}.`
        );
      }

      const key = createRecoveryLocatorKey(method, value);
      const registeredAt = input.registered_at ?? nowIso();
      const record = {
        method,
        value,
        references: [
          {
            manifest_id: input.manifest_id,
            version_id: versionId,
            trust_code: trustCode,
            match_type: method === "watermark" ? "watermark_locator" : "fingerprint_locator",
            source: input.source,
            metadata: input.metadata ? clone(input.metadata) : undefined,
            registered_at: registeredAt
          }
        ]
      };

      database.recovery_locators[key] = mergeRecoveryLocatorRecord(
        database.recovery_locators[key],
        record
      );

      await writeDatabase(rootDir, database);

      return {
        matched: true,
        match_type: record.references[0]?.match_type,
        manifest_id: input.manifest_id,
        trust_code: trustCode,
        file_trust_state: "remote_manifest_found",
        recovery_locator: {
          method,
          value
        },
        recovery_refs: clone(database.recovery_locators[key].references)
      };
    },

    async getManifestById(manifestId: string, options: GetManifestOptions = {}): Promise<ManifestEnvelope> {
      const database = await readDatabase(rootDir);
      const versionId =
        options.version && options.version !== "current"
          ? options.version
          : getCurrentVersionId(database, manifestId);
      const version = database.versions[versionId];

      if (!version || version.manifest_id !== manifestId) {
        throw new RegistryError(404, "VVMP_REGISTRY_VERSION_NOT_FOUND", `Version ${versionId} was not found.`);
      }

      const view = options.view ?? "public";

      return {
        manifest_id: manifestId,
        version_id: versionId,
        published_at: version.published_at,
        view,
        manifest: sanitizeManifestForView(version.manifest, view)
      };
    },

    async getManifestVersions(manifestId: string): Promise<ManifestVersionHistory> {
      const database = await readDatabase(rootDir);
      const manifestRecord = database.manifests[manifestId];
      if (!manifestRecord) {
        throw new RegistryError(404, "VVMP_REGISTRY_MANIFEST_NOT_FOUND", `Manifest ${manifestId} was not found.`);
      }

      return {
        manifest_id: manifestId,
        versions: manifestRecord.version_ids.map((versionId) => {
          const version = database.versions[versionId];
          return {
            version_id: version.version_id,
            published_at: version.published_at,
            superseded_by: version.superseded_by,
            change_reason: version.change_reason
          };
        })
      };
    },

    async resolveTrustCode(trustCode: string): Promise<TrustCodeResolution> {
      const database = await readDatabase(rootDir);
      const resolution = database.trust_codes[trustCode];
      if (!resolution) {
        throw new RegistryError(404, "VVMP_REGISTRY_TRUST_CODE_NOT_FOUND", `Trust code ${trustCode} was not found.`);
      }

      return clone(resolution);
    },

    async getManifestByTrustCode(trustCode: string, options: GetManifestOptions = {}) {
      const resolution = await this.resolveTrustCode(trustCode);
      const version = options.version ?? resolution.current_version_id;

      return this.getManifestById(resolution.manifest_id, {
        view: options.view,
        version
      });
    },

    async getAssetByHash(algorithm: string, value: string): Promise<VerifyResponse> {
      const database = await readDatabase(rootDir);
      const normalized = normalizeHashInput(algorithm, value);
      const key = `${normalized.algorithm}:${normalized.value}`;
      const asset = database.assets[key];
      if (!asset) {
        throw new RegistryError(
          404,
          "VVMP_REGISTRY_ASSET_NOT_FOUND",
          `Asset hash ${normalized.algorithm}:${normalized.value} was not found.`
        );
      }

      const firstReference = asset.references[0];

      return {
        matched: true,
        match_type: firstReference?.match_type ?? "exact_asset_hash",
        manifest_id: firstReference?.manifest_id,
        trust_code: firstReference?.trust_code,
        file_trust_state: "remote_manifest_found",
        asset_refs: clone(asset.references)
      };
    },

    async getRecoveryLocator(
      method: RecoveryLocatorMethod,
      value: string
    ): Promise<RecoveryLocatorResolution> {
      const database = await readDatabase(rootDir);
      const normalizedMethod = normalizeRecoveryLocatorMethod(method);
      const normalizedValue = normalizeRecoveryLocatorValue(value);
      const key = createRecoveryLocatorKey(normalizedMethod, normalizedValue);
      const locator = database.recovery_locators[key];

      if (!locator) {
        throw new RegistryError(
          404,
          "VVMP_REGISTRY_RECOVERY_LOCATOR_NOT_FOUND",
          `Recovery locator ${normalizedMethod}:${normalizedValue} was not found.`
        );
      }

      const firstReference = locator.references[0];
      return {
        matched: true,
        match_type: firstReference?.match_type,
        manifest_id: firstReference?.manifest_id,
        trust_code: firstReference?.trust_code,
        file_trust_state: "remote_manifest_found",
        recovery_locator: {
          method: normalizedMethod,
          value: normalizedValue
        },
        recovery_refs: clone(locator.references)
      };
    },

    async verify(request: VerifyRequest): Promise<VerifyResponse> {
      if (request.mode === "manifest_payload") {
        const validation = validateManifest(request.manifest);
        if (!validation.valid) {
          return {
            matched: false,
            match_type: "manifest_payload",
            file_trust_state: "remote_manifest_not_found",
            validation
          };
        }

        try {
          const envelope = await this.getManifestById(request.manifest.manifest_id);
          return {
            matched: true,
            match_type: "manifest_id",
            manifest_id: envelope.manifest_id,
            trust_code: envelope.manifest.video.trust_code,
            file_trust_state: "remote_manifest_found",
            validation
          };
        } catch {
          return {
            matched: false,
            match_type: "manifest_payload",
            manifest_id: request.manifest.manifest_id,
            trust_code: request.manifest.video.trust_code,
            file_trust_state: "remote_manifest_not_found",
            validation
          };
        }
      }

      if (request.mode === "manifest_id") {
        try {
          const envelope = await this.getManifestById(request.manifest_id);
          return {
            matched: true,
            match_type: "manifest_id",
            manifest_id: envelope.manifest_id,
            trust_code: envelope.manifest.video.trust_code,
            file_trust_state: "remote_manifest_found"
          };
        } catch {
          return {
            matched: false,
            match_type: "manifest_id",
            manifest_id: request.manifest_id,
            file_trust_state: "remote_manifest_not_found"
          };
        }
      }

      if (request.mode === "trust_code") {
        try {
          const resolution = await this.resolveTrustCode(request.trust_code);
          return {
            matched: true,
            match_type: "trust_code",
            manifest_id: resolution.manifest_id,
            trust_code: resolution.trust_code,
            file_trust_state: "remote_manifest_found"
          };
        } catch {
          return {
            matched: false,
            match_type: "trust_code",
            trust_code: request.trust_code,
            file_trust_state: "remote_manifest_not_found"
          };
        }
      }

      if (request.mode === "recovery_locator") {
        return this.getRecoveryLocator(
          request.recovery_locator.method,
          request.recovery_locator.value
        ).catch(() => ({
          matched: false,
          match_type:
            request.recovery_locator.method === "watermark"
              ? "watermark_locator"
              : "fingerprint_locator",
          file_trust_state: "remote_manifest_not_found",
          recovery_locator: {
            method: request.recovery_locator.method,
            value: request.recovery_locator.value
          }
        }));
      }

      return this.getAssetByHash(request.asset_hash.algorithm, request.asset_hash.value).catch(() => ({
        matched: false,
        match_type: "asset_hash",
        file_trust_state: "remote_manifest_not_found"
      }));
    }
  };
}

export type {
  FileRegistry,
  FileRegistryConfig,
  GetManifestOptions,
  ManifestEnvelope,
  ManifestVersionEntry,
  ManifestVersionHistory,
  PublishManifestInput,
  PublishManifestResponse,
  RegistryAssetRecord,
  RegistryAssetReference,
  RegistryDatabase,
  RegistryManifestRecord,
  RecoveryLocatorMethod,
  RecoveryLocatorResolution,
  RegisterRecoveryLocatorInput,
  RegistryRecoveryLocatorRecord,
  RegistryRecoveryLocatorReference,
  RegistrySignerRecord,
  RegistryPublishPolicyPack,
  RegistryTrustCodeRecord,
  RegistryVersionRecord,
  TrustCodeResolution,
  VerifyRequest,
  VerifyResponse
} from "./types";
