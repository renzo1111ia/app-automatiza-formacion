import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const publishSchema = z.object({
    tenantId: z.string().uuid(),
    workflowId: z.string().uuid(),
    graphData: z.object({
        nodes: z.array(z.unknown()),
        edges: z.array(z.unknown()),
        viewport: z.unknown().optional()
    })
});

/**
 * API: PUBLISH ORCHESTRATION SEQUENCE (v2.0 - Workflow Aware)
 * Saves the visual graph and flattens it for the execution engine.
 */

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tenantId, workflowId, graphData } = publishSchema.parse(body);

        const supabase = await getAdminSupabaseClient();

        // 1. Save the visual graph state
        const { error: graphError } = await (supabase
            .from("orchestration_graphs" as any) as any)
            .upsert({
                tenant_id: tenantId,
                workflow_id: workflowId,
                graph_data: graphData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'workflow_id' });

        if (graphError) {
            console.error("[PUBLISH] Graph Error:", graphError);
            throw graphError;
        }

        // 2. Flatten the graph into execution rules
        const executionSteps = flattenGraph(graphData.nodes as any, graphData.edges as any);

        // 3. Clear existing rules for THIS workflow and insert new ones
        const { error: deleteError } = await (supabase
            .from("orchestration_rules" as any) as any)
            .delete()
            .eq("workflow_id", workflowId);

        if (deleteError) {
            console.warn("[PUBLISH] Rule cleanup warning (non-fatal):", deleteError);
        }

        if (executionSteps.length > 0) {
            const { error: rulesError } = await (supabase
                .from("orchestration_rules" as any) as any)
                .insert(executionSteps.map((step, index) => ({
                    tenant_id: tenantId,
                    workflow_id: workflowId,
                    step_name: step.label,
                    action_type: step.type,
                    sequence_order: step.sequence_order || index,
                    config: step.config,
                    trigger_node_id: step.triggerNodeId,
                    is_active: true
                })));
            
            if (rulesError) {
                console.error("[PUBLISH] Rules Insertion Error:", rulesError);
                throw rulesError;
            }
        }

        return NextResponse.json({ success: true, stepsCount: executionSteps.length });

    } catch (error: unknown) {
        const err = error as { message: string; stack?: string };
        console.error("CRITICAL PUBLISH API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * HELPER: FLATTEN GRAPH (v4.0 - Branching & Specialized Nodes)
 */
function flattenGraph(nodes: any[], edges: any[]) {
    const triggerNodes = nodes.filter(n => ['leadTrigger', 'webhookTrigger', 'flow_trigger'].includes(n.type));
    if (triggerNodes.length === 0) return [];

    const allSteps: any[] = [];

    function traverse(currentNodeId: string, triggerNodeId: string, order: number, visitedPath: Set<string>) {
        if (visitedPath.has(currentNodeId) || order > 50) return;
        visitedPath.add(currentNodeId);

        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (!currentNode) return;

        // Map visual node to execution action
        let actionType = 'UNKNOWN';
        const type = currentNode.type;
        const data = currentNode.data || {};

        if (['voiceCall', 'flow_call'].includes(type)) actionType = 'VOICE_CALL';
        else if (['whatsapp', 'flow_meta_template'].includes(type)) actionType = 'WHATSAPP_TEMPLATE';
        else if (['textAgent', 'flow_ai_agent'].includes(type)) actionType = 'TEXT_AGENT';
        else if (['timeCondition', 'flow_condition'].includes(type)) actionType = 'CONDITION';
        else if (['delay', 'flow_wait'].includes(type)) actionType = 'WAIT';
        else if (['api', 'flow_http'].includes(type)) actionType = 'HTTP';
        else if (['llm', 'flow_ai'].includes(type)) actionType = 'LLM';
        else if (type === 'end') return; // Stop traversal

        // If it's a step (not the trigger itself), add it
        if (!['leadTrigger', 'webhookTrigger', 'flow_trigger'].includes(type)) {
            allSteps.push({
                label: data.label || type,
                type: actionType,
                config: { ...data.config, ...data },
                triggerNodeId,
                sequence_order: order
            });
        }

        // Find outgoing edges
        const outgoing = edges.filter(e => e.source === currentNodeId);
        outgoing.forEach((edge, idx) => {
            // If it's a condition, we might want to attach the handle info to the config of the NEXT step or current?
            // For now, let's just follow all branches
            traverse(edge.target, triggerNodeId, order + 1 + idx, new Set(visitedPath));
        });
    }

    triggerNodes.forEach(trigger => {
        traverse(trigger.id, trigger.id, 0, new Set());
    });

    return allSteps;
}
