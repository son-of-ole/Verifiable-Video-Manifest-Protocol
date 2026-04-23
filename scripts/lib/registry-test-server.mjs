import http from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const registryModule = await import(
  path.join(repoRoot, "packages", "trust-registry", "dist", "index.js")
);

const { RegistryError, createFileRegistry } = registryModule;

function parseAuthorization(headers) {
  const value = headers.authorization;
  if (typeof value !== "string") {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1] ?? null;
}

function writeJson(response, status, body, contentType = "application/json") {
  response.writeHead(status, {
    "content-type": contentType
  });
  response.end(JSON.stringify(body, null, 2));
}

function writeProblem(response, error) {
  const registryError =
    error instanceof RegistryError
      ? error
      : new RegistryError(500, "VVMP_REGISTRY_INTERNAL_ERROR", "Unexpected registry error.");

  writeJson(
    response,
    registryError.status,
    {
      title: registryError.message,
      status: registryError.status,
      code: registryError.code
    },
    "application/problem+json"
  );
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireAccess(request, apiToken) {
  if (!apiToken) {
    return;
  }

  const token = parseAuthorization(request.headers);
  if (token !== apiToken) {
    throw new RegistryError(401, "VVMP_REGISTRY_UNAUTHORIZED", "Registry access token required.");
  }
}

export async function startRegistryTestServer(options = {}) {
  const rootDir =
    options.rootDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), "vvmp-registry-client-smoke-")));
  const apiToken = options.apiToken ?? null;
  let registry = null;

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = url.pathname;
      const segments = pathname.split("/").filter(Boolean);

      if (request.method === "POST" && pathname === "/api/v1/manifests") {
        requireAccess(request, apiToken);
        const body = await readJsonBody(request);
        const result = await registry.publishManifest({
          manifest: body.manifest,
          profile: body.profile,
          visibility: body.visibility,
          changeReason: body.changeReason,
          publishedAt: body.publishedAt
        });
        writeJson(response, 201, result);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/recovery-locators") {
        requireAccess(request, apiToken);
        const body = await readJsonBody(request);
        const result = await registry.registerRecoveryLocator({
          manifest_id: body.manifest_id,
          method: body.method,
          value: body.value,
          version_id: body.version_id,
          trust_code: body.trust_code,
          source: body.source,
          metadata: body.metadata,
          registered_at: body.registered_at
        });
        writeJson(response, 201, result);
        return;
      }

      if (request.method === "GET" && segments[0] === "api" && segments[1] === "v1") {
        if (segments[2] === "manifests" && segments[4] === "versions" && segments.length === 5) {
          const manifestId = decodeURIComponent(segments[3]);
          const result = await registry.getManifestVersions(manifestId);
          writeJson(response, 200, result);
          return;
        }

        if (segments[2] === "manifests" && segments.length === 4) {
          const manifestId = decodeURIComponent(segments[3]);
          const view = url.searchParams.get("view");
          if (view === "full") {
            requireAccess(request, apiToken);
          }
          const result = await registry.getManifestById(manifestId, {
            view: view === "full" ? "full" : "public",
            version: url.searchParams.get("version") ?? "current"
          });
          writeJson(response, 200, result);
          return;
        }

        if (segments[2] === "trust-codes" && segments.length === 4) {
          const trustCode = decodeURIComponent(segments[3]);
          const result = await registry.resolveTrustCode(trustCode);
          writeJson(response, 200, result);
          return;
        }

        if (segments[2] === "assets" && segments.length === 5) {
          const algorithm = decodeURIComponent(segments[3]);
          const value = decodeURIComponent(segments[4]);
          const result = await registry.getAssetByHash(algorithm, value);
          writeJson(response, 200, result);
          return;
        }

        if (segments[2] === "recovery-locators" && segments.length === 5) {
          const method = decodeURIComponent(segments[3]);
          const value = decodeURIComponent(segments[4]);
          const result = await registry.getRecoveryLocator(method, value);
          writeJson(response, 200, result);
          return;
        }
      }

      if (request.method === "POST" && pathname === "/api/v1/verify") {
        const body = await readJsonBody(request);
        const result = await registry.verify(body);
        writeJson(response, 200, result);
        return;
      }

      throw new RegistryError(404, "VVMP_REGISTRY_ROUTE_NOT_FOUND", `Route ${pathname} was not found.`);
    } catch (error) {
      writeProblem(response, error);
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start registry test server.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  registry = createFileRegistry({
    rootDir,
    baseUrl,
    publishPolicyPacks: options.publishPolicyPacks
  });

  return {
    apiToken,
    baseUrl,
    rootDir,
    async close() {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(undefined);
        });
      });
    }
  };
}
