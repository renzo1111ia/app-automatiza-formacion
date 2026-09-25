import { NextRequest, NextResponse } from "next/server";
import { fetchUltravoxCallDetail } from "@/lib/actions/ultravox-calls";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Falta callId" }, { status: 400 });
    }

    const result = await fetchUltravoxCallDetail(id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error al obtener detalle de llamada" },
      { status: 500 }
    );
  }
}
