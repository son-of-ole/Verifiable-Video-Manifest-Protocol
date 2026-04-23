import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-recovery-smoke-"));
  const manifestPath = path.join(
    repoRoot,
    "test-fixtures",
    "conformance",
    "valid",
    "registry",
    "valid-registry-public-001.json"
  );
  const observationPath = path.join(
    repoRoot,
    "packages",
    "trust-schema",
    "examples",
    "recovered-copy.rendition-observation.json"
  );
  const cardPath = path.join(tempDir, "recovery-card.svg");
  const cliPath = path.join(repoRoot, "packages", "trust-cli", "dist", "cli.js");

  const compare = await execFile(
    "node",
    [cliPath, "compare-rendition", manifestPath, observationPath, "--duration-tolerance", "1"],
    { cwd: repoRoot }
  );
  const compareResult = JSON.parse(compare.stdout.trim());

  assert(compareResult.recovered, "Rendition comparison should recover the manifest by trust code or QR.");
  assert(
    compareResult.match_type === "likely_known_rendition",
    "Re-encoded observation should be classified as a likely known rendition."
  );
  assert(
    compareResult.recommended_file_trust_state === "recovered_by_qr",
    "QR-recovered observation should recommend recovered_by_qr."
  );
  assert(compareResult.exact_binary_match === false, "Re-encoded observation should not be an exact binary match.");

  const render = await execFile(
    "node",
    [cliPath, "render-recovery-card", manifestPath, "--out", cardPath],
    { cwd: repoRoot }
  );
  const renderResult = JSON.parse(render.stdout.trim());
  const cardSvg = await fs.readFile(cardPath, "utf8");
  const observation = await readJson(observationPath);

  assert(renderResult.written === cardPath, "Recovery card command should report the written SVG path.");
  assert(cardSvg.includes("<svg"), "Recovery card output should be SVG.");
  assert(cardSvg.includes("VV-7N4Q-28XZ"), "Recovery card should include the visible trust code.");
  assert(
    cardSvg.includes("https://trust.example.com/v/VV-7N4Q-28XZ"),
    "Recovery card should include the QR target URL."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        tempDir,
        cardPath,
        recoveryMethod: observation.recovery.method,
        matchType: compareResult.match_type
      },
      null,
      2
    )
  );
}

await main();
