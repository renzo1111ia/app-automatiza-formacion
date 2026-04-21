import type { Tenant } from "./tenant";
export type { Tenant };

// ─── LEAD ────────────────────────────────────────────────────────────────────

export interface Lead {
    id: string;
    tenant_id: string;
    id_lead_externo?: string | null;
    nombre?: string | null;
    apellido?: string | null;
    telefono?: string | null;
    email?: string | null;
    pais?: string | null;
    tipo_lead?: string | null;
    origen?: string | null;
    campana?: string | null;
    foto_url?: string | null;
    is_ai_enabled?: boolean;
    fecha_ingreso_crm?: string | null;
    fecha_creacion?: string | null;
    fecha_actualizacion?: string | null;

    // v2.0 Memory Fields
    current_stage?: 'QUALIFICATION' | 'SCHEDULING' | 'COMPLETED' | 'DROPPED' | string | null;
    metadata?: Record<string, unknown> | null;
    last_interaction_at?: string | null;
    is_ai_paused?: boolean;
    ai_agent_id?: string | null;
    inactivity_sent_count?: number;
}

// ─── LLAMADA (resumen de una llamada individual) ──────────────────────────────

export interface Llamada {
    id: string;
    tenant_id: string;
    id_lead: string;
    id_llamada_retell?: string | null;
    tipo_agente?: string | null;
    nombre_agente?: string | null;
    estado_llamada?: string | null;
    razon_termino?: string | null;
    fecha_inicio?: string | null;
    duracion_segundos?: number | null;
    url_grabacion?: string | null;
    transcripcion?: string | null;
    resumen?: string | null;
    fecha_creacion?: string | null;
    // Joined from `lead`
    lead?: Lead;
}

export type LlamadaConLead = Llamada & { lead: Lead };

/**
 * Resumen de una llamada individual dentro del timeline de un lead.
 * Se usa en HistorialRow.llamadas[].
 */
export interface LlamadaResumen {
    id: string;
    estado_llamada?: string | null;
    razon_termino?: string | null;
    fecha_inicio?: string | null;
    duracion_segundos?: number | null;
    url_grabacion?: string | null;
    resumen?: string | null;
    tipo_agente?: string | null;
    numero_intento?: number | null;   // si existe en intentos_llamadas
}

// ─── INTENTOS LLAMADAS ────────────────────────────────────────────────────────

export interface IntentoLlamada {
    id: string;
    tenant_id: string;
    id_lead: string;
    id_llamada?: string | null;
    tipo_intento?: string | null;   // "LLAMADA" | "WHATSAPP"
    numero_intento?: number | null;
    fecha_reintento?: string | null;
    estado?: string | null;
    fecha_ejecucion?: string | null;
    fecha_creacion?: string | null;
    // Joined
    lead?: Lead;
    llamada?: Llamada;
}

// ─── CONVERSACIONES WHATSAPP ──────────────────────────────────────────────────

export interface ConversacionWhatsapp {
    id: string;
    tenant_id: string;
    id_lead: string;
    id_conversacion_chatwoot?: string | null;
    opt_in_whatsapp?: boolean | null;
    estado?: string | null;
    fecha_ultimo_mensaje?: string | null;
    fecha_creacion?: string | null;
    // Joined
    lead?: Lead;
}

// ─── AGENDAMIENTOS ────────────────────────────────────────────────────────────

export interface Agendamiento {
    id: string;
    tenant_id: string;
    id_lead: string;
    fecha_agendada_cliente?: string | null;
    fecha_agendada_lead?: string | null;
    confirmado?: boolean;
    fecha_creacion?: string | null;
    // Joined
    lead?: Lead;
}

// ─── LEAD CUALIFICACION ───────────────────────────────────────────────────────

export interface LeadCualificacion {
    id: string;
    tenant_id: string;
    id_lead: string;
    id_llamada?: string | null;
    motivo_anulacion?: string | null;
    cualificacion?: string | null;
    calificacion_score?: number | null;
    objeciones?: string | null;
    analisis_profundo?: Record<string, unknown> | null;
    anios_experiencia?: number | null;
    nivel_estudios?: string | null;
    fecha_creacion?: string | null;
    // Joined
    lead?: Lead;
    llamada?: Llamada;
}

// ─── PROGRAMAS ────────────────────────────────────────────────────────────────

export interface Programa {
    id: string;
    tenant_id: string;
    nombre: string;
    id_producto?: string | null;
    presentacion?: string | null;
    objetivos?: string | null;
    precio?: string | null;
    becas_financiacion?: string | null;
    metodologia?: string | null;
    beneficios?: string | null;
    practicas?: string | null;
    fechas_inicio?: string | null;
    requisitos_cualificacion?: string | null;
    fecha_creacion?: string | null;
}

export interface LeadPrograma {
    id: string;
    id_lead: string;
    id_programa: string;
    fecha_creacion?: string | null;
    // Joined
    lead?: Lead;
    programa?: Programa;
}

export interface AdvisorPrograma {
    id: string;
    advisor_id: string;
    programa_id: string;
    created_at?: string;
}

// ─── NOTIFICACIONES ───────────────────────────────────────────────────────────

export interface Notificacion {
    id: string;
    tenant_id: string;
    id_lead: string;
    tipo: string;
    fecha_envio?: string | null;
    metadatos?: Record<string, unknown> | null;
    fecha_creacion?: string | null;
    // Joined
    lead?: Lead;
}

// ─── CAMPANAS ────────────────────────────────────────────────────────────────

export interface Campana {
    id: string;
    tenant_id: string;
    nombre: string;
    descripcion?: string | null;
    estado?: string | null; // "ACTIVA", "PAUSADA", "FINALIZADA"
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    agente_texto_id?: string | null;
    agente_llamada_id?: string | null;
    fecha_creacion?: string | null;
}

// ─── NEW V2.0 TABLES ─────────────────────────────────────────────────────────

export interface OrchestrationRule {
    id: string;
    tenant_id: string;
    workflow_id: string;
    step_name: string;
    action_type: string;
    sequence_order: number;
    config?: Record<string, unknown> | null;
    is_active?: boolean;
    created_at?: string;
}

export interface Workflow {
    id: string;
    tenant_id: string;
    name: string;
    description?: string | null;
    is_active?: boolean;
    is_primary?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface OrchestrationGraph {
    id: string;
    tenant_id: string;
    workflow_id: string;
    graph_data: unknown;
    updated_at?: string;
}

export interface PlannedAction {
    id: string;
    tenant_id: string;
    lead_id: string;
    workflow_id: string;
    action_type: string;
    config: Record<string, unknown> | null;
    scheduled_for: string;
    status: string;
    error_message?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface AIAgent {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    type: 'QUALIFY' | 'REMINDER' | 'CLOSER' | 'SUPPORT';
    status: 'ACTIVE' | 'PAUSED';
    flow_config: {
        nodes: unknown[];
        edges: unknown[];
    } | null;
    created_at: string;
    updated_at: string;
}

export interface AIAgentVariant {
    id: string;
    agent_id: string;
    version_label: string;
    prompt_text: string;
    model_provider?: 'OPENAI' | 'ANTHROPIC' | 'GEMINI';
    model_name?: string;
    api_key?: string;
    knowledge_base_id?: string | null;
    is_active: boolean;
    is_variant_b: boolean;
    weight: number;
    metrics: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface FeatureFlag {
    id: string;
    tenant_id?: string | null;
    flag_key: string;
    is_enabled: boolean;
    metadata?: Record<string, unknown> | null;
    created_at?: string;
}

// ─── RETELL TYPES ─────────────────────────────────────────────────────────────

export interface RetellTool {
    type: string;
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    url?: string; // for webhooks
}

export interface RetellEdge {
    destination_state_name: string;
    description: string;
    conditions?: unknown[];
}

export interface RetellState {
    name: string;
    state_prompt: string;
    edges?: RetellEdge[];
    tools?: RetellTool[];
}

export interface RetellLLMConfig {
    model: string;
    general_prompt: string;
    states?: RetellState[];
    tools?: RetellTool[];
    begin_message?: string;
    [key: string]: unknown; // fallback for other Retell props
}

export interface VoiceAgent {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    status: 'ACTIVE' | 'PAUSED';
    provider: 'RETELL' | 'ULTRAVOX' | 'INTERNAL';
    provider_agent_id: string | null;
    voice_id: string | null;
    from_number: string | null;
    retell_llm_id: string | null;
    prompt_text_retell: string | null;
    retell_llm_config: RetellLLMConfig | null;
    created_at: string;
    updated_at: string;
}

export interface VoiceAgentVariant {
    id: string;
    agent_id: string;
    version_label: string;
    prompt_text: string;
    is_active: boolean;
    is_variant_b: boolean;
    weight: number;
    metrics: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

// ─── CLIENT CONFIG (v2.0) ────────────────────────────────────────────────────────

export interface ClientConfig {
    id: string;
    tenant_id: string;
    routing_rules: {
        allowed_campaigns: string[];
        allowed_origins: string[];
        drop_invalid_leads: boolean;
        contact_sequence: ("whatsapp" | "call")[];
    };
    rescue_config: {
        enabled: boolean;
        wait_minutes: number;
        template_id: string;
    };
    timezone_config: {
        default_timezone: string;
        compliance_start: string; // e.g., "09:00"
        compliance_end: string;   // e.g., "21:00"
    };
    created_at: string;
    updated_at: string;
}

// ─── COMBINED / VIEW TYPES ────────────────────────────────────────────────────

/**
 * Una fila del Historial = UN LEAD con toda su actividad consolidada.
 */
export interface HistorialRow {
    // ── Identidad del lead ──
    id: string;             // lead.id (clave única, sin duplicados)
    nombre?: string | null;
    apellido?: string | null;
    telefono?: string | null;
    email?: string | null;
    pais?: string | null;
    tipo_lead?: string | null;  // string libre: "nuevo", "ilocalizable", "localizable", ...
    origen?: string | null;
    campana?: string | null;
    fecha_ingreso_crm?: string | null;

    // ── Resumen de la ÚLTIMA llamada (o la más relevante) ──
    estado_llamada?: string | null;
    razon_termino?: string | null;
    fecha_inicio?: string | null;       // fecha de la última llamada
    duracion_segundos?: number | null;
    url_grabacion?: string | null;
    resumen?: string | null;
    tipo_agente?: string | null;

    // ── Cualificación (la más reciente) ──
    cualificacion?: string | null;
    motivo_anulacion?: string | null;
    anios_experiencia?: number | null;
    nivel_estudios?: string | null;

    // ── Agendamiento confirmado (el más próximo) ──
    fecha_agendada_cliente?: string | null;
    confirmado?: boolean | null;

    // ── Related Module Data (New) ──
    programa_nombre?: string | null;
    intentos_count: number;
    whatsapp_status?: string | null;
    opt_in_whatsapp?: boolean | null;
    notificaciones_status?: string | null;

    // v2.0 Memory Fields
    current_stage?: string | null;
    metadata?: Record<string, unknown> | null;

    // ── Computed ──
    tiempo_respuesta_minutos?: number | null;  // primera llamada - fecha_ingreso_crm
    fecha_primer_contacto?: string | null;     // MIN(llamada, whatsapp)

    // ── Historial completo de llamadas/reintentos de este lead ──
    llamadas: LlamadaResumen[];        // todas las llamadas, orden desc
    total_llamadas: number;            // = llamadas.length

    // ── Dynamic / Extra Fields ──
    [key: string]: unknown;
}

/** Supabase database shape (for createClient generic) */
export type Database = {
    public: {
        Tables: {
            lead: { Row: Lead; Insert: Omit<Lead, "id" | "fecha_creacion" | "fecha_actualizacion">; Update: Partial<Lead>; };
            llamadas: { Row: Llamada; Insert: Omit<Llamada, "id" | "fecha_creacion">; Update: Partial<Llamada>; };
            intentos_llamadas: { Row: IntentoLlamada; Insert: Omit<IntentoLlamada, "id" | "fecha_creacion">; Update: Partial<IntentoLlamada>; };
            conversaciones_whatsapp: { Row: ConversacionWhatsapp; Insert: Omit<ConversacionWhatsapp, "id" | "fecha_creacion">; Update: Partial<ConversacionWhatsapp>; };
            agendamientos: { Row: Agendamiento; Insert: Omit<Agendamiento, "id" | "fecha_creacion">; Update: Partial<Agendamiento>; };
            lead_cualificacion: { Row: LeadCualificacion; Insert: Omit<LeadCualificacion, "id" | "fecha_creacion">; Update: Partial<LeadCualificacion>; };
            programas: { Row: Programa; Insert: Omit<Programa, "id" | "fecha_creacion">; Update: Partial<Programa>; };
            lead_programas: { Row: LeadPrograma; Insert: Omit<LeadPrograma, "id" | "fecha_creacion">; Update: Partial<LeadPrograma>; };
            advisor_programas: { Row: AdvisorPrograma; Insert: Omit<AdvisorPrograma, "id" | "created_at">; Update: Partial<AdvisorPrograma>; };
            notificaciones: { Row: Notificacion; Insert: Omit<Notificacion, "id" | "fecha_creacion">; Update: Partial<Notificacion>; };
            campanas: { Row: Campana; Insert: Omit<Campana, "id" | "fecha_creacion">; Update: Partial<Campana>; };
            orchestration_rules: { Row: OrchestrationRule; Insert: Omit<OrchestrationRule, "id" | "created_at">; Update: Partial<OrchestrationRule>; };
            feature_flags: { Row: FeatureFlag; Insert: Omit<FeatureFlag, "id" | "created_at">; Update: Partial<FeatureFlag>; };
            workflows: { Row: Workflow; Insert: Omit<Workflow, "id" | "created_at" | "updated_at">; Update: Partial<Workflow>; };
            orchestration_graphs: { Row: OrchestrationGraph; Insert: Omit<OrchestrationGraph, "id" | "updated_at">; Update: Partial<OrchestrationGraph>; };
            planned_actions: { Row: PlannedAction; Insert: Omit<PlannedAction, "id" | "created_at" | "updated_at">; Update: Partial<PlannedAction>; };
            ai_agents: { Row: AIAgent; Insert: Omit<AIAgent, "id" | "created_at" | "updated_at">; Update: Partial<AIAgent>; };
            ai_agent_variants: { Row: AIAgentVariant; Insert: Omit<AIAgentVariant, "id" | "created_at" | "updated_at">; Update: Partial<AIAgentVariant>; };
            voice_agents: { Row: VoiceAgent; Insert: Omit<VoiceAgent, "id" | "created_at" | "updated_at">; Update: Partial<VoiceAgent>; };
            voice_agent_variants: { Row: VoiceAgentVariant; Insert: Omit<VoiceAgentVariant, "id" | "created_at" | "updated_at">; Update: Partial<VoiceAgentVariant>; };
            tenant_orchestrator_config: { Row: { id: string; tenant_id: string; config: Record<string, unknown>; created_at: string; updated_at: string }; Insert: { tenant_id: string; config: Record<string, unknown> }; Update: { config?: Record<string, unknown> }; };
            advisors: { Row: { id: string; tenant_id: string; name: string; email: string | null; phone: string | null; is_active: boolean; created_at: string }; Insert: { tenant_id: string; name: string; email?: string | null; phone?: string | null; is_active?: boolean }; Update: Partial<{ name: string; email: string | null; phone: string | null; is_active: boolean }>; };
            client_configs: { Row: ClientConfig; Insert: Omit<ClientConfig, "id" | "created_at" | "updated_at">; Update: Partial<ClientConfig>; };
            availability_slots: { Row: { id: string; advisor_id: string; day_of_week: number; start_time: string; end_time: string; slot_duration_minutes: number }; Insert: { advisor_id: string; day_of_week: number; start_time: string; end_time: string; slot_duration_minutes?: number }; Update: Partial<{ day_of_week: number; start_time: string; end_time: string }>; };
            appointments: { Row: { id: string; tenant_id: string; advisor_id: string; lead_id: string | null; scheduled_at: string; duration_minutes: number; status: string; notes: string | null; agent_used: string | null; ab_variant: string | null; created_at: string; updated_at: string; watchdog_processed: boolean }; Insert: { tenant_id: string; advisor_id: string; lead_id?: string | null; scheduled_at: string; duration_minutes?: number; status?: string; notes?: string | null; agent_used?: string | null; ab_variant?: string | null; watchdog_processed?: boolean }; Update: Partial<{ status: string; notes: string | null; updated_at: string; watchdog_processed: boolean }>; };
            orchestration_logs: { Row: { id: string; tenant_id: string; lead_id: string | null; workflow_id: string | null; step_number: number; action_type: string; agent_used: string | null; ab_variant: string | null; result: string; error_message: string | null; metadata: Record<string, unknown>; executed_at: string }; Insert: { tenant_id: string; lead_id?: string | null; workflow_id?: string | null; step_number: number; action_type: string; agent_used?: string | null; ab_variant?: string | null; result: string; error_message?: string | null; metadata?: Record<string, unknown> }; Update: Partial<{ result: string }>; };
            chat_messages: { Row: { id: string; tenant_id: string; lead_id: string; direction: string; message_type: string; content: string; sent_by: string | null; status: string; created_at: string; metadata: Record<string, unknown> }; Insert: Omit<{ id: string; tenant_id: string; lead_id: string; direction: string; message_type: string; content: string; sent_by: string | null; status: string; created_at: string; metadata: Record<string, unknown> }, 'id' | 'created_at'>; Update: Partial<{ status: string; metadata: Record<string, unknown> }>; };
            tenants: { Row: Tenant; Insert: Omit<Tenant, "id" | "created_at" | "updated_at">; Update: Partial<Tenant>; };
        };

        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
