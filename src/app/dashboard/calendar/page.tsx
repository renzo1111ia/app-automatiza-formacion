"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Calendar, Users, Clock, Check, X, Plus,
    ChevronLeft, ChevronRight, Bot, BarChart3,
    Pencil, Trash2, Phone, Mail, RotateCcw, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getAdvisors, saveAdvisor, deleteAdvisor,
    getAdvisorSlots, saveAdvisorSlots,
    getAppointments, updateAppointmentStatus,
    type Advisor, type Appointment
} from "@/lib/actions/scheduling";

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

type Tab = "agenda" | "advisors" | "slots";

export default function CalendarPage() {
    const [tab, setTab] = useState<Tab>("agenda");
    const [advisors, setAdvisors] = useState<Advisor[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
    const [editingAdvisor, setEditingAdvisor] = useState<Partial<Advisor> | null>(null);
    const [slots, setSlots] = useState<Record<number, boolean>>({}); // dayOfWeek → active
    const [saving, setSaving] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);

    const loadData = useCallback(async () => {
        const [advisorsRes, aptsRes] = await Promise.all([
            getAdvisors(),
            getAppointments()
        ]);
        if (advisorsRes.success && advisorsRes.data) {
            setAdvisors(advisorsRes.data);
            if (!selectedAdvisor && advisorsRes.data.length > 0) setSelectedAdvisor(advisorsRes.data[0]);
        }
        if (aptsRes.success && aptsRes.data) setAppointments(aptsRes.data);
    }, [selectedAdvisor]);

    const loadSlots = useCallback(async (advisorId: string) => {
        const res = await getAdvisorSlots(advisorId);
        if (res.success && res.data) {
            const map: Record<number, boolean> = {};
            res.data.forEach(s => { map[s.day_of_week] = true; });
            setSlots(map);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { if (selectedAdvisor) loadSlots(selectedAdvisor.id); }, [selectedAdvisor, loadSlots]);

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
        await saveAdvisor(editingAdvisor);
        setEditingAdvisor(null);
        await loadData();
        setSaving(false);
    }

    async function handleSaveSlots() {
        if (!selectedAdvisor) return;
        setSaving(true);
        const slotsToSave = Object.entries(slots)
            .filter(([, active]) => active)
            .map(([day]) => ({
                day_of_week: parseInt(day),
                start_time: "09:00",
                end_time: "20:00",
                slot_duration_minutes: 30,
            }));
        await saveAdvisorSlots(selectedAdvisor.id, slotsToSave);
        setSaving(false);
    }

    async function handleStatusChange(aptId: string, status: string) {
        await updateAppointmentStatus(aptId, status);
        await loadData();
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* HEADER */}
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Calendario & Agendas</h1>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Round Robin · Asesores · Citas Automáticas</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {(["agenda", "advisors", "slots"] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            title={t}
                            className={cn(
                                "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                tab === t ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/40 hover:bg-white/10"
                            )}
                        >
                            {t === "agenda" ? "Agenda" : t === "advisors" ? "Asesores" : "Horarios"}
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
                                                        <div className="truncate opacity-80">{(apt.lead as any)?.nombre} {(apt.lead as any)?.apellido}</div>
                                                        <div className="opacity-60">{(apt.advisors as any)?.name}</div>
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
                                                    <p className="text-sm font-bold">{(apt.lead as any)?.nombre} {(apt.lead as any)?.apellido}</p>
                                                    <p className="text-[10px] text-white/40">{(apt.lead as any)?.telefono}</p>
                                                </div>
                                                <div className="text-xs text-white/60 font-medium w-32">{(apt.advisors as any)?.name}</div>
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
                            <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-primary">{editingAdvisor.id ? "Editar Asesor" : "Nuevo Asesor"}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Nombre *</label>
                                        <input
                                            value={editingAdvisor.name || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, name: e.target.value }))}
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="Nombre completo"
                                            aria-label="Nombre del asesor"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Email</label>
                                        <input
                                            value={editingAdvisor.email || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, email: e.target.value }))}
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="email@empresa.com"
                                            aria-label="Email del asesor"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Teléfono</label>
                                        <input
                                            value={editingAdvisor.phone || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, phone: e.target.value }))}
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="+34 600 000 000"
                                            aria-label="Teléfono del asesor"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Especialidad (Cursos)</label>
                                        <input
                                            value={editingAdvisor.specialties?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, specialties: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-primary font-bold"
                                            placeholder="MBA, Big Data, etc."
                                            title="Lista de programas separados por coma"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Tipos de Lead</label>
                                        <input
                                            value={editingAdvisor.handled_lead_types?.join(", ") || ""}
                                            onChange={e => setEditingAdvisor(p => ({ ...p, handled_lead_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="nuevo, ilocalizable, etc."
                                            title="Tipos de lead separados por coma"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleSaveAdvisor} disabled={saving} title="Guardar asesor"
                                        className="flex items-center gap-2 h-9 px-5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:scale-[1.02] transition-all">
                                        <Save className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar"}
                                    </button>
                                    <button onClick={() => setEditingAdvisor(null)} title="Cancelar" className="h-9 px-5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white/40">
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
                                <p className="text-xs text-white/40 font-bold">Configura los días en que <span className="text-white font-black">{selectedAdvisor.name}</span> está disponible para recibir citas (09:00 - 20:00).</p>
                                <div className="grid grid-cols-7 gap-3">
                                    {DAYS_FULL.map((dayLabel, i) => {
                                        const dbDay = DAYS_DB_MAP[i];
                                        const isActive = slots[dbDay];
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setSlots(s => ({ ...s, [dbDay]: !s[dbDay] }))}
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
            </div>
        </div>
    );
}
