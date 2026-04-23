import { NextRequest, NextResponse } from "next/server";
import { getRegistry, registryProblem } from "../../../lib/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const registry = getRegistry(request.nextUrl.origin);
    const result = await registry.verify(body);
    return NextResponse.json(result);
  } catch (error) {
    return registryProblem(error);
  }
}
