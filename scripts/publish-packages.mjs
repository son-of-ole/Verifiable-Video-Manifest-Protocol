import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const dryRun = process.argv.includes("--dry-run");

function readWorkspacePackage(packageName) {
  const stdout = execFileSync("npm", ["pkg", "get", "--workspace", packageName, "version"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  const parsed = JSON.parse(stdout);
  return {
    name: packageName,
    version: parsed[packageName]
  };
}

function isVersionPublished(packageName, version) {
  const result = spawnSync("npm", ["view", `${packageName}@${version}`, "version", "--json"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return result.status === 0 && result.stdout.includes(version);
}

function publishWorkspace(packageName) {
  const args = ["publish", "--workspace", packageName, "--access", "public"];
  if (dryRun) {
    args.push("--dry-run");
  }

  execFileSync("npm", args, {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

for (const packageName of packages) {
  const workspacePackage = readWorkspacePackage(packageName);

  if (isVersionPublished(packageName, workspacePackage.version)) {
    console.log(`Skipping ${packageName}@${workspacePackage.version}; it is already published.`);
    continue;
  }

  console.log(`${dryRun ? "Dry-running publish for" : "Publishing"} ${packageName}@${workspacePackage.version}...`);
  publishWorkspace(packageName);
}

console.log(`VVMP package ${dryRun ? "publish dry run" : "publish run"} complete.`);
