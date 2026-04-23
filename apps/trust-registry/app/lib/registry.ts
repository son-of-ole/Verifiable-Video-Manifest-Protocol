import path from "node:path";
import { createFileRegistry, RegistryError } from "@vvmp/trust-registry";

export function getRegistry(baseUrl?: string) {
  const rootDir =
    process.env.VVMP_REGISTRY_DATA_DIR ??
    path.resolve(process.cwd(), ".vvmp-registry-data");

  return createFileRegistry({
    rootDir,
    baseUrl
  });
}

export function registryProblem(error: unknown): Response {
  const registryError =
    error instanceof RegistryError
      ? error
      : new RegistryError(500, "VVMP_REGISTRY_INTERNAL_ERROR", "Unexpected registry error.");

  return new Response(
    JSON.stringify(
      {
        title: registryError.message,
        status: registryError.status,
        code: registryError.code
      },
      null,
      2
    ),
    {
      status: registryError.status,
      headers: {
        "content-type": "application/problem+json"
      }
    }
  );
}
