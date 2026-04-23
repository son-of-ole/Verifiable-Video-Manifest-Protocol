import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "packages", "trust-cli", "dist", "cli.js");
const manifestFixturePath = path.join(
  repoRoot,
  "test-fixtures",
  "conformance",
  "valid",
  "registry",
  "valid-signed-manifest-001.json"
);
const publicAdobeAssetPath = path.join(
  repoRoot,
  "test-fixtures",
  "c2pa-trust-programs",
  "public-assets",
  "adobe-20220124-C.jpg"
);
const signingFixturesDir = path.join(
  repoRoot,
  "test-fixtures",
  "c2pa-verification",
  "signing"
);

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout.trim(),
        result.stderr.trim()
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return result;
}

function runCli(args) {
  return runCommand("node", [cliPath, ...args]);
}

function readEnvValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function summarizeSyncResult(result) {
  return {
    trust_program: result?.trust_program ?? null,
    source: result?.source ?? null,
    paths: {
      trustAnchorsPath: result?.paths?.trustAnchorsPath ?? null,
      tsaTrustAnchorsPath: result?.paths?.tsaTrustAnchorsPath ?? null,
      allowedListPath: result?.paths?.allowedListPath ?? null,
      trustConfigPath: result?.paths?.trustConfigPath ?? null
    }
  };
}

function pngChunk(type, data) {
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

function createPngBuffer() {
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

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(imageData)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

async function main() {
  await fs.access(cliPath);
  await fs.access(publicAdobeAssetPath);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-c2pa-trust-program-"));
  const officialFixtureCertificatePath = path.join(signingFixturesDir, "es256-test-cert-chain.pem");
  const officialFixturePrivateKeyPath = path.join(signingFixturesDir, "es256-test-private.key");
  const officialCacheDir = path.join(tempDir, "official-c2pa-cache");
  const interimCacheDir = path.join(tempDir, "interim-cache");
  const fixtureProfileDir = path.join(tempDir, "fixture-signing-profile");

  const materializedFixtureProfile = JSON.parse(
    runCli([
      "materialize-signing-profile",
      "--out-dir",
      fixtureProfileDir,
      "--profile-id",
      "vvmp-smoke-official-es256-materialized",
      "--trust-program",
      "official-c2pa",
      "--algorithm",
      "es256",
      "--certificate-file",
      officialFixtureCertificatePath,
      "--private-key-file",
      officialFixturePrivateKeyPath
    ]).stdout
  );

  if (
    materializedFixtureProfile.trust_program !== "official-c2pa" ||
    materializedFixtureProfile.algorithm !== "es256" ||
    !materializedFixtureProfile.written
  ) {
    throw new Error("Materialized signing profile did not produce the expected profile output.");
  }

  const officialSync = JSON.parse(
    runCli(["sync-trust-program", "official-c2pa", "--cache-dir", officialCacheDir]).stdout
  );
  const interimSync = JSON.parse(
    runCli(["sync-trust-program", "interim", "--cache-dir", interimCacheDir]).stdout
  );

  if (
    officialSync.source !== "cache" ||
    officialSync.trust_program !== "official-c2pa" ||
    !officialSync.paths?.trustAnchorsPath ||
    !officialSync.paths?.tsaTrustAnchorsPath
  ) {
    throw new Error("Official trust-program sync did not materialize cached trust artifacts.");
  }

  if (
    interimSync.source !== "cache" ||
    interimSync.trust_program !== "interim" ||
    !interimSync.paths?.trustAnchorsPath ||
    !interimSync.paths?.allowedListPath ||
    !interimSync.paths?.trustConfigPath
  ) {
    throw new Error("Interim trust-program sync did not materialize cached trust artifacts.");
  }

  const officialVerification = JSON.parse(
    runCli(["verify-c2pa", publicAdobeAssetPath, "--trust-program", "official-c2pa"]).stdout
  );
  const officialVerificationCached = JSON.parse(
    runCli([
      "verify-c2pa",
      publicAdobeAssetPath,
      "--trust-program",
      "official-c2pa",
      "--trust-program-cache-dir",
      officialCacheDir
    ]).stdout
  );
  const interimVerification = JSON.parse(
    runCli(["verify-c2pa", publicAdobeAssetPath, "--trust-program", "interim"]).stdout
  );

  if (
    !officialVerification.found ||
    officialVerification.verificationSummary?.signature_state !== "valid" ||
    officialVerification.trustProgramSummary?.enabled !== true ||
    officialVerification.trustProgramSummary?.trust_program !== "official-c2pa" ||
    officialVerification.trustProgramSummary?.source !== "bundled_fixture" ||
    officialVerificationCached.trustProgramSummary?.source !== "cache" ||
    interimVerification.trustProgramSummary?.trust_program !== "interim"
  ) {
    throw new Error("Trust-program verification presets did not behave as expected.");
  }

  const fixtureProfileInputAssetPath = path.join(tempDir, "fixture-profile-input.png");
  const fixtureProfileOutputAssetPath = path.join(tempDir, "fixture-profile-output.png");
  await fs.writeFile(fixtureProfileInputAssetPath, createPngBuffer());

  const fixtureMaterializedExport = JSON.parse(
    runCli([
      "export-c2pa",
      manifestFixturePath,
      "--input",
      fixtureProfileInputAssetPath,
      "--out",
      fixtureProfileOutputAssetPath,
      "--signing-profile",
      materializedFixtureProfile.written
    ]).stdout
  );
  const fixtureMaterializedVerification = JSON.parse(
    runCli([
      "verify-c2pa",
      fixtureProfileOutputAssetPath,
      "--signing-profile",
      materializedFixtureProfile.written
    ]).stdout
  );
  const fixtureDoctor = JSON.parse(
    runCli([
      "doctor-trusted-lane",
      "--signing-profile",
      materializedFixtureProfile.written,
      "--out-dir",
      path.join(tempDir, "fixture-doctor")
    ]).stdout
  );

  if (
    !fixtureMaterializedVerification.found ||
    fixtureMaterializedVerification.verificationSummary?.signature_state !== "valid" ||
    fixtureMaterializedVerification.trustProgramSummary?.trust_program !== "official-c2pa" ||
    fixtureDoctor.status !== "configured_untrusted" ||
    fixtureDoctor.trustProgramSummary?.trust_program !== "official-c2pa"
  ) {
    throw new Error("Materialized signing profile did not drive trust-program-aware verification.");
  }

  let trustedLane;
  let signingProfilePath = readEnvValue("VVMP_TRUSTED_C2PA_SIGNING_PROFILE");
  let trustedLaneInput = {
    source: signingProfilePath ? "env_profile_path" : "not_configured",
    profile_path: signingProfilePath ?? null
  };

  if (
    !signingProfilePath &&
    (readEnvValue("VVMP_TRUSTED_C2PA_CERTIFICATE_PEM") ||
      readEnvValue("VVMP_TRUSTED_C2PA_CERTIFICATE_PEM_B64")) &&
    (readEnvValue("VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM") ||
      readEnvValue("VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM_B64"))
  ) {
    const trustedProfileDir = path.join(tempDir, "trusted-signing-profile");
    const materializedTrustedProfile = JSON.parse(
      runCli(["materialize-signing-profile", "--out-dir", trustedProfileDir]).stdout
    );
    signingProfilePath = materializedTrustedProfile.written;
    trustedLaneInput = {
      source: "env_materialized_profile",
      profile_path: signingProfilePath,
      trust_program: materializedTrustedProfile.trust_program,
      algorithm: materializedTrustedProfile.algorithm
    };
  }

  if (signingProfilePath) {
    const inputAssetPath = path.join(tempDir, "trusted-input.png");
    const outputAssetPath = path.join(tempDir, "trusted-output.png");
    await fs.writeFile(inputAssetPath, createPngBuffer());

    const trustedExport = JSON.parse(
      runCli([
        "export-c2pa",
        manifestFixturePath,
        "--input",
        inputAssetPath,
        "--out",
        outputAssetPath,
        "--signing-profile",
        signingProfilePath
      ]).stdout
    );
    const trustedVerification = JSON.parse(
      runCli([
        "verify-c2pa",
        outputAssetPath,
        "--signing-profile",
        signingProfilePath
      ]).stdout
    );

    if (
      !trustedVerification.found ||
      trustedVerification.verificationSummary?.signature_state !== "valid" ||
      trustedVerification.verificationSummary?.trust_state !== "trusted"
    ) {
      throw new Error("Configured trusted signing profile did not produce a trusted result.");
    }

    trustedLane = {
      status: "verified",
      input: trustedLaneInput,
      doctor: JSON.parse(
        runCli([
          "doctor-trusted-lane",
          "--out-dir",
          path.join(tempDir, "trusted-doctor"),
          "--require-trusted",
          "true"
        ]).stdout
      ),
      export: trustedExport,
      verificationSummary: trustedVerification.verificationSummary,
      trustProgramSummary: trustedVerification.trustProgramSummary
    };
  } else {
    trustedLane = {
      status: "not_configured",
      input: trustedLaneInput,
      reason:
        "Set VVMP_TRUSTED_C2PA_SIGNING_PROFILE or the VVMP_TRUSTED_C2PA_CERTIFICATE_PEM(_B64) and VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM(_B64) env vars to enable the real trusted signing smoke lane."
    };
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tempDir,
        officialSync: summarizeSyncResult(officialSync),
        interimSync: summarizeSyncResult(interimSync),
        materializedFixtureProfile,
        fixtureMaterializedLane: {
          doctor: fixtureDoctor,
          export: fixtureMaterializedExport,
          verificationSummary: fixtureMaterializedVerification.verificationSummary,
          trustProgramSummary: fixtureMaterializedVerification.trustProgramSummary
        },
        officialVerification: {
          validationState: officialVerification.validationState,
          verificationSummary: officialVerification.verificationSummary,
          trustProgramSummary: officialVerification.trustProgramSummary
        },
        officialVerificationCached: {
          validationState: officialVerificationCached.validationState,
          verificationSummary: officialVerificationCached.verificationSummary,
          trustProgramSummary: officialVerificationCached.trustProgramSummary
        },
        interimVerification: {
          validationState: interimVerification.validationState,
          verificationSummary: interimVerification.verificationSummary,
          trustProgramSummary: interimVerification.trustProgramSummary
        },
        trustedLane
      },
      null,
      2
    )
  );
}

void main();
