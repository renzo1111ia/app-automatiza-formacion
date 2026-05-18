import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/admin/tenants/[id]/client-sql
 *
 * Returns the SQL script that a tenant must run in their own Supabase project.
 * The SQL adapts dynamically — it includes the tenant name as a comment header.
 *
 * Security: only accessible with the admin service_role session.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: tenantId } = await params;
        if (!tenantId) {
            return NextResponse.json({ error: "Missing tenant ID" }, { status: 400 });
        }

        // Verify the tenant exists
        const supabase = await getSupabaseServerClient();
        const { data: tenant, error } = await supabase
            .from("tenants")
            .select("id, name")
            .eq("id", tenantId)
            .returns<{ id: string; name: string }[]>()
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        // Read the base SQL template
        const sqlTemplatePath = path.join(
            process.cwd(),
            "supabase",
            "migrations",
            "client_supabase_schema.sql"
        );

        let sql: string;
        try {
            sql = fs.readFileSync(sqlTemplatePath, "utf-8");
        } catch {
            return NextResponse.json(
                { error: "SQL template not found on server" },
                { status: 500 }
            );
        }

        // Inject the tenant-specific header
        const header = `-- ============================================================
-- ESDEN Analytics — Setup para: ${tenant.name}
-- Tenant ID: ${tenant.id}
-- Generado: ${new Date().toISOString()}
-- 
-- INSTRUCCIONES:
--   1. Abre el SQL Editor de tu proyecto Supabase
--   2. Pega este script completo y ejecuta
--   3. Compártenos tu Service Role Key de forma segura
-- ============================================================

`;
        const finalSql = header + sql;

        // Return as downloadable .sql file
        return new NextResponse(finalSql, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition": `attachment; filename="esden_setup_${tenant.name.toLowerCase().replace(/\s+/g, "_")}.sql"`,
            },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
