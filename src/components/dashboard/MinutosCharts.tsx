"use client";

import type { KpiMinutos } from "@/lib/actions/analytics";
import { cn, formatDuration } from "@/lib/utils";
import {
    AreaChart, Area,
    BarChart, Bar,
    PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Legend,
} from "recharts";

// ─── PALETTE ──────────────────────────────────────────────────────────────────

const PALETTE = ["#3b82f6", "#6366f1", "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
const TEXT_PALETTE: Record<string, string> = {
    "#3b82f6": "text-[#3b82f6]", "#6366f1": "text-[#6366f1]", "#0ea5e9": "text-[#0ea5e9]", "#8b5cf6": "text-[#8b5cf6]",
    "#10b981": "text-[#10b981]", "#f59e0b": "text-[#f59e0b]", "#ef4444": "text-[#ef4444]", "#ec4899": "text-[#ec4899]"
};

// ─── CUSTOM TOOLTIPS ──────────────────────────────────────────────────────────

function TooltipBase({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs">
            <p className="font-bold text-card-foreground mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} className={cn("font-black", TEXT_PALETTE[p.color] || "text-primary")}>
                    {p.name}: {formatDuration(p.value)}
                </p>
            ))}
        </div>
    );
}

function TooltipBar({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs">
            <p className="font-bold text-card-foreground mb-1">{label}</p>
            <p className="font-black text-primary">{formatDuration(payload[0].value)}</p>
        </div>
    );
}

function TooltipPie({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs">
            <p className="font-bold text-card-foreground">{payload[0].name}</p>
            <p className="font-black text-primary">{payload[0].value?.toLocaleString("es-ES")} llamadas</p>
        </div>
    );
}

// ─── CHART CARD WRAPPER ───────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-3xl border border-border bg-card p-7 shadow-sm">
            <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
            {children}
        </div>
    );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface Props {
    data: KpiMinutos;
}

export function MinutosCharts({ data }: Props) {
    const {
        minutos_por_dia,
        minutos_por_campana,
        minutos_por_estado,
        distribucion_duracion,
    } = data;

    // Format X-axis dates: "Mar 10" instead of "2026-03-10"
    const diaDatos = minutos_por_dia.map((r) => ({
        ...r,
        label: r.label.slice(5).replace("-", "/"), // "03/10"
    }));

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* 1. Minutos por día – Área */}
            <div className="lg:col-span-2">
                <ChartCard title="Evolución de Minutos IA por Día">
                    {diaDatos.length === 0 ? (
                        <Empty />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={diaDatos} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="minGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" />
                                <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10, fontWeight: 600 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "currentColor", fontSize: 10, fontWeight: 700 }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => formatDuration(v)} />
                                <Tooltip content={<TooltipBase />} />
                                <Area
                                    type="monotone" dataKey="value" name="Minutos"
                                    stroke="#3b82f6" strokeWidth={3}
                                    fillOpacity={1} fill="url(#minGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* 2. Minutos por campaña – Barras horizontales */}
            <ChartCard title="Minutos por Campaña">
                {minutos_por_campana.length === 0 ? (
                    <Empty />
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={minutos_por_campana} layout="vertical" margin={{ left: 8, right: 16 }}>
                            <defs>
                                <linearGradient id="campGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                                </linearGradient>
                            </defs>
                            <XAxis type="number" tick={{ fill: "currentColor", fontSize: 10, fontWeight: 700 }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => formatDuration(v)} />
                            <YAxis type="category" dataKey="label" tick={{ fill: "currentColor", fontSize: 10, fontWeight: 600 }} className="text-card-foreground" width={110} axisLine={false} tickLine={false} />
                            <Tooltip content={<TooltipBar />} cursor={{ fill: "rgba(59,130,246,0.04)", radius: 8 }} />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={28} fill="url(#campGrad)" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* 3. Minutos por estado – Barras verticales */}
            <ChartCard title="Minutos por Estado de Llamada">
                {minutos_por_estado.length === 0 ? (
                    <Empty />
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={minutos_por_estado} margin={{ top: 10, right: 8, bottom: 50, left: 0 }}>
                            <defs>
                                <linearGradient id="estadoGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#6366f1" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.5} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 9, fontWeight: 600 }} className="text-muted-foreground" axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                            <YAxis tick={{ fill: "currentColor", fontSize: 10, fontWeight: 700 }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => formatDuration(v)} />
                            <Tooltip content={<TooltipBar />} cursor={{ fill: "rgba(99,102,241,0.04)", radius: 8 }} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={80} fill="url(#estadoGrad)" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* 4. Distribución de duración – Donut */}
            <div className="lg:col-span-2">
                <ChartCard title="Distribución de Duración de Llamadas IA">
                    {distribucion_duracion.every(r => r.value === 0) ? (
                        <Empty />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={distribucion_duracion.map((r) => ({ ...r, name: r.label }))}
                                    cx="50%" cy="50%"
                                    innerRadius={75} outerRadius={110}
                                    paddingAngle={4}
                                    dataKey="value"
                                    nameKey="name"
                                    stroke="#ffffff" strokeWidth={3}
                                >
                                    {distribucion_duracion.map((_, i) => (
                                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<TooltipPie />} />
                                <Legend
                                    layout="vertical" align="right" verticalAlign="middle"
                                    iconType="circle" iconSize={8}
                                    formatter={(val) => <span className="text-xs text-muted-foreground font-bold ml-1">{val}</span>}
                                />
                                {/* Center label */}
                                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={900} className="fill-card-foreground">
                                    {distribucion_duracion.reduce((s, r) => s + r.value, 0).toLocaleString("es-ES")}
                                </text>
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

        </div>
    );
}

function Empty() {
    return (
        <div className="h-[200px] flex items-center justify-center text-sm font-bold text-muted-foreground/50">
            Sin datos para el período seleccionado
        </div>
    );
}
