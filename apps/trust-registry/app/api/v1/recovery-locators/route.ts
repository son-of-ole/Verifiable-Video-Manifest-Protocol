import { NextRequest, NextResponse } from "next/server";
import { requireRegistryAccess } from "../../../lib/auth";
import { getRegistry, registryProblem } from "../../../lib/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireRegistryAccess(request);
    const body = await request.json();
    const registry = getRegistry(request.nextUrl.origin);
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

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return registryProblem(error);
  }
}
