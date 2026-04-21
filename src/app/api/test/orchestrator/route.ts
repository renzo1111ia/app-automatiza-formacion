import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/core/orchestrator";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { Workflow, OrchestrationRule, Lead } from "@/types/database";

export async function GET() {
    try {
        const supabase = (await getAdminSupabaseClient()) as unknown as SupabaseClient;
        const tenantId = "test-tenant-123";

        // 1. Ensure a Baseline Workflow exists
        const { data: workflows } = await supabase.from("workflows").select("*").eq("tenant_id", tenantId).limit(1);
        let workflow = workflows && workflows.length > 0 ? workflows[0] : null;

        if (!workflow) {
            console.log("[PLAYGROUND] Creating Baseline Workflow...");
            const { data: newWf, error: wfE } = await supabase.from("workflows").insert({
                tenant_id: tenantId,
                name: "Workflow de Prueba A/B",
                is_active: true,
                is_primary: true
            }).select().single();
            
            if (wfE) throw new Error("Workflow creation failed: " + wfE.message);
            workflow = newWf;

            // Add a Rule
            const { error: ruleE } = await supabase.from("orchestration_rules").insert({
                tenant_id: tenantId,
                workflow_id: (workflow as unknown as Workflow).id,
                step_name: "AI Qualification",
                action_type: "AI_AGENT",
                sequence_order: 1,
                config: { agentId: "test-agent-id", sendWhatsApp: false }
            });
            if (ruleE) throw new Error("Rule creation failed: " + ruleE.message);
        }

        // 2. Create Mock Lead
        const { data: lead, error: leadE } = await supabase.from("lead").insert({
            tenant_id: tenantId,
            nombre: "Test",
            apellido: "Orchestrator",
            telefono: "+34123456789",
            email: "test@play.com",
            origen: "API Test"
        }).select().single();

        if (leadE) throw new Error("Lead creation failed: " + leadE.message);

        // 3. Execute
        await orchestrator.executeWorkflow((workflow as unknown as Workflow).id, lead as unknown as Lead, tenantId, {});

        return NextResponse.json({ 
            success: true, 
            leadId: (lead as unknown as Lead).id, 
            workflowId: (workflow as unknown as Workflow).id,
            execution: "Orquestador disparado correctamente. Variantes A/B procesadas con éxito." 
        });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ success: false, error: errMsg });
    }
}
