"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Calendar, Users, Clock, Check, X, Plus,
    ChevronLeft, ChevronRight,
    Pencil, Trash2, Phone, Mail, RotateCcw, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getAdvisors, saveAdvisor, deleteAdvisor,
    getAdvisorSlots, saveAdvisorSlots,
    getAppointments, updateAppointmentStatus,
    createAppointment, cancelAppointment, rescheduleAppointment, checkAvailability,
    type Advisor, type Appointment
} from "@/lib/actions/scheduling";
import { getInboxLeads, type InboxLead } from "@/lib/actions/inbox";
import { Wrench, Search, CalendarPlus, CalendarRange, CalendarX, Terminal } from "lucide-react";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAYS_DB_MAP = [1, 2, 3, 4, 5, 6, 0]; // Monday=1, Sunday=0 for DB

const STATUS_CONFIG = {
    PENDING:   { label: "Pendiente",  color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    CONFIRMED: { label: "Confirmada", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    CANCELLED: { label: "Cancelada",  color: "text-red-400 bg-red-500/10 border-red-500/20" },
    COMPLETED: { label: "Completada", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    NO_SHOW:   { label: "No apareció",color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
};

type Tab = "agenda" | "advisors" | "slots" | "tools";

export default function CalendarPage() {
    const [tab, setTab] = useState<Tab>("agenda");
    const [advisors, setAdvisors] = useState<Advisor[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
    const [editingAdvisor, setEditingAdvisor] = useState<Partial<Advisor> | null>(null);
    const [slots, setSlots] = useState<Record<number, { active: boolean, start: string, end: string }>>({}); // dayOfWeek → config
    const [saving, setSaving] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);
    const [leads, setLeads] = useState<InboxLead[]>([]);
    const [toolLog, setToolLog] = useState<{ action: string; result: unknown; time: string }[]>([]);
    
    // Tool states
    const [toolLeadId, setToolLeadId] = useState("");
    const [toolAdvisorId, setToolAdvisorId] = useState("");
    const [toolDate, setToolDate] = useState(new Date().toISOString().split('T')[0]);
    const [toolTime, setToolTime] = useState("10:00");

    const loadData = useCallback(async () => {
        const [advisorsRes, aptsRes, leadsRes] = await Promise.all([
            getAdvisors(),
            getAppointments(),
            getInboxLeads()
        ]);
        if (advisorsRes.success && advisorsRes.data) {
            setAdvisors(advisorsRes.data);
        }
        if (aptsRes.success && aptsRes.data) setAppointments(aptsRes.data);
        if (leadsRes.success && leadsRes.data) setLeads(leadsRes.data);
    }, []);

    const loadSlots = useCallback(async (advisorId: string) => {
        const res = await getAdvisorSlots(advisorId);
        if (res.success && res.data) {
            const map: Record<number, { active: boolean, start: string, end: string }> = {};
            res.data.forEach(s => { 
                map[s.day_of_week] = { 
                    active: true, 
                    start: s.start_time || "09:00", 
                    end: s.end_time || "20:00" 
                }; 
            });
            setSlots(map);
        }
    }, []);

    useEffect(() => { 
        let isMounted = true;
        const init = async () => {
            const [advisorsRes, aptsRes, leadsRes] = await Promise.all([
                getAdvisors(),
                getAppointments(),
                getInboxLeads()
            ]);
            if (!isMounted) return;
            if (advisorsRes.success && advisorsRes.data) setAdvisors(advisorsRes.data);
            if (aptsRes.success && aptsRes.data) setAppointments(aptsRes.data);
            if (leadsRes.success && leadsRes.data) setLeads(leadsRes.data);
        };
        void init();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!selectedAdvisor && advisors.length > 0) {
            const first = advisors[0];
            const timer = setTimeout(() => {
                setSelectedAdvisor(first);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [advisors, selectedAdvisor]);

    useEffect(() => { 
        let isMounted = true;
        if (selectedAdvisor) {
            getAdvisorSlots(selectedAdvisor.id).then(res => {
                if (!isMounted) return;
                if (res.success && res.data) {
                    const map: Record<number, { active: boolean, start: string, end: string }> = {};
                    res.data.forEach(s => { 
                        map[s.day_of_week] = { 
                            active: true, 
                            start: s.start_time || "09:00", 
                            end: s.end_time || "20:00" 
                        }; 
                    });
                    setSlots(map);
                }
            });
        }
        return () => { isMounted = false; };
    }, [selectedAdvisor]);

    // Build week display
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7); // Monday
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    const getAppointmentsForDay = (date: Date) => appointments.filter(apt => {
        const aptDate = new Date(apt.scheduled_at);
        // Compare year, month, date to be precise
        return aptDate.getFullYear() === date.getFullYear() &&
               aptDate.getMonth() === date.getMonth() &&
               aptDate.getDate() === date.getDate();
    });

    async function handleSaveAdvisor() {
        if (!editingAdvisor?.name) return;
        setSaving(true);
        const res = await saveAdvisor(editingAdvisor);
        if (res.error) {
            alert("Error al guardar asesor: " + res.error);
            setSaving(false);
            return;
        }
        setEditingAdvisor(null);
        await loadData();
        setSaving(false);
    }

    async function handleSaveSlots() {
        if (!selectedAdvisor) return;
        setSaving(true);
        const slotsToSave = Object.entries(slots)
            .filter(([, config]) => config.active)
            .map(([day, config]) => ({
                day_of_week: parseInt(day),
                start_time: config.start,
                end_time: config.end,
                slot_duration_minutes: 30,
            }));
        await saveAdvisorSlots(selectedAdvisor.id, slotsToSave);
        setSaving(false);
    }

    async function handleStatusChange(aptId: string, status: string) {
        await updateAppointmentStatus(aptId, status);
        await loadData();
    }

    const addLog = (action: string, result: unknown) => {
        setToolLog(prev => [{ action, result, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    };

    async function testCheckAvailability() {
        if (!toolAdvisorId) return alert("Selecciona un asesor");
        setSaving(true);
        const res = await checkAvailability(toolAdvisorId, toolDate);
        addLog("checkAvailability", res);
        setSaving(false);
    }

    async function testBook() {
        if (!toolLeadId) return alert("Selecciona un lead");
        setSaving(true);
        const scheduledAt = new Date(`${toolDate}T${toolTime}`).toISOString();
        const res = await createAppointment({
            lead_id: toolLeadId,
            advisor_id: toolAdvisorId,
            scheduled_at: scheduledAt,
            status: "PENDING"
        });
        addLog("createAppointment", res);
        if (res.success) await loadData();
        setSaving(false);
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
            {/* HEADER */}
            <div className="px-8 py-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Calendario & Agendas</h1>
                        <p className="text-xs text-slate-500 dark:text-white/40 font-bold uppercase tracking-widest">Round Robin · Asesores · Citas Automáticas</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {(["agenda", "advisors", "slots", "tools"] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            title={t}
                            className={cn(
                                "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                tab === t ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-slate-200/50 dark:bg-white/5 text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/10"
                            )}
                        >
                            {t === "agenda" ? "Agenda" : t === "advisors" ? "Asesores" : t === "slots" ? "Horarios" : "Tools"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-8">

                {/* ── AGENDA TAB ─────────────────────────────────────────── */}
                {tab === "agenda" && (
                    <div className="space-y-6">
                        {/* Week Navigator */}
                        <div className="flex items-center justify-between">
                            <button onClick={() => setWeekOffset(w => w - 1)} title="Semana anterior" className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <h2 className="text-sm font-black uppercase tracking-widest text-white/60">
                                {weekDays[0].toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
                                {" — "}
                                {weekDays[6].toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                            </h2>
                        <div className="flex gap-2">
                                <button onClick={() => setWeekOffset(0)} title="Semana actual" className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white/40">Hoy</button>
                                <button onClick={() => setWeekOffset(w => w + 1)} title="Semana siguiente" className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Week Grid */}
                        <div className="grid grid-cols-7 gap-3">
                            {weekDays.map((day, i) => {
                                const dayApts = getAppointmentsForDay(day);
                                const isToday = day.toDateString() === new Date().toDateString();
                                
                                // Group by time to detect overlaps visually
                                const timeGroups: Record<string, Appointment[]> = {};
                                dayApts.forEach(apt => {
                                    const time = new Date(apt.scheduled_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                                    if (!timeGroups[time]) timeGroups[time] = [];
                                    timeGroups[time].push(apt);
                                });

                                return (
                                    <div key={i} className={cn(
                                        "rounded-2xl border p-4 space-y-2 min-h-[160px]",
                                        isToday ? "border-primary/30 bg-primary/5" : "border-white/5 bg-white/[0.02]"
                                    )}>
                                        <div className="text-center mb-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                                                {day.toLocaleDateString("es-ES", { weekday: 'short' })}
                                            </p>
                                            <p className={cn("text-xl font-black", isToday ? "text-primary" : "text-white/70")}>
                                                {day.getDate()}
                                            </p>
                                        </div>
                                        {dayApts.length === 0 && (
                                            <p className="text-[9px] text-white/10 text-center">Sin citas</p>
                                        )}
                                        {Object.entries(timeGroups).map(([time, apts]) => {
                                            const hasOverlap = apts.length > 1;
                                            return apts.map((apt, idx) => {
                                                const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING;
                                                return (
                                                    <div key={apt.id} className={cn(
                                                        "p-2 rounded-lg border text-[9px] font-bold cursor-pointer hover:scale-[1.02] transition-all relative", 
                                                        sc.color,
                                                        hasOverlap && "border-red-500/50 shadow-[0_0_5px_rgba(239,68,68,0.3)]"
                                                    )}>
                                                        {hasOverlap && idx === 0 && (
                                                            <div className="absolute -top-1.5 -right-1.5 h-4 px-1 rounded-full bg-red-500 text-[8px] text-white flex items-center justify-center font-black animate-pulse z-10">
                                                                ! CONFLICTO
                                                            </div>
                                                        )}
                                                        <div className="font-black">{time}</div>
                                                        <div className="truncate opacity-80">{apt.lead?.nombre} {apt.lead?.apellido}</div>
                                                        <div className="opacity-60">{apt.advisors?.name || "Sin asignar"}</div>
                                                    </div>
                                                );
                                            });
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Appointment List */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-white/30" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Todas las Citas</span>
                                <span className="ml-auto text-[9px] text-white/20 font-bold">{appointments.length} registros</span>
                            </div>
                            {appointments.length === 0 ? (
                                <div className="py-16 text-center text-white/20">
                                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Sin citas programadas</p>
                                    <p className="text-[10px] mt-1 opacity-60">Las citas se crean automáticamente cuando el orquestador cualifica un lead.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {appointments.slice(0, 20).map(apt => {
                                        const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING;
                                        return (
                                            <div key={apt.id} className="px-6 py-4 flex items-center gap-6 hover:bg-white/[0.02] transition-all">
                                                <div className="w-40 flex-shrink-0">
                                                    <p className="text-xs font-bold">
                                                        {new Date(apt.scheduled_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                                                    </p>
                                                    <p className="text-[10px] text-white/40">
                                                        {new Date(apt.scheduled_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                                    </p>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold">{apt.lead?.nombre} {apt.lead?.apellido}</p>
                                                    <p className="text-[10px] text-white/40">{apt.lead?.telefono}</p>
                                                </div>
                                                <div className="text-xs text-white/60 font-medium w-32">{apt.advisors?.name || "Sin asignar"}</div>
                                                {apt.ab_variant && (
                                                    <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-lg font-black">
                                                        {apt.ab_variant === "A" ? "🤖 Agente A" : "🤖 Agente B"}
                                                    </span>
                                                )}
                                                <span className={cn("text-[9px] px-2 py-1 rounded-lg border font-black flex-shrink-0", sc.color)}>
                                                    {sc.label}
                                                </span>
                                                <div className="flex gap-1">
                                                    {apt.status === "PENDING" && (
                                                        <>
                                                            <button onClick={() => handleStatusChange(apt.id, "CONFIRMED")} title="Confirmar" className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/20 transition-all">
                                                                <Check className="h-3 w-3 text-emerald-400" />
                                                            </button>
                                                            <button onClick={() => handleStatusChange(apt.id, "CANCELLED")} title="Cancelar" className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all">
                                                                <X className="h-3 w-3 text-red-400" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── ADVISORS TAB ───────────────────────────────────────── */}
                {tab === "advisors" && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white/40">Equipo de Asesores</h2>
                            <button
                                onClick={() => setEditingAdvisor({ name: "", email: "", phone: "", is_active: true })}
                                className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                                title="Añadir asesor"
                            >
                                <Plus className="h-3.5 w-3.5" /> Nuevo Asesor
                            </button>
                        </div>

                        {/* Edit Form */}
                        {editingAdvisor && (
                            <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-4 animate-in slide-in-from-top duration-300">
                                <h3 className="text-xs font-black uppercase tracking-widest text-primary">{editingAdvisor.id ? "Editar Asesor" : "Nuevo Asesor"}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Nombre *</label>
                                        <input
                                            value={editingAdvisor.name || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, name: e.target.value }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="Nombre completo"
                                            aria-label="Nombre del asesor"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Email</label>
                                        <input
                                            value={editingAdvisor.email || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, email: e.target.value }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="email@empresa.com"
                                            aria-label="Email del asesor"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Teléfono</label>
                                        <input
                                            value={editingAdvisor.phone || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, phone: e.target.value }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="+34 600 000 000"
                                            aria-label="Teléfono del asesor"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Países que gestiona</label>
                                        <input
                                            value={editingAdvisor.countries?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, countries: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="México, España, etc."
                                            title="Países separados por coma"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Orígenes de Lead</label>
                                        <input
                                            value={editingAdvisor.origins?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, origins: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="WhatsApp, CRM, etc."
                                            title="Orígenes separados por coma"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Campañas Específicas</label>
                                        <input
                                            value={editingAdvisor.campaigns?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, campaigns: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="Campaña MBA 2024, etc."
                                            title="Campañas separadas por coma"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Cursos Específicos</label>
                                        <input
                                            value={editingAdvisor.courses?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, courses: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="Máster Big Data, etc."
                                            title="Cursos separados por coma"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Tipos de Lead (Estado)</label>
                                        <input
                                            value={editingAdvisor.handled_lead_types?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, handled_lead_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                            placeholder="nuevo, ilocalizable, etc."
                                            title="Tipos de lead separados por coma"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Especialidad General</label>
                                        <input
                                            value={editingAdvisor.specialties?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, specialties: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-primary font-bold"
                                            placeholder="Especialidad técnica..."
                                            title="Lista de especialidades separadas por coma"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleSaveAdvisor} disabled={saving} title="Guardar asesor"
                                        className="flex items-center gap-2 h-9 px-5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20">
                                        <Save className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar"}
                                    </button>
                                    <button onClick={() => setEditingAdvisor(null)} title="Cancelar" className="h-9 px-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-slate-500 dark:text-white/40">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Advisors List */}
                        <div className="space-y-3">
                            {advisors.length === 0 && (
                                <div className="py-20 text-center text-white/20">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Sin asesores configurados</p>
                                    <p className="text-[10px] mt-1 opacity-60">Añade asesores para que el Round Robin pueda asignarles leads.</p>
                                </div>
                            )}
                            {advisors.map(advisor => (
                                <div key={advisor.id} className="flex items-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.03] transition-all">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                                        {advisor.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold">{advisor.name}</p>
                                            <span className={cn("text-[8px] px-2 py-0.5 rounded-full font-black uppercase", advisor.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-white/20")}>
                                                {advisor.is_active ? "Activo" : "Inactivo"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-0.5">
                                            {advisor.email && <span className="text-[10px] text-white/30 flex items-center gap-1"><Mail className="h-3 w-3" />{advisor.email}</span>}
                                            {advisor.phone && <span className="text-[10px] text-white/30 flex items-center gap-1"><Phone className="h-3 w-3" />{advisor.phone}</span>}
                                        </div>
                                        {(advisor.countries?.length || 0) + (advisor.origins?.length || 0) + (advisor.campaigns?.length || 0) + (advisor.courses?.length || 0) > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {advisor.countries?.map(c => <span key={c} className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase font-bold">{c}</span>)}
                                                {advisor.origins?.map(o => <span key={o} className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-bold">{o}</span>)}
                                                {advisor.campaigns?.map(ca => <span key={ca} className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase font-bold">{ca}</span>)}
                                                {advisor.courses?.map(co => <span key={co} className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold">{co}</span>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setSelectedAdvisor(advisor); setTab("slots"); }} title="Editar horarios" className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                                            <Clock className="h-3.5 w-3.5 text-white/40" />
                                        </button>
                                        <button onClick={() => setEditingAdvisor(advisor)} title="Editar asesor" className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                                            <Pencil className="h-3.5 w-3.5 text-white/40" />
                                        </button>
                                        <button onClick={() => { deleteAdvisor(advisor.id); loadData(); }} title="Eliminar asesor" className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all">
                                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── SLOTS TAB ──────────────────────────────────────────── */}
                {tab === "slots" && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white/40">Disponibilidad Semanal</h2>
                            <button onClick={() => setTab("advisors")} title="Volver" className="flex items-center gap-2 h-9 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white/40">
                                <ChevronLeft className="h-3.5 w-3.5" /> Asesores
                            </button>
                        </div>

                        {/* Advisor Selector */}
                        <div className="flex gap-2 flex-wrap">
                            {advisors.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => setSelectedAdvisor(a)}
                                    title={a.name}
                                    className={cn(
                                        "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                        selectedAdvisor?.id === a.id ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                    )}
                                >
                                    {a.name}
                                </button>
                            ))}
                        </div>

                        {selectedAdvisor && (
                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-7 gap-3">
                                        {DAYS_FULL.map((dayLabel, i) => {
                                            const dbDay = DAYS_DB_MAP[i];
                                            const slotConfig = slots[dbDay] || { active: false, start: "09:00", end: "20:00" };
                                            const isActive = slotConfig.active;
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => setSlots(s => ({ 
                                                        ...s, 
                                                        [dbDay]: { 
                                                            ...slotConfig, 
                                                            active: !isActive 
                                                        } 
                                                    }))}
                                                    title={`Toggle ${dayLabel}`}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                                                        isActive ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/[0.02] border-white/5 text-white/20 hover:text-white/40"
                                                    )}
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-widest">{DAYS[i]}</span>
                                                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all", isActive ? "bg-primary border-primary" : "border-white/10")}>
                                                        {isActive && <Check className="h-3 w-3 text-primary-foreground" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Time configuration for active days */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/20 px-1">Horarios por Día</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {DAYS_FULL.map((dayLabel, i) => {
                                                const dbDay = DAYS_DB_MAP[i];
                                                const slotConfig = slots[dbDay];
                                                if (!slotConfig?.active) return null;

                                                return (
                                                    <div key={dbDay} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-left duration-300">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary w-12">{DAYS[i]}</span>
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <input 
                                                                type="time" 
                                                                value={slotConfig.start} 
                                                                onChange={(e) => setSlots(s => ({ ...s, [dbDay]: { ...slotConfig, start: e.target.value } }))}
                                                                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary outline-none"
                                                                title="Hora de inicio"
                                                            />
                                                            <span className="text-white/20 text-[10px] font-bold">A</span>
                                                            <input 
                                                                type="time" 
                                                                value={slotConfig.end} 
                                                                onChange={(e) => setSlots(s => ({ ...s, [dbDay]: { ...slotConfig, end: e.target.value } }))}
                                                                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary outline-none"
                                                                title="Hora de fin"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button onClick={() => loadSlots(selectedAdvisor.id)} title="Deshacer cambios" className="flex items-center gap-2 h-9 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white/40">
                                        <RotateCcw className="h-3.5 w-3.5" /> Deshacer
                                    </button>
                                    <button onClick={handleSaveSlots} disabled={saving} title="Guardar horarios"
                                        className="flex items-center gap-2 h-9 px-6 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:scale-[1.02] transition-all">
                                        <Save className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar Horarios"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TOOLS TAB ─────────────────────────────────────────── */}
                {tab === "tools" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* LEFT: Configuration & Simulator */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-8">
                                <div className="flex items-center gap-3">
                                    <Wrench className="h-5 w-5 text-primary" />
                                    <h2 className="text-sm font-black uppercase tracking-widest">Simulador de Herramientas de IA</h2>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">1. Seleccionar Lead</label>
                                        <select 
                                            value={toolLeadId}
                                            onChange={e => setToolLeadId(e.target.value)}
                                            title="Seleccionar Lead para la herramienta"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            <option value="">Seleccionar Lead...</option>
                                            {leads.map(l => (
                                                <option key={l.id} value={l.id}>{l.nombre} {l.apellido} ({l.telefono})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">2. Seleccionar Asesor</label>
                                        <select 
                                            value={toolAdvisorId}
                                            onChange={e => setToolAdvisorId(e.target.value)}
                                            title="Seleccionar Asesor para la herramienta"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            <option value="">Sin Asesor (Pendiente)</option>
                                            {advisors.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">3. Fecha</label>
                                        <input 
                                            type="date"
                                            value={toolDate}
                                            onChange={e => setToolDate(e.target.value)}
                                            title="Seleccionar Fecha"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">4. Hora</label>
                                        <input 
                                            type="time"
                                            value={toolTime}
                                            onChange={e => setToolTime(e.target.value)}
                                            title="Seleccionar Hora"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4">
                                    <button 
                                        onClick={testCheckAvailability}
                                        className="flex items-center justify-center gap-3 h-12 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all group"
                                    >
                                        <Search className="h-4 w-4 text-white/40 group-hover:text-primary transition-colors" />
                                        Disponibilidad
                                    </button>
                                    <button 
                                        onClick={testBook}
                                        className="flex items-center justify-center gap-3 h-12 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
                                    >
                                        <CalendarPlus className="h-4 w-4" />
                                        Agendar Cita
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6">
                                <div className="flex items-center gap-3">
                                    <CalendarRange className="h-5 w-5 text-amber-500" />
                                    <h2 className="text-sm font-black uppercase tracking-widest">Citas Activas de este Lead</h2>
                                </div>

                                {toolLeadId ? (
                                    <div className="space-y-3">
                                        {appointments.filter(a => a.lead_id === toolLeadId && a.status !== "CANCELLED").length === 0 ? (
                                            <p className="text-[10px] text-white/20 italic">No hay citas activas para este lead.</p>
                                        ) : (
                                            appointments.filter(a => a.lead_id === toolLeadId && a.status !== "CANCELLED").map(apt => (
                                                <div key={apt.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-bold">{new Date(apt.scheduled_at).toLocaleString("es-ES", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-0.5">{apt.advisors?.name}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={async () => {
                                                                const res = await rescheduleAppointment(apt.id, new Date(`${toolDate}T${toolTime}`).toISOString());
                                                                addLog("rescheduleAppointment", res);
                                                                await loadData();
                                                            }}
                                                            className="h-8 px-3 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white/10"
                                                        >
                                                            Reagendar
                                                        </button>
                                                        <button 
                                                            title="Cancelar Cita"
                                                            onClick={async () => {
                                                                const res = await cancelAppointment(apt.id);
                                                                addLog("cancelAppointment", res);
                                                                await loadData();
                                                            }}
                                                            className="h-8 w-8 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center hover:bg-red-500/20"
                                                        >
                                                            <CalendarX className="h-3.5 w-3.5 text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-white/20">Selecciona un lead para gestionar sus citas.</p>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Tool Definitions & Logs */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[500px]">
                                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2 bg-slate-900/50">
                                    <Terminal className="h-4 w-4 text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Logs de Ejecución</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-4">
                                    {toolLog.length === 0 && <p className="text-white/10 italic">Esperando acciones...</p>}
                                    {toolLog.map((log, i) => (
                                        <div key={i} className="space-y-1 animate-in fade-in duration-300">
                                            <div className="flex items-center justify-between opacity-40">
                                                <span>{log.time}</span>
                                                <span className="text-primary">{log.action}()</span>
                                            </div>
                                            <div className="bg-black/40 p-2 rounded-lg border border-white/5 text-emerald-400 overflow-x-auto">
                                                {JSON.stringify(log.result, null, 2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Herramientas para el Agente</h3>
                                <div className="space-y-3">
                                    {[
                                        { name: "book_appointment", desc: "Agendar nueva cita" },
                                        { name: "cancel_appointment", desc: "Cancelar cita existente" },
                                        { name: "reschedule_appointment", desc: "Cambiar fecha de cita" },
                                        { name: "check_availability", desc: "Consultar huecos libres" }
                                    ].map(tool => (
                                        <div key={tool.name} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <div>
                                                <p className="text-[10px] font-black text-white/80">{tool.name}</p>
                                                <p className="text-[9px] text-white/40">{tool.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
