import { NextRequest, NextResponse } from "next/server";
import { requireRegistryAccess } from "../../../lib/auth";
import { getRegistry, registryProblem } from "../../../lib/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireRegistryAccess(request);
    const body = await request.json();
    const registry = getRegistry(request.nextUrl.origin);
    const result = await registry.publishManifest({
      manifest: body.manifest,
      profile: body.profile,
      visibility: body.visibility,
      changeReason: body.changeReason,
      publishedAt: body.publishedAt
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return registryProblem(error);
  }
}
