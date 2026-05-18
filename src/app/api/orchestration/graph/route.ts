import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * API: GET ORCHESTRATION GRAPH (v2.0 - Workflow Aware)
 * Fetches the saved visual graph for a specific workflow.
 */

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const workflowId = searchParams.get("workflowId");

        if (!workflowId) {
            return NextResponse.json({ error: "Falta el workflowId" }, { status: 400 });
        }

        const supabase = await getAdminSupabaseClient();

        const { data, error } = await (supabase
            .from("orchestration_graphs" as any) as any)
            .select("*")
            .eq("workflow_id", workflowId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
            console.error("[API_GET_GRAPH] Error de Supabase:", error);
            throw error;
        }

        // Return empty graph if none exists
        return NextResponse.json(data || { graph_data: { nodes: [], edges: [] } });

    } catch (error: unknown) {
        const err = error as { message: string };
        console.error("[API_GET_GRAPH] Error crítico:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
