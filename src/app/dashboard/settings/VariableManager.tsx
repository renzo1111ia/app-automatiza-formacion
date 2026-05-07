/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { 
    Type, Hash, ToggleLeft, Braces, List, Calendar, Mail, Phone, Link, DollarSign, ChevronDown, Plus, Trash2, Edit3, Save, X, Settings2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type VariableType = 
    | 'string' 
    | 'number' 
    | 'boolean' 
    | 'object' 
    | 'array' 
    | 'date' 
    | 'email' 
    | 'phone' 
    | 'url' 
    | 'currency' 
    | 'select' 
    | 'multi-select';

export interface Variable {
    id: string;
    name: string;
    type: VariableType;
    defaultValue: unknown;
    options?: string[];
    description?: string;
}

interface VariableManagerProps {
    variables: Variable[];
    onChange: (variables: Variable[]) => void;
}

const TYPE_CONFIG: Record<VariableType, { label: string; icon: any; color: string }> = {
    string: { label: "Texto", icon: Type, color: "text-blue-500" },
    number: { label: "Número", icon: Hash, color: "text-emerald-500" },
    boolean: { label: "Booleano", icon: ToggleLeft, color: "text-purple-500" },
    object: { label: "Objeto (JSON)", icon: Braces, color: "text-orange-500" },
    array: { label: "Lista", icon: List, color: "text-indigo-500" },
    date: { label: "Fecha", icon: Calendar, color: "text-pink-500" },
    email: { label: "Email", icon: Mail, color: "text-cyan-500" },
    phone: { label: "Teléfono", icon: Phone, color: "text-green-500" },
    url: { label: "URL/Link", icon: Link, color: "text-blue-600" },
    currency: { label: "Moneda", icon: DollarSign, color: "text-yellow-600" },
    select: { label: "Selección Única", icon: ChevronDown, color: "text-violet-500" },
    'multi-select': { label: "Selección Múltiple", icon: List, color: "text-rose-500" },
};

export function VariableManager({ variables = [], onChange }: VariableManagerProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Variable>>({});

    const handleAdd = () => {
        const newVar: Variable = {
            id: `v_${variables.length + 1}`,
            name: "nueva_variable",
            type: "string",
            defaultValue: "",
            description: ""
        };
        onChange([...variables, newVar]);
        startEdit(newVar);
    };

    const startEdit = (v: Variable) => {
        setEditingId(v.id);
        setEditForm({ ...v });
    };

    const handleSave = () => {
        if (!editingId) return;
        const updated = variables.map(v => v.id === editingId ? { ...v, ...editForm } as Variable : v);
        onChange(updated);
        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm("¿Eliminar esta variable?")) return;
        onChange(variables.filter(v => v.id !== id));
    };

    const renderValueInput = (v: Partial<Variable>, isEdit: boolean) => {
        const type = v.type || 'string';
        const value = v.defaultValue;
        const setVal = (val: unknown) => setEditForm(prev => ({ ...prev, defaultValue: val }));

        if (!isEdit) {
            if (type === 'boolean') return <span>{value ? 'Verdadero' : 'Falso'}</span>;
            if (type === 'object') return <span className="font-mono text-[10px] opacity-60">JSON Object</span>;
            return <span>{String(value || '-')}</span>;
        }

        switch (type) {
            case 'boolean':
                return (
                    <button 
                        onClick={() => setVal(!value)}
                        className={cn(
                            "flex items-center gap-2 px-3 h-10 rounded-xl border transition-all text-xs font-bold",
                            value ? "bg-purple-500 text-white border-purple-600" : "bg-slate-100 text-slate-500 border-slate-200"
                        )}
                    >
                        {value ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                );
            case 'number':
                return <Input type="number" value={(value as any)} onChange={e => setVal(Number(e.target.value))} className="h-10 rounded-xl" />;
            case 'date':
                return <Input type="date" value={(value as any)} onChange={e => setVal(e.target.value)} className="h-10 rounded-xl" />;
            case 'select':
            case 'multi-select':
                return (
                    <div className="space-y-2">
                        <Input 
                            placeholder="Opciones (separadas por coma)" 
                            value={v.options?.join(", ") || ""} 
                            onChange={e => setEditForm(prev => ({ ...prev, options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                            className="h-10 rounded-xl"
                        />
                        <Input placeholder="Valor por defecto" value={(value as any)} onChange={e => setVal(e.target.value)} className="h-10 rounded-xl" />
                    </div>
                );
            case 'object':
            case 'array':
                return (
                    <textarea 
                        value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} 
                        onChange={e => setVal(e.target.value)}
                        className="w-full h-24 p-3 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                        placeholder='{ "key": "value" }'
                    />
                );
            default:
                return <Input value={(value as any)} onChange={e => setVal(e.target.value)} className="h-10 rounded-xl" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Gestión de Variables</h3>
                </div>
                <button 
                    onClick={handleAdd}
                    className="flex items-center gap-2 h-8 px-4 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                >
                    <Plus className="h-3.5 w-3.5" /> Nueva Variable
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Variable / Nombre</th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo</th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Valor Inicial</th>
                            <th className="px-6 py-3 text-right pr-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {variables.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-xs font-medium">
                                    No hay variables definidas. Comienza añadiendo una.
                                </td>
                            </tr>
                        )}
                        {variables.map(v => {
                            const isEditing = editingId === v.id;
                            const config = TYPE_CONFIG[v.type];
                            const Icon = config.icon;

                            return (
                                <tr key={v.id} className={cn("transition-all", isEditing ? "bg-primary/5" : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]")}>
                                    <td className="px-6 py-4">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <Input 
                                                    value={editForm.name} 
                                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                                                    className="h-10 font-mono font-bold text-primary border-primary/20"
                                                />
                                                <Input 
                                                    value={editForm.description} 
                                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                    placeholder="Descripción (opcional)"
                                                    className="h-8 text-[10px] opacity-70"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <code className="text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">{v.name}</code>
                                                {v.description && <p className="text-[10px] text-slate-500 mt-1">{v.description}</p>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isEditing ? (
                                            <div className="relative">
                                                <select 
                                                    value={editForm.type}
                                                    onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value as VariableType }))}
                                                    className="w-full h-10 pl-3 pr-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs appearance-none focus:ring-2 focus:ring-primary/20 outline-none"
                                                    aria-label="Seleccionar tipo de variable"
                                                >
                                                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                                        <option key={key} value={key}>{cfg.label}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Icon className={cn("h-3.5 w-3.5", config.color)} />
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{config.label}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                            {renderValueInput(isEditing ? editForm : v, isEditing)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={handleSave} className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20" title="Guardar">
                                                        <Save className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-500 transition-all" title="Cancelar">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(v)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-600 transition-all" title="Editar">
                                                        <Edit3 className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(v.id)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-500 transition-all" title="Eliminar">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
