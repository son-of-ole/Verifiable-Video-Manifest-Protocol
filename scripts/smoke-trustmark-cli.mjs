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
  "valid-registry-public-001.json"
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

function createGradientPngBuffer(width = 256, height = 256) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const rgba = Buffer.alloc(width * 4);
    for (let x = 0; x < width; x += 1) {
      const index = x * 4;
      rgba[index] = (x + y) % 256;
      rgba[index + 1] = (x * 2) % 256;
      rgba[index + 2] = (y * 2) % 256;
      rgba[index + 3] = 255;
    }

    rows.push(Buffer.concat([Buffer.from([0]), rgba]));
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

async function main() {
  await fs.access(cliPath);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-trustmark-smoke-"));
  const registryDir = path.join(tempDir, "registry");
  const inputAssetPath = path.join(tempDir, "input.png");
  const outputAssetPath = path.join(tempDir, "output-trustmarked.png");
  const manifest = JSON.parse(await fs.readFile(fixturePath, "utf8"));

  await fs.mkdir(registryDir, { recursive: true });
  await fs.writeFile(inputAssetPath, createGradientPngBuffer());

  const publishResult = JSON.parse(
    runCli([
      "publish",
      fixturePath,
      "--registry-dir",
      registryDir,
      "--base-url",
      "https://registry.example"
    ]).stdout
  );

  const generated = JSON.parse(runCli(["generate-trustmark-bits"]).stdout);

  const registerResult = JSON.parse(
    runCli([
      "register-recovery-locator",
      fixturePath,
      "--registry-dir",
      registryDir,
      "--method",
      "watermark",
      "--value",
      generated.watermark_bits,
      "--source",
      "vvmp-trustmark-smoke"
    ]).stdout
  );

  const encoded = JSON.parse(
    runCli([
      "encode-trustmark",
      inputAssetPath,
      "--out",
      outputAssetPath,
      "--watermark-bits",
      generated.watermark_bits
    ]).stdout
  );

  const decoded = JSON.parse(runCli(["decode-trustmark", outputAssetPath]).stdout);
  const recovered = JSON.parse(
    runCli([
      "recover-trustmark",
      outputAssetPath,
      "--registry-dir",
      registryDir
    ]).stdout
  );

  if (
    generated.version !== "BCH_5" ||
    generated.bit_length !== 61 ||
    generated.watermark_bits !== encoded.watermark_bits ||
    decoded.watermark_bits !== generated.watermark_bits ||
    recovered.decoded?.watermark_bits !== generated.watermark_bits ||
    recovered.resolution?.matched !== true ||
    recovered.resolution?.match_type !== "watermark_locator" ||
    recovered.resolution?.trust_code !== manifest.video.trust_code ||
    registerResult.trust_code !== manifest.video.trust_code ||
    publishResult.trust_code !== manifest.video.trust_code
  ) {
    throw new Error("Trustmark smoke flow did not recover the expected registry record.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tempDir,
        publishResult,
        generated,
        encoded: {
          outputAssetPath: encoded.outputAssetPath,
          bit_length: encoded.bit_length,
          model_dir: encoded.model_dir
        },
        decoded,
        recovered: {
          trust_code: recovered.resolution.trust_code,
          match_type: recovered.resolution.match_type,
          watermark_bits: recovered.decoded.watermark_bits
        }
      },
      null,
      2
    )
  );
}

void main();
