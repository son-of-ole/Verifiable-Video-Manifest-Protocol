import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const { canonicalizeJson, validateManifest } = require("../packages/trust-core/dist/index.js");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const conformanceRoot = path.join(rootDir, "test-fixtures", "conformance");
const canonicalizationRoot = path.join(rootDir, "test-fixtures", "canonicalization");

async function collectFixtures(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const output = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await collectFixtures(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".expected.json")) {
      output.push(fullPath);
    }
  }

  return output.sort();
}

async function collectCanonicalFixtures(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const output = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await collectCanonicalFixtures(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".input.json")) {
      output.push(fullPath);
    }
  }

  return output.sort();
}

function compareArrays(actual, expected) {
  const a = [...actual].sort();
  const b = [...expected].sort();
  return JSON.stringify(a) === JSON.stringify(b);
}

function compareResult(actual, expected) {
  const actualCodes = actual.issues.map((issue) => issue.code);
  const expectedCodes = expected.error_codes ?? [];

  if (actual.valid !== expected.valid) {
    return `expected valid=${expected.valid} but got ${actual.valid}`;
  }

  if (!compareArrays(actualCodes, expectedCodes)) {
    return `expected error codes ${JSON.stringify(expectedCodes)} but got ${JSON.stringify(actualCodes)}`;
  }

  if (expected.profiles) {
    for (const [key, value] of Object.entries(expected.profiles)) {
      if (actual.profiles[key] !== value) {
        return `expected profile ${key}=${value} but got ${actual.profiles[key]}`;
      }
    }
  }

  if (expected.trust_states) {
    for (const [key, value] of Object.entries(expected.trust_states)) {
      if (actual.trustStates[key] !== value) {
        return `expected trust state ${key}=${value} but got ${actual.trustStates[key]}`;
      }
    }
  }

  return null;
}

function compareCanonicalResult(actualCanonical, actualSha, expected) {
  if (actualCanonical !== expected.canonical_json) {
    return "canonical JSON mismatch";
  }

  if (actualSha !== expected.sha256) {
    return `expected sha256 ${expected.sha256} but got ${actualSha}`;
  }

  return null;
}

async function main() {
  const fixtures = await collectFixtures(conformanceRoot);
  const canonicalFixtures = await collectCanonicalFixtures(canonicalizationRoot);
  let passed = 0;

  for (const fixturePath of fixtures) {
    const expectedPath = fixturePath.replace(/\.json$/, ".expected.json");
    const raw = await fs.readFile(fixturePath, "utf8");
    const expectedRaw = await fs.readFile(expectedPath, "utf8");
    const manifest = JSON.parse(raw);
    const expected = JSON.parse(expectedRaw);
    const result = validateManifest(manifest);
    const mismatch = compareResult(result, expected);

    if (mismatch) {
      console.error(`FAIL ${path.relative(rootDir, fixturePath)}: ${mismatch}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`PASS ${path.relative(rootDir, fixturePath)}`);
    passed += 1;
  }

  for (const fixturePath of canonicalFixtures) {
    const expectedPath = fixturePath.replace(/\.input\.json$/, ".expected.json");
    const raw = await fs.readFile(fixturePath, "utf8");
    const expectedRaw = await fs.readFile(expectedPath, "utf8");
    const value = JSON.parse(raw);
    const expected = JSON.parse(expectedRaw);
    const canonical = canonicalizeJson(value);
    const sha = crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
    const mismatch = compareCanonicalResult(canonical, sha, expected);

    if (mismatch) {
      console.error(`FAIL ${path.relative(rootDir, fixturePath)}: ${mismatch}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`PASS ${path.relative(rootDir, fixturePath)}`);
    passed += 1;
  }

  if (process.exitCode && process.exitCode !== 0) {
    return;
  }

  console.log(`JS conformance passed: ${passed}/${fixtures.length + canonicalFixtures.length}`);
}

await main();
