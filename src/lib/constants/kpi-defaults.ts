import { KpiConfig, ChartConfig } from "@/types/tenant";

/**
 * Default KPIs mapped to the new normalized schema.
 * staticKey values correspond to fields in KpiGenerales interface from analytics.ts
 */

// ─── GENERAL KPIs ─────────────────────────────────────────────────────────────

export const DEFAULT_SUMMARY_KPIS: KpiConfig[] = [
    // ── GRUPO 1: VOLUMEN Y CONTACTO ─────────────────────────────────────────
    {
        id: 'def-1',
        label: 'Llamadas realizadas',
        icon: 'PhoneCall',
        color: 'bg-blue-600',
        size: '3',
        staticKey: 'total_llamadas',
        isVisible: true,
        group: 'Informes',
    },
    {
        id: 'def-2',
        label: 'Llamadas conectadas',
        icon: 'Phone',
        color: 'bg-indigo-600',
        size: '3',
        staticKey: 'total_leads',
        isVisible: true,
        group: 'Informes',
    },
    {
        id: 'def-3',
        label: 'Llamadas fallidas',
        icon: 'PhoneOff',
        color: 'bg-emerald-600',
        size: '3',
        staticKey: 'total_contactados',
        isVisible: true,
        group: 'Informes',
    },
    {
        id: 'def-4',
        label: 'Tasa de contacto',
        icon: 'Percent',
        color: 'bg-teal-600',
        size: '3',
        staticKey: 'tasa_contacto',
        isVisible: true,
        suffix: '%',
        group: 'Informes',
    },

    // ── GRUPO 2: PERFORMANCE Y CONVERSIÓN ────────────────────────────────────
    {
        id: 'def-7',
        label: 'Citas Agendadas',
        icon: 'Calendar',
        color: 'bg-orange-600',
        size: '3',
        staticKey: 'total_agendados',
        isVisible: true,
        group: 'PERFORMANCE Y CONVERSIÓN',
    },
    {
        id: 'def-12',
        label: 'Tasa de agenda',
        icon: 'TrendingUp',
        color: 'bg-orange-500',
        size: '3',
        staticKey: 'tasa_agendamiento',
        isVisible: true,
        suffix: '%',
        group: 'PERFORMANCE Y CONVERSIÓN',
    },
    {
        id: 'def-8',
        label: 'Leads Cualificados',
        icon: 'Star',
        color: 'bg-yellow-500',
        size: '3',
        staticKey: 'total_cualificados',
        isVisible: true,
        group: 'PERFORMANCE Y CONVERSIÓN',
    },
    {
        id: 'def-13',
        label: 'Tasa de conversión',
        icon: 'Target',
        color: 'bg-yellow-600',
        size: '3',
        staticKey: 'tasa_conversion',
        isVisible: true,
        suffix: '%',
        group: 'PERFORMANCE Y CONVERSIÓN',
    },

    // ── GRUPO 3: PRODUCTIVIDAD IA ──────────────────────────────────────────
    {
        id: 'def-5',
        label: 'Total Minutos IA',
        icon: 'Clock',
        color: 'bg-purple-600',
        size: '4',
        staticKey: 'total_segundos',
        isVisible: true,
        group: 'PRODUCTIVIDAD IA',
    },
    {
        id: 'def-6',
        label: 'Duración media',
        icon: 'Clock',
        color: 'bg-cyan-600',
        size: '4',
        staticKey: 'duracion_media_segundos',
        isVisible: true,
        suffix: ' seg',
        group: 'PRODUCTIVIDAD IA',
    },
    {
        id: 'def-11',
        label: 'T. Respuesta Promedio',
        icon: 'Zap',
        color: 'bg-amber-600',
        size: '4',
        staticKey: 'tiempo_respuesta_promedio_minutos',
        isVisible: true,
        suffix: ' min',
        group: 'PRODUCTIVIDAD IA',
    },

    // ── GRUPO 4: AHORRO Y EFICIENCIA ───────────────────────────────────────
    {
        id: 'def-16',
        label: 'Horas Ahorradas',
        icon: 'Clock',
        color: 'bg-blue-500',
        size: '12',
        staticKey: 'tiempo_ahorrado_formateado',
        isVisible: true,
        group: 'AHORRO Y EFICIENCIA',
    },

    // ── GRUPO 5: FILTROS Y NEGATIVOS ───────────────────────────────────────
    {
        id: 'def-9',
        label: 'No Cualificados',
        icon: 'UserMinus',
        color: 'bg-rose-600',
        size: '4',
        staticKey: 'total_no_cualificados',
        isVisible: true,
        group: 'FILTROS Y NEGATIVOS',
    },
    {
        id: 'def-10',
        label: 'Sin Contacto',
        icon: 'PhoneMissed',
        color: 'bg-slate-500',
        size: '4',
        staticKey: 'total_no_contacto',
        isVisible: true,
        group: 'FILTROS Y NEGATIVOS',
    },
    {
        id: 'def-14',
        label: '% Ilocalizables',
        icon: 'UserX',
        color: 'bg-gray-600',
        size: '4',
        staticKey: 'tasa_ilocalizables',
        isVisible: true,
        suffix: '%',
        group: 'FILTROS Y NEGATIVOS',
    },
];

// ─── DEFAULT CHARTS ───────────────────────────────────────────────────────────

export const DEFAULT_CHARTS: ChartConfig[] = [
    { id: 'ch-1', type: 'donut', title: 'Motivo de Anulación', dataKey: 'dynamic', xKey: 'lead_cualificacion.motivo_anulacion', size: '6', isVisible: true, isDonut: true },
    { id: 'ch-2', type: 'area', title: 'Citas Agendadas por Fecha', dataKey: 'dynamic', xKey: 'agendamientos.fecha_agendada_cliente', size: '6', isVisible: true },
    { id: 'ch-3', type: 'vertical-bar', title: 'Estado de Llamadas', dataKey: 'dynamic', xKey: 'llamadas.estado_llamada', size: '6', isVisible: true },
    { id: 'ch-4', type: 'vertical-bar', title: 'Razón de Término', dataKey: 'dynamic', xKey: 'llamadas.razon_termino', size: '6', isVisible: true },
    { id: 'ch-5', type: 'donut', title: 'Tipo de Lead', dataKey: 'dynamic', xKey: 'lead.tipo_lead', size: '6', isVisible: true },
    { id: 'ch-6', type: 'vertical-bar', title: 'Leads por Origen', dataKey: 'dynamic', xKey: 'lead.origen', size: '6', isVisible: true },
    { id: 'ch-7', type: 'donut', title: 'Cualificación de Leads', dataKey: 'dynamic', xKey: 'lead_cualificacion.cualificacion', size: '6', isVisible: true },
    { id: 'ch-8', type: 'area', title: 'Leads Ingresados por Fecha', dataKey: 'dynamic', xKey: 'lead.fecha_ingreso_crm', size: '6', isVisible: true },
];

// ─── LLAMADAS KPIs ────────────────────────────────────────────────────────────

export const LLAMADAS_KPIS: KpiConfig[] = [
    { id: 'll-1', label: 'Total Llamadas', icon: 'Phone', color: 'bg-blue-600', size: '4', staticKey: 'total_llamadas', isVisible: true },
    { id: 'll-2', label: 'Contactados', icon: 'PhoneCall', color: 'bg-emerald-600', size: '4', staticKey: 'total_contactados', isVisible: true },
    { id: 'll-3', label: 'Sin Contacto', icon: 'PhoneMissed', color: 'bg-red-600', size: '4', staticKey: 'total_no_contacto', isVisible: true },
    { id: 'll-4', label: 'Total Minutos IA', icon: 'Clock', color: 'bg-purple-600', size: '4', staticKey: 'total_segundos', isVisible: true, valType: 'duration' },
    { id: 'll-5', label: 'Duración Media', icon: 'Timer', color: 'bg-cyan-600', size: '4', staticKey: 'duracion_media_segundos', isVisible: true, valType: 'duration' },
    { id: 'll-6', label: 'Tasa Contacto', icon: 'TrendingUp', color: 'bg-teal-600', size: '4', staticKey: 'tasa_contacto', isVisible: true, suffix: '%' },
    { id: 'll-7', label: '% Agenda', icon: 'Calendar', color: 'bg-orange-600', size: '4', staticKey: 'tasa_agendamiento', isVisible: true, suffix: '%' },
    { id: 'll-8', label: '% Conversión', icon: 'Target', color: 'bg-yellow-600', size: '4', staticKey: 'tasa_conversion', isVisible: true, suffix: '%' },
];

// ─── FUNNEL DEFAULT ─────────────────────────────────────────────────────────────

export const DEFAULT_FUNNEL: KpiConfig[] = [
    { id: 'fnl-1', label: 'Leads Ingresados', icon: 'Users', color: 'bg-blue-600', size: '12', staticKey: 'total_leads', isVisible: true, group: 'FUNNEL', order: 1 },
    { id: 'fnl-2', label: 'Leads Alcanzados', icon: 'Phone', color: 'bg-blue-500', size: '12', staticKey: 'total_leads_alcanzados', isVisible: true, group: 'FUNNEL', order: 2 },
    { id: 'fnl-3', label: 'Atendidas', icon: 'PhoneCall', color: 'bg-emerald-600', size: '12', staticKey: 'total_contactados', isVisible: true, group: 'FUNNEL', order: 3 },
    { id: 'fnl-4', label: 'Cualificados', icon: 'Star', color: 'bg-emerald-500', size: '12', staticKey: 'total_cualificados', isVisible: true, group: 'FUNNEL', order: 4 },
    { id: 'fnl-5', label: 'Agendas', icon: 'Calendar', color: 'bg-slate-500', size: '12', staticKey: 'total_agendados', isVisible: true, group: 'FUNNEL', order: 5 },
];

export const CAMPANAS_FUNNEL: KpiConfig[] = [
    { id: 'cp-fnl-1', label: 'Leads Ingresados', icon: 'Users', color: 'bg-blue-600', size: '12', staticKey: 'total_leads', isVisible: true, group: 'FUNNEL', order: 1 },
    { id: 'cp-fnl-2', label: 'Leads Alcanzados', icon: 'Phone', color: 'bg-blue-500', size: '12', staticKey: 'total_leads_alcanzados', isVisible: true, group: 'FUNNEL', order: 2 },
    { id: 'cp-fnl-3', label: 'Atendidas', icon: 'PhoneCall', color: 'bg-emerald-600', size: '12', staticKey: 'total_contactados', isVisible: true, group: 'FUNNEL', order: 3 },
    { id: 'cp-fnl-4', label: 'Cualificados', icon: 'Star', color: 'bg-emerald-500', size: '12', staticKey: 'total_cualificados', isVisible: true, group: 'FUNNEL', order: 4 },
    { id: 'cp-fnl-5', label: 'Agendas', icon: 'Calendar', color: 'bg-slate-500', size: '12', staticKey: 'total_agendados', isVisible: true, group: 'FUNNEL', order: 5 },
];

// ─── WHATSAPP KPIs ────────────────────────────────────────────────────────────

export const WHATSAPP_KPIS: KpiConfig[] = [
    { id: 'ws-1', label: 'Leads con WhatsApp', icon: 'MessageCircle', color: 'bg-blue-600', size: '4', staticKey: 'total_leads_unicos', isVisible: true },
    { id: 'ws-3', label: 'Agendados', icon: 'Calendar', color: 'bg-orange-600', size: '4', staticKey: 'total_agendados', isVisible: true },
    { id: 'ws-4', label: '% Agenda', icon: 'PieChart', color: 'bg-orange-500', size: '4', staticKey: 'tasa_agendamiento', isVisible: true, suffix: '%' },
    { id: 'ws-2', label: 'Cualificados', icon: 'Star', color: 'bg-yellow-600', size: '4', staticKey: 'total_cualificados', isVisible: true },
    { id: 'ws-5', label: '% Conversión', icon: 'Target', color: 'bg-yellow-700', size: '4', staticKey: 'tasa_conversion', isVisible: true, suffix: '%' },
    { id: 'ws-6', label: '% Ilocalizables', icon: 'UserX', color: 'bg-gray-600', size: '4', staticKey: 'tasa_ilocalizables', isVisible: true, suffix: '%' },
];

// ─── CAMPAÑAS KPIs ────────────────────────────────────────────────────────────

export const CAMPANAS_KPIS: KpiConfig[] = [
    { id: 'cp-1', label: 'Total Leads', icon: 'Users', color: 'bg-blue-600', size: '4', staticKey: 'total_leads', isVisible: true },
    { id: 'cp-2', label: 'Contactados', icon: 'PhoneCall', color: 'bg-emerald-600', size: '4', staticKey: 'total_contactados', isVisible: true },
    { id: 'cp-3', label: 'Cualificados', icon: 'Star', color: 'bg-yellow-600', size: '4', staticKey: 'total_cualificados', isVisible: true },
    { id: 'cp-4', label: 'Agendados', icon: 'Calendar', color: 'bg-teal-600', size: '4', staticKey: 'total_agendados', isVisible: true },
    { id: 'cp-5', label: 'No Cualificados', icon: 'UserMinus', color: 'bg-rose-600', size: '4', staticKey: 'total_no_cualificados', isVisible: true },
    { id: 'cp-6', label: 'T. Respuesta', icon: 'Zap', color: 'bg-amber-600', size: '4', staticKey: 'total_segundos', isVisible: true },
];

// ─── DEFAULT CHARTS PER MODULE ────────────────────────────────────────────────

export const CAMPANAS_CHARTS: ChartConfig[] = [
    { id: 'cp-ch-1', type: 'area', title: 'Leads por Fecha', dataKey: 'dynamic', xKey: 'lead.fecha_ingreso_crm', size: '6', isVisible: true },
    { id: 'cp-ch-2', type: 'vertical-bar', title: 'Leads por Origen', dataKey: 'dynamic', xKey: 'lead.origen', size: '6', isVisible: true },
    { id: 'cp-ch-3', type: 'donut', title: 'Tipo de Lead', dataKey: 'dynamic', xKey: 'lead.tipo_lead', size: '6', isVisible: true },
    { id: 'cp-ch-4', type: 'area', title: 'Primer Contacto por Fecha', dataKey: 'dynamic', xKey: 'llamadas.fecha_inicio', size: '6', isVisible: true },
];

export const DEFAULT_CHARTS_LLAMADAS: ChartConfig[] = [
    { id: 'll-ch-1', type: 'area', title: 'Llamadas por Fecha', dataKey: 'dynamic', xKey: 'llamadas.fecha_inicio', size: '6', isVisible: true },
    { id: 'll-ch-2', type: 'vertical-bar', title: 'Estado de Llamadas', dataKey: 'dynamic', xKey: 'llamadas.estado_llamada', size: '6', isVisible: true },
    { id: 'll-ch-3', type: 'vertical-bar', title: 'Razón de Término', dataKey: 'dynamic', xKey: 'llamadas.razon_termino', size: '6', isVisible: true },
    { id: 'll-ch-4', type: 'donut', title: 'Tipo de Agente', dataKey: 'dynamic', xKey: 'llamadas.tipo_agente', size: '6', isVisible: true },
];

export const DEFAULT_CHARTS_WHATSAPP: ChartConfig[] = [
    { id: 'ws-ch-1', type: 'area', title: 'Conversaciones por Fecha', dataKey: 'dynamic', xKey: 'conversaciones_whatsapp.fecha_ultimo_mensaje', size: '6', isVisible: true },
    { id: 'ws-ch-2', type: 'donut', title: 'Cualificación de Leads', dataKey: 'dynamic', xKey: 'lead_cualificacion.cualificacion', size: '6', isVisible: true },
    { id: 'ws-ch-3', type: 'vertical-bar', title: 'Leads por Origen', dataKey: 'dynamic', xKey: 'lead.origen', size: '6', isVisible: true },
    { id: 'ws-ch-4', type: 'vertical-bar', title: 'Leads por Tipo', dataKey: 'dynamic', xKey: 'lead.tipo_lead', size: '6', isVisible: true },
];
