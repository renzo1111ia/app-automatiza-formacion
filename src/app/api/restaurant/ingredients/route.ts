import { NextRequest, NextResponse } from "next/server";
import { IngredientsRepository } from "@/lib/repositories/inventory-repository";
import {
  CreateIngredientSchema,
  UpdateIngredientSchema,
  StockAdjustmentSchema,
} from "@/lib/schemas/inventory";

const ingRepo = new IngredientsRepository();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    const res = await ingRepo.findByTenant(tenantId);
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
    const parsed = CreateIngredientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { tenantId, ...data } = parsed.data;
    const res = await ingRepo.create(tenantId, parsed.data);

    if (res.error || !res.data) {
      return NextResponse.json(
        { error: res.error || "Error creando ingrediente" },
        { status: 500 }
      );
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
    const { id, tenantId, action, ...rest } = body;

    if (!id || !tenantId) {
      return NextResponse.json({ error: "Missing id or tenantId" }, { status: 400 });
    }

    // Si la acción es ajuste de stock manual (reposición, merma, conteo)
    if (action === "adjust") {
      const parsedAdjust = StockAdjustmentSchema.safeParse({
        tenantId,
        ingredientId: id,
        movementType: rest.movementType,
        quantity: rest.quantity,
        reason: rest.reason,
      });

      if (!parsedAdjust.success) {
        return NextResponse.json(
          { error: "Datos de ajuste inválidos", details: parsedAdjust.error.issues },
          { status: 400 }
        );
      }

      const res = await ingRepo.adjustStock(
        tenantId,
        id,
        parsedAdjust.data.movementType,
        parsedAdjust.data.quantity,
        parsedAdjust.data.reason
      );

      if (res.error || !res.data) {
        return NextResponse.json({ error: res.error || "Error ajustando stock" }, { status: 500 });
      }

      return NextResponse.json({ data: res.data });
    }

    // Actualización regular del insumo
    const parsed = UpdateIngredientSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const res = await ingRepo.update(id, tenantId, parsed.data);
    if (res.error || !res.data) {
      return NextResponse.json(
        { error: res.error || "Error actualizando ingrediente" },
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

    const res = await ingRepo.delete(id, tenantId);
    if (!res.success) {
      return NextResponse.json(
        { error: res.error || "Error eliminando ingrediente" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
