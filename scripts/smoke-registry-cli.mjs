import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRegistryTestServer } from "./lib/registry-test-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "packages", "trust-cli", "dist", "cli.js");
const fixturePath = path.join(
  repoRoot,
  "test-fixtures",
  "conformance",
  "valid",
  "registry",
  "valid-registry-public-001.json"
);

async function runCli(args) {
  const child = spawn("node", [cliPath, ...args], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: trust ${args.join(" ")}`));
    }, 10000);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  if (result.code !== 0) {
    throw new Error(
      [
        `Command failed: trust ${args.join(" ")}`,
        stdout.trim(),
        stderr.trim(),
        result.signal ? `signal=${result.signal}` : null
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return JSON.parse(stdout);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const server = await startRegistryTestServer({
    apiToken: "cli-test-token"
  });

  try {
    const publishResult = await runCli([
      "publish",
      fixturePath,
      "--registry-url",
      server.baseUrl,
      "--api-token",
      server.apiToken
    ]);

    const compareResult = await runCli([
      "compare",
      fixturePath,
      "--registry-url",
      server.baseUrl,
      "--manifest-id",
      publishResult.manifest_id
    ]);

    const registerRecoveryResult = await runCli([
      "register-recovery-locator",
      fixturePath,
      "--registry-url",
      server.baseUrl,
      "--api-token",
      server.apiToken,
      "--method",
      "watermark",
      "--value",
      "wm-cli-001",
      "--source",
      "trust-cli-smoke"
    ]);

    const resolveRecoveryResult = await runCli([
      "resolve-recovery-locator",
      "watermark",
      "wm-cli-001",
      "--registry-url",
      server.baseUrl
    ]);

    const inspectResult = await runCli(["inspect", fixturePath]);

    assert(typeof publishResult.version_id === "string", "CLI publish should return a version_id.");
    assert(typeof publishResult.trust_code === "string", "CLI publish should return a trust_code.");
    assert(compareResult.local_summary.manifestId === publishResult.manifest_id, "CLI compare should inspect the requested manifest lineage.");
    assert(compareResult.remote_source.manifest_id === publishResult.manifest_id, "CLI compare should report the remote manifest lineage.");
    assert(inspectResult.summary.manifestId === publishResult.manifest_id, "CLI inspect should summarize the fixture manifest.");
    assert(
      compareResult.remote_source.type === "registry_manifest_id",
      "CLI compare should resolve the remote manifest through the registry transport."
    );
    assert(
      registerRecoveryResult.recovery_locator?.value === "wm-cli-001",
      "CLI should register a recovery locator through the registry transport."
    );
    assert(
      resolveRecoveryResult.recovery_locator?.value === "wm-cli-001",
      "CLI should resolve a registered recovery locator through the registry transport."
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: server.baseUrl,
          publishResult,
          compareResult,
          registerRecoveryResult,
          resolveRecoveryResult,
          inspectResult
        },
        null,
        2
      )
    );
  } finally {
    await server.close();
  }
}

main();
