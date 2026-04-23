import type { ValidationResult, VvmpManifest } from "@vvmp/trust-core";
import type {
  PolicyExecutionRequest,
  PolicyPackDefinition
} from "@vvmp/policy-pack-sdk";

export type FileRegistryConfig = {
  rootDir: string;
  baseUrl?: string;
  publishPolicyPacks?: RegistryPublishPolicyPack[];
};

export type RecoveryLocatorMethod = "watermark" | "fingerprint";

export type RegistryPublishPolicyPack = {
  policyPack: PolicyPackDefinition;
  targetTypes?: string[];
  stage?: PolicyExecutionRequest["stage"];
  review_mode?: PolicyExecutionRequest["review_mode"];
  check_types?: PolicyExecutionRequest["check_types"];
  context?: PolicyExecutionRequest["context"];
  appendExtension?: boolean;
  criticalExtension?: boolean;
};

export type RegistryDatabase = {
  manifests: Record<string, RegistryManifestRecord>;
  versions: Record<string, RegistryVersionRecord>;
  trust_codes: Record<string, RegistryTrustCodeRecord>;
  assets: Record<string, RegistryAssetRecord>;
  recovery_locators: Record<string, RegistryRecoveryLocatorRecord>;
  signers: Record<string, RegistrySignerRecord>;
};

export type RegistryManifestRecord = {
  manifest_id: string;
  trust_code?: string;
  current_version_id: string;
  version_ids: string[];
  created_at: string;
  updated_at: string;
};

export type RegistryVersionRecord = {
  version_id: string;
  manifest_id: string;
  trust_code?: string;
  published_at: string;
  profile: string;
  visibility: string;
  manifest: VvmpManifest;
  previous_version_id?: string;
  superseded_by?: string;
  change_reason?: string;
};

export type RegistryTrustCodeRecord = {
  trust_code: string;
  manifest_id: string;
  current_version_id: string;
  trust_page_url: string;
  created_at: string;
  updated_at: string;
};

export type RegistryAssetReference = {
  manifest_id: string;
  version_id: string;
  trust_code?: string;
  match_type: string;
};

export type RegistryAssetRecord = {
  algorithm: string;
  value: string;
  references: RegistryAssetReference[];
};

export type RegistryRecoveryLocatorReference = {
  manifest_id: string;
  version_id: string;
  trust_code?: string;
  match_type: string;
  source?: string;
  metadata?: Record<string, unknown>;
  registered_at: string;
};

export type RegistryRecoveryLocatorRecord = {
  method: RecoveryLocatorMethod;
  value: string;
  references: RegistryRecoveryLocatorReference[];
};

export type RegistrySignerRecord = {
  signer: string;
  version_ids: string[];
};

export type PublishManifestInput = {
  manifest: VvmpManifest;
  profile: string;
  visibility: string;
  changeReason?: string;
  publishedAt?: string;
};

export type PublishManifestResponse = {
  manifest_id: string;
  version_id: string;
  trust_code?: string;
  published_at: string;
  links: {
    manifest: string;
    trust_page?: string;
  };
};

export type RegisterRecoveryLocatorInput = {
  manifest_id: string;
  method: RecoveryLocatorMethod;
  value: string;
  version_id?: string;
  trust_code?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  registered_at?: string;
};

export type RecoveryLocatorResolution = {
  matched: boolean;
  match_type?: string;
  manifest_id?: string;
  trust_code?: string;
  file_trust_state?: string;
  recovery_locator: {
    method: RecoveryLocatorMethod;
    value: string;
  };
  recovery_refs?: RegistryRecoveryLocatorReference[];
};

export type ManifestEnvelope = {
  manifest_id: string;
  version_id: string;
  published_at: string;
  view: "public" | "full";
  manifest: VvmpManifest;
};

export type ManifestVersionEntry = {
  version_id: string;
  published_at: string;
  superseded_by?: string;
  change_reason?: string;
};

export type ManifestVersionHistory = {
  manifest_id: string;
  versions: ManifestVersionEntry[];
};

export type TrustCodeResolution = {
  trust_code: string;
  manifest_id: string;
  current_version_id: string;
  trust_page_url: string;
};

export type VerifyRequest =
  | {
      mode: "manifest_payload";
      manifest: VvmpManifest;
    }
  | {
      mode: "manifest_id";
      manifest_id: string;
    }
  | {
      mode: "trust_code";
      trust_code: string;
    }
  | {
      mode: "asset_hash";
      asset_hash: {
        algorithm: string;
        value: string;
      };
    }
  | {
      mode: "recovery_locator";
      recovery_locator: {
        method: RecoveryLocatorMethod;
        value: string;
      };
    };

export type VerifyResponse = {
  matched: boolean;
  match_type?: string;
  manifest_id?: string;
  trust_code?: string;
  file_trust_state?: string;
  validation?: ValidationResult;
  asset_refs?: RegistryAssetReference[];
  recovery_locator?: {
    method: RecoveryLocatorMethod;
    value: string;
  };
  recovery_refs?: RegistryRecoveryLocatorReference[];
};

export type GetManifestOptions = {
  view?: "public" | "full";
  version?: "current" | string;
};

export type FileRegistry = {
  publishManifest(input: PublishManifestInput): Promise<PublishManifestResponse>;
  registerRecoveryLocator(
    input: RegisterRecoveryLocatorInput
  ): Promise<RecoveryLocatorResolution>;
  getManifestById(manifestId: string, options?: GetManifestOptions): Promise<ManifestEnvelope>;
  getManifestVersions(manifestId: string): Promise<ManifestVersionHistory>;
  resolveTrustCode(trustCode: string): Promise<TrustCodeResolution>;
  getManifestByTrustCode(trustCode: string, options?: GetManifestOptions): Promise<ManifestEnvelope>;
  getAssetByHash(algorithm: string, value: string): Promise<VerifyResponse>;
  getRecoveryLocator(
    method: RecoveryLocatorMethod,
    value: string
  ): Promise<RecoveryLocatorResolution>;
  verify(request: VerifyRequest): Promise<VerifyResponse>;
};
