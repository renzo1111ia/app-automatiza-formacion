import { NextRequest, NextResponse } from "next/server";
import { KnowledgeBaseRepository } from "@/lib/repositories/knowledge-base-repository";

const kbRepo = new KnowledgeBaseRepository();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    const res = await kbRepo.findByTenant(tenantId);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({ data: res.data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
