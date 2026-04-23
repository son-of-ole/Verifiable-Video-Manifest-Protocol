import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "packages", "trust-cli", "dist", "cli.js");
const fixturePath = path.join(
  repoRoot,
  "test-fixtures",
  "conformance",
  "valid",
  "registry",
  "valid-signed-manifest-001.json"
);
const expectationsDir = path.join(
  repoRoot,
  "test-fixtures",
  "c2pa-verification",
  "expectations"
);
const signingFixturesDir = path.join(
  repoRoot,
  "test-fixtures",
  "c2pa-verification",
  "signing"
);
const trustProfilesDir = path.join(
  repoRoot,
  "test-fixtures",
  "c2pa-verification",
  "trust-profiles"
);
const settingsNoTrustPath = path.join(
  repoRoot,
  "test-fixtures",
  "c2pa-verification",
  "settings",
  "verify-no-trust.json"
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

function assertMatchesExpectation(actual, expectation) {
  if (actual.found !== expectation.found) {
    throw new Error(`${expectation.name}: expected found=${expectation.found}`);
  }

  if (actual.embedded !== expectation.embedded) {
    throw new Error(`${expectation.name}: expected embedded=${expectation.embedded}`);
  }

  if (actual.validationState !== expectation.validationState) {
    throw new Error(
      `${expectation.name}: expected validationState=${expectation.validationState}, received ${actual.validationState}`
    );
  }

  for (const [key, value] of Object.entries(expectation.verificationSummary ?? {})) {
    if (actual.verificationSummary?.[key] !== value) {
      throw new Error(
        `${expectation.name}: expected verificationSummary.${key}=${value}, received ${actual.verificationSummary?.[key]}`
      );
    }
  }

  for (const [key, value] of Object.entries(expectation.localTrustProfileSummary ?? {})) {
    if (actual.localTrustProfileSummary?.[key] !== value) {
      throw new Error(
        `${expectation.name}: expected localTrustProfileSummary.${key}=${value}, received ${actual.localTrustProfileSummary?.[key]}`
      );
    }
  }

  for (const code of expectation.requiredSuccessCodes ?? []) {
    if (!actual.verificationSummary?.success_codes?.includes(code)) {
      throw new Error(`${expectation.name}: missing success code ${code}`);
    }
  }

  for (const code of expectation.requiredFailureCodes ?? []) {
    if (!actual.verificationSummary?.failure_codes?.includes(code)) {
      throw new Error(`${expectation.name}: missing failure code ${code}`);
    }
  }
}

async function main() {
  await fs.access(cliPath);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-c2pa-matrix-"));
  const inputAssetPath = path.join(tempDir, "input.png");
  const outputAssetPath = path.join(tempDir, "signed.png");
  const officialOutputAssetPath = path.join(tempDir, "official-signed.png");
  const certificatePath = path.join(tempDir, "self-signed-cert.pem");
  const privateKeyPath = path.join(tempDir, "self-signed-key.pem");
  const opensslConfigPath = path.join(tempDir, "openssl.cnf");
  const officialCertificatePath = path.join(signingFixturesDir, "es256-test-cert-chain.pem");
  const officialPrivateKeyPath = path.join(signingFixturesDir, "es256-test-private.key");
  const officialLocalTrustProfilePath = path.join(
    trustProfilesDir,
    "official-es256-local.json"
  );

  await fs.writeFile(inputAssetPath, createPngBuffer());
  await fs.writeFile(
    opensslConfigPath,
    [
      "[req]",
      "distinguished_name = dn",
      "x509_extensions = v3_req",
      "prompt = no",
      "",
      "[dn]",
      "CN = VVMP Verification Matrix Signer",
      "",
      "[v3_req]",
      "basicConstraints = critical,CA:FALSE",
      "keyUsage = critical,digitalSignature",
      "extendedKeyUsage = emailProtection",
      "subjectKeyIdentifier = hash",
      "authorityKeyIdentifier = keyid,issuer",
      ""
    ].join("\n")
  );

  runCommand("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-keyout",
    privateKeyPath,
    "-out",
    certificatePath,
    "-days",
    "1",
    "-nodes",
    "-config",
    opensslConfigPath
  ]);

  runCli([
    "export-c2pa",
    fixturePath,
    "--input",
    inputAssetPath,
    "--out",
    outputAssetPath,
    "--certificate",
    certificatePath,
    "--private-key",
    privateKeyPath
  ]);

  runCli([
    "export-c2pa",
    fixturePath,
    "--input",
    inputAssetPath,
    "--out",
    officialOutputAssetPath,
    "--certificate",
    officialCertificatePath,
    "--private-key",
    officialPrivateKeyPath,
    "--alg",
    "es256"
  ]);

  const cases = [
    {
      id: "official-es256-default",
      args: ["verify-c2pa", officialOutputAssetPath]
    },
    {
      id: "official-es256-local-profile",
      args: [
        "verify-c2pa",
        officialOutputAssetPath,
        "--vvmp-trust-profile",
        officialLocalTrustProfilePath
      ]
    },
    {
      id: "self-signed-default",
      args: ["verify-c2pa", outputAssetPath]
    },
    {
      id: "self-signed-no-trust",
      args: ["verify-c2pa", outputAssetPath, "--settings-file", settingsNoTrustPath]
    },
    {
      id: "self-signed-with-anchor",
      args: ["verify-c2pa", outputAssetPath, "--trust-anchors", certificatePath]
    }
  ];

  const results = [];
  for (const item of cases) {
    const actual = JSON.parse(runCli(item.args).stdout);
    const expectation = JSON.parse(
      await fs.readFile(path.join(expectationsDir, `${item.id}.json`), "utf8")
    );
    assertMatchesExpectation(actual, expectation);
    results.push({
      case: item.id,
      validationState: actual.validationState,
      verificationSummary: actual.verificationSummary,
      localTrustProfileSummary: actual.localTrustProfileSummary ?? null
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tempDir,
        settingsFile: settingsNoTrustPath,
        results
      },
      null,
      2
    )
  );
}

void main();
