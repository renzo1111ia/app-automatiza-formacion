"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { requireApiUser, requireTenantAccess } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { FlowNode, FlowEdge, DatabaseWithFlows } from "@/types/flows";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Obtiene el flujo configurado para un agente específico.
 */
export async function getAgentFlow(agentId: string) {
  try {
    const ctx = await requireApiUser();
    if (ctx instanceof NextResponse) throw new Error("No autenticado");
    
    const tenantId = await getActiveTenantId();
    if (!tenantId) return { success: false, error: "No hay una sesión de cliente activa." };

    const guard = await requireTenantAccess(ctx, tenantId);
    if (guard) throw new Error("Acceso denegado al tenant");

    const supabase = (await getAdminSupabaseClient()) as any;

    // 1. Buscar el flujo del agente
    const { data, error: flowError } = await supabase
      .from("agent_flows")
      .select("*")
      .eq("agent_id", agentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const flow = data as any;

    if (flowError) return { success: false, error: flowError.message };
    if (!flow) {
      // Si no existe, retornamos un flujo vacío inicial
      return { success: true, data: { nodes: [], edges: [] } };
    }

    // 2. Cargar nodos
    const { data: nodesData, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", flow.id);

    if (nodesError) return { success: false, error: nodesError.message };

    // 3. Cargar aristas (edges)
    const { data: edgesData, error: edgesError } = await supabase
      .from("flow_edges")
      .select("*")
      .eq("flow_id", flow.id);

    if (edgesError) return { success: false, error: edgesError.message };

    // Formatear al estándar de React Flow
    const nodes: FlowNode[] = (nodesData || []).map((n: any) => {
      const row = n as { node_id: string; type: string; data?: unknown; position?: unknown };
      return {
        id: row.node_id,
        type: row.type,
        data: (row.data as Record<string, unknown>) || {},
        position: (row.position as { x: number; y: number }) || { x: 0, y: 0 },
      };
    });

    const edges: FlowEdge[] = (edgesData || []).map((e: any) => {
      const row = e as { edge_id: string; source: string; target: string; source_handle?: string | null; target_handle?: string | null };
      return {
        id: row.edge_id,
        source: row.source,
        target: row.target,
        sourceHandle: row.source_handle || undefined,
        targetHandle: row.target_handle || undefined,
      };
    });

    return { success: true, data: { nodes, edges } };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message || String(err) };
  }
}

/**
 * Guarda y publica la configuración de un flujo (nodos y conexiones) de un agente.
 */
export async function saveAgentFlow(agentId: string, flow: { nodes: FlowNode[]; edges: FlowEdge[] }) {
  try {
    const ctx = await requireApiUser();
    if (ctx instanceof NextResponse) throw new Error("No autenticado");

    const tenantId = await getActiveTenantId();
    if (!tenantId) return { success: false, error: "No hay una sesión de cliente activa." };

    const guard = await requireTenantAccess(ctx, tenantId);
    if (guard) throw new Error("Acceso denegado al tenant");

    const supabase = (await getAdminSupabaseClient()) as any;

    // 1. Buscar o crear el registro padre del flujo
    const flowData = {
      tenant_id: tenantId,
      agent_id: agentId,
      name: `Flujo del Agente ${agentId}`,
      status: "PUBLISHED" as const,
      updated_at: new Date().toISOString(),
    };

    const { data, error: flowError } = await supabase
      .from("agent_flows")
      .upsert(flowData, { onConflict: "agent_id" })
      .select()
      .single();

    const savedFlow = data as any;

    if (flowError) return { success: false, error: flowError.message };

    const flowId = savedFlow.id;

    // 2. Limpiar nodos y conexiones anteriores (cascada manual rápida y segura)
    await supabase.from("flow_nodes").delete().eq("flow_id", flowId);
    await supabase.from("flow_edges").delete().eq("flow_id", flowId);

    // 3. Insertar nuevos nodos
    const nodesToInsert = flow.nodes.map((n) => ({
      flow_id: flowId,
      tenant_id: tenantId,
      node_id: n.id,
      type: n.type,
      data: n.data || {},
      position: n.position || { x: 0, y: 0 },
    }));

    if (nodesToInsert.length > 0) {
      const { error: nodesError } = await supabase.from("flow_nodes").insert(nodesToInsert);
      if (nodesError) return { success: false, error: nodesError.message };
    }

    // 4. Insertar nuevas aristas
    const edgesToInsert = flow.edges.map((e) => ({
      flow_id: flowId,
      tenant_id: tenantId,
      edge_id: e.id,
      source: e.source,
      target: e.target,
      source_handle: e.sourceHandle || null,
      target_handle: e.targetHandle || null,
    }));

    if (edgesToInsert.length > 0) {
      const { error: edgesError } = await supabase.from("flow_edges").insert(edgesToInsert);
      if (edgesError) return { success: false, error: edgesError.message };
    }

    return { success: true, data: { nodes: flow.nodes, edges: flow.edges } };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message || String(err) };
  }
}

/**
 * Elimina el flujo asociado a un agente.
 */
export async function deleteAgentFlow(agentId: string) {
  try {
    const ctx = await requireApiUser();
    if (ctx instanceof NextResponse) throw new Error("No autenticado");

    const tenantId = await getActiveTenantId();
    if (!tenantId) return { success: false, error: "No hay una sesión de cliente activa." };

    const guard = await requireTenantAccess(ctx, tenantId);
    if (guard) throw new Error("Acceso denegado al tenant");

    const supabase = (await getAdminSupabaseClient()) as any;

    const { error } = await supabase
      .from("agent_flows")
      .delete()
      .eq("agent_id", agentId)
      .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message || String(err) };
  }
}
