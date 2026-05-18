"use client";

import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer
} from "recharts";
import { 
    ShieldCheck, DollarSign, TrendingUp, Users, 
    ArrowUpRight, ArrowDownRight, Zap, ListChecks,
    Activity, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * INTERNAL ADMIN PANEL (v2.0)
 * Financial control and team productivity for the Turnkey service.
 */

const FINANCIAL_DATA = [
    { name: "Ene", revenue: 4500, cost: 1200 },
    { name: "Feb", revenue: 5200, cost: 1450 },
    { name: "Mar", revenue: 6100, cost: 1800 },
];

export default function AdminPage() {
    return (
        <div className="flex flex-col gap-8 p-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-left">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        Panel de Control Turnkey
                    </h1>
                    <p className="text-muted-foreground text-lg text-left">
                        Control financiero global y productividad del equipo.
                    </p>
                </div>
            </div>

            {/* Financial Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 rounded-3xl border bg-card shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <ArrowUpRight className="h-3 w-3" />
                            +12%
                        </span>
                    </div>
                    <div className="text-left">
                        <p className="text-sm text-muted-foreground font-semibold">Ingresos Mensuales</p>
                        <h2 className="text-2xl font-black">$15,800</h2>
                    </div>
                </div>

                <div className="p-6 rounded-3xl border bg-card shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                            <Activity className="h-5 w-5" />
                        </div>
                        <span className="flex items-center gap-1 text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                            <ArrowDownRight className="h-3 w-3" />
                            +4%
                        </span>
                    </div>
                    <div className="text-left">
                        <p className="text-sm text-muted-foreground font-semibold">Costos Operativos</p>
                        <h2 className="text-2xl font-black">$4,250</h2>
                    </div>
                </div>

                <div className="p-6 rounded-3xl border bg-card shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                             Margen: 73%
                        </span>
                    </div>
                    <div className="text-left">
                        <p className="text-sm text-muted-foreground font-semibold">Costo por Cita Agendada</p>
                        <h2 className="text-2xl font-black">$2.14</h2>
                    </div>
                </div>

                <div className="p-6 rounded-3xl border bg-card shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                            <Users className="h-5 w-5" />
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-black bg-orange-500/10 text-orange-600 rounded-full">8 TENANTS</span>
                    </div>
                    <div className="text-left">
                        <p className="text-sm text-muted-foreground font-semibold">Leads Procesados (24h)</p>
                        <h2 className="text-2xl font-black">1,242</h2>
                    </div>
                </div>
            </div>

            {/* Charts & Notion-style Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Profitability Chart */}
                <div className="lg:col-span-8 p-8 rounded-3xl border bg-card space-y-8 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold italic tracking-tight">Rentabilidad del Servicio</h2>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-primary" />
                                <span className="text-xs font-bold">Ingresos</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                                <span className="text-xs font-bold">Costos (API)</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={FINANCIAL_DATA}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Bar dataKey="revenue" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={40} />
                                <Bar dataKey="cost" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Team Productivity (Notion-style) */}
                <div className="lg:col-span-4 flex flex-col gap-8">
                    <div className="p-8 rounded-3xl border bg-card shadow-sm space-y-6 flex-1">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <ListChecks className="h-5 w-5 text-primary" />
                                Tareas Equipo
                            </h2>
                            <button 
                                title="Añadir tarea"
                                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {[
                                { task: "Actualizar Prompts MBA", tenant: "ESDEN", status: "PENDIENTE" },
                                { task: "Revisar Webhook Retell", tenant: "Salesforce", status: "HECHO" },
                                { task: "Billing Mayo", tenant: "Global", status: "EN_CURSO" },
                                { task: "Filtro Leads Pais", tenant: "ESDEN", status: "PENDIENTE" },
                             ].map((item, i) => (
                                <div key={i} className="group flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-all border border-transparent hover:border-muted cursor-pointer text-left">
                                    <div className={cn(
                                        "h-2 w-2 rounded-full mt-2",
                                        item.status === "HECHO" ? "bg-emerald-500" : 
                                        item.status === "EN_CURSO" ? "bg-amber-500" : "bg-muted-foreground/30"
                                    )} />
                                    <div className="flex-1">
                                        <p className={cn("text-sm font-bold", item.status === "HECHO" && "line-through opacity-40")}>{item.task}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black tracking-tight text-primary uppercase">{item.tenant}</span>
                                            <span className="text-[10px] text-muted-foreground">•</span>
                                            <span className="text-[10px] text-muted-foreground font-semibold">{item.status}</span>
                                        </div>
                                    </div>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Server Status (Real-time Feel) */}
                    <div className="p-6 rounded-3xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 flex flex-col justify-between text-left">
                        <div className="flex items-center justify-between">
                            <Zap className="h-6 w-6" />
                            <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded-lg">CORE: OK</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-xs opacity-60">Infraestructura Elástica</p>
                            <h3 className="text-lg font-black tracking-tight leading-tight">Clúster Distribuidor Operativo</h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Minimal Plus component for the team tasks
function Plus({ className }: { className?: string }) {
    return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>;
}
