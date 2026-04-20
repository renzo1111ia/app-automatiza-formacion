"use server";

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { getActiveTenantConfig } from "./tenant";
import { whatsappBridge, WhatsAppConfig } from "../integrations/whatsapp";
import type { Database } from "@/types/database";

type LeadRow = Database['public']['Tables']['lead']['Row'];

export interface ChatMessage {
    id: string;
    tenant_id: string;
    lead_id: string;
    direction: "INBOUND" | "OUTBOUND";
    message_type: "TEXT" | "TEMPLATE" | "SYSTEM_LOG" | "IMAGE" | "DOCUMENT";
    content: string;
    sent_by: string | null;
    status: "SENT" | "DELIVERED" | "READ" | "FAILED";
    created_at: string;
    metadata: Record<string, unknown>;
}

export interface InboxLead {
    id: string;
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    email?: string | null;
    foto_url: string | null;
    is_ai_enabled: boolean;
    last_message?: string;
    last_message_time?: string | null;
    unread_count?: number;
    ai_agent_id?: string | null;
    // Fields for detailed view
    tipo_lead?: string | null;
    pais?: string | null;
    origen?: string | null;
    campana?: string | null;
    segmentacion?: 'PUESTO 1' | 'REVISADO' | 'CUALIFICADO' | 'SIN INTERÉS' | null;
    created_at?: string | null;
}

export async function updateLeadSegment(leadId: string, segment: InboxLead['segmentacion']): Promise<{ success: boolean; error?: string }> {
    const supabase = await getAdminSupabaseClient();
    const { error } = await supabase
        .from('lead')
        .update({ segmentacion: segment } as never)
        .eq('id', leadId);
    
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Gets the list of ALL leads for the current tenant, attaching their most recent message if it exists.
 * Upgraded to show leads even if they don't have conversation history yet.
 */
export async function getInboxLeads(): Promise<{ success: boolean; data?: InboxLead[]; error?: string }> {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return { success: false, error: "No se encontró configuración de tenant activa." };

    try {
        const supabase = await getAdminSupabaseClient();
        
        // 1. Fetch ALL leads for this tenant (Limit to 50 most recent for performance)
        const { data: leads, error: leadError } = await supabase
            .from("lead")
            .select("*")
            .eq("tenant_id", tenant.id)
            .order("fecha_creacion", { ascending: false })
            .limit(50);

        if (leadError) throw leadError;
        const leadList = (leads as LeadRow[]) || [];
        if (leadList.length === 0) return { success: true, data: [] };

        const leadIds = leadList.map(l => l.id);

        // 2. Fetch the most recent message for each of these leads
        const { data: messages, error: msgError } = await supabase
            .from("chat_messages")
            .select("lead_id, content, created_at")
            .in("lead_id", leadIds)
            .order("created_at", { ascending: false });

        if (msgError) throw msgError;

        // 3. Map latest messages to their leads
        const latestMsgByLead = new Map<string, { content: string; time: string }>();
        const msgList = (messages || []) as unknown as Array<{ lead_id: string; content: string; created_at: string }>;
        
        msgList.forEach(m => {
            if (m.lead_id && !latestMsgByLead.has(m.lead_id)) {
                latestMsgByLead.set(m.lead_id, { content: m.content, time: m.created_at });
            }
        });

        // 4. Transform into InboxLead objects
        const results: InboxLead[] = leadList.map(l => {
            const msg = latestMsgByLead.get(l.id);
            
            // Normalize phone for UI (always show +)
            let phone = l.telefono || null;
            if (phone && !phone.startsWith("+")) {
                phone = "+" + phone;
            }

            return {
                id: l.id,
                nombre: l.nombre || null,
                apellido: l.apellido || null,
                telefono: phone,
                foto_url: (l as LeadRow & { foto_url?: string }).foto_url || null,
                is_ai_enabled: l.is_ai_enabled ?? true,
                ai_agent_id: (l as any).ai_agent_id || null,
                last_message: msg?.content || "Nueva conversación (sin mensajes)",
                last_message_time: msg?.time || l.fecha_creacion || null, 
                created_at: l.fecha_creacion || null,
                tipo_lead: l.tipo_lead || 'SIN CALIFICAR',
                pais: l.pais || 'Identificando...',
                origen: l.origen || 'Manual / CRM',
                campana: l.campana || 'General',
                segmentacion: (l as LeadRow & { segmentacion?: InboxLead['segmentacion'] }).segmentacion || null,
                unread_count: 0
            };
        });

        // 5. Final Sort: By message time (or creation time if new) descending
        results.sort((a, b) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime());

        return { success: true, data: results };
    } catch (e: unknown) {
        const error = e as Error;
        console.error("[INBOX_LEADS] Error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Loads the full chat history for a specific lead.
 */
export async function getChatHistory(leadId: string): Promise<{ success: boolean; data?: ChatMessage[]; error?: string }> {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return { success: false, error: "No tenant" };

    const supabase = await getAdminSupabaseClient();
    
    // Fetch Messages
    const { data: messages, error: msgError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(100);

    if (msgError) return { success: false, error: msgError.message };

    // Fetch Calls to show in timeline
    const { data: calls } = await supabase
        .from("llamadas")
        .select("id, estado_llamada, fecha_inicio, duracion_segundos")
        .eq("id_lead", leadId)
        .order("fecha_inicio", { ascending: false });

    // Combine and sort
    const chronological: ChatMessage[] = (messages as ChatMessage[] || []).map(m => ({ ...m }));

    interface CallTimelineItem {
        id: string;
        estado_llamada: string | null;
        fecha_inicio: string | null;
        duracion_segundos: number | null;
    }

    if (calls && calls.length > 0) {
        (calls as unknown as CallTimelineItem[]).forEach((call) => {
            chronological.push({
                id: `call-${call.id}`,
                tenant_id: tenant.id,
                lead_id: leadId,
                direction: 'OUTBOUND',
                message_type: 'SYSTEM_LOG',
                content: `Llamada ${call.estado_llamada === 'completed' ? 'Realizada' : 'Intento'}: ${call.duracion_segundos ? Math.floor(call.duracion_segundos / 60) + 'm ' + (call.duracion_segundos % 60) + 's' : 'Sin respuesta'}`,
                sent_by: 'Voice AI Agent',
                status: 'READ',
                created_at: call.fecha_inicio || new Date().toISOString(),
                metadata: { call_id: call.id }
            });
        });
    }

    // Sort all by date
    chronological.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return { success: true, data: chronological };
}

/**
 * Sends a manual text message or a predefined template to a lead.
 * This function handles real WhatsApp delivery and AI handover.
 */
export async function sendManualMessage(
    leadId: string, 
    content: string, 
    type: "TEXT" | "TEMPLATE" = "TEXT"
): Promise<{ success: boolean; data?: ChatMessage; error?: string }> {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return { success: false, error: "No tenant" };

    const supabase = await getAdminSupabaseClient();

    // 1. Fetch Lead data (for phone and name)
    const { data: leadRaw, error: leadError } = await supabase
        .from("lead")
        .select("telefono, nombre, is_ai_enabled")
        .eq("id", leadId)
        .single();

    if (leadError || !leadRaw) return { success: false, error: "Lead no encontrado" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lead = leadRaw as any;

    // 2. Resolve WhatsApp Config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conf = tenant.config as any;
    const waConfig: WhatsAppConfig = {
        accessToken: conf?.whatsapp?.accessToken,
        phoneNumberId: conf?.whatsapp?.phoneNumberId,
        wabaId: conf?.whatsapp?.wabaId
    };

    // 3. Real WhatsApp Send (only if credentials exist)
    if (waConfig.accessToken && waConfig.phoneNumberId) {
        try {
            if (type === "TEXT") {
                await whatsappBridge.sendTextMessage(lead.telefono || "", content, waConfig);
            } else {
                // For manual template sends, we resolve {{1}} to name automatically
                const components = lead.nombre ? [
                    {
                        type: "BODY",
                        parameters: [{ type: "text", text: lead.nombre }]
                    }
                ] : [];
                await whatsappBridge.sendTemplateMessage(lead.telefono || "", content, "es", components, waConfig);
            }
        } catch (waError) {
            const err = waError as any;
            console.error("[INBOX] WhatsApp Send Error:", err.message);
            // Log to system_logs for the user to see
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("system_logs" as any) as any).insert({
                tenant_id: tenant.id,
                event_type: "WHATSAPP_SEND_ERROR",
                message: `Error enviando ${type}: ${err.message}`,
                metadata: { leadId, error: err.response?.data || err.message }
            });
        }
    } else {
        console.warn("[INBOX] No WhatsApp credentials - Persisting as MOCK message locally.");
    }

    // 4. HANDOVER: Disable AI for this lead since a human intervened
    if (lead.is_ai_enabled) {
        await supabase.from("lead").update({ is_ai_enabled: false } as never).eq("id", leadId);
    }

    // 5. Persist message in DB
    const { data, error } = await supabase
        .from("chat_messages")
        .insert({
            tenant_id: tenant.id,
            lead_id: leadId,
            direction: "OUTBOUND",
            message_type: type,
            content: content,
            sent_by: "Asesor Humano", 
            status: "SENT"
        } as never)
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: data as ChatMessage };
}

/**
 * Injects a mockup message (Use only for demonstration/development).
 */
export async function injectMockupMessage(
    leadId: string, 
    direction: "INBOUND"| "OUTBOUND", 
    content: string, 
    sentBy?: string,
    messageType: "TEXT" | "TEMPLATE" | "SYSTEM_LOG" = "TEXT"
) {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return;

    const supabase = await getAdminSupabaseClient();
    await supabase.from("chat_messages").insert({
        tenant_id: tenant.id,
        lead_id: leadId,
        direction,
        message_type: messageType,
        content,
        sent_by: sentBy,
        status: "DELIVERED"
    } as never);
}

/**
 * Toggles the AI agent status for a specific lead.
 */
export async function toggleLeadAI(leadId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
    const supabase = await getAdminSupabaseClient();
    const { error } = await (supabase
        .from("lead")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ is_ai_enabled: enabled } as never) as any)
        .eq("id", leadId);

    if (error) {
        if (error.message.includes('column')) {
            console.error("[INBOX] Cannot toggle AI: column 'is_ai_enabled' missing in DB.");
            return { success: false, error: "La base de datos aún no tiene habilitada la función de pausa. Por favor, ejecuta la migración SQL." };
        }
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * Assigns a specific agent to a lead.
 */
export async function assignAgentToLead(leadId: string, agentId: string | null) {
    const supabase = await getAdminSupabaseClient();
    const { error } = await supabase
        .from('lead')
        .update({ ai_agent_id: agentId } as never)
        .eq('id', leadId);
    
    if (error) {
        if (error.message.includes('column')) {
             return { success: false, error: "Columna 'ai_agent_id' no encontrada. Por favor, ejecuta la migración SQL." };
        }
        return { success: false, error: error.message };
    }
    return { success: true };
}
