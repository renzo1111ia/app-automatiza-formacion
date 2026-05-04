import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";
import { Node, Edge } from "@xyflow/react";

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

interface VisualNodeData {
    label?: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
}

export async function POST(req: Request) {
    console.log("[DEBUG] PUBLISH ENDPOINT HIT");
    try {
        const body = await req.json();
        console.log("[DEBUG] BODY:", JSON.stringify(body).substring(0, 500));
        const { tenantId, workflowId, graphData } = publishSchema.parse(body);

        const supabase = await getAdminSupabaseClient();

        // 1. Save the visual graph state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: graphError } = await (supabase as any)
            .from("orchestration_graphs")
            .upsert({
                tenant_id: tenantId,
                workflow_id: workflowId,
                graph_data: graphData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'workflow_id' });
// ... (omitting lines between 36 and 41 for context match if possible, but I'll use a larger block)
        if (graphError) {
            console.error("[PUBLISH] Graph Error:", graphError);
            throw graphError;
        }

        // 2. Flatten the graph into execution rules
        const executionSteps = flattenGraph(graphData.nodes as Node[], graphData.edges as Edge[]);

        // 3. Clear existing rules for THIS workflow and insert new ones
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteError } = await (supabase as any)
            .from("orchestration_rules")
            .delete()
            .eq("workflow_id", workflowId);

        if (deleteError) {
            console.warn("[PUBLISH] Rule cleanup warning (non-fatal):", deleteError);
        }

        if (executionSteps.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: rulesError } = await (supabase as any)
                .from("orchestration_rules")
                .insert(executionSteps.map((step, index) => ({
                    tenant_id: tenantId,
                    workflow_id: workflowId,
                    step_name: step.label,
                    action_type: step.type,
                    sequence_order: step.sequence_order || index,
                    config: step.config as Record<string, unknown>,
                    trigger_node_id: (step.config as any)?.trigger_node_id || null,
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
function flattenGraph(nodes: Node[], edges: Edge[]) {
    const triggerNodes = nodes.filter(n => ['leadTrigger', 'webhookTrigger', 'flow_trigger'].includes(n.type || ''));
    if (triggerNodes.length === 0) return [];

    const allSteps: any[] = [];

    function traverse(currentNodeId: string, triggerNodeId: string, order: number, visitedPath: Set<string>) {
        if (visitedPath.has(currentNodeId) || order > 50) return;
        visitedPath.add(currentNodeId);
  
        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (!currentNode) return;
  
        // Map visual node to execution action
        let actionType = 'UNKNOWN';
        const type = currentNode.type || 'unknown';
        const data = (currentNode.data || {}) as VisualNodeData;
  
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
                config: { ...(data.config || {}), ...data, trigger_node_id: triggerNodeId },
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
