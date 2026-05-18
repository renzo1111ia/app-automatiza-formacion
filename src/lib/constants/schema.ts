import { 
    Activity, Users, PhoneCall, Calendar, CheckSquare, 
    AlertCircle, MessageSquare, Clock, BarChart3, TrendingUp,
    Shield, UserCheck, PhoneIncoming, PhoneOutgoing,
    PieChart, Layout, Settings, Check, Database,
    Bot, Percent, Plus, Save, X, GripVertical,
    ChevronRight, ArrowRight, Search, Filter, Table, Hash,
    Megaphone, Phone, PhoneMissed, UserX, PhoneOff, Voicemail,
    UserMinus, ThumbsDown, Star, Target, MessageCircle, Zap, Timer, Trash2,
    LayoutGrid, AreaChart, Maximize2, Edit3, ChevronUp, ChevronDown, EyeOff, Eye
} from "lucide-react";

export const SCHEMA_COLUMNS: Record<string, string[]> = {
    lead: ["id", "id_lead_externo", "nombre", "apellido", "telefono", "email", "pais", "tipo_lead", "origen", "campana", "fecha_ingreso_crm", "fecha_actualizacion"],
    llamadas: ["id", "id_lead", "id_llamada_retell", "tipo_agente", "nombre_agente", "estado_llamada", "razon_termino", "fecha_inicio", "duracion_segundos", "url_grabacion", "transcripcion", "resumen", "fecha_creacion"],
    agendamientos: ["id", "id_lead", "fecha_agendada_cliente", "fecha_agendada_lead", "confirmado", "fecha_creacion"],
    lead_cualificacion: ["id", "id_lead", "id_llamada", "motivo_anulacion", "cualificacion", "anios_experiencia", "nivel_estudios", "fecha_creacion"],
    intentos_llamadas: ["id", "id_lead", "id_llamada", "tipo_intento", "numero_intento", "fecha_reintento", "estado", "fecha_ejecucion", "fecha_creacion"],
    conversaciones_whatsapp: ["id", "id_lead", "id_conversacion_chatwoot", "opt_in_whatsapp", "estado", "fecha_ultimo_mensaje", "fecha_creacion"],
};

export const AVAILABLE_COLORS = [
    { name: "Blue", class: "bg-blue-600" },
    { name: "Indigo", class: "bg-indigo-600" },
    { name: "Purple", class: "bg-purple-600" },
    { name: "Violet", class: "bg-violet-600" },
    { name: "Emerald", class: "bg-emerald-600" },
    { name: "Teal", class: "bg-teal-600" },
    { name: "Cyan", class: "bg-cyan-600" },
    { name: "Orange", class: "bg-orange-600" },
    { name: "Rose", class: "bg-rose-600" },
    { name: "Slate", class: "bg-slate-600" },
    { name: "Zinc", class: "bg-zinc-800" },
];

export const COL_SPAN_MAP: Record<string, string> = {
    "1": "md:col-span-1",
    "2": "md:col-span-2",
    "3": "md:col-span-3",
    "4": "md:col-span-4",
    "5": "md:col-span-5",
    "6": "md:col-span-6",
    "8": "md:col-span-8",
    "9": "md:col-span-9",
    "12": "md:col-span-12",
};

import { LucideIcon } from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
    Activity, Users, PhoneCall, Calendar, CheckSquare, 
    AlertCircle, MessageSquare, Clock, BarChart3, TrendingUp,
    Shield, UserCheck, PhoneIncoming, PhoneOutgoing,
    PieChart, Layout, Settings, Check, Database,
    Bot, Percent, Plus, Save, X, GripVertical,
    ChevronRight, ArrowRight, Search, Filter, Table, Hash,
    Megaphone, Phone, PhoneMissed, UserX, PhoneOff, Voicemail,
    UserMinus, ThumbsDown, Star, Target, MessageCircle, Zap, Timer, Trash2,
    LayoutGrid, AreaChart, Maximize2, Edit3, ChevronUp, ChevronDown, EyeOff, Eye
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);
