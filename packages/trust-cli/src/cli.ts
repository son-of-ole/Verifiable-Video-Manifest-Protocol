#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import QRCode from "qrcode";
import {
  buildRecoveryCardSummary,
  canonicalizeJson,
  compareRenditionObservation,
  type RenditionObservation,
  summarizeManifest,
  validateRenditionObservation,
  validateManifest,
  type VvmpManifest
} from "@vvmp/trust-core";
import { createFileRegistry, type FileRegistry } from "@vvmp/trust-registry";
import { createRegistryClient } from "@vvmp/trust-registry-client";
import {
  createLocalTrustProfileFromCertificatePem,
  createTrustmarkBits,
  decodeTrustmarkImage,
  encodeTrustmarkImage,
  exportC2paManifest,
  getTrustmarkBitLength,
  readC2paManifest,
  resolveTrustProgram,
  signPrototypeSidecar,
  verifyPrototypeSidecar,
  type LocalTrustProfileDocument,
  type PrototypeSidecar,
  type TrustProgramId,
  type TrustedC2paSigningProfile
} from "@vvmp/trust-c2pa-adapter";

function printUsage() {
  console.log(`trust <command> <file> [options]

Commands:
  validate <manifest.json>                Validate a VVMP manifest
  summarize <manifest.json>               Print a manifest summary
  inspect <manifest.json>                 Print technical manifest inspection data
  canonicalize <json-file>                Print canonical JSON
  extract <asset-file>                    Extract embedded or detached C2PA manifest data
  generate-trustmark-bits                 Generate a registry-safe watermark bitstring
  encode-trustmark <image-file>           Encode a trustmark into a PNG image
  decode-trustmark <image-file>           Decode a trustmark from an image
  recover-trustmark <image-file>          Decode a trustmark and resolve it through a registry
  derive-trust-profile <certificate.pem>  Derive a VVMP local trust profile from a signer cert
  materialize-signing-profile             Materialize a reusable C2PA signing profile and PEM files
  doctor-trusted-lane                     Validate a configured trust-program-backed signing lane
  sync-trust-program <program>            Sync a trust-program preset into a local cache
  publish <manifest.json>                 Publish a manifest to the reference registry
  compare <local.json> [remote.json]      Compare a local manifest to a file or registry record
  register-recovery-locator <manifest.json>
                                          Register a watermark or fingerprint locator
  resolve-recovery-locator <method> <value>
                                          Resolve a recovery locator through a registry
  compare-rendition <manifest.json> <observation.json>
                                          Compare an observed copy to a manifest recovery record
  render-recovery-card <manifest.json>    Render an SVG recovery card with trust code and QR
  verify <asset-file>                     Verify/read embedded or detached C2PA data
  sign <asset-file> <manifest.json>       Sign an asset with a VVMP manifest through C2PA
  verify-prototype <sidecar.json>         Verify a VVMP prototype sidecar
  export-prototype <manifest.json>        Export a C2PA-style prototype sidecar
  export-c2pa <manifest.json>             Export a real C2PA manifest to an asset
  verify-c2pa <asset-file>                Verify/read embedded or detached C2PA data

Options for publish:
  --registry-dir <dir>                    Registry storage directory
  --registry-url <url>                    Remote registry base URL
  --api-token <token>                     Bearer token for remote or restricted registry access
  --base-url <url>                        Base URL recorded in returned links
  --profile <profile>                     Publication profile, default registry_backed
  --visibility <visibility>               Visibility, default public
  --change-reason <text>                  Optional change reason

Options for compare:
  --registry-dir <dir>                    Registry storage directory
  --registry-url <url>                    Remote registry base URL
  --api-token <token>                     Bearer token for remote or restricted registry access
  --base-url <url>                        Local registry base URL
  --manifest-id <id>                      Compare local file against registry manifest ID
  --trust-code <code>                     Compare local file against registry trust code

Options for register-recovery-locator:
  --registry-dir <dir>                    Registry storage directory
  --registry-url <url>                    Remote registry base URL
  --api-token <token>                     Bearer token for remote or restricted registry access
  --method <watermark|fingerprint>        Recovery locator method
  --value <locator>                       Recovery locator value
  --version-id <id>                       Optional manifest version to attach the locator to
  --source <name>                         Optional extraction or indexing source label
  --metadata-file <json-file>             Optional JSON metadata payload recorded with the locator

Options for resolve-recovery-locator:
  --registry-dir <dir>                    Registry storage directory
  --registry-url <url>                    Remote registry base URL
  --api-token <token>                     Bearer token for remote or restricted registry access

Options for compare-rendition:
  --base-url <url>                        Base URL used to derive a trust page URL when needed
  --duration-tolerance <seconds>          Allowed duration delta, default 1

Options for render-recovery-card:
  --out <file>                            Output SVG path
  --base-url <url>                        Base URL used to derive a trust page URL when needed
  --title <text>                          Optional heading override

Options for extract:
  --manifest-data <file>                  Detached manifest bytes to extract against asset
  --out <file>                            Optional output path for extracted JSON
  --verify-trust <true|false>             Toggle trust verification, default false

Options for generate-trustmark-bits:
  --version <BCH_SUPER|BCH_5|BCH_4|BCH_3>
                                          Trustmark version, default BCH_5

Options for encode-trustmark:
  --out <file>                            Output PNG path
  --watermark-bits <bits>                 Explicit bitstring payload, default random valid payload
  --variant <B|C|P|Q>                     Trustmark model variant, default Q
  --version <BCH_SUPER|BCH_5|BCH_4|BCH_3>
                                          Trustmark version, default BCH_5
  --strength <0-1>                        Encoding strength, default 0.95
  --model-dir <dir>                       Trustmark model cache directory
  --model-root <url>                      Optional override for model download root

Options for decode-trustmark:
  --variant <B|C|P|Q>                     Trustmark model variant, default Q
  --version <BCH_SUPER|BCH_5|BCH_4|BCH_3>
                                          Trustmark version, default BCH_5
  --model-dir <dir>                       Trustmark model cache directory
  --model-root <url>                      Optional override for model download root

Options for recover-trustmark:
  --variant <B|C|P|Q>                     Trustmark model variant, default Q
  --version <BCH_SUPER|BCH_5|BCH_4|BCH_3>
                                          Trustmark version, default BCH_5
  --model-dir <dir>                       Trustmark model cache directory
  --model-root <url>                      Optional override for model download root
  --registry-dir <dir>                    Registry storage directory
  --registry-url <url>                    Remote registry base URL
  --api-token <token>                     Bearer token for remote or restricted registry access

Options for verify:
  Same options as verify-c2pa

Options for sign:
  Same options as export-c2pa, but with asset path first and manifest path second

Options for export-prototype:
  --out <file>                            Output path
  --signer <name>                         Signer label
  --private-key <pem-file>                Optional Ed25519 private key PEM

Options for export-c2pa:
  --input <asset-file>                    Source asset to sign
  --out <asset-file>                      Signed asset output path
  --signing-profile <json-file>           VVMP C2PA signing-profile document
  --certificate <pem-file>                X.509 certificate PEM
  --private-key <pem-file>                Private key PEM
  --alg <algorithm>                       Signing algorithm, default ps256
  --tsa-url <url>                         Optional RFC3161 timestamp authority URL
  --manifest-data-out <file>              Optional path to write detached manifest bytes
  --remote-url <url>                      Optional remote manifest URL
  --no-embed                              Export detached manifest instead of embedding

Options for verify-c2pa:
  --manifest-data <file>                  Detached manifest bytes to verify against asset
  --settings-file <file>                  JSON or TOML C2PA settings file
  --signing-profile <json-file>           Optional signing-profile document used to infer trust program
  --trust-program <official-c2pa|interim> Trust-program preset
  --trust-program-cache-dir <dir>         Optional trust-program cache directory
  --refresh-trust-program                 Refresh trust-program artifacts into the cache before use
  --vvmp-trust-profile <json-file>        VVMP local trust-profile document
  --trust-anchors <pem-file>              Trust anchor PEM bundle
  --user-anchors <pem-file>               User anchor PEM bundle
  --allowed-list <pem-file>               Allowed list PEM bundle
  --trust-config <file>                   Trust config path passed through to C2PA
  --verify-trust <true|false>             Toggle trust verification, default true
  --verify-trust-list <true|false>        Toggle trust-list verification, default false
  --verify-timestamp-trust <true|false>   Toggle timestamp trust verification
  --remote-manifest-fetch <true|false>    Toggle remote manifest fetching
  --ocsp-fetch <true|false>               Toggle OCSP fetching
  --strict-v1-validation <true|false>     Toggle strict v1 validation

Options for derive-trust-profile:
  --out <file>                            Output JSON path
  --profile-id <id>                       Trust-profile ID, default vvmp-local-trust-profile
  --signer-id <id>                        Signer ID, default local_signer
  --algorithm <alg>                       Optional algorithm override
  --environment <name>                    Optional environment label
  --note <text>                           Optional note recorded with the signer

Options for materialize-signing-profile:
  --out-dir <dir>                         Output directory, default ./vvmp-trusted-signing-profile
  --profile-id <id>                       Signing-profile ID, default vvmp-trusted-c2pa-profile
  --trust-program <official-c2pa|interim> Trust-program, default official-c2pa
  --algorithm <alg>                       Signing algorithm, default es256
  --tsa-url <url>                         Optional TSA URL recorded in the profile
  --certificate-file <pem-file>           Certificate chain PEM file
  --private-key-file <pem-file>           Private key PEM file
  --certificate-env <env-name>            PEM env var, default VVMP_TRUSTED_C2PA_CERTIFICATE_PEM
  --private-key-env <env-name>            PEM env var, default VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM
  --certificate-env-b64 <env-name>        Base64 PEM env var, default VVMP_TRUSTED_C2PA_CERTIFICATE_PEM_B64
  --private-key-env-b64 <env-name>        Base64 PEM env var, default VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM_B64

Options for doctor-trusted-lane:
  --signing-profile <json-file>           Explicit signing profile to test
  --manifest <manifest.json>              Manifest used for the doctor run, default bundled signed fixture
  --input <asset-file>                    Optional input asset to sign, default generated PNG
  --out-dir <dir>                         Working directory, default temp dir
  --out <asset-file>                      Optional signed output path
  --require-trusted <true|false>          Exit non-zero unless trust_state is trusted
  --trust-program-cache-dir <dir>         Optional trust-program cache directory
  --refresh-trust-program                 Refresh trust-program artifacts before verification
  Materialization flags from materialize-signing-profile are also accepted.

Options for sync-trust-program:
  --cache-dir <dir>                       Optional trust-program cache directory
`);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function resolveRelativePath(filePath: string, baseDir?: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(baseDir ?? process.cwd(), filePath);
}

function isTrustedC2paSigningProfile(value: unknown): value is TrustedC2paSigningProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.format === "vvmp-c2pa-signing-profile/v1" &&
    typeof record.profile_id === "string" &&
    typeof record.trust_program === "string" &&
    typeof record.certificate_pem_path === "string" &&
    typeof record.private_key_pem_path === "string" &&
    typeof record.algorithm === "string"
  );
}

async function readSigningProfile(
  profilePath: string | undefined
): Promise<{ profile: TrustedC2paSigningProfile; path: string } | undefined> {
  if (!profilePath) {
    return undefined;
  }

  const resolvedPath = path.resolve(profilePath);
  const value = await readJsonFile(resolvedPath);
  if (!isTrustedC2paSigningProfile(value)) {
    throw new Error(`Invalid VVMP C2PA signing profile: ${resolvedPath}`);
  }

  return {
    profile: value,
    path: resolvedPath
  };
}

type MaterializedSigningProfileBundle = {
  written: string;
  profile_id: string;
  trust_program: TrustProgramId;
  algorithm: TrustedC2paSigningProfile["algorithm"];
  tsa_url: string | null;
  certificate_path: string;
  private_key_path: string;
  sources: {
    certificate: string;
    private_key: string;
  };
  profile: TrustedC2paSigningProfile;
};

function readOptionalEnvValue(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }

  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function readPemFromFileOrEnv(options: {
  filePath?: string;
  pemEnvName: string;
  pemBase64EnvName: string;
  label: string;
}): Promise<{ pem: string; source: string }> {
  if (options.filePath) {
    const resolvedPath = path.resolve(options.filePath);
    return {
      pem: await fs.readFile(resolvedPath, "utf8"),
      source: `file:${resolvedPath}`
    };
  }

  const directPem = readOptionalEnvValue(options.pemEnvName);
  if (directPem) {
    return {
      pem: directPem,
      source: `env:${options.pemEnvName}`
    };
  }

  const base64Pem = readOptionalEnvValue(options.pemBase64EnvName);
  if (base64Pem) {
    return {
      pem: Buffer.from(base64Pem, "base64").toString("utf8"),
      source: `env-b64:${options.pemBase64EnvName}`
    };
  }

  throw new Error(
    `Missing ${options.label} material. Provide ${options.label} via file or env (${options.pemEnvName} or ${options.pemBase64EnvName}).`
  );
}

function createTinyPngBuffer() {
  const rows = [
    [255, 0, 0, 255, 0, 255, 0, 255],
    [0, 0, 255, 255, 255, 255, 255, 255]
  ];
  const imageData = Buffer.concat(
    rows.map((row) => Buffer.concat([Buffer.from([0]), Buffer.from(row)]))
  );
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  function pngChunk(type: string, data: Buffer) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([Buffer.from(type, "ascii"), data]);
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
    return Buffer.concat([length, Buffer.from(type, "ascii"), data, crcBuffer]);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(imageData)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function getBundledTrustedLaneManifestPath() {
  return path.resolve(
    __dirname,
    "../../../test-fixtures/conformance/valid/registry/valid-signed-manifest-001.json"
  );
}

function hasMaterializableSigningInputs(args: string[]): boolean {
  return Boolean(
    readOption(args, "--certificate-file") ||
      readOption(args, "--private-key-file") ||
      readOptionalEnvValue(readOption(args, "--certificate-env") ?? "VVMP_TRUSTED_C2PA_CERTIFICATE_PEM") ||
      readOptionalEnvValue(
        readOption(args, "--certificate-env-b64") ?? "VVMP_TRUSTED_C2PA_CERTIFICATE_PEM_B64"
      ) ||
      readOptionalEnvValue(readOption(args, "--private-key-env") ?? "VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM") ||
      readOptionalEnvValue(
        readOption(args, "--private-key-env-b64") ?? "VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM_B64"
      )
  );
}

async function materializeSigningProfileBundleFromArgs(
  args: string[],
  defaultOutputDir: string
): Promise<MaterializedSigningProfileBundle> {
  const outputDir = path.resolve(readOption(args, "--out-dir") ?? defaultOutputDir);
  const profileId =
    readOption(args, "--profile-id") ??
    readOptionalEnvValue("VVMP_TRUSTED_C2PA_PROFILE_ID") ??
    "vvmp-trusted-c2pa-profile";
  const trustProgram =
    (readOption(args, "--trust-program") ??
      readOptionalEnvValue("VVMP_TRUSTED_C2PA_TRUST_PROGRAM") ??
      "official-c2pa") as TrustProgramId;
  const algorithm =
    (readOption(args, "--algorithm") ??
      readOptionalEnvValue("VVMP_TRUSTED_C2PA_ALGORITHM") ??
      "es256") as TrustedC2paSigningProfile["algorithm"];
  const tsaUrl =
    readOption(args, "--tsa-url") ?? readOptionalEnvValue("VVMP_TRUSTED_C2PA_TSA_URL");
  const certificate = await readPemFromFileOrEnv({
    filePath: readOption(args, "--certificate-file"),
    pemEnvName: readOption(args, "--certificate-env") ?? "VVMP_TRUSTED_C2PA_CERTIFICATE_PEM",
    pemBase64EnvName:
      readOption(args, "--certificate-env-b64") ?? "VVMP_TRUSTED_C2PA_CERTIFICATE_PEM_B64",
    label: "certificate"
  });
  const privateKey = await readPemFromFileOrEnv({
    filePath: readOption(args, "--private-key-file"),
    pemEnvName: readOption(args, "--private-key-env") ?? "VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM",
    pemBase64EnvName:
      readOption(args, "--private-key-env-b64") ?? "VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM_B64",
    label: "private key"
  });

  await fs.mkdir(outputDir, { recursive: true });

  const certificatePath = path.join(outputDir, "certificate.pem");
  const privateKeyPath = path.join(outputDir, "private-key.pem");
  const profilePath = path.join(outputDir, "signing-profile.json");
  const profile: TrustedC2paSigningProfile = {
    format: "vvmp-c2pa-signing-profile/v1",
    profile_id: profileId,
    trust_program: trustProgram,
    certificate_pem_path: "./certificate.pem",
    private_key_pem_path: "./private-key.pem",
    algorithm,
    ...(tsaUrl ? { tsa_url: tsaUrl } : {})
  };

  await fs.writeFile(certificatePath, certificate.pem);
  await fs.writeFile(privateKeyPath, privateKey.pem);
  await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));

  return {
    written: profilePath,
    profile_id: profile.profile_id,
    trust_program: profile.trust_program,
    algorithm: profile.algorithm,
    tsa_url: profile.tsa_url ?? null,
    certificate_path: certificatePath,
    private_key_path: privateKeyPath,
    sources: {
      certificate: certificate.source,
      private_key: privateKey.source
    },
    profile
  };
}

function readOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readBooleanOption(args: string[], flag: string): boolean | undefined {
  const value = readOption(args, flag);
  if (!value) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Invalid boolean value for ${flag}: ${value}`);
}

function readNumberOption(args: string[], flag: string): number | undefined {
  const value = readOption(args, flag);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }

  return parsed;
}

async function commandValidate(filePath: string) {
  const manifest = await readJsonFile(filePath);
  const result = validateManifest(manifest);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
}

async function commandSummarize(filePath: string) {
  const manifest = (await readJsonFile(filePath)) as VvmpManifest;
  console.log(JSON.stringify(summarizeManifest(manifest), null, 2));
}

async function commandInspect(filePath: string) {
  const manifest = (await readJsonFile(filePath)) as VvmpManifest;
  const validation = validateManifest(manifest);
  const summary = summarizeManifest(manifest);

  console.log(
    JSON.stringify(
      {
        summary,
        validation,
        top_level: {
          manifest_version: manifest.manifest_version,
          manifest_id: manifest.manifest_id,
          video_id: manifest.video.video_id,
          trust_code: manifest.video.trust_code ?? null
        },
        counts: {
          assets: manifest.assets.length,
          edits: manifest.edits.length,
          rights: manifest.rights.length,
          signatures: manifest.signatures.length,
          extensions: manifest.extensions.length
        }
      },
      null,
      2
    )
  );
  process.exitCode = validation.valid ? 0 : 1;
}

async function commandCanonicalize(filePath: string) {
  const value = await readJsonFile(filePath);
  console.log(canonicalizeJson(value));
}

function getRegistryDir(args: string[]): string {
  return readOption(args, "--registry-dir") ?? path.resolve(process.cwd(), ".vvmp-registry-data");
}

function getRegistryBaseUrl(args: string[]): string | undefined {
  return readOption(args, "--base-url");
}

function getRegistryUrl(args: string[]): string | undefined {
  return readOption(args, "--registry-url");
}

function getRegistryApiToken(args: string[]): string | undefined {
  return readOption(args, "--api-token") ?? process.env.VVMP_REGISTRY_API_TOKEN;
}

function getRegistryTransport(args: string[]): FileRegistry {
  const registryUrl = getRegistryUrl(args);

  if (registryUrl) {
    return createRegistryClient({
      baseUrl: registryUrl,
      apiToken: getRegistryApiToken(args),
      connectionClose: true
    });
  }

  return createFileRegistry({
    rootDir: getRegistryDir(args),
    baseUrl: getRegistryBaseUrl(args)
  });
}

async function commandPublish(filePath: string, args: string[]) {
  const manifest = (await readJsonFile(filePath)) as VvmpManifest;
  const registry = getRegistryTransport(args);

  const result = await registry.publishManifest({
    manifest,
    profile: readOption(args, "--profile") ?? "registry_backed",
    visibility: readOption(args, "--visibility") ?? "public",
    changeReason: readOption(args, "--change-reason")
  });

  console.log(JSON.stringify(result, null, 2));
}

async function commandRegisterRecoveryLocator(filePath: string, args: string[]) {
  const manifest = (await readJsonFile(filePath)) as VvmpManifest;
  const registry = getRegistryTransport(args);
  const method = readOption(args, "--method");
  const value = readOption(args, "--value");

  if (!method || !value) {
    throw new Error("register-recovery-locator requires both --method and --value.");
  }

  const metadataFilePath = readOption(args, "--metadata-file");
  const metadata = metadataFilePath
    ? ((await readJsonFile(metadataFilePath)) as Record<string, unknown>)
    : undefined;

  const result = await registry.registerRecoveryLocator({
    manifest_id: manifest.manifest_id,
    trust_code: manifest.video.trust_code,
    method: method as "watermark" | "fingerprint",
    value,
    version_id: readOption(args, "--version-id"),
    source: readOption(args, "--source"),
    metadata
  });

  console.log(JSON.stringify(result, null, 2));
}

async function commandResolveRecoveryLocator(
  method: string,
  value: string,
  args: string[]
) {
  const registry = getRegistryTransport(args);
  const result = await registry.getRecoveryLocator(method as "watermark" | "fingerprint", value);
  console.log(JSON.stringify(result, null, 2));
}

async function resolveCompareTarget(args: string[], remoteFilePath?: string): Promise<{
  manifest: VvmpManifest;
  source: Record<string, unknown>;
}> {
  if (remoteFilePath && !remoteFilePath.startsWith("--")) {
    return {
      manifest: (await readJsonFile(remoteFilePath)) as VvmpManifest,
      source: {
        type: "file",
        file: remoteFilePath
      }
    };
  }

  const manifestId = readOption(args, "--manifest-id");
  const trustCode = readOption(args, "--trust-code");

  if (!manifestId && !trustCode) {
    throw new Error("compare requires a remote file path or one of --manifest-id / --trust-code.");
  }

  const registry = getRegistryTransport(args);

  if (trustCode) {
    const envelope = await registry.getManifestByTrustCode(trustCode, { view: "public" });
    return {
      manifest: envelope.manifest,
      source: {
        type: "registry_trust_code",
        trust_code: trustCode,
        manifest_id: envelope.manifest_id,
        version_id: envelope.version_id
      }
    };
  }

  const envelope = await registry.getManifestById(manifestId as string, { view: "public" });
  return {
    manifest: envelope.manifest,
    source: {
      type: "registry_manifest_id",
      manifest_id: envelope.manifest_id,
      version_id: envelope.version_id
    }
  };
}

async function commandCompare(localFilePath: string, remoteFilePath: string | undefined, args: string[]) {
  const localManifest = (await readJsonFile(localFilePath)) as VvmpManifest;
  const remote = await resolveCompareTarget(args, remoteFilePath);
  const localSummary = summarizeManifest(localManifest);
  const remoteSummary = summarizeManifest(remote.manifest);
  const canonicalEqual = canonicalizeJson(localManifest) === canonicalizeJson(remote.manifest);

  const comparison = {
    same_manifest_id: localManifest.manifest_id === remote.manifest.manifest_id,
    same_trust_code: (localManifest.video.trust_code ?? null) === (remote.manifest.video.trust_code ?? null),
    same_title: localManifest.video.title === remote.manifest.video.title,
    same_duration:
      localManifest.video.final_asset.duration_seconds ===
      remote.manifest.video.final_asset.duration_seconds,
    same_source_count: localManifest.sources.length === remote.manifest.sources.length,
    same_prompt_count: localManifest.prompts.length === remote.manifest.prompts.length,
    same_tool_count: localManifest.tools.length === remote.manifest.tools.length,
    same_segment_count: localManifest.timeline.length === remote.manifest.timeline.length,
    canonical_equal: canonicalEqual
  };

  console.log(
    JSON.stringify(
      {
        matched: Object.values(comparison).every(Boolean),
        comparison,
        local_summary: localSummary,
        remote_summary: remoteSummary,
        remote_source: remote.source
      },
      null,
      2
    )
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildRecoveryCardSvg(
  manifest: VvmpManifest,
  options: { baseUrl?: string; title?: string }
): Promise<string> {
  const summary = buildRecoveryCardSummary(manifest, {
    baseUrl: options.baseUrl
  });

  if (!summary.qr_target_url || !summary.trust_code) {
    throw new Error(
      "Manifest does not include enough recovery metadata to render a QR recovery card."
    );
  }

  const qrSvg = await QRCode.toString(summary.qr_target_url, {
    type: "svg",
    width: 220,
    margin: 1,
    color: {
      dark: "#0f2d28",
      light: "#ffffff"
    }
  });

  const qrInner = qrSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const cardTitle = options.title ?? "VVMP Recovery Card";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="640" viewBox="0 0 1080 640" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(cardTitle)}</title>
  <desc id="desc">${escapeXml(
    `Recovery card for ${summary.title} with trust code ${summary.trust_code} and target ${summary.qr_target_url}.`
  )}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f1e6"/>
      <stop offset="100%" stop-color="#ece2cf"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="640" rx="36" fill="url(#bg)"/>
  <rect x="36" y="36" width="1008" height="568" rx="30" fill="rgba(255,255,255,0.86)" stroke="rgba(27,26,23,0.12)"/>
  <text x="72" y="92" fill="#0d6b5d" font-family="Georgia, serif" font-size="22" letter-spacing="4">VVMP RECOVERY</text>
  <text x="72" y="152" fill="#1b1a17" font-family="Georgia, serif" font-size="52" font-weight="700">${escapeXml(summary.title)}</text>
  <text x="72" y="208" fill="#665f55" font-family="Georgia, serif" font-size="24">Scan to resolve the trust record for this video.</text>

  <rect x="72" y="252" width="500" height="86" rx="22" fill="#ffffff" stroke="rgba(27,26,23,0.12)"/>
  <text x="96" y="288" fill="#665f55" font-family="Menlo, monospace" font-size="18">TRUST CODE</text>
  <text x="96" y="323" fill="#1b1a17" font-family="Menlo, monospace" font-size="34">${escapeXml(summary.trust_code)}</text>

  <rect x="72" y="360" width="600" height="152" rx="24" fill="#ffffff" stroke="rgba(27,26,23,0.12)"/>
  <text x="96" y="396" fill="#665f55" font-family="Menlo, monospace" font-size="18">QR TARGET URL</text>
  <text x="96" y="432" fill="#1b1a17" font-family="Menlo, monospace" font-size="20">${escapeXml(summary.qr_target_url)}</text>
  <text x="96" y="472" fill="#665f55" font-family="Georgia, serif" font-size="20">Manifest: ${escapeXml(summary.manifest_id)}</text>
  <text x="96" y="506" fill="#665f55" font-family="Georgia, serif" font-size="20">Final asset: ${escapeXml(summary.final_asset.format)} • ${summary.final_asset.duration_seconds}s</text>

  <g transform="translate(764 148)">
    <rect width="240" height="240" rx="28" fill="#ffffff" stroke="rgba(27,26,23,0.12)"/>
    <g transform="translate(10 10)">
      ${qrInner}
    </g>
  </g>
</svg>`;
}

async function commandCompareRendition(
  manifestFilePath: string,
  observationFilePath: string,
  args: string[]
) {
  const manifest = (await readJsonFile(manifestFilePath)) as VvmpManifest;
  const observation = (await readJsonFile(observationFilePath)) as RenditionObservation;
  const validation = validateRenditionObservation(observation);

  if (!validation.valid) {
    console.log(JSON.stringify(validation, null, 2));
    process.exitCode = 1;
    return;
  }

  const result = compareRenditionObservation(manifest, observation, {
    baseUrl: readOption(args, "--base-url"),
    durationToleranceSeconds: readNumberOption(args, "--duration-tolerance")
  });

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.recovered ? 0 : 1;
}

async function commandRenderRecoveryCard(filePath: string, args: string[]) {
  const manifest = (await readJsonFile(filePath)) as VvmpManifest;
  const outputPath =
    readOption(args, "--out") ?? path.resolve(process.cwd(), "vvmp-recovery-card.svg");
  const svg = await buildRecoveryCardSvg(manifest, {
    baseUrl: readOption(args, "--base-url"),
    title: readOption(args, "--title")
  });

  await fs.writeFile(outputPath, svg);
  console.log(JSON.stringify({ written: outputPath, manifest_id: manifest.manifest_id }, null, 2));
}

function getActiveManifestFromStore(
  manifestStore: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!manifestStore || typeof manifestStore.active_manifest !== "string") {
    return null;
  }

  const manifests = manifestStore.manifests;
  if (!manifests || typeof manifests !== "object") {
    return null;
  }

  const activeManifest = (manifests as Record<string, unknown>)[manifestStore.active_manifest];
  return activeManifest && typeof activeManifest === "object"
    ? (activeManifest as Record<string, unknown>)
    : null;
}

async function commandExtract(filePath: string, args: string[]) {
  const manifestDataPath = readOption(args, "--manifest-data");
  const manifestData = manifestDataPath ? await fs.readFile(manifestDataPath) : undefined;
  const result = await readC2paManifest({
    assetPath: filePath,
    manifestData,
    verifyTrust: readBooleanOption(args, "--verify-trust") ?? false
  });

  const output = {
    found: result.found,
    embedded: result.embedded,
    remoteUrl: result.remoteUrl,
    activeLabel: result.activeLabel,
    validationState: result.validationState,
    verificationSummary: result.verificationSummary,
    activeManifest: getActiveManifestFromStore(result.manifestStore),
    manifestStore: result.manifestStore
  };

  const outputPath = readOption(args, "--out");
  if (outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(JSON.stringify({ written: outputPath, found: result.found }, null, 2));
    process.exitCode = result.found ? 0 : 1;
    return;
  }

  console.log(JSON.stringify(output, null, 2));
  process.exitCode = result.found ? 0 : 1;
}

function readTrustmarkVersionOption(args: string[]) {
  const version = readOption(args, "--version") ?? "BCH_5";
  return version as "BCH_SUPER" | "BCH_5" | "BCH_4" | "BCH_3";
}

function readTrustmarkVariantOption(args: string[]) {
  const variant = readOption(args, "--variant") ?? "Q";
  return variant as "B" | "C" | "P" | "Q";
}

async function commandGenerateTrustmarkBits(args: string[]) {
  const version = readTrustmarkVersionOption(args);
  const watermarkBits = createTrustmarkBits(version);
  console.log(
    JSON.stringify(
      {
        version,
        bit_length: watermarkBits.length,
        max_bit_length: getTrustmarkBitLength(version),
        watermark_bits: watermarkBits
      },
      null,
      2
    )
  );
}

async function commandEncodeTrustmark(filePath: string, args: string[]) {
  const outputPath =
    readOption(args, "--out") ?? path.resolve(process.cwd(), "vvmp-trustmarked.png");
  const result = await encodeTrustmarkImage({
    inputAssetPath: filePath,
    outputAssetPath: outputPath,
    watermarkBits: readOption(args, "--watermark-bits"),
    variant: readTrustmarkVariantOption(args),
    version: readTrustmarkVersionOption(args),
    strength: readNumberOption(args, "--strength") ?? 0.95,
    modelDir: readOption(args, "--model-dir"),
    modelRootUrl: readOption(args, "--model-root")
  });

  console.log(JSON.stringify(result, null, 2));
}

async function commandDecodeTrustmark(filePath: string, args: string[]) {
  const result = await decodeTrustmarkImage({
    assetPath: filePath,
    variant: readTrustmarkVariantOption(args),
    version: readTrustmarkVersionOption(args),
    modelDir: readOption(args, "--model-dir"),
    modelRootUrl: readOption(args, "--model-root")
  });

  console.log(JSON.stringify(result, null, 2));
}

async function commandRecoverTrustmark(filePath: string, args: string[]) {
  const decoded = await decodeTrustmarkImage({
    assetPath: filePath,
    variant: readTrustmarkVariantOption(args),
    version: readTrustmarkVersionOption(args),
    modelDir: readOption(args, "--model-dir"),
    modelRootUrl: readOption(args, "--model-root")
  });
  const registry = getRegistryTransport(args);
  const resolution = await registry.getRecoveryLocator("watermark", decoded.watermark_bits);

  console.log(
    JSON.stringify(
      {
        decoded,
        resolution
      },
      null,
      2
    )
  );
  process.exitCode = resolution.matched ? 0 : 1;
}

async function commandVerifyPrototype(filePath: string) {
  const sidecar = (await readJsonFile(filePath)) as PrototypeSidecar;
  const result = verifyPrototypeSidecar(sidecar);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
}

async function commandExportPrototype(filePath: string, args: string[]) {
  const manifest = (await readJsonFile(filePath)) as VvmpManifest;
  const signer = readOption(args, "--signer") ?? "VVMP Prototype Signer";
  const outputPath =
    readOption(args, "--out") ?? path.resolve(process.cwd(), "vvmp-prototype-sidecar.json");
  const privateKeyPath = readOption(args, "--private-key");
  const privateKeyPem = privateKeyPath ? await fs.readFile(privateKeyPath, "utf8") : undefined;

  const sidecar = signPrototypeSidecar({
    manifest,
    signer,
    privateKeyPem
  });

  await fs.writeFile(outputPath, JSON.stringify(sidecar, null, 2));
  console.log(JSON.stringify({ written: outputPath, manifest_id: manifest.manifest_id }, null, 2));
}

async function commandExportC2pa(filePath: string, args: string[]) {
  const manifest = (await readJsonFile(filePath)) as VvmpManifest;
  const inputAssetPath = readOption(args, "--input");
  const outputPath = readOption(args, "--out");
  const signingProfileInput = await readSigningProfile(readOption(args, "--signing-profile"));
  const signingProfile = signingProfileInput?.profile;
  const signingProfileBaseDir = signingProfileInput
    ? path.dirname(signingProfileInput.path)
    : undefined;
  const certificatePath =
    readOption(args, "--certificate") ??
    (signingProfile
      ? resolveRelativePath(signingProfile.certificate_pem_path, signingProfileBaseDir)
      : undefined);
  const privateKeyPath =
    readOption(args, "--private-key") ??
    (signingProfile
      ? resolveRelativePath(signingProfile.private_key_pem_path, signingProfileBaseDir)
      : undefined);
  const manifestDataOutputPath = readOption(args, "--manifest-data-out");
  const remoteUrl = readOption(args, "--remote-url");
  const tsaUrl = readOption(args, "--tsa-url") ?? signingProfile?.tsa_url;
  const algorithm =
    (readOption(args, "--alg") as
      | "es256"
      | "es384"
      | "es512"
      | "ps256"
      | "ps384"
      | "ps512"
      | "ed25519"
      | undefined) ??
    signingProfile?.algorithm ??
    "ps256";
  const noEmbed = args.includes("--no-embed");

  if (!inputAssetPath || !outputPath || !certificatePath || !privateKeyPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const certificatePem = await fs.readFile(certificatePath, "utf8");
  const privateKeyPem = await fs.readFile(privateKeyPath, "utf8");

  const result = await exportC2paManifest({
    manifest,
    inputAssetPath,
    outputAssetPath: outputPath,
    certificatePem,
    privateKeyPem,
    manifestBaseDir: path.dirname(path.resolve(filePath)),
    algorithm,
    tsaUrl,
    remoteUrl,
    noEmbed
  });

  if (manifestDataOutputPath) {
    await fs.writeFile(manifestDataOutputPath, result.manifestBytes);
  }

  console.log(
    JSON.stringify(
      {
        manifest_id: result.manifest_id,
        trust_code: result.trust_code,
        written_asset: result.outputAssetPath,
        embedded: result.embedded,
        manifest_bytes_written: manifestDataOutputPath ?? null,
        ingredient_summary: result.ingredientSummary
      },
      null,
      2
    )
  );
}

async function commandDeriveTrustProfile(filePath: string, args: string[]) {
  const certificatePem = await fs.readFile(filePath, "utf8");
  const profile = createLocalTrustProfileFromCertificatePem({
    certificatePem,
    profileId: readOption(args, "--profile-id"),
    signerId: readOption(args, "--signer-id"),
    algorithm: readOption(args, "--algorithm"),
    environment: readOption(args, "--environment"),
    note: readOption(args, "--note")
  });
  const outputPath = readOption(args, "--out");

  if (outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(profile, null, 2));
    console.log(JSON.stringify({ written: outputPath, profile_id: profile.profile_id }, null, 2));
    return;
  }

  console.log(JSON.stringify(profile, null, 2));
}

async function commandMaterializeSigningProfile(args: string[]) {
  const result = await materializeSigningProfileBundleFromArgs(
    args,
    path.join(process.cwd(), "vvmp-trusted-signing-profile")
  );

  console.log(
    JSON.stringify(
      {
        written: result.written,
        profile_id: result.profile_id,
        trust_program: result.trust_program,
        algorithm: result.algorithm,
        tsa_url: result.tsa_url,
        certificate_path: result.certificate_path,
        private_key_path: result.private_key_path,
        sources: result.sources
      },
      null,
      2
    )
  );
}

async function commandDoctorTrustedLane(args: string[]) {
  const workingDir = path.resolve(
    readOption(args, "--out-dir") ?? path.join(process.cwd(), "vvmp-trusted-lane-doctor")
  );
  await fs.mkdir(workingDir, { recursive: true });

  const explicitProfileOption = readOption(args, "--signing-profile");
  const envProfileOption = readOptionalEnvValue("VVMP_TRUSTED_C2PA_SIGNING_PROFILE");
  const requireTrusted = readBooleanOption(args, "--require-trusted") ?? false;

  let signingProfileInput:
    | {
        source: "explicit_profile" | "env_profile_path" | "materialized_from_inputs";
        path: string;
        profile: TrustedC2paSigningProfile;
        materialized?: MaterializedSigningProfileBundle;
      }
    | undefined;

  if (explicitProfileOption) {
    const loaded = await readSigningProfile(explicitProfileOption);
    if (!loaded) {
      throw new Error(`Unable to load signing profile: ${explicitProfileOption}`);
    }
    signingProfileInput = {
      source: "explicit_profile",
      path: loaded.path,
      profile: loaded.profile
    };
  } else if (envProfileOption) {
    const loaded = await readSigningProfile(envProfileOption);
    if (!loaded) {
      throw new Error(`Unable to load signing profile from VVMP_TRUSTED_C2PA_SIGNING_PROFILE.`);
    }
    signingProfileInput = {
      source: "env_profile_path",
      path: loaded.path,
      profile: loaded.profile
    };
  } else if (hasMaterializableSigningInputs(args)) {
    const materialized = await materializeSigningProfileBundleFromArgs(
      args,
      path.join(workingDir, "materialized-signing-profile")
    );
    signingProfileInput = {
      source: "materialized_from_inputs",
      path: materialized.written,
      profile: materialized.profile,
      materialized
    };
  }

  if (!signingProfileInput) {
    console.log(
      JSON.stringify(
        {
          status: "not_configured",
          trusted: false,
          reason:
            "No trusted signing profile path or certificate/private key material was configured.",
          accepted_inputs: {
            profile_path_env: "VVMP_TRUSTED_C2PA_SIGNING_PROFILE",
            certificate_envs: [
              "VVMP_TRUSTED_C2PA_CERTIFICATE_PEM",
              "VVMP_TRUSTED_C2PA_CERTIFICATE_PEM_B64"
            ],
            private_key_envs: [
              "VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM",
              "VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM_B64"
            ]
          }
        },
        null,
        2
      )
    );
    process.exitCode = requireTrusted ? 1 : 0;
    return;
  }

  const manifestPath = path.resolve(
    readOption(args, "--manifest") ?? getBundledTrustedLaneManifestPath()
  );
  const manifest = (await readJsonFile(manifestPath)) as VvmpManifest;
  const inputAssetPath = readOption(args, "--input")
    ? path.resolve(readOption(args, "--input") as string)
    : path.join(workingDir, "doctor-input.png");
  const outputAssetPath = path.resolve(
    readOption(args, "--out") ?? path.join(workingDir, "doctor-signed.png")
  );

  if (!readOption(args, "--input")) {
    await fs.writeFile(inputAssetPath, createTinyPngBuffer());
  }

  const signingProfileBaseDir = path.dirname(signingProfileInput.path);
  const certificatePem = await fs.readFile(
    resolveRelativePath(signingProfileInput.profile.certificate_pem_path, signingProfileBaseDir),
    "utf8"
  );
  const privateKeyPem = await fs.readFile(
    resolveRelativePath(signingProfileInput.profile.private_key_pem_path, signingProfileBaseDir),
    "utf8"
  );

  const exportResult = await exportC2paManifest({
    manifest,
    inputAssetPath,
    outputAssetPath,
    certificatePem,
    privateKeyPem,
    manifestBaseDir: path.dirname(manifestPath),
    algorithm: signingProfileInput.profile.algorithm,
    tsaUrl: signingProfileInput.profile.tsa_url
  });
  const verificationResult = await readC2paManifest({
    assetPath: outputAssetPath,
    trustProgram: signingProfileInput.profile.trust_program,
    trustProgramCacheDir: readOption(args, "--trust-program-cache-dir"),
    refreshTrustProgram: args.includes("--refresh-trust-program")
  });
  const trusted = verificationResult.verificationSummary.trust_state === "trusted";
  const status = trusted ? "configured_trusted" : "configured_untrusted";

  console.log(
    JSON.stringify(
      {
        status,
        trusted,
        profile_source: signingProfileInput.source,
        profile_path: signingProfileInput.path,
        materialized_profile:
          signingProfileInput.source === "materialized_from_inputs"
            ? signingProfileInput.materialized
            : null,
        manifest_path: manifestPath,
        input_asset_path: inputAssetPath,
        output_asset_path: outputAssetPath,
        export: {
          manifest_id: exportResult.manifest_id,
          trust_code: exportResult.trust_code,
          embedded: exportResult.embedded,
          ingredient_summary: exportResult.ingredientSummary
        },
        verificationSummary: verificationResult.verificationSummary,
        trustProgramSummary: verificationResult.trustProgramSummary,
        recommendation: trusted
          ? "trusted_lane_verified"
          : "The signing path is functioning, but the result is not trusted under the configured trust program. Check the supplied certificate chain, trust-program issuance, and trust-list eligibility."
      },
      null,
      2
    )
  );

  process.exitCode = requireTrusted && !trusted ? 1 : 0;
}

async function commandSyncTrustProgram(program: string, args: string[]) {
  const result = await resolveTrustProgram({
    trustProgram: program as TrustProgramId,
    cacheDir: readOption(args, "--cache-dir"),
    refresh: true
  });

  console.log(JSON.stringify(result, null, 2));
}

async function commandVerifyC2pa(filePath: string, args: string[]) {
  const manifestDataPath = readOption(args, "--manifest-data");
  const manifestData = manifestDataPath ? await fs.readFile(manifestDataPath) : undefined;
  const signingProfileInput = await readSigningProfile(readOption(args, "--signing-profile"));
  const signingProfile = signingProfileInput?.profile;
  const settingsFilePath = readOption(args, "--settings-file");
  const localTrustProfilePath = readOption(args, "--vvmp-trust-profile");
  const trustAnchorsPath = readOption(args, "--trust-anchors");
  const userAnchorsPath = readOption(args, "--user-anchors");
  const allowedListPath = readOption(args, "--allowed-list");
  const trustConfigPath = readOption(args, "--trust-config");
  const trustProgram =
    (readOption(args, "--trust-program") as TrustProgramId | undefined) ??
    signingProfile?.trust_program;
  const result = await readC2paManifest({
    assetPath: filePath,
    manifestData,
    settingsFilePath,
    trustProgram,
    trustProgramCacheDir: readOption(args, "--trust-program-cache-dir"),
    refreshTrustProgram: args.includes("--refresh-trust-program"),
    localTrustProfile: localTrustProfilePath
      ? ((await readJsonFile(localTrustProfilePath)) as LocalTrustProfileDocument)
      : undefined,
    trustAnchorsPem: trustAnchorsPath ? await fs.readFile(trustAnchorsPath, "utf8") : undefined,
    userAnchorsPem: userAnchorsPath ? await fs.readFile(userAnchorsPath, "utf8") : undefined,
    allowedListPem: allowedListPath ? await fs.readFile(allowedListPath, "utf8") : undefined,
    trustConfigPath,
    verifyTrust: readBooleanOption(args, "--verify-trust"),
    verifyTrustList: readBooleanOption(args, "--verify-trust-list"),
    verifyTimestampTrust: readBooleanOption(args, "--verify-timestamp-trust"),
    remoteManifestFetch: readBooleanOption(args, "--remote-manifest-fetch"),
    ocspFetch: readBooleanOption(args, "--ocsp-fetch"),
    strictV1Validation: readBooleanOption(args, "--strict-v1-validation")
  });

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.found ? 0 : 1;
}

async function commandSign(assetFilePath: string, manifestFilePath: string, args: string[]) {
  const translatedArgs = [...args];
  if (!readOption(translatedArgs, "--input")) {
    translatedArgs.push("--input", assetFilePath);
  }

  await commandExportC2pa(manifestFilePath, translatedArgs);
}

async function commandVerify(filePath: string, args: string[]) {
  await commandVerifyC2pa(filePath, args);
}

async function main() {
  const [, , command, firstArg, ...args] = process.argv;

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const noPrimaryArgCommands = new Set([
    "generate-trustmark-bits",
    "materialize-signing-profile",
    "doctor-trusted-lane"
  ]);
  const noPrimaryArgs = noPrimaryArgCommands.has(command);
  const commandArgs =
    noPrimaryArgs && firstArg ? [firstArg, ...args] : args;
  if (!firstArg && !noPrimaryArgCommands.has(command)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "validate":
      await commandValidate(firstArg);
      return;
    case "summarize":
      await commandSummarize(firstArg);
      return;
    case "inspect":
      await commandInspect(firstArg);
      return;
    case "canonicalize":
      await commandCanonicalize(firstArg);
      return;
    case "extract":
      await commandExtract(firstArg, args);
      return;
    case "generate-trustmark-bits":
      await commandGenerateTrustmarkBits(commandArgs);
      return;
    case "encode-trustmark":
      await commandEncodeTrustmark(firstArg, args);
      return;
    case "decode-trustmark":
      await commandDecodeTrustmark(firstArg, args);
      return;
    case "recover-trustmark":
      await commandRecoverTrustmark(firstArg, args);
      return;
    case "derive-trust-profile":
      await commandDeriveTrustProfile(firstArg, args);
      return;
    case "materialize-signing-profile":
      await commandMaterializeSigningProfile(commandArgs);
      return;
    case "doctor-trusted-lane":
      await commandDoctorTrustedLane(commandArgs);
      return;
    case "sync-trust-program":
      await commandSyncTrustProgram(firstArg, args);
      return;
    case "publish":
      await commandPublish(firstArg, args);
      return;
    case "compare": {
      const [remoteArg, ...restArgs] = args;
      await commandCompare(firstArg, remoteArg, remoteArg?.startsWith("--") ? args : restArgs);
      return;
    }
    case "register-recovery-locator":
      await commandRegisterRecoveryLocator(firstArg, args);
      return;
    case "resolve-recovery-locator": {
      const [locatorValue, ...restArgs] = args;
      if (!locatorValue || locatorValue.startsWith("--")) {
        printUsage();
        process.exitCode = 1;
        return;
      }
      await commandResolveRecoveryLocator(firstArg, locatorValue, restArgs);
      return;
    }
    case "compare-rendition": {
      const [observationFilePath, ...restArgs] = args;
      if (!observationFilePath || observationFilePath.startsWith("--")) {
        printUsage();
        process.exitCode = 1;
        return;
      }
      await commandCompareRendition(firstArg, observationFilePath, restArgs);
      return;
    }
    case "render-recovery-card":
      await commandRenderRecoveryCard(firstArg, args);
      return;
    case "verify":
      await commandVerify(firstArg, args);
      return;
    case "sign": {
      const [manifestFilePath, ...restArgs] = args;
      if (!manifestFilePath || manifestFilePath.startsWith("--")) {
        printUsage();
        process.exitCode = 1;
        return;
      }
      await commandSign(firstArg, manifestFilePath, restArgs);
      return;
    }
    case "verify-prototype":
      await commandVerifyPrototype(firstArg);
      return;
    case "export-prototype":
      await commandExportPrototype(firstArg, args);
      return;
    case "export-c2pa":
      await commandExportC2pa(firstArg, args);
      return;
    case "verify-c2pa":
      await commandVerifyC2pa(firstArg, args);
      return;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

async function flushStdIo() {
  await Promise.all([
    new Promise<void>((resolve) => {
      process.stdout.write("", () => resolve());
    }),
    new Promise<void>((resolve) => {
      process.stderr.write("", () => resolve());
    })
  ]);
}

void main()
  .then(async () => {
    const exitCode = process.exitCode ?? 0;
    await flushStdIo();
    process.exit(exitCode);
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
    await flushStdIo();
    process.exit(1);
  });
