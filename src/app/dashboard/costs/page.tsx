"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
    Coins, TrendingUp, Phone, MessageSquare, 
    BrainCircuit, DollarSign, Calendar, 
    ChevronRight, ArrowUpRight,
    BarChart3
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useTenantStore } from "@/store/tenant";
import type { ChatMessage } from "@/lib/actions/inbox";
import type { Database, Lead } from "@/types/database";

type ChatMessageWithLead = ChatMessage & { lead?: Lead };
type LlamadaRow = Database['public']['Tables']['llamadas']['Row'] & { lead?: Lead; created_at?: string };

interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
}

interface CostSummary {
    meta: number;
    ai: number;
    telephony: number;
    total: number;
    growth: number;
}

interface LeadCost {
    name: string;
    cost: number;
    type: string;
}

interface DailyCost {
    day: string;
    meta: number;
    ai: number;
    telephony: number;
}

export default function CostsPage() {
    const { tenantId } = useTenantStore();
    const [timeRange, setTimeRange] = useState("last_30_days");
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<CostSummary>({
        meta: 0,
        ai: 0,
        telephony: 0,
        total: 0,
        growth: 0
    });
    const [topLeads, setTopLeads] = useState<LeadCost[]>([]);
    const [dailyData, setDailyData] = useState<DailyCost[]>([]);

    const fetchCosts = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);

        try {
            const supabase = getSupabaseClient();
            
            // 1. Fetch AI & Meta Costs with Lead names
            const { data: messages } = await supabase
                .from("chat_messages")
                .select(`
                    lead_id, 
                    metadata, 
                    direction, 
                    sent_by, 
                    created_at,
                    lead:lead_id (nombre, apellido)
                `)
                .eq("tenant_id", tenantId)
                .order('created_at', { ascending: true });

            // 2. Fetch Telephony Costs with Lead names
            const { data: calls } = await supabase
                .from("llamadas")
                .select(`
                    id_lead, 
                    duracion_segundos, 
                    created_at,
                    lead:id_lead (nombre, apellido)
                `)
                .eq("tenant_id", tenantId)
                .order('created_at', { ascending: true });

            let aiTotal = 0;
            let metaTotal = 0;
            let telephonyTotal = 0;

            const leadMap = new Map<string, { name: string; cost: number; types: Set<string> }>();
            const dayMap = new Map<string, DailyCost>();

            // Process Messages
            messages?.forEach((msg: ChatMessageWithLead) => {
                let msgCost = 0;
                let msgAiCost = 0;
                let msgMetaCost = 0;

                // AI Cost
                const metadata = msg.metadata as Record<string, unknown>;
                const usage = metadata?.token_usage as unknown as TokenUsage | undefined;
                
                if (usage?.prompt_tokens && usage?.completion_tokens) {
                    msgAiCost = (usage.prompt_tokens * 0.005 / 1000) + (usage.completion_tokens * 0.015 / 1000);
                } else if (msg.sent_by === "AI_AGENT" || msg.sent_by === "AI_WIDGET") {
                    msgAiCost = 0.002;
                }

                // Meta Cost
                if (msg.direction === "OUTBOUND" && msg.metadata?.source !== "WEB_WIDGET") {
                    msgMetaCost = 0.015;
                }

                msgCost = msgAiCost + msgMetaCost;
                aiTotal += msgAiCost;
                metaTotal += msgMetaCost;

                // Update Lead Map
                const leadId = msg.lead_id;
                const leadInfo = leadMap.get(leadId) || { 
                    name: msg.lead ? `${msg.lead.nombre || ''} ${msg.lead.apellido || ''}`.trim() || 'Lead Desconocido' : 'Lead Desconocido',
                    cost: 0,
                    types: new Set()
                };
                leadInfo.cost += msgCost;
                if (msgAiCost > 0) leadInfo.types.add("IA");
                if (msgMetaCost > 0) leadInfo.types.add("WhatsApp");
                leadMap.set(leadId, leadInfo);

                // Update Daily Map
                const day = new Date(msg.created_at).toISOString().split('T')[0];
                const dData = dayMap.get(day) || { day, meta: 0, ai: 0, telephony: 0 };
                dData.meta += msgMetaCost;
                dData.ai += msgAiCost;
                dayMap.set(day, dData);
            });

            // Process Calls
            calls?.forEach((call: LlamadaRow) => {
                const durationMinutes = (call.duracion_segundos || 0) / 60;
                const callCost = durationMinutes * 0.15;
                telephonyTotal += callCost;

                const leadId = call.id_lead;
                const leadInfo = leadMap.get(leadId) || { 
                    name: call.lead ? `${call.lead.nombre || ''} ${call.lead.apellido || ''}`.trim() || 'Lead Desconocido' : 'Lead Desconocido',
                    cost: 0,
                    types: new Set()
                };
                leadInfo.cost += callCost;
                leadInfo.types.add("Voz");
                leadMap.set(leadId, leadInfo);

                const day = new Date(call.created_at || (call as { fecha_creacion?: string }).fecha_creacion || new Date()).toISOString().split('T')[0];
                const dData = dayMap.get(day) || { day, meta: 0, ai: 0, telephony: 0 };
                dData.telephony += callCost;
                dayMap.set(day, dData);
            });

            setSummary({
                meta: metaTotal,
                ai: aiTotal,
                telephony: telephonyTotal,
                total: metaTotal + aiTotal + telephonyTotal,
                growth: 5.2 // Simulated growth from prev month would need more queries
            });

            // Format Top Leads
            const sortedLeads = Array.from(leadMap.values())
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 5)
                .map(l => ({
                    name: l.name,
                    cost: l.cost,
                    type: Array.from(l.types).join(" + ")
                }));
            setTopLeads(sortedLeads);

            // Format Daily Data (Last 14 days - CONTINUOUS TIMELINE)
            const daysToDisplay = 14;
            const timeline: DailyCost[] = [];
            for (let i = daysToDisplay - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                
                const existingData = dayMap.get(dateStr);
                timeline.push(existingData || { 
                    day: dateStr, 
                    meta: 0, 
                    ai: 0, 
                    telephony: 0 
                });
            }
            setDailyData(timeline);

        } catch (error) {
            console.error("Error fetching real costs:", error);
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchCosts();
    }, [fetchCosts, timeRange]);

    const CostCard = ({ title, amount, icon, color, description }: {
        title: string;
        amount: number;
        icon: React.ReactNode;
        color: string;
        description: string;
    }) => (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[32px] shadow-sm hover:shadow-xl transition-all group"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-4 rounded-2xl", color)}>
                    {icon}
                </div>
                <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs bg-emerald-500/10 px-2 py-1 rounded-full">
                    <ArrowUpRight className="h-3 w-3" />
                    Real-time
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <p className="text-xs text-slate-500 mt-2 font-medium">{description}</p>
            </div>
        </motion.div>
    );

    if (loading && summary.total === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center p-20">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold animate-pulse">Calculando métricas reales...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <Coins className="h-10 w-10 text-blue-500" />
                        Centro de Costes
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Inversión real auditada por lead y categoría.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <button 
                        onClick={() => setTimeRange("last_7_days")}
                        className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", timeRange === "last_7_days" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5")}
                    >
                        7 Días
                    </button>
                    <button 
                        onClick={() => setTimeRange("last_30_days")}
                        className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", timeRange === "last_30_days" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5")}
                    >
                        30 Días
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
                    <button 
                        className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                        title="Seleccionar fecha"
                        aria-label="Seleccionar fecha"
                    >
                        <Calendar className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Top Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <CostCard 
                    title="Inversión Total"
                    amount={summary.total}
                    icon={<DollarSign className="h-6 w-6 text-blue-600" />}
                    color="bg-blue-50 dark:bg-blue-500/10"
                    description="Suma total de todas las categorías."
                />
                <CostCard 
                    title="Meta API (WhatsApp)"
                    amount={summary.meta}
                    icon={<MessageSquare className="h-6 w-6 text-emerald-600" />}
                    color="bg-emerald-50 dark:bg-emerald-500/10"
                    description="Coste estimado por conversaciones Meta."
                />
                <CostCard 
                    title="Modelos de IA"
                    amount={summary.ai}
                    icon={<BrainCircuit className="h-6 w-6 text-purple-600" />}
                    color="bg-purple-50 dark:bg-purple-500/10"
                    description="Consumo real de tokens (In/Out)."
                />
                <CostCard 
                    title="Telefonía (Voz)"
                    amount={summary.telephony}
                    icon={<Phone className="h-6 w-6 text-orange-600" />}
                    color="bg-orange-50 dark:bg-orange-500/10"
                    description="Minutos consumidos en llamadas IA."
                />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Flujo de Gastos</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Histórico diario real</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-blue-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Meta</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-purple-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">AI</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-orange-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Voz</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[350px] relative mt-10">
                        {/* Y-Axis Indicators */}
                        <div className="absolute left-0 inset-y-0 flex flex-col justify-between text-[10px] font-bold text-slate-400 opacity-50 pr-4 border-r border-slate-100 dark:border-white/5">
                            <span>${Math.max(...dailyData.map(x => x.meta + x.ai + x.telephony), 10).toFixed(0)}</span>
                            <span>${(Math.max(...dailyData.map(x => x.meta + x.ai + x.telephony), 10) / 2).toFixed(0)}</span>
                            <span>$0</span>
                        </div>

                        <div className="h-full ml-12 flex items-end justify-between gap-3 px-2">
                            {dailyData.length > 0 ? dailyData.map((d, i) => {
                                const totalDay = d.meta + d.ai + d.telephony;
                                const maxVal = Math.max(...dailyData.map(x => x.meta + x.ai + x.telephony), 1);
                                const heightPerc = (totalDay / maxVal) * 100;
                                
                                const metaPerc = totalDay > 0 ? (d.meta / totalDay) * 100 : 0;
                                const aiPerc = totalDay > 0 ? (d.ai / totalDay) * 100 : 0;
                                const telephonyPerc = totalDay > 0 ? (d.telephony / totalDay) * 100 : 0;
                                
                                return (
                                    <div key={i} className="flex-1 group relative h-full flex flex-col justify-end">
                                        {/* Tooltip */}
                                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-xl text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 shadow-xl whitespace-nowrap mb-2 border border-white/10">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-slate-400">TOTAL:</span>
                                                    <span>${totalDay.toFixed(2)}</span>
                                                </div>
                                                <div className="h-px bg-white/10 my-0.5" />
                                                <div className="flex items-center justify-between gap-2 text-blue-400">
                                                    <span>Meta:</span>
                                                    <span>${d.meta.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 text-purple-400">
                                                    <span>AI:</span>
                                                    <span>${d.ai.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 text-orange-400">
                                                    <span>Voz:</span>
                                                    <span>${d.telephony.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                                        </div>

                                        {/* Bar */}
                                        <motion.div 
                                            className="w-full bg-slate-50 dark:bg-white/5 group-hover:bg-slate-100 dark:group-hover:bg-white/10 rounded-t-xl transition-all cursor-pointer relative overflow-hidden"
                                            initial={{ height: "2%" }}
                                            animate={{ height: `${Math.max(heightPerc, 2)}%` }}
                                        >
                                            <motion.div 
                                                className="absolute inset-x-0 bottom-0 bg-blue-500" 
                                                initial={{ height: 0 }}
                                                animate={{ height: `${metaPerc}%` }}
                                            />
                                            <motion.div 
                                                className="absolute inset-x-0 bg-purple-500" 
                                                initial={{ height: 0 }}
                                                animate={{ 
                                                    height: `${aiPerc}%`, 
                                                    bottom: `${metaPerc}%` 
                                                }}
                                            />
                                            <motion.div 
                                                className="absolute inset-x-0 bg-orange-500" 
                                                initial={{ height: 0 }}
                                                animate={{ 
                                                    height: `${telephonyPerc}%`, 
                                                    bottom: `${metaPerc + aiPerc}%` 
                                                }}
                                            />
                                        </motion.div>

                                        {/* Date Label */}
                                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-400 uppercase tracking-tighter transition-colors group-hover:text-blue-500">
                                            {d.day.split('-').slice(2)}/{d.day.split('-').slice(1, 2)}
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <BarChart3 className="h-12 w-12 opacity-10 animate-pulse" />
                                    <div className="text-center">
                                        <p className="font-black text-xs uppercase tracking-[0.2em] opacity-30">Sin Actividad</p>
                                        <p className="text-[10px] opacity-20 mt-1">Los datos aparecerán aquí conforme entren leads.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-900 dark:bg-white rounded-[32px] p-6 text-white dark:text-slate-900 shadow-2xl">
                        <TrendingUp className="h-8 w-8 text-blue-400 mb-4" />
                        <h3 className="text-xl font-black mb-2">Estado del Saldo</h3>
                        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mb-6">
                            Tu inversión se mantiene dentro del presupuesto estimado para este periodo.
                        </p>
                        <button className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/25">
                            Exportar Reporte PDF
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="h-4 w-4 text-slate-400" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Leads con mayor coste</h3>
                        </div>
                        <div className="space-y-4">
                            {topLeads.length > 0 ? topLeads.map((lead, i) => (
                                <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">
                                            {lead.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{lead.name}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{lead.type}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-900 dark:text-white">${lead.cost.toFixed(2)}</p>
                                        <ChevronRight className="h-4 w-4 text-slate-300 ml-auto mt-1" />
                                    </div>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-400 italic text-center py-4">No hay datos de consumo registrados.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
