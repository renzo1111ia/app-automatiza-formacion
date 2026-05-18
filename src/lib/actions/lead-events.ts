"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TraceabilityEvent } from "@/components/historial/LeadTraceability";
import { Database, Llamada } from "@/types/database";

type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type OrchestrationLog = Database["public"]["Tables"]["orchestration_logs"]["Row"];

/**
 * FETCH LEAD EVENTS
 * Consolidates calls, whatsapp messages, and orchestration logs into a unified timeline.
 */
export async function fetchLeadEvents(leadId: string): Promise<TraceabilityEvent[]> {
    const supabase = await getSupabaseServerClient();
    const events: TraceabilityEvent[] = [];

    // 1. Fetch Calls
    const { data: calls } = await supabase
        .from("llamadas")
        .select("*")
        .eq("id_lead", leadId)
        .order("fecha_inicio", { ascending: false });

    if (calls) {
        (calls as Llamada[]).forEach((c) => {
            events.push({
                id: c.id,
                type: 'CALL',
                title: `Llamada ${c.tipo_agente || ''}`,
                description: c.resumen || `Llamada finalizada: ${c.estado_llamada}. Duración: ${c.duracion_segundos}s`,
                timestamp: c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleString() : '---',
                status: c.estado_llamada === 'COMPLETED' ? 'SUCCESS' : 'FAILURE'
            });
        });
    }

    // 2. Fetch WhatsApp Messages (from chat_messages table if exists)
    const { data: messages } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(20);

    if (messages) {
        (messages as ChatMessage[]).forEach((m) => {
            events.push({
                id: m.id,
                type: 'WHATSAPP',
                title: m.direction === 'OUTBOUND' ? 'Mensaje Enviado' : 'Mensaje Recibido',
                description: m.content,
                timestamp: new Date(m.created_at).toLocaleString(),
                status: m.status === 'SENT' || m.status === 'DELIVERED' ? 'SUCCESS' : 'PENDING'
            });
        });
    }

    // 3. Fetch Orchestration Logs (The "Brain" decisions)
    const { data: logs } = await supabase
        .from("orchestration_logs")
        .select("*")
        .eq("lead_id", leadId)
        .order("executed_at", { ascending: false });

    if (logs) {
        (logs as OrchestrationLog[]).forEach((l) => {
            events.push({
                id: l.id,
                type: 'CRM',
                title: 'Decisión Orquestador',
                description: `${l.action_type}: ${l.result}. ${l.error_message || ''}`,
                timestamp: l.executed_at ? new Date(l.executed_at).toLocaleString() : '---',
                status: l.result === 'SUCCESS' ? 'SUCCESS' : 'FAILURE'
            });
        });
    }

    // Sort all events by timestamp descending
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
