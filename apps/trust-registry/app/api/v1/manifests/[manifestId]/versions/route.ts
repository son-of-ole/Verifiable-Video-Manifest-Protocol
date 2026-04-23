import { NextRequest, NextResponse } from "next/server";
import { getRegistry, registryProblem } from "../../../../../lib/registry";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ manifestId: string }> }
) {
  try {
    const { manifestId } = await context.params;
    const registry = getRegistry(request.nextUrl.origin);
    const result = await registry.getManifestVersions(decodeURIComponent(manifestId));
    return NextResponse.json(result);
  } catch (error) {
    return registryProblem(error);
  }
}
