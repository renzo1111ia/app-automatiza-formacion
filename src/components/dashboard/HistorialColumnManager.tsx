"use client";

import { useState } from "react";
import { Tenant } from "@/types/tenant";
import { updateTenant } from "@/lib/actions/tenant";
import { useRouter } from "next/navigation";
import {
    GripVertical, Trash2, Plus, Save, X,
    Table, Check, ChevronRight, Info, Settings
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
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
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';

interface ColumnConfig {
    key: string;
    label: string;
}

const PREDEFINED_FIELDS = [
    { key: "fecha_ingreso_crm", label: "Fecha Ingreso CRM", desc: "Fecha en que el lead entró al sistema" },
    { key: "lead", label: "Lead (Nombre/Telf)", desc: "Bloque consolidado de nombre, teléfono y país" },
    { key: "nombre", label: "Nombre", desc: "Campo individual de nombre" },
    { key: "apellido", label: "Apellido", desc: "Campo individual de apellido" },
    { key: "telefono", label: "Teléfono", desc: "Campo individual de teléfono" },
    { key: "email", label: "Email", desc: "Correo electrónico del lead" },
    { key: "pais", label: "País", desc: "País de origen" },
    { key: "origen", label: "Origen", desc: "Fuente del lead (UTM Source)" },
    { key: "campana", label: "Campaña", desc: "Nombre de la campaña (UTM Campaign)" },
    { key: "tipo_lead", label: "Tipo Lead", desc: "Categoría (Nuevo, Ilocalizable, etc)" },
    { key: "programa_nombre", label: "Programa", desc: "Programa de interés" },
    { key: "cualificacion", label: "Cualificación", desc: "Estado de cualificación (SI/NO)" },
    { key: "fecha_agendada_cliente", label: "Cita Agendada", desc: "Fecha de la cita con el asesor" },
    { key: "intentos_count", label: "Nº Intentos", desc: "Cantidad de intentos de contacto" },
    { key: "estado_llamada", label: "Última Llamada", desc: "Estado y grabación de la última llamada" },
    { key: "whatsapp_status", label: "Estado WhatsApp", desc: "Si tiene Opt-In o estado del chat" },
    { key: "notificaciones_status", label: "Notificaciones", desc: "Estado del envío de notificaciones" },
];

interface SortableColumnProps {
    col: ColumnConfig;
    onRemove: (key: string) => void;
    onLabelChange: (key: string, newLabel: string) => void;
}

function SortableColumn({ col, onRemove, onLabelChange }: SortableColumnProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useSortable({ id: col.key });



    return (
        <motion.div
            ref={setNodeRef}
            animate={{
                x: transform ? transform.x : 0,
                y: transform ? transform.y : 0,
                scale: isDragging ? 1.05 : 1,
                zIndex: isDragging ? 50 : 1
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
                "flex items-center gap-3 p-3 bg-card border border-border rounded-2xl shadow-sm group",
                isDragging && "opacity-50 z-50 bg-muted/50 border-primary/50 shadow-2xl"
            )}
        >
            <div {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors">
                <GripVertical className="h-5 w-5" />
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <input
                    type="text"
                    value={col.label}
                    onChange={(e) => onLabelChange(col.key, e.target.value)}
                    className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest text-foreground focus:ring-0 p-0"
                    placeholder="ETIQUETA"
                />
                <span className="text-[10px] font-mono text-muted-foreground font-bold mt-0.5 opacity-50">
                    {col.key}
                </span>
            </div>

            <button
                onClick={() => onRemove(col.key)}
                title="Eliminar columna"
                aria-label="Eliminar columna"
                className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </motion.div>
    );
}

export function HistorialColumnManager({ tenant, sampleKeys = [] }: { tenant: Tenant, sampleKeys?: string[] }) {
    const [columns, setColumns] = useState<ColumnConfig[]>(
        ((tenant.config as unknown as { historial_columns?: ColumnConfig[] })?.historial_columns) || []
    );
    const [saving, setSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const router = useRouter();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setColumns((items) => {
                const oldIndex = items.findIndex((i) => i.key === active.id);
                const newIndex = items.findIndex((i) => i.key === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            const newConfig = {
                ...(tenant.config as unknown as Record<string, unknown>),
                historial_columns: columns
            };
            const res = await updateTenant(tenant.id, { config: newConfig });
            if (res.success) {
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

    function addColumn(key: string, label: string) {
        if (columns.some(c => c.key === key)) return;
        setColumns([...columns, { key, label }]);
        setIsAdding(false);
    }

    function removeColumn(key: string) {
        setColumns(columns.filter(c => c.key !== key));
    }

    function updateLabel(key: string, newLabel: string) {
        setColumns(columns.map(c => c.key === key ? { ...c, label: newLabel } : c));
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                        <Table className="h-4 w-4 text-primary" />
                        Configuración de Columnas
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        Personaliza los encabezados y campos visibles en el Historial
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (confirm("Se cargarán todos los campos detectados en la base de datos que aún no estén en la lista. ¿Continuar?")) {
                                const ignoredKeys = ["id", "id_lead", "llamadas", "total_llamadas", "url_grabacion", "transcripcion", "resumen"];
                                const newCols: ColumnConfig[] = [...columns];
                                sampleKeys.forEach(key => {
                                    if (!ignoredKeys.includes(key) && !newCols.some(c => c.key === key)) {
                                        newCols.push({
                                            key,
                                            label: key.replace(/_/g, " ").toUpperCase()
                                        });
                                    }
                                });
                                setColumns(newCols);
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted border border-border rounded-xl hover:bg-muted/80 transition-all font-outfit"
                    >
                        <Settings className="h-3.5 w-3.5" /> Descubrir Campos
                    </button>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all shadow-sm font-outfit"
                    >
                        <Plus className="h-3.5 w-3.5" /> Añadir Columna
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-primary rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                    >
                        <Save className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-[32px] p-8">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={columns.map(c => c.key)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {columns.map((col) => (
                                <SortableColumn
                                    key={col.key}
                                    col={col}
                                    onRemove={removeColumn}
                                    onLabelChange={updateLabel}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                {columns.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed border-border rounded-3xl">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic">
                            No hay columnas configuradas. El sistema usará los campos por defecto.
                        </p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-3">
                <Info className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                    <span className="text-primary">TIP:</span> Arrastra las columnas para cambiar su orden en la tabla.
                    Haz clic en el nombre para editar la etiqueta que verá el cliente.
                </p>
            </div>

            {/* Modal de añadir columna */}
            {isAdding && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setIsAdding(false)}
                    />
                    <div className="relative bg-card border border-border w-full max-w-2xl rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Añadir Columna</h2>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                    Selecciona un campo disponible de la base de datos
                                </p>
                            </div>
                            <button
                                onClick={() => setIsAdding(false)}
                                className="p-2 hover:bg-muted rounded-xl transition-all"
                                title="Cerrar"
                            >
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {PREDEFINED_FIELDS.map(f => {
                                    const exists = columns.some(c => c.key === f.key);
                                    return (
                                        <button
                                            key={f.key}
                                            disabled={exists}
                                            onClick={() => addColumn(f.key, f.label)}
                                            className={cn(
                                                "p-4 text-left border rounded-2xl transition-all flex items-center justify-between group",
                                                exists
                                                    ? "bg-muted/50 border-border opacity-50 cursor-not-allowed"
                                                    : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                                    {f.label}
                                                    {exists && <Check className="h-3 w-3 text-emerald-500" />}
                                                </h4>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5 line-clamp-1">
                                                    {f.desc}
                                                </p>
                                            </div>
                                            {!exists && <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-[9px] uppercase font-black">
                                    <span className="bg-card px-3 text-muted-foreground tracking-[0.3em]">o campo personalizado</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Key en Supabase</label>
                                <div className="flex gap-2">
                                    <input
                                        id="custom-key"
                                        type="text"
                                        placeholder="ej: mi_campo_custom"
                                        className="flex-1 bg-muted border border-border rounded-xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:border-primary transition-all"
                                    />
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('custom-key') as HTMLInputElement;
                                            if (el.value) addColumn(el.value, el.value.replace(/_/g, ' ').toUpperCase());
                                        }}
                                        className="px-6 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                                    >
                                        Añadir
                                    </button>
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider italic">
                                    Asegúrate de que la &quot;Key&quot; existe como columna en la tabla `lead`.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
