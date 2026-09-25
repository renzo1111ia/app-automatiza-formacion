import { NextRequest, NextResponse } from "next/server";
import { processKnowledgeUploadFromPayload } from "@/lib/services/knowledge-upload-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/knowledge/upload
 *
 * Accepts raw binary stream with query parameters for metadata.
 * Completely eliminates Base64 JSON and FormData buffer truncation issues.
 */
export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const name = searchParams.get("name") || undefined;
    const description = searchParams.get("description") || undefined;
    const tenant_id = searchParams.get("tenant_id") || undefined;
    const fileName = searchParams.get("fileName") || "documento";
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const fileType = searchParams.get("fileType") || contentType;

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[API /api/knowledge/upload] 📥 Processing file "${fileName}" (${(buffer.length / (1024 * 1024)).toFixed(2)} MB, type: ${fileType})`);

    if (buffer.length === 0) {
      return NextResponse.json({ success: false, error: "El archivo recibido está vacío." }, { status: 400 });
    }

    const result = await processKnowledgeUploadFromPayload({
      tenant_id,
      name,
      description,
      fileName,
      fileType,
      buffer,
    });

    console.log(`[API /api/knowledge/upload] 📤 Result for "${fileName}":`, result.success ? "SUCCESS" : result.error);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[API /api/knowledge/upload] ❌ Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}
