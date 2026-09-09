import { NextRequest, NextResponse } from "next/server";
import { MenuProductsRepository } from "@/lib/repositories/inventory-repository";
import { CreateMenuProductSchema, UpdateMenuProductSchema } from "@/lib/schemas/inventory";

const menuRepo = new MenuProductsRepository();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;
    const isActiveParam = searchParams.get("isActive");
    const isActive =
      isActiveParam !== null && isActiveParam !== undefined ? isActiveParam === "true" : undefined;

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    const res = await menuRepo.findByTenant(tenantId, { category, search, isActive });
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({ data: res.data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateMenuProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { tenantId, ...data } = parsed.data;
    const res = await menuRepo.create(tenantId, parsed.data);

    if (res.error || !res.data) {
      return NextResponse.json({ error: res.error || "Error creando producto" }, { status: 500 });
    }

    return NextResponse.json({ data: res.data }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tenantId, ...updates } = body;

    if (!id || !tenantId) {
      return NextResponse.json({ error: "Missing id or tenantId" }, { status: 400 });
    }

    const parsed = UpdateMenuProductSchema.safeParse(updates);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const res = await menuRepo.update(id, tenantId, parsed.data);
    if (res.error || !res.data) {
      return NextResponse.json(
        { error: res.error || "Error actualizando producto" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: res.data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const tenantId = searchParams.get("tenantId");

    if (!id || !tenantId) {
      return NextResponse.json({ error: "Missing id or tenantId" }, { status: 400 });
    }

    const res = await menuRepo.delete(id, tenantId);
    if (!res.success) {
      return NextResponse.json(
        { error: res.error || "Error eliminando producto" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
