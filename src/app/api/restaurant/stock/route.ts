import { NextRequest, NextResponse } from "next/server";
import { StockMovementsRepository } from "@/lib/repositories/inventory-repository";
import { InventoryService } from "@/lib/services/inventory-service";
import { DeductStockOrderSchema } from "@/lib/schemas/inventory";

const movRepo = new StockMovementsRepository();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const ingredientId = searchParams.get("ingredientId") || undefined;
    const movementType = searchParams.get("movementType") || undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    const res = await movRepo.findByTenant(tenantId, { ingredientId, movementType, limit });
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
    const parsed = DeductStockOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de deducción inválidos", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { tenantId, reservationId, orderId, items } = parsed.data;

    const result = await InventoryService.deductStockOnServed(
      tenantId,
      reservationId,
      orderId,
      items
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error al descontar stock" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deductedMovementsCount: result.deductedMovementsCount,
      warnings: result.warnings,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
