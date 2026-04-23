import type { NextRequest } from "next/server";
import { RegistryError } from "@vvmp/trust-registry";

function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function requireRegistryAccess(request: NextRequest): void {
  const expectedToken = process.env.VVMP_REGISTRY_API_TOKEN;
  if (!expectedToken) {
    return;
  }

  const providedToken = readBearerToken(request);
  if (providedToken === expectedToken) {
    return;
  }

  throw new RegistryError(
    401,
    "VVMP_REGISTRY_UNAUTHORIZED",
    "A valid bearer token is required for this registry operation."
  );
}
