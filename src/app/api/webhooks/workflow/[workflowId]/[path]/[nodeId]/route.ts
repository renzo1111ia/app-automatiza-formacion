import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/core/orchestrator";
import type { Lead } from "@/types/database";

/**
 * DYNAMIC WEBHOOK HANDLER (v1.0)
 * Pattern: /api/webhooks/workflow/[workflowId]/[path]/[nodeId]
 */

interface WorkflowRecord {
  tenant_id: string;
  graph_data: {
    nodes?: Array<{
      id: string;
      type: string;
      data?: {
        config?: {
          method?: string;
        };
      };
    }>;
  };
}

async function handleWebhook(
  req: Request,
  { params }: { params: Promise<{ workflowId: string; nodeId: string; path: string }> }
) {
  const { workflowId, nodeId } = await params;

  try {
    const supabase = await getAdminSupabaseClient();

    // 1. Validate Workflow & Get Tenant
    // orchestration_graphs uses workflow_id PK not in generated DB types; cast required.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data: workflow, error: wfError } = (await (
      supabase.from("orchestration_graphs" as any) as any
    )
      .select("tenant_id, graph_data")
      .eq("workflow_id", workflowId)
      .single()) as { data: WorkflowRecord | null; error: unknown };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (wfError || !workflow) {
      console.error(`[WEBHOOK] Workflow ${workflowId} not found in graphs`);
      return NextResponse.json({ error: "Workflow graph not found" }, { status: 404 });
    }

    // 2. Validate Node in Graph
    const graphData = workflow.graph_data;
    const node = graphData?.nodes?.find((n) => n.id === nodeId);

    if (!node || node.type !== "webhookTrigger") {
      console.error(`[WEBHOOK] Node ${nodeId} is not a valid webhookTrigger`);
      return NextResponse.json(
        { error: "Webhook node not found or invalid type" },
        { status: 400 }
      );
    }

    // 3. Method Validation (Strict if configured)
    const config = node.data?.config ?? {};
    if (config.method && config.method !== req.method && req.method !== "HEAD") {
      return NextResponse.json(
        { error: `Method ${req.method} not allowed. Expected ${config.method}` },
        { status: 405 }
      );
    }

    // 4. Extract Payload
    let payload: Record<string, unknown> = {};
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    } else {
      const { searchParams } = new URL(req.url);
      payload = Object.fromEntries(searchParams.entries());
    }

    // 5. Ingest/Identify Lead
    const telefono = (payload.telefono ?? payload.phone ?? payload.lead_phone) as
      | string
      | undefined;
    const nombre = (payload.nombre ?? payload.name ?? payload.lead_name) as string | undefined;
    const email = (payload.email ?? payload.lead_email) as string | undefined;
    const idLeadExterno =
      (payload.id_lead_externo as string | undefined) ?? `wh_${nodeId}_${Date.now()}`;

    if (!telefono) {
      // If phone is missing, we still want it to be "functional" but we might need a dummy or skip execution
      // For this system, we'll return error as the orchestrator depends on Lead
      return NextResponse.json(
        {
          error: "Missing lead phone number",
          hint: "Ensure payload includes 'telefono', 'phone' or 'lead_phone'",
        },
        { status: 400 }
      );
    }

    // Standard Lead Upsert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error: leadError } = (await (supabase.from("lead" as any) as any)
      .upsert(
        {
          tenant_id: workflow.tenant_id,
          nombre: nombre ?? "Referido Webhook",
          telefono,
          email,
          id_lead_externo: idLeadExterno,
          fecha_actualizacion: new Date().toISOString(),
        },
        { onConflict: "tenant_id, id_lead_externo" }
      )
      .select()
      .single()) as { data: Lead | null; error: unknown };

    if (leadError || !lead) {
      console.error("[WEBHOOK] Lead ingestion error:", leadError);
      throw leadError ?? new Error("Lead upsert returned null");
    }

    // 6. Trigger Orchestration specifically from this Webhook Node
    orchestrator
      .executeWorkflow(workflowId, lead, workflow.tenant_id, payload, nodeId)
      .catch((err) => {
        console.error("[WEBHOOK] Orchestration trigger failed:", err);
      });

    return NextResponse.json({
      success: true,
      message: "Special automation link triggered",
      lead_id: lead.id,
      node: nodeId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[WEBHOOK API CRITICAL ERROR]:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const POST = handleWebhook;
export const GET = handleWebhook;
export const PUT = handleWebhook;
export const PATCH = handleWebhook;
export const DELETE = handleWebhook;
export const HEAD = handleWebhook;
