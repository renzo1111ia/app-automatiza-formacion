import { NextRequest, NextResponse } from "next/server";
import { fetchUltravoxLeadCalls } from "@/lib/actions/ultravox-calls";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 100;

    const result = await fetchUltravoxLeadCalls({ agentId, limit });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error al obtener llamadas" },
      { status: 500 }
    );
  }
}
