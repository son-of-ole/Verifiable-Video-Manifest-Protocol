import { NextRequest, NextResponse } from "next/server";
import { getRegistry, registryProblem } from "../../../../lib/registry";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ trustCode: string }> }
) {
  try {
    const { trustCode } = await context.params;
    const registry = getRegistry(request.nextUrl.origin);
    const result = await registry.resolveTrustCode(decodeURIComponent(trustCode));
    return NextResponse.json(result);
  } catch (error) {
    return registryProblem(error);
  }
}
