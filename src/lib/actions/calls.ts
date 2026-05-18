"use server";

import { getSupabaseServerClient, getActiveTenantId, getAdminSupabaseClient } from "@/lib/supabase/server";
import type { 
    HistorialRow, 
    IntentoLlamada, 
    LlamadaResumen, 
    LeadCualificacion, 
    ConversacionWhatsapp, 
    Lead
} from "@/types/database";

// ─── LOCAL TYPES FOR SUPABASE JOINS ──────────────────────────────────────────

interface JoinedLead extends Lead {
    last_program?: { programa: { nombre: string | null } }[];
    intentos?: { count: number }[];
    llamadas?: LlamadaResumen[];
    lead_cualificacion?: LeadCualificacion[];
    appointments?: {
        scheduled_at: string;
        status: string;
        created_at: string;
    }[];
    conversaciones_whatsapp?: ConversacionWhatsapp[];
}

// ─── FETCH PARAMS ─────────────────────────────────────────────────────────────

export interface FetchCallsParams {
    page: number;
    pageSize: number;
    search?: string;
    estadoLlamada?: string;
    fromDate?: string;
    toDate?: string;
    pais?: string;
    origen?: string;
    campana?: string;
    tipoLead?: string;
    cualificacion?: string;
}

export interface FetchCallsResult {
    data: HistorialRow[];
    count: number;
    totalPages: number;
}

// ─── FETCH CALLS (HISTORIAL) ──────────────────────────────────────────────────

/**
 * Fetches leads with their activity consolidated.
 * One Lead = One Row. No duplicates even if there are retries.
 */
export async function fetchCalls({
    page = 1,
    pageSize = 50,
    search,
    estadoLlamada,
    fromDate,
    toDate,
    pais,
    origen,
    campana,
    tipoLead,
    cualificacion,
}: FetchCallsParams): Promise<FetchCallsResult> {
    const emptyResult: FetchCallsResult = { data: [], count: 0, totalPages: 0 };

    try {
        const supabase = await getSupabaseServerClient();
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from("lead")
            .select(`
                *,
                llamadas:llamadas (
                    id,
                    estado_llamada,
                    razon_termino,
                    fecha_inicio,
                    duracion_segundos,
                    url_grabacion,
                    resumen,
                    tipo_agente
                ),
                lead_cualificacion (
                    cualificacion,
                    motivo_anulacion,
                    anios_experiencia,
                    nivel_estudios,
                    fecha_creacion
                )
            `, { count: "exact" })
            .order("fecha_ingreso_crm", { ascending: false })
            .range(from, to);

        // ── Lead Filters ─────────────────────────────────────────────────────
        if (pais) query = query.eq("pais", pais);
        if (origen) query = query.eq("origen", origen);
        if (campana) query = query.eq("campana", campana);
        if (tipoLead) query = query.eq("tipo_lead", tipoLead);

        // ── Filters on nested tables ─────────────────────────────────────────
        if (estadoLlamada && estadoLlamada !== "ALL") {
            query = query.filter("llamadas.estado_llamada", "eq", estadoLlamada);
        }
        if (fromDate) {
            query = query.filter("llamadas.fecha_inicio", "gte", fromDate);
        }
        if (toDate) {
            query = query.filter("llamadas.fecha_inicio", "lte", toDate);
        }
        if (cualificacion) {
            query = query.filter("lead_cualificacion.cualificacion", "eq", cualificacion);
        }

        // Search by phone or name
        if (search) {
            query = query.or(
                `telefono.ilike.%${search}%,nombre.ilike.%${search}%,apellido.ilike.%${search}%`
            );
        }

        const { data, error, count } = await query;

        if (error) {
            console.error("fetchCalls ERROR:", error.message);
            return emptyResult;
        }

        // Enrich with appointments via a separate query
        const leadIds = ((data ?? []) as JoinedLead[]).map((l) => l.id);
        const appointmentsMap = new Map<string, { scheduled_at: string; status: string; created_at: string }[]>();
        if (leadIds.length > 0) {
            const { data: appts } = await supabase
                .from("appointments")
                .select("lead_id, scheduled_at, status, created_at")
                .in("lead_id", leadIds);
            
            if (appts) {
                (appts as { lead_id: string; scheduled_at: string; status: string; created_at: string }[]).forEach((apt) => {
                    const list = appointmentsMap.get(apt.lead_id) || [];
                    list.push({
                        scheduled_at: apt.scheduled_at,
                        status: apt.status,
                        created_at: apt.created_at
                    });
                    appointmentsMap.set(apt.lead_id, list);
                });
            }
        }

        // ── Map results to lead-centric HistorialRow ──────────────────────────
        const rows: HistorialRow[] = ((data as unknown as JoinedLead[]) ?? []).map((lead) => {
            const sortedLlamadas = (lead.llamadas ?? []).sort((a, b) =>
                new Date(b.fecha_inicio || 0).getTime() - new Date(a.fecha_inicio || 0).getTime()
            );

            const latestCall = sortedLlamadas[0] || {};
            const firstCall = sortedLlamadas[sortedLlamadas.length - 1] || {};

            const latestCual = (lead.lead_cualificacion ?? []).sort((a, b) =>
                new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()
            )[0] || ({} as LeadCualificacion);

            const leadAppointments = appointmentsMap.get(lead.id) || [];
            const sortedAppointments = leadAppointments.sort((a, b) =>
                new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );
            const latestAppt = sortedAppointments[0] || {};

            const latestWA = (lead.conversaciones_whatsapp ?? []).sort((a, b) =>
                new Date(b.fecha_ultimo_mensaje || 0).getTime() - new Date(a.fecha_ultimo_mensaje || 0).getTime()
            )[0] || ({} as ConversacionWhatsapp);

            const programaNombre = lead.last_program?.[0]?.programa?.nombre || null;

            let tiempo_respuesta_minutos: number | null = null;
            if (lead.fecha_ingreso_crm && firstCall.fecha_inicio) {
                const diff = new Date(firstCall.fecha_inicio).getTime() - new Date(lead.fecha_ingreso_crm).getTime();
                tiempo_respuesta_minutos = Math.round(diff / 1000 / 60);
            }

            return {
                id: lead.id,
                nombre: lead.nombre,
                apellido: lead.apellido,
                telefono: lead.telefono,
                email: lead.email,
                pais: lead.pais,
                tipo_lead: lead.tipo_lead,
                origen: lead.origen,
                campana: lead.campana,
                fecha_ingreso_crm: lead.fecha_ingreso_crm,
                estado_llamada: latestCall.estado_llamada,
                razon_termino: latestCall.razon_termino,
                fecha_inicio: latestCall.fecha_inicio,
                duracion_segundos: latestCall.duracion_segundos,
                url_grabacion: latestCall.url_grabacion,
                resumen: latestCall.resumen,
                tipo_agente: latestCall.tipo_agente,
                cualificacion: latestCual.cualificacion,
                motivo_anulacion: latestCual.motivo_anulacion,
                anios_experiencia: latestCual.anios_experiencia,
                nivel_estudios: latestCual.nivel_estudios,
                fecha_agendada_cliente: latestAppt.scheduled_at,
                confirmado: latestAppt.status === "CONFIRMED",
                programa_nombre: programaNombre,
                intentos_count: 0,
                whatsapp_status: latestWA.estado,
                opt_in_whatsapp: latestWA.opt_in_whatsapp,
                notificaciones_status: undefined,
                tiempo_respuesta_minutos,
                fecha_primer_contacto: firstCall.fecha_inicio,
                llamadas: sortedLlamadas,
                total_llamadas: sortedLlamadas.length,
            };
        });

        return {
            data: rows,
            count: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / pageSize),
        };
    } catch (e) {
        console.error("fetchCalls EXCEPTION:", e);
        return emptyResult;
    }
}

// ─── GET CALLS BY PHONE ───────────────────────────────────────────────────────

/**
 * Returns leads associated with a phone number, including their full call timeline.
 */
export async function getCallsByPhone(phone: string): Promise<HistorialRow[]> {
    try {
        const supabase = await getSupabaseServerClient();
        const { data, error } = await supabase
            .from("lead")
            .select(`
                id, nombre, apellido, telefono, email, pais, tipo_lead, origen, campana, fecha_ingreso_crm,
                llamadas:llamadas (
                    id, estado_llamada, razon_termino, fecha_inicio, duracion_segundos, url_grabacion, resumen, tipo_agente
                ),
                lead_cualificacion (
                    cualificacion, motivo_anulacion, anios_experiencia, nivel_estudios, fecha_creacion
                )
            `)
            .eq("telefono", phone)
            .order("fecha_ingreso_crm", { ascending: false });

        if (error) throw new Error(error.message);

        // Enrich with appointments via a separate query
        const leadIds = ((data ?? []) as JoinedLead[]).map((l) => l.id);
        const appointmentsMap = new Map<string, { scheduled_at: string; status: string; created_at: string }[]>();
        if (leadIds.length > 0) {
            const { data: appts } = await supabase
                .from("appointments")
                .select("lead_id, scheduled_at, status, created_at")
                .in("lead_id", leadIds);
            
            if (appts) {
                (appts as { lead_id: string; scheduled_at: string; status: string; created_at: string }[]).forEach((apt) => {
                    const list = appointmentsMap.get(apt.lead_id) || [];
                    list.push({
                        scheduled_at: apt.scheduled_at,
                        status: apt.status,
                        created_at: apt.created_at
                    });
                    appointmentsMap.set(apt.lead_id, list);
                });
            }
        }

        return ((data as unknown as JoinedLead[]) ?? []).map((lead) => {
            const sortedLlamadas = (lead.llamadas ?? []).sort((a, b) =>
                new Date(b.fecha_inicio || 0).getTime() - new Date(a.fecha_inicio || 0).getTime()
            );
            const latestCall = sortedLlamadas[0] || {};
            const firstCall = sortedLlamadas[sortedLlamadas.length - 1] || {};

            const latestCual = (lead.lead_cualificacion ?? []).sort((a, b) =>
                new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()
            )[0] || ({} as LeadCualificacion);

            const leadAppointments = appointmentsMap.get(lead.id) || [];
            const sortedAppointments = leadAppointments.sort((a, b) =>
                new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );
            const latestAppt = sortedAppointments[0] || {};

            const latestWA = (lead.conversaciones_whatsapp ?? []).sort((a, b) =>
                new Date(b.fecha_ultimo_mensaje || 0).getTime() - new Date(a.fecha_ultimo_mensaje || 0).getTime()
            )[0] || ({} as ConversacionWhatsapp);

            const programaNombre = lead.last_program?.[0]?.programa?.nombre || null;

            return {
                id: lead.id,
                nombre: lead.nombre,
                apellido: lead.apellido,
                telefono: lead.telefono,
                email: lead.email,
                pais: lead.pais,
                tipo_lead: lead.tipo_lead,
                origen: lead.origen,
                campana: lead.campana,
                fecha_ingreso_crm: lead.fecha_ingreso_crm,
                estado_llamada: latestCall.estado_llamada,
                razon_termino: latestCall.razon_termino,
                fecha_inicio: latestCall.fecha_inicio,
                duracion_segundos: latestCall.duracion_segundos,
                url_grabacion: latestCall.url_grabacion,
                resumen: latestCall.resumen,
                tipo_agente: latestCall.tipo_agente,
                cualificacion: latestCual.cualificacion,
                motivo_anulacion: latestCual.motivo_anulacion,
                anios_experiencia: latestCual.anios_experiencia,
                nivel_estudios: latestCual.nivel_estudios,
                fecha_agendada_cliente: latestAppt.scheduled_at,
                confirmado: latestAppt.status === "CONFIRMED",
                programa_nombre: programaNombre,
                intentos_count: 0,
                whatsapp_status: latestWA.estado,
                opt_in_whatsapp: latestWA.opt_in_whatsapp,
                notificaciones_status: undefined,
                tiempo_respuesta_minutos: null,
                fecha_primer_contacto: firstCall.fecha_inicio,
                llamadas: sortedLlamadas,
                total_llamadas: sortedLlamadas.length,
            };
        });
    } catch (e) {
        console.error("getCallsByPhone ERROR:", e);
        return [];
    }
}

// ─── FETCH INTENTOS BY PHONE ──────────────────────────────────────────────────

/**
 * Returns call/whatsapp attempt history for a given phone number.
 */
export async function fetchIntentosByPhone(phone: string): Promise<IntentoLlamada[]> {
    try {
        const supabase = await getSupabaseServerClient();
        const { data, error } = await supabase
            .from("intentos_llamadas")
            .select(`
                *,
                lead:id_lead!inner ( id, nombre, apellido, telefono )
            `)
            .eq("lead.telefono", phone)
        if (error) {
            console.error("fetchIntentosByPhone ERROR:", error.message);
            return [];
        }
        return (data ?? []) as unknown as IntentoLlamada[];
    } catch (e) {
        console.error("fetchIntentosByPhone EXCEPTION:", e);
        return [];
    }
}

export async function fetchWhatsappByPhone(phone: string) {
    try {
        const supabase = await getSupabaseServerClient();
        const { data, error } = await supabase
            .from("conversaciones_whatsapp")
            .select(`*, lead:id_lead!inner ( id, nombre, apellido, telefono )`)
            .eq("lead.telefono", phone)
            .order("fecha_creacion", { ascending: false });

        if (error) {
            console.error("fetchWhatsappByPhone ERROR:", error.message);
            return [];
        }
        return data ?? [];
    } catch (e) {
        console.error("fetchWhatsappByPhone EXCEPTION:", e);
        return [];
    }
}

export async function createLead(data: {
    nombre: string;
    apellido?: string | null;
    telefono: string;
    email?: string | null;
    pais?: string | null;
    tipo_lead?: string | null;
    origen?: string | null;
    campana?: string | null;
    id_programa?: string | null;
}) {
    try {
        const client = await getAdminSupabaseClient();
        const tenantId = await getActiveTenantId();
        if (!tenantId) return { success: false, error: "No active tenant" };

        const { data: newLead, error: leadError } = await client.from("lead" as never)
            .insert({
                tenant_id: tenantId,
                nombre: data.nombre,
                apellido: data.apellido,
                telefono: data.telefono,
                email: data.email,
                pais: data.pais,
                tipo_lead: data.tipo_lead || "nuevo",
                origen: data.origen,
                campana: data.campana,
                fecha_ingreso_crm: new Date().toISOString(),
            } as never)
            .select()
            .single();

        if (leadError) throw leadError;

        if (data.id_programa && newLead) {
            await client.from("lead_programas" as never).insert({
                id_lead: (newLead as { id: string }).id,
                id_programa: data.id_programa
            } as never);
        }
        return { success: true, data: newLead as never };
    } catch (e) {
        const error = e as Error;
        console.error("createLead Error:", error.message);
        return { success: false, error: error.message };
    }
}

// ─── GET PROGRAMS ─────────────────────────────────────────────────────────────

export async function getPrograms() {
    try {
        const supabase = await getSupabaseServerClient();
        const { data, error } = await supabase
            .from("programas")
            .select("*")
            .order("nombre");

        if (error) throw new Error(error.message);
        return data || [];
    } catch (e) {
        console.error("getPrograms ERROR:", e);
        return [];
    }
}
