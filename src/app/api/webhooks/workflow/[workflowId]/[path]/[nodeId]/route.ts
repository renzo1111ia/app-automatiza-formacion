import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/core/orchestrator";

/**
 * DYNAMIC WEBHOOK HANDLER (v1.0)
 * Pattern: /api/webhooks/workflow/[workflowId]/[path]/[nodeId]
 */

async function handleWebhook(req: Request, { params }: { params: Promise<{ workflowId: string, nodeId: string, path: string }> }) {
    const { workflowId, nodeId } = await params;
    
    try {
        const supabase = await getAdminSupabaseClient();
        
        // 1. Validate Workflow & Get Tenant
        const { data: workflow, error: wfError } = await (supabase
            .from("orchestration_graphs" as any) as any)
            .select("tenant_id, graph_data")
            .eq("workflow_id", workflowId)
            .single();

        if (wfError || !workflow) {
            console.error(`[WEBHOOK] Workflow ${workflowId} not found in graphs`);
            return NextResponse.json({ error: "Workflow graph not found" }, { status: 404 });
        }

        // 2. Validate Node in Graph
        const graphData = (workflow as any).graph_data;
        const node = graphData?.nodes?.find((n: any) => n.id === nodeId);
        
        if (!node || node.type !== 'webhookTrigger') {
            console.error(`[WEBHOOK] Node ${nodeId} is not a valid webhookTrigger`);
            return NextResponse.json({ error: "Webhook node not found or invalid type" }, { status: 400 });
        }

        // 3. Method Validation (Strict if configured)
        const config = node.data?.config || {};
        if (config.method && config.method !== req.method && req.method !== 'HEAD') {
             return NextResponse.json({ error: `Method ${req.method} not allowed. Expected ${config.method}` }, { status: 405 });
        }

        // 4. Extract Payload
        let payload: Record<string, any> = {};
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            payload = await req.json().catch(() => ({}));
        } else {
            const { searchParams } = new URL(req.url);
            payload = Object.fromEntries(searchParams.entries());
        }

        // 5. Ingest/Identify Lead
        const telefono = (payload as any).telefono || (payload as any).phone || (payload as any).lead_phone;
        const nombre = (payload as any).nombre || (payload as any).name || (payload as any).lead_name;
        const email = (payload as any).email || (payload as any).lead_email;

        if (!telefono) {
            // If phone is missing, we still want it to be "functional" but we might need a dummy or skip execution
            // For this system, we'll return error as the orchestrator depends on Lead
            return NextResponse.json({ 
                error: "Missing lead phone number", 
                hint: "Ensure payload includes 'telefono', 'phone' or 'lead_phone'" 
            }, { status: 400 });
        }

        // Standard Lead Upsert
        const { data: lead, error: leadError } = await (supabase
            .from("lead" as any) as any)
            .upsert({
                tenant_id: workflow.tenant_id,
                nombre: nombre || "Referido Webhook",
                telefono,
                email,
                id_lead_externo: (payload as any).id_lead_externo || `wh_${nodeId}_${Date.now()}`,
                fecha_actualizacion: new Date().toISOString()
            }, { onConflict: "tenant_id, id_lead_externo" })
            .select()
            .single();

        if (leadError) {
            console.error("[WEBHOOK] Lead ingestion error:", leadError);
            throw leadError;
        }

        // 6. Trigger Orchestration specifically from this Webhook Node
        orchestrator.executeWorkflow(workflowId, lead as any, workflow.tenant_id, payload, nodeId).catch(err => {
            console.error("[WEBHOOK] Orchestration trigger failed:", err);
        });

        return NextResponse.json({ 
            success: true, 
            message: "Special automation link triggered",
            lead_id: (lead as any).id,
            node: nodeId
        });

    } catch (error: any) {
        console.error("[WEBHOOK API CRITICAL ERROR]:", error.message);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export const POST = handleWebhook;
export const GET = handleWebhook;
export const PUT = handleWebhook;
export const PATCH = handleWebhook;
export const DELETE = handleWebhook;
export const HEAD = handleWebhook;
