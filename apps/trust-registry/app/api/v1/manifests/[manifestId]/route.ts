import { NextRequest, NextResponse } from "next/server";
import { requireRegistryAccess } from "../../../../lib/auth";
import { getRegistry, registryProblem } from "../../../../lib/registry";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ manifestId: string }> }
) {
  try {
    const { manifestId } = await context.params;
    const registry = getRegistry(request.nextUrl.origin);
    const view = request.nextUrl.searchParams.get("view");
    const version = request.nextUrl.searchParams.get("version");
    if (view === "full") {
      requireRegistryAccess(request);
    }
    const result = await registry.getManifestById(decodeURIComponent(manifestId), {
      view: view === "full" ? "full" : "public",
      version: version ?? "current"
    });

    return NextResponse.json(result);
  } catch (error) {
    return registryProblem(error);
  }
}
