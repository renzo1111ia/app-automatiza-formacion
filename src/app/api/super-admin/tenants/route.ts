import { NextResponse } from "next/server";
import { getTenants } from "@/lib/actions/tenant";
import { getAdminStatus } from "@/lib/actions/auth";

export async function GET() {
  const isAdmin = await getAdminStatus();
  if (!isAdmin) {
    return NextResponse.json(
      { error: "No autorizado. Requiere privilegios de Super Admin." },
      { status: 401 }
    );
  }

  try {
    const tenants = await getTenants();
    return NextResponse.json({
      success: true,
      count: tenants.length,
      data: tenants,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error obteniendo tenants";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
