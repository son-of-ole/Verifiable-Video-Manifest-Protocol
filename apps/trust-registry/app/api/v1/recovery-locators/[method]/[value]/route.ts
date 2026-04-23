import { NextRequest, NextResponse } from "next/server";
import { getRegistry, registryProblem } from "../../../../../lib/registry";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ method: string; value: string }>;
  }
) {
  try {
    const { method, value } = await context.params;
    const registry = getRegistry(request.nextUrl.origin);
    const result = await registry.getRecoveryLocator(
      decodeURIComponent(method) as "watermark" | "fingerprint",
      decodeURIComponent(value)
    );
    return NextResponse.json(result);
  } catch (error) {
    return registryProblem(error);
  }
}
