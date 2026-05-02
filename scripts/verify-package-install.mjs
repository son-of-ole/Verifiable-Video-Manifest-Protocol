import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packOnly = process.argv.includes("--pack-only");

const packages = [
  "@vvmp/trust-core",
  "@vvmp/trust-schema",
  "@vvmp/policy-pack-sdk",
  "@vvmp/trust-capture-sdk",
  "@vvmp/trust-registry",
  "@vvmp/trust-registry-client",
  "@vvmp/trust-c2pa-adapter",
  "@vvmp/trust-cli"
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    ...options
  });
}

function packWorkspace(packageName, packDir) {
  const stdout = run("npm", [
    "pack",
    "--workspace",
    packageName,
    "--pack-destination",
    packDir,
    "--json",
    "--ignore-scripts"
  ]);
  const [packResult] = JSON.parse(stdout);

  if (!packResult?.filename) {
    throw new Error(`npm pack did not return a tarball filename for ${packageName}.`);
  }

  return path.join(packDir, packResult.filename);
}

function createConsumerSmokeTest(consumerDir) {
  const smokePath = path.join(consumerDir, "consumer-smoke.cjs");

  writeFileSync(
    smokePath,
    `const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

const core = require("@vvmp/trust-core");
const schema = require("@vvmp/trust-schema");
const policy = require("@vvmp/policy-pack-sdk");
const capture = require("@vvmp/trust-capture-sdk");
const registry = require("@vvmp/trust-registry");
const registryClient = require("@vvmp/trust-registry-client");
const c2pa = require("@vvmp/trust-c2pa-adapter");

(async () => {
  assert.equal(core.canonicalizeJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(typeof core.validateManifest, "function");
  assert.match(core.VVMP_CORE_VERSION, /^0\\.1\\.\\d+$/);
  assert.equal(typeof core.createEmptyManifest, "function");
  assert.equal(typeof core.withManifestDefaults, "function");
  assert.equal(typeof core.summarizeManifestSafe, "function");
  assert.equal(typeof core.appendSignature, "function");
  assert.equal(typeof core.verifySignatures, "function");
  assert.equal(typeof schema.readManifestSchema, "function");
  assert.equal(typeof policy.definePolicyPack, "function");
  assert.equal(typeof capture.createTrustSession, "function");
  assert.equal(typeof registry.createFileRegistry, "function");
  assert.equal(typeof registryClient.createRegistryClient, "function");
  assert.equal(typeof c2pa.signPrototypeSidecar, "function");

  const manifestSchema = await schema.readManifestSchema();
  assert.equal(manifestSchema.$id, "https://vvmp.org/schemas/vvmp-manifest.v1.json");

  const session = capture.createTrustSession({ sessionId: "consumer-smoke" });
  assert.equal(session.getSnapshot().session_id, "consumer-smoke");

  const emptyManifest = core.createEmptyManifest({ manifest_id: "urn:vvmp:manifest:consumer-smoke" });
  assert.equal(emptyManifest.edits.length, 0);
  const signedManifest = core.appendSignature(emptyManifest, {
    signer: "consumer-smoke",
    value: "test-signature"
  });
  const signatureVerification = await core.verifySignatures(signedManifest, () => true);
  assert.equal(signatureVerification.valid, true);

  const corePackage = require("@vvmp/trust-core/package.json");
  assert.equal(corePackage.version, core.VVMP_CORE_VERSION);

  const fileRegistry = registry.createFileRegistry({
    rootDir: path.join(os.tmpdir(), "vvmp-package-consumer-registry")
  });
  assert.equal(typeof fileRegistry.publishManifest, "function");
})();
`
  );

  return smokePath;
}

function verifyCliBin(consumerDir) {
  const result = spawnSync("npm", ["exec", "--", "trust"], {
    cwd: consumerDir,
    encoding: "utf8"
  });

  if (result.status !== 1 || !result.stdout.includes("Commands:")) {
    throw new Error(
      [
        "The installed trust CLI did not print the expected usage output.",
        `exit=${result.status}`,
        `stdout=${result.stdout}`,
        `stderr=${result.stderr}`
      ].join("\\n")
    );
  }
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "vvmp-package-check-"));
const packDir = path.join(tempRoot, "packs");
const consumerDir = path.join(tempRoot, "consumer");

try {
  mkdirSync(packDir, { recursive: true });
  mkdirSync(consumerDir, { recursive: true });
  const tarballs = packages.map((packageName) => packWorkspace(packageName, packDir));

  console.log(`Packed ${tarballs.length} VVMP packages into ${packDir}.`);

  if (packOnly) {
    console.log("Package tarballs are ready for inspection.");
    process.exit(0);
  }

  writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "vvmp-package-consumer-smoke",
        private: true,
        version: "0.0.0"
      },
      null,
      2
    )
  );

  execFileSync("npm", ["install", "--silent", "--no-audit", ...tarballs], {
    cwd: consumerDir,
    stdio: "inherit"
  });

  const smokePath = createConsumerSmokeTest(consumerDir);
  execFileSync(process.execPath, [smokePath], {
    cwd: consumerDir,
    stdio: "inherit"
  });
  verifyCliBin(consumerDir);

  console.log("Fresh-project package install smoke passed.");
} finally {
  if (!process.env.VVMP_KEEP_PACKAGE_CHECK) {
    rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`Kept package check workspace at ${tempRoot}.`);
  }
}
