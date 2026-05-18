"use client";

import { ReactNode, cloneElement, isValidElement } from "react";
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
    AreaChart, Area, CartesianGrid, FunnelChart, Funnel, LabelList
} from "recharts";
import type { ChartRow } from "@/lib/actions/analytics";
import { cn } from "@/lib/utils";

// Premium color palette (Blue & Indigo focused)
const PALETTE = [
    "#2563eb", "#f97316", "#10b981", "#8b5cf6",
    "#51a2b1", "#3b82f6", "#ef4444", "#ec4899",
];

import type { TooltipProps } from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltipBar = ({ active, payload, label }: TooltipProps<number, string> | any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs">
            <p className="font-bold text-card-foreground mb-1">{label}</p>
            <p className="text-blue-600 dark:text-blue-400 font-black">{payload[0].value?.toLocaleString()} llamadas</p>
        </div>
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltipPie = ({ active, payload }: TooltipProps<number, string> | any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs">
            <p className="font-bold text-card-foreground">{payload[0].name}</p>
            <p className="text-blue-600 dark:text-blue-400 font-black">
                {payload[0].value?.toLocaleString()} ({payload[0].payload?.pct}%)
            </p>
        </div>
    );
};

function withPct(data: ChartRow[]) {
    const total = data.reduce((s, r) => s + r.value, 0);
    return data.map((r) => ({ ...r, name: r.label, pct: total > 0 ? Math.round((r.value / total) * 100) : 0 }));
}

/* ── KPI Card ──────────────────────────────── */
interface KpiCardProps { label: string; value: string | number; sub?: string; color?: string }

export function KpiCard({ label, value, sub, color = "text-card-foreground" }: KpiCardProps) {
    return (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
            <p className={cn("mt-2 text-3xl font-black tracking-tight", color)}>{value}</p>
            {sub && <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{sub}</p>}
        </div>
    );
}

/* ── Dark Score Card (Total Leads Campañas) ───────────────── */
interface DarkScoreCardProps {
    label: string;
    value: string | number;
    valueColor?: string;
}

export function DarkScoreCard({ label, value, valueColor = "text-card-foreground" }: DarkScoreCardProps) {
    return (
        <div className="flex flex-col justify-center rounded-2xl border border-border bg-card p-6 shadow-sm min-h-[105px]">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-2">{label}</div>
            <div className={`text-2xl font-black tracking-tighter ${valueColor}`}>{value}</div>
        </div>
    );
}

/* ── Summary Card ──────────────────────────── */
interface SummaryCardProps {
    label: ReactNode;
    value: ReactNode;
    sub?: ReactNode;
    icon?: ReactNode;
}

export function SummaryCard({ label, value, sub, icon }: SummaryCardProps) {
    return (
        <div className="flex items-center gap-5 rounded-[28px] border border-slate-100/60 dark:border-slate-800/40 bg-white dark:bg-slate-900 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 group h-full">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50/50 dark:bg-sky-900/10 transition-colors group-hover:bg-sky-100/50 dark:group-hover:bg-sky-900/20">
                {/* Clone the icon to ensure it has the right size and maintains its own colors/bg */}
                {isValidElement(icon) ? (
                    <div className="flex items-center justify-center">
                        {cloneElement(icon as React.ReactElement<{ className?: string }>, {
                            className: cn((icon as React.ReactElement<{ className?: string }>).props?.className, "h-7 w-7")
                        })}
                    </div>
                ) : icon}
            </div>
            <div className="flex flex-col min-w-0">
                <p className="text-[14px] font-semibold text-slate-500 dark:text-slate-400 leading-tight mb-1 truncate">{label}</p>
                <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</div>
                {sub && <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">{sub}</p>}
            </div>
        </div>
    );
}

/* ── Horizontal Bar ────────────────────────── */
export function HorizontalBarChart({ title, data }: { title: string; data: ChartRow[] }) {
    return (
        <ChartCard title={title}>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} layout="vertical" margin={{ left: -10, right: 20 }}>
                    <CartesianGrid strokeDasharray="0" horizontal={false} stroke="#f1f5f9" />
                    <XAxis 
                        type="number" 
                        tick={{ fill: "#94a3b8", fontSize: 10 }} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <YAxis 
                        type="category" 
                        dataKey="label" 
                        tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }} 
                        width={120} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <Tooltip content={<CustomTooltipBar />} cursor={{ fill: "rgba(59, 130, 246, 0.04)", radius: 4 }} />
                    <Bar 
                        dataKey="value" 
                        radius={[0, 4, 4, 0]} 
                        barSize={16} 
                        fill="#6366f1" 
                    />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

/* ── Vertical Bar ──────────────────────────── */
export function VerticalBarChart({ title, data }: { title: string; data: ChartRow[] }) {
    return (
        <ChartCard title={title}>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 10, right: 8, bottom: 40, left: -20 }}>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="label" 
                        tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 500 }} 
                        axisLine={false} 
                        tickLine={false} 
                        dy={10}
                    />
                    <YAxis 
                        tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 500 }} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <Tooltip content={<CustomTooltipBar />} cursor={{ fill: "rgba(81, 162, 177, 0.05)", radius: 4 }} />
                    <Bar 
                        dataKey="value" 
                        radius={[4, 4, 0, 0]} 
                        barSize={12}
                        fill="#51a2b1" 
                    />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

/* ── Pie / Donut ───────────────────────────── */
export function DonutChart({ title, data, centerLabel, isDonut = true }: { title: string; data: ChartRow[]; centerLabel?: string; isDonut?: boolean }) {
    const pie = withPct(data);
    const total = data.reduce((s, r) => s + r.value, 0);

    return (
        <ChartCard title={title}>
            <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                    <Pie
                        data={pie}
                        cx="50%"
                        cy="50%"
                        innerRadius={isDonut ? 75 : 0}
                        outerRadius={100}
                        paddingAngle={isDonut ? 3 : 0}
                        dataKey="value"
                        nameKey="name"
                        stroke={isDonut ? "transparent" : "#ffffff"}
                        strokeWidth={2}
                    >
                        {pie.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={PALETTE[i % PALETTE.length]} radius={4} />
                        ))}
                    </Pie>

                    <Tooltip content={<CustomTooltipPie />} />
                    <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconType="circle"
                        iconSize={8}
                        formatter={(val) => <span className="text-xs text-muted-foreground font-bold ml-1">{val}</span>}
                    />
                    {isDonut && centerLabel && (
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-card-foreground font-black" fontSize={24}>
                            {centerLabel === "total" ? total.toLocaleString() : centerLabel}
                        </text>
                    )}
                </PieChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

/* ── Area Chart ────────────────────────────── */
export function AreaChartComponent({ title, data }: { title: string; data: ChartRow[] }) {
    return (
        <ChartCard title={title}>
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.08} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="label" 
                        tick={{ fill: "#94a3b8", fontSize: 10 }} 
                        axisLine={false} 
                        tickLine={false} 
                        dy={10}
                    />
                    <YAxis 
                        tick={{ fill: "#94a3b8", fontSize: 10 }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => v === 0 ? "0" : v}
                    />
                    <Tooltip 
                        content={<CustomTooltipBar />}
                        cursor={{ stroke: "rgba(59, 130, 246, 0.1)", strokeWidth: 2 }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        name="Valor" 
                        stroke="#2563eb" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        dot={{ r: 4, fill: "white", stroke: "#2563eb", strokeWidth: 2 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

/* ── Funnel Chart ──────────────────────────── */
export function FunnelChartComponent({ title, data, effectiveness }: { title: string; data: ChartRow[]; effectiveness?: number }) {
    // Custom colors matching the image
    const colors = ["#1e60c3", "#69a1e0", "#5eaa6b", "#81c17b", "#d2dce9"];
    
    return (
        <ChartCard title={title}>
            {effectiveness !== undefined && (
                <div className="absolute top-6 right-7 bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs shadow-sm">
                    Efectividad: {effectiveness.toFixed(1)}%
                </div>
            )}
            <ResponsiveContainer width="100%" height={320}>
                <FunnelChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                    <Tooltip 
                        content={<CustomTooltipBar />}
                        cursor={{ fill: "transparent" }}
                    />
                    <Funnel
                        dataKey="value"
                        data={data}
                        isAnimationActive
                    >
                        <LabelList 
                            position="center" 
                            fill="#ffffff" 
                            stroke="none" 
                            dataKey="displayLabel" 
                            /* eslint-disable-next-line */
                            style={{ fontWeight: "bold", fontSize: "13px", textShadow: "0px 1px 2px rgba(0,0,0,0.5)" } as React.CSSProperties}
                        />
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                    </Funnel>
                </FunnelChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

/* ── Heatmap Chart (Calendar Density) ───────── */
export function HeatmapChartComponent({ title, data = [] }: { title: string; data?: { day: number; hour: number; value: number }[] }) {
    const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S']; // Sunday to Saturday (standard JS Date.getDay)
    
    // Pre-calculate max value for normalization
    const maxVal = data && data.length > 0 ? Math.max(...data.map(d => d.value), 1) : 1;

    return (
        <ChartCard title={title}>
            <div className="flex flex-col gap-1 w-full overflow-hidden">
                {/* Hours Labels */}
                <div className="flex text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-2 pl-6 pr-1">
                    <div className="flex-1 text-left">12a</div>
                    <div className="flex-1 text-center">6a</div>
                    <div className="flex-1 text-center">12p</div>
                    <div className="flex-1 text-center">6p</div>
                    <div className="flex-1 text-right">11p</div>
                </div>

                {days.map((dayLabel, dIdx) => (
                    <div key={`${dayLabel}-${dIdx}`} className="flex items-center gap-2 w-full">
                        <div className="w-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase shrink-0 text-center">
                            {dayLabel}
                        </div>
                        <div 
                            className="flex-1 grid gap-[2px] sm:gap-[4px] grid-cols-[repeat(24,minmax(0,1fr))]"
                        >
                            {Array.from({ length: 24 }).map((_, hIdx) => {
                                const entry = data.find(item => item.day === dIdx && item.hour === hIdx);
                                const val = entry?.value || 0;
                                
                                // Color ramp: Very light grey/blue for 0, then scales to deep indigo
                                const intensity = val === 0 ? 0 : (val / maxVal);
                                
                                // Map intensity to discrete Tailwind opacity classes to avoid dynamic style prop
                                const opacityClass = val === 0 ? "opacity-100" : (
                                    intensity > 0.8 ? "opacity-100" :
                                    intensity > 0.6 ? "opacity-80" :
                                    intensity > 0.4 ? "opacity-60" :
                                    intensity > 0.2 ? "opacity-40" : "opacity-20"
                                );
                                
                                 return (
                                    <div 
                                        key={`${dIdx}-${hIdx}`}
                                        className={cn(
                                            "h-2 sm:h-3 rounded-sm transition-all duration-300",
                                            val === 0 ? "bg-slate-100/30 dark:bg-slate-800/20" : "bg-blue-600",
                                            opacityClass
                                        )}
                                        title={`${val} llamadas a las ${hIdx}:00`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </ChartCard>
    );
}

/* ── Chart Card wrapper ────────────────────── */
function ChartCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="rounded-3xl border border-border bg-card p-7 shadow-sm">
            <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
            {children}
        </div>
    );
}

/* ── Skeleton ──────────────────────────────── */
export function ChartSkeleton() {
    return (
        <div className="rounded-3xl border border-border bg-card p-7 shadow-sm animate-pulse">
            <div className="mb-6 h-4 w-40 rounded bg-muted" />
            <div className="h-[220px] rounded bg-muted/50" />
        </div>
    );
}

export function KpiSkeleton() {
    return (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-pulse">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-4 h-10 w-20 rounded bg-muted" />
            <div className="mt-3 h-3 w-32 rounded bg-muted/50" />
        </div>
    );
}
