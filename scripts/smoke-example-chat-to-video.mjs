import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trustCore = await import(path.join(repoRoot, "packages", "trust-core", "dist", "index.js"));
const trustSchema = await import(path.join(repoRoot, "packages", "trust-schema", "dist", "index.js"));

const { summarizeManifest, validateManifest } = trustCore;
const { validateEventLog } = trustSchema;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-example-chat-to-video-"));
  const examplePath = path.join(repoRoot, "examples", "chat-to-video", "run-example.mjs");

  const { stdout } = await execFile("node", [examplePath, "--out-dir", outputDir], {
    cwd: repoRoot
  });

  const result = JSON.parse(stdout.trim());
  assert(result.example === "chat-to-video", "Smoke example should identify the chat-to-video workflow.");
  assert(typeof result.trustCode === "string" && result.trustCode.startsWith("VV-"), "Example should publish a trust code.");
  assert(typeof result.trustPageUrl === "string" && result.trustPageUrl.includes("/v/"), "Example should output a trust page URL.");
  assert(result.eventCount >= 10, "Example should emit a non-trivial event log.");
  assert(result.segmentCount === 3, "Example should build three timeline segments.");
  assert(result.guardrailCount === 3, "Example should retain three guardrail records.");

  const [eventLog, manifestFull, manifestPublic, summary, publishResult, versionHistory] = await Promise.all([
    readJson(result.files.event_log),
    readJson(result.files.manifest_full),
    readJson(result.files.manifest_public),
    readJson(result.files.summary),
    readJson(result.files.publish_result),
    readJson(result.files.version_history)
  ]);

  const eventValidation = validateEventLog(eventLog);
  const manifestValidation = validateManifest(manifestPublic);
  assert(eventValidation.valid, `Expected example event log to validate. Issues: ${JSON.stringify(eventValidation.issues)}`);
  assert(
    manifestValidation.valid,
    `Expected example public manifest to validate. Issues: ${JSON.stringify(manifestValidation.issues)}`
  );
  assert(manifestFull.prompts[0]?.text, "Full example manifest should retain the private prompt text.");
  assert(manifestPublic.prompts[0]?.text === undefined, "Public example manifest should hide the private prompt text.");
  assert(manifestFull.sources[0]?.display_text, "Full example manifest should retain the private source text.");
  assert(manifestPublic.sources[0]?.display_text === undefined, "Public example manifest should hide the private source text.");
  assert(summary.segmentCount === 3, "Summary should reflect the example timeline length.");
  assert(publishResult.trust_code === result.trustCode, "Publish result should match the reported trust code.");
  assert(versionHistory.versions.length === 1, "Example smoke should create a single-version lineage.");

  const derivedSummary = summarizeManifest(manifestPublic);
  assert(
    derivedSummary.guardrailCount === summary.guardrailCount,
    "Stored summary should match a fresh summary from the public manifest."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        trustCode: result.trustCode,
        manifestId: result.manifestId,
        outputDir
      },
      null,
      2
    )
  );
}

await main();
