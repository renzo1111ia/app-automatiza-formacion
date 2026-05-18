"use client";

import { useState } from "react";
import { ChartConfig, Tenant } from "@/types/tenant";
import { AnalyticsFilters, ChartRow } from "@/lib/actions/analytics";
import {
    AreaChartComponent,
    VerticalBarChart,
    DonutChart,
    HeatmapChartComponent,
    FunnelChartComponent
} from "@/components/charts/DashboardCharts";
import {
    Save, X, EyeOff, Eye, GripVertical,
    Plus, Trash2, PieChart, BarChart3, AreaChart, Settings, 
    Layout, Database, Bot, LayoutGrid, Target
} from "lucide-react";
import { SCHEMA_COLUMNS } from "@/lib/constants/schema";
import { cn } from "@/lib/utils";
import { updateTenant } from "@/lib/actions/tenant";
import { useRouter } from "next/navigation";

// DND Kit Imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';

type ChartData = { label: string; value: number | string }[] | { day: number; hour: number; value: number }[];

interface SortableChartProps {
    c: ChartConfig;
    idx: number;
    isEditing: boolean;
    cycleSize: (id: string, current: string) => void;
    updateChart: (id: string, updates: Partial<ChartConfig>) => void;
    removeChart: (id: string) => void;
    chartData: ChartData;
    totalCount: number;
    onConfigure: (id: string) => void;
}

function SortableChartItem({ c, isEditing, cycleSize, updateChart, removeChart, chartData, onConfigure }: SortableChartProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: c.id, disabled: !isEditing });


    const colSpanClass = c.size === "12" ? "lg:col-span-12" : (c.size === "8" ? "lg:col-span-8" : (c.size === "6" ? "lg:col-span-6" : "lg:col-span-4"));

    const renderChart = () => {
        if (c.type === 'heatmap') return <HeatmapChartComponent title={c.title} data={chartData as unknown as { day: number; hour: number; value: number }[]} />;
        if (c.type === 'vertical-bar') return <VerticalBarChart title={c.title} data={chartData as unknown as ChartRow[]} />;
        if (c.type === 'donut') return <DonutChart title={c.title} data={chartData as unknown as ChartRow[]} />;
        if (c.type === 'funnel') return <FunnelChartComponent title={c.title} data={chartData as unknown as ChartRow[]} />;
        return <AreaChartComponent title={c.title} data={chartData as unknown as ChartRow[]} />;
    };

    const transformStr = transform ? CSS.Translate.toString(transform) : undefined;

    return (
        <div 
            ref={setNodeRef} 
            className={cn(
                colSpanClass, 
                "relative group transition-all duration-300", 
                isDragging && "opacity-50",
                transformStr && `[transform:${transformStr}]`,
                transition && `[transition:${transition}]`
            )}
        >
            <div className={cn(
                "h-full transition-all duration-300",
                isEditing && "ring-4 ring-primary/30 rounded-[32px] scale-[1.02] z-[40] shadow-2xl relative bg-card",
                isEditing && c.isVisible === false && "opacity-40 grayscale"
            )}>
                {renderChart()}

                {isEditing && (
                    <div className="absolute inset-0 z-[50] flex items-center justify-center bg-background/40 dark:bg-slate-950/40 backdrop-blur-[2px] rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity border-2 border-primary/50">
                        <div className="flex items-center gap-1.5 bg-card/90 p-2 rounded-2xl shadow-xl border border-border backdrop-blur-md">
                            {/* Drag Handle */}
                            <div {...attributes} {...listeners} className="p-2 text-muted-foreground hover:text-primary cursor-grab active:cursor-grabbing" title="Arrastrar">
                                <GripVertical className="h-5 w-5" />
                            </div>

                            <button
                                title="Configurar Gráfico"
                                onClick={() => onConfigure(c.id)}
                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors bg-primary/5 border border-primary/20"
                            >
                                <Settings className="h-5 w-5" />
                            </button>

                            <button
                                title="Cambiar Tamaño"
                                onClick={() => cycleSize(c.id, c.size || "6")}
                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            >
                                <Layout className="h-5 w-5" />
                            </button>

                            <button
                                title={c.isVisible === false ? "Mostrar" : "Ocultar"}
                                onClick={() => updateChart(c.id, { isVisible: c.isVisible === false })}
                                className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    c.isVisible === false ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                                )}
                            >
                                {c.isVisible === false ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                            </button>

                            <button
                                title="Eliminar Gráfico"
                                onClick={() => removeChart(c.id)}
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ChartManager({ tenant, initialCharts, data, isAdmin, configKey = 'charts', title }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [charts, setCharts] = useState<ChartConfig[]>(initialCharts);
    const [saving, setSaving] = useState(false);
    const [editingChartId, setEditingChartId] = useState<string | null>(null);
    const router = useRouter();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const editingChart = charts.find(c => c.id === editingChartId);

    async function handleSave() {
        setSaving(true);
        try {
            const newConfig = {
                ...(tenant.config as Record<string, unknown>),
                [configKey]: charts
            };
            const res = await updateTenant(tenant.id, { config: newConfig });
            if (res.success) {
                setIsEditing(false);
                router.refresh();
            } else {
                alert("Error al guardar: " + res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error inesperado");
        } finally {
            setSaving(false);
        }
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setCharts((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    function updateChart(id: string, updates: Partial<ChartConfig>) {
        setCharts(charts.map(c => c.id === id ? { ...c, ...updates } : c));
    }

    function removeChart(id: string) {
        if (confirm("¿Eliminar este gráfico?")) {
            setCharts(charts.filter(c => c.id !== id));
        }
    }

    function addChart() {
        const newChart: ChartConfig = {
            id: `chart-${Date.now()}`,
            title: 'Nuevo Gráfico',
            type: 'area',
            size: '6',
            dataKey: 'lead.fecha_ingreso_crm',
            isVisible: true
        };
        setCharts([...charts, newChart]);
        setEditingChartId(newChart.id);
    }

    function cycleSize(id: string, current: string) {
        const sizes: ChartConfig["size"][] = ["4", "6", "8", "12"];
        const currentIndex = sizes.indexOf(current as ChartConfig["size"]);
        const nextSize = sizes[(currentIndex + 1) % sizes.length];
        updateChart(id, { size: nextSize });
    }

    return (
        <div className="mb-10 relative">
            <div className="flex items-center justify-between mb-8">
                {title ? (
                    <h2 className="text-[12px] font-bold uppercase tracking-[0.15em] text-slate-400">{title}</h2>
                ) : (
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-[20px]">
                            <PieChart className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-[32px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Análisis <span className="text-indigo-600 dark:text-indigo-400">Visual</span>
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-[15px]">
                                Histogramas, tendencias y distribución de datos
                            </p>
                        </div>
                    </div>
                )}

                {isAdmin && (
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={addChart}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-primary bg-card border border-primary/20 rounded-xl hover:bg-primary/5 transition-all shadow-sm"
                                >
                                    <Plus className="h-4 w-4" /> Nuevo Gráfico
                                </button>
                                <div className="w-px h-6 bg-border mx-1" />
                                <button
                                    onClick={() => { setCharts(initialCharts); setIsEditing(false); }}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-muted-foreground bg-card border border-border rounded-xl hover:bg-muted transition-all"
                                >
                                    <X className="h-4 w-4" /> Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar Cambios"}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all"
                            >
                                <Settings className="h-4 w-4" /> Personalizar Gráficos
                            </button>
                        )}
                    </div>
                )}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToFirstScrollableAncestor]}
            >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <SortableContext
                        items={charts.filter(c => isEditing || c.isVisible !== false).map(c => c.id)}
                        strategy={rectSortingStrategy}
                    >
                        {charts.filter(c => isEditing || c.isVisible !== false).map((c, idx) => (
                            <SortableChartItem
                                key={c.id}
                                c={c}
                                idx={idx}
                                isEditing={isEditing}
                                cycleSize={cycleSize}
                                updateChart={updateChart}
                                removeChart={removeChart}
                                chartData={data[c.id] || []}
                                totalCount={charts.length}
                                onConfigure={(id) => setEditingChartId(id)}
                            />
                        ))}
                    </SortableContext>
                </div>
            </DndContext>

            {/* Sidebar Editor */}
            {isEditing && editingChartId && editingChart && (
                <>
                    <div 
                        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
                        onClick={() => setEditingChartId(null)}
                    />
                    <div className="fixed top-0 right-0 h-full w-[420px] bg-card border-l border-border shadow-2xl z-[101] animate-in slide-in-from-right duration-500 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary shadow-lg">
                                    <BarChart3 className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Configurar Gráfico</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{editingChart.title || "Sin título"}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setEditingChartId(null)} 
                                className="p-2 hover:bg-muted rounded-xl transition-all"
                                title="Cerrar Editor"
                            >
                                <X className="h-6 w-6 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Visual Type */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Layout className="h-4 w-4" />
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Tipo de Visualización</h4>
                                </div>
                                <div className="grid grid-cols-4 gap-2 pl-6">
                                    {[
                                        { type: 'area', icon: <AreaChart className="h-4 w-4" />, label: 'ÁREA' },
                                        { type: 'vertical-bar', icon: <BarChart3 className="h-4 w-4" />, label: 'BARRAS' },
                                        { type: 'donut', icon: <PieChart className="h-4 w-4" />, label: 'DONUT' },
                                        { type: 'heatmap', icon: <LayoutGrid className="h-4 w-4" />, label: 'MAPA' },
                                    ].map(t => (
                                        <button
                                            key={t.type}
                                            onClick={() => updateChart(editingChart.id, { type: t.type as unknown as ChartConfig["type"] })}
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all hover:scale-105",
                                                editingChart.type === t.type ? "bg-primary text-white border-primary shadow-lg" : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                                            )}
                                        >
                                            {t.icon}
                                            <span className="text-[8px] font-black uppercase tracking-tighter">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Identity */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-blue-500">
                                    <Settings className="h-4 w-4" />
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Identidad</h4>
                                </div>
                                <div className="space-y-3 pl-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Título del Gráfico</label>
                                        <input 
                                            type="text" 
                                            value={editingChart.title}
                                            onChange={(e) => updateChart(editingChart.id, { title: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary transition-all"
                                            title="Título del Gráfico"
                                            placeholder="Ej: Leads por día"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Data Connection */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-indigo-500">
                                        <Database className="h-4 w-4" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Conexión de Datos</h4>
                                    </div>
                                    <button
                                        onClick={() => updateChart(editingChart.id, { isAdvanced: !editingChart.isAdvanced })}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border",
                                            editingChart.isAdvanced ? "bg-indigo-500 text-white border-indigo-400 shadow-lg" : "bg-muted text-muted-foreground border-border hover:border-indigo-400"
                                        )}
                                    >
                                        {editingChart.isAdvanced ? <Bot className="h-3 w-3" /> : <Settings className="h-3 w-3" />}
                                        {editingChart.isAdvanced ? "Avanzado" : "Simple"}
                                    </button>
                                </div>

                                <div className="space-y-4 pl-6">
                                    {!editingChart.isAdvanced ? (
                                        <div className="space-y-4">
                                            {/* ── Origen: Tabla / Columna ── */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                                                    Origen (Tabla / Columna)
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select
                                                        title="Tabla"
                                                        value={editingChart.xKey?.split('.')[0] || 'lead'}
                                                        onChange={(e) => {
                                                            const table = e.target.value;
                                                            const cols = SCHEMA_COLUMNS[table] || SCHEMA_COLUMNS['lead'];
                                                            const col = cols[0] || 'id';
                                                            updateChart(editingChart.id, { xKey: `${table}.${col}`, dataKey: 'dynamic' });
                                                        }}
                                                        className="bg-muted border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                    >
                                                        <option value="lead">lead</option>
                                                        <option value="llamadas">llamadas</option>
                                                        <option value="agendamientos">agendamientos</option>
                                                        <option value="lead_cualificacion">lead_cualificacion</option>
                                                        <option value="intentos_llamadas">intentos_llamadas</option>
                                                        <option value="conversaciones_whatsapp">conversaciones_whatsapp</option>
                                                    </select>
                                                    <select
                                                        title="Columna"
                                                        value={editingChart.xKey?.split('.')[1] || 'fecha_ingreso_crm'}
                                                        onChange={(e) => {
                                                            const table = editingChart.xKey?.split('.')[0] || 'lead';
                                                            updateChart(editingChart.id, { xKey: `${table}.${e.target.value}`, dataKey: 'dynamic' });
                                                        }}
                                                        className="bg-muted border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                    >
                                                        {(SCHEMA_COLUMNS[editingChart.xKey?.split('.')[0] || 'lead'] || SCHEMA_COLUMNS['lead']).map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* ── Eje X (Agrupación) ── */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                                                    Eje X — ¿Cómo agrupar?
                                                </label>
                                                <select
                                                    value={editingChart.xKey || 'lead.fecha_ingreso_crm'}
                                                    onChange={(e) => updateChart(editingChart.id, { xKey: e.target.value, dataKey: 'dynamic' })}
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-foreground outline-none cursor-pointer"
                                                    title="Eje X — Dimensión"
                                                >
                                                    <optgroup label="⏱ Tiempo">
                                                        <option value="lead.fecha_ingreso_crm">📅 Día de ingreso de lead</option>
                                                        <option value="llamadas.fecha_inicio">📅 Día de llamada</option>
                                                        <option value="agendamientos.fecha_agendada_cliente">📅 Día de agendamiento</option>
                                                        <option value="lead_cualificacion.fecha_creacion">📅 Día de cualificación</option>
                                                        <option value="conversaciones_whatsapp.fecha_creacion">📅 Día de conversación WA</option>
                                                    </optgroup>
                                                    <optgroup label="🎯 Segmentación">
                                                        <option value="lead.campana">📢 Campaña</option>
                                                        <option value="lead.origen">🌐 Origen del lead</option>
                                                        <option value="lead.tipo_lead">🏷️ Tipo de lead</option>
                                                        <option value="lead.pais">🌍 País</option>
                                                        <option value="llamadas.estado_llamada">📞 Estado de llamada</option>
                                                        <option value="llamadas.razon_termino">🔚 Razón de término</option>
                                                        <option value="llamadas.tipo_agente">🤖 Tipo de agente</option>
                                                        <option value="lead_cualificacion.cualificacion">⭐ Cualificación</option>
                                                        <option value="lead_cualificacion.motivo_anulacion">❌ Motivo de anulación</option>
                                                        <option value="conversaciones_whatsapp.estado">💬 Estado de conversación</option>
                                                    </optgroup>
                                                </select>
                                                <p className="text-[9px] font-bold text-slate-400 italic px-1">Define las etiquetas del eje horizontal del gráfico.</p>
                                            </div>

                                            {/* ── Eje Y (Métrica) ── */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                                                    Eje Y — ¿Qué medir?
                                                </label>
                                                <select
                                                    value={editingChart.yKey || '__count__'}
                                                    onChange={(e) => updateChart(editingChart.id, { yKey: e.target.value === '__count__' ? undefined : e.target.value })}
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-foreground outline-none cursor-pointer"
                                                    title="Eje Y — Métrica"
                                                >
                                                    <optgroup label="📊 Conteos generales">
                                                        <option value="__count__">🔢 Número de registros (COUNT)</option>
                                                        <option value="lead.id">👥 Número de leads</option>
                                                        <option value="llamadas.id">📞 Número de llamadas</option>
                                                        <option value="agendamientos.id">📅 Número de agendamientos</option>
                                                        <option value="lead_cualificacion.id">⭐ Número de cualificaciones</option>
                                                        <option value="conversaciones_whatsapp.id">💬 Número de conversaciones</option>
                                                    </optgroup>
                                                    <optgroup label="⏱ Tiempo y duración">
                                                        <option value="llamadas.duracion_segundos">⏱ Segundos de llamada</option>
                                                    </optgroup>
                                                    <optgroup label="🔢 Intentos">
                                                        <option value="intentos_llamadas.numero_intento">🔄 Número de intento</option>
                                                    </optgroup>
                                                </select>
                                                <p className="text-[9px] font-bold text-slate-400 italic px-1">{'Define los valores del eje vertical (COUNT si se elige "Número de registros").'}</p>
                                            </div>

                                            {/* ── Método de Cálculo ── */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                                                    Método de Cálculo
                                                </label>
                                                <select
                                                    title="Método de Cálculo"
                                                    value={editingChart.calcType || 'count'}
                                                    onChange={(e) => updateChart(editingChart.id, { calcType: e.target.value as ChartConfig['calcType'] })}
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-foreground outline-none cursor-pointer"
                                                >
                                                    <option value="count">Contar Registros (Count)</option>
                                                    <option value="sum">Sumatoria de Valores (Sum)</option>
                                                    <option value="avg">Promedio de Valores (Avg)</option>
                                                </select>
                                            </div>

                                            {/* ── Filtro Condicional ── */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                                                    Filtro Condicional (Opcional)
                                                </label>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={editingChart.condCol || ''}
                                                        onChange={(e) => updateChart(editingChart.id, { condCol: e.target.value || undefined })}
                                                        className="flex-1 min-w-0 bg-muted border border-border rounded-xl px-2 py-2 text-[11px] font-bold text-foreground outline-none cursor-pointer"
                                                        title="Columna para el filtro"
                                                    >
                                                        <option value="">-- Columna --</option>
                                                        {/* Dynamic columns based on xKey table */}
                                                        {(SCHEMA_COLUMNS[editingChart.xKey?.split('.')[0] || 'lead'] || SCHEMA_COLUMNS['lead']).map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        title="Operador de filtro"
                                                        value={editingChart.condOp || '='}
                                                        onChange={(e) => updateChart(editingChart.id, { condOp: e.target.value as ChartConfig['condOp'] })}
                                                        className="bg-muted border border-border rounded-xl px-1 py-2 text-[11px] font-bold text-foreground outline-none cursor-pointer"
                                                    >
                                                        <option value="=">=</option>
                                                        <option value="!=">!=</option>
                                                        <option value="ILIKE">~</option>
                                                        <option value=">">&gt;</option>
                                                        <option value="<">&lt;</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="valor"
                                                        value={editingChart.condVal || ''}
                                                        onChange={(e) => updateChart(editingChart.id, { condVal: e.target.value || undefined })}
                                                        className="flex-1 min-w-0 bg-muted border border-border rounded-xl px-2 py-2 text-[11px] font-bold text-foreground outline-none focus:border-indigo-500 transition-all"
                                                        title="Valor del filtro"
                                                    />
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 italic px-1">Ej: estado_llamada = completed · solo leads de una campaña · etc.</p>
                                            </div>
                                        </div>

                                    ) : (
                                        <div className="space-y-6 animate-in fade-in duration-300">
                                            <div className="space-y-2.5 p-4 bg-muted/60 rounded-3xl border-2 border-primary/20 shadow-inner">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Target className="h-4 w-4 text-primary" />
                                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Fórmula Temporal</label>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: (a / b) * 100"
                                                    value={editingChart.formula || ""}
                                                    onChange={(e) => updateChart(editingChart.id, { formula: e.target.value })}
                                                    className="w-full bg-card border-b-4 border-primary/30 rounded-2xl px-5 py-4 text-lg font-black text-primary outline-none text-center uppercase"
                                                />
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-2">
                                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Series de Datos</label>
                                                    <button
                                                        onClick={() => {
                                                            const parts = { ...(editingChart.parts || {}) };
                                                            const nextId = String.fromCharCode(97 + Object.keys(parts).length);
                                                            parts[nextId] = { id: nextId, targetCol: "lead.id", calcType: "count" };
                                                            updateChart(editingChart.id, { parts });
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 border border-primary/20"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" /> Añadir Serie
                                                    </button>
                                                </div>

                                                <div className="space-y-4">
                                                    {Object.entries(editingChart.parts || {}).map(([id, part]) => (
                                                        <div key={id} className="p-5 bg-card border border-border rounded-3xl space-y-4 relative shadow-sm">
                                                            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary/50" />
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-sm uppercase">{id}</div>
                                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Configurar Serie</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const parts = { ...(editingChart.parts || {}) };
                                                                        delete parts[id];
                                                                        updateChart(editingChart.id, { parts });
                                                                    }}
                                                                    className="text-muted-foreground hover:text-red-500"
                                                                    title="Eliminar Serie"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <select
                                                                    title="Tabla"
                                                                    value={part.targetCol.split('.')[0]}
                                                                    onChange={(e) => {
                                                                        const parts = { ...(editingChart.parts || {}) };
                                                                        parts[id] = { ...part, targetCol: `${e.target.value}.${part.targetCol.split('.')[1] || "id"}` };
                                                                        updateChart(editingChart.id, { parts });
                                                                    }}
                                                                    className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                                                >
                                                                    <option value="lead">lead</option>
                                                                    <option value="llamadas">llamadas</option>
                                                                    <option value="agendamientos">agendamientos</option>
                                                                    <option value="lead_cualificacion">cualificacion</option>
                                                                </select>
                                                                <select
                                                                    title="Método"
                                                                    value={part.calcType}
                                                                    onChange={(e) => {
                                                                        const parts = { ...(editingChart.parts || {}) };
                                                                        parts[id] = { ...part, calcType: e.target.value as "count" | "sum" | "avg" };
                                                                        updateChart(editingChart.id, { parts });
                                                                    }}
                                                                    className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                                                >
                                                                    <option value="count">Contar</option>
                                                                    <option value="sum">Sumar</option>
                                                                    <option value="avg">Promedio</option>
                                                                </select>
                                                            </div>
                                                            <select
                                                                title="Columna"
                                                                value={part.targetCol.split('.')[1] || "id"}
                                                                onChange={(e) => {
                                                                    const parts = { ...(editingChart.parts || {}) };
                                                                    parts[id] = { ...part, targetCol: `${part.targetCol.split('.')[0]}.${e.target.value}` };
                                                                    updateChart(editingChart.id, { parts });
                                                                }}
                                                                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                                            >
                                                                {(SCHEMA_COLUMNS[part.targetCol.split('.')[0]] || SCHEMA_COLUMNS["lead"]).map(col => (
                                                                    <option key={col} value={col}>{col}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        <div className="p-6 border-t border-border bg-muted/30">
                            <button
                                onClick={() => setEditingChartId(null)}
                                className="w-full py-4 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:shadow-primary/20 active:scale-95 transition-all text-xs"
                            >
                                Aplicar Configuración
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

interface Props {
    tenant: Tenant;
    initialCharts: ChartConfig[];
    data: Record<string, ChartData>;
    isAdmin: boolean;
    filters?: AnalyticsFilters;
    configKey?: string;
    title?: string;
}
