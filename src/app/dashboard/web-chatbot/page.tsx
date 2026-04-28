"use client";

import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import { 
    MessageCircle, Zap, 
    Save, PlusCircle, 
    Trash2, 
    Code, Globe, 
    Bot, CheckCircle2,
    Palette, Settings2,
    Copy, ExternalLink,
    LucideIcon,
    AlertCircle,
    Smartphone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getWebWidgets, saveWebWidget, deleteWebWidget } from "@/lib/actions/web-widgets";
import { getAIAgents } from "@/lib/actions/agents";
import { WebWidget, AIAgent } from "@/types/database";

export default function WebChatbotPage() {
    const [widgets, setWidgets] = useState<WebWidget[]>([]);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [selectedWidget, setSelectedWidget] = useState<WebWidget | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Form state
    const [formData, setFormData] = useState<Partial<WebWidget>>({
        name: "",
        agent_id: null,
        welcome_message: "¡Hola! ¿En qué puedo ayudarte hoy?",
        bubble_color: "#25D366",
        bubble_icon: "message-circle",
        status: "ACTIVE"
    });

    const loadData = useCallback(async (isInitial = false) => {
        const [widgetsRes, agentsRes] = await Promise.all([
            getWebWidgets(),
            getAIAgents()
        ]);

        if (widgetsRes.success && widgetsRes.data) {
            setWidgets(widgetsRes.data);
            if (isInitial && widgetsRes.data.length > 0 && !selectedWidget) {
                const first = widgetsRes.data[0];
                setSelectedWidget(first);
                setFormData(first);
            }
        } else if (!widgetsRes.success) {
            setError(widgetsRes.error || "Error al cargar widgets. Verifique que la tabla 'web_widgets' exista.");
        }

        if (agentsRes.success && agentsRes.data) {
            setAgents(agentsRes.data);
        }
    }, [selectedWidget]);

    useEffect(() => {
        loadData(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSelectWidget = (w: WebWidget) => {
        setSelectedWidget(w);
        setFormData(w);
        setError(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const res = await saveWebWidget(formData);
        if (res.success && res.data) {
            await loadData();
            setSelectedWidget(res.data);
            setFormData(res.data);
            alert("Configuración de conexión guardada con éxito.");
        } else {
            alert("Error al guardar: " + res.error);
        }
        setIsSaving(false);
    };

    const handleCreate = async () => {
        setIsSaving(true);
        const res = await saveWebWidget({
            ...formData,
            id: undefined
        });
        if (res.success && res.data) {
            await loadData();
            setSelectedWidget(res.data);
            setFormData(res.data);
            setIsCreateModalOpen(false);
        } else {
            alert("Error al crear: " + res.error);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta configuración de widget?")) return;
        const res = await deleteWebWidget(id);
        if (res.success) {
            await loadData();
            setSelectedWidget(null);
            setFormData({
                name: "",
                agent_id: null,
                welcome_message: "¡Hola! ¿En qué puedo ayudarte hoy?",
                bubble_color: "#25D366",
                bubble_icon: "message-circle",
                status: "ACTIVE"
            });
        }
    };

    const copyEmbedCode = (id: string) => {
        const code = `<script src="${window.location.origin}/api/widget/embed.js?id=${id}" async></script>`;
        navigator.clipboard.writeText(code);
        alert("Código de inserción copiado al portapapeles.");
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 text-white">
            <div className="flex items-center justify-between px-8 py-6 bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Conector Web</h1>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest leading-none mt-1">Conecta tus agentes de IA a burbujas de chat web.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving || !selectedWidget}
                        title="Guardar cambios"
                        className="flex items-center gap-2 h-11 px-6 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[11px] rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? "Guardando..." : "Guardar Configuración"}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-80 border-r border-white/5 bg-black/40 flex flex-col">
                    <div className="p-6">
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            title="Nueva burbuja de chat"
                            className="w-full h-11 border border-dashed border-primary/40 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Nueva Conexión Web
                        </button>
                    </div>

                    {error && (
                        <div className="mx-6 mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Error de Conexión</p>
                                <p className="text-[9px] text-red-500/60 font-medium leading-relaxed">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
                        {widgets.map(w => (
                            <div
                                key={w.id}
                                onClick={() => handleSelectWidget(w)}
                                className={cn(
                                    "p-4 rounded-2xl border transition-all cursor-pointer group",
                                    selectedWidget?.id === w.id ? "bg-primary/10 border-primary/20" : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                                )}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-primary">{w.status}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }} title="Eliminar" className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"><Trash2 className="h-3 w-3" /></button>
                                </div>
                                <h3 className="font-bold text-sm">{w.name}</h3>
                                <p className="text-[10px] text-white/30 truncate">{agents.find(a => a.id === w.agent_id)?.name || "Sin agente vinculado"}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    {selectedWidget ? (
                        <div className="max-w-4xl mx-auto space-y-12">
                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <SectionHeader icon={Settings2} title="1. Vincular Agente" />
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-relaxed">
                                        Selecciona un agente de IA para que atienda esta burbuja web. La IA usará automáticamente las variables que configuraste en el agente.
                                    </p>
                                    
                                    <div className="grid grid-cols-1 gap-3">
                                        {agents.length > 0 ? (
                                            agents.map(a => (
                                                <div 
                                                    key={a.id}
                                                    onClick={() => setFormData({...formData, agent_id: a.id})}
                                                    className={cn(
                                                        "p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 group relative overflow-hidden",
                                                        formData.agent_id === a.id 
                                                            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" 
                                                            : "bg-white/[0.02] border-white/10 hover:border-white/20"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center border transition-all",
                                                        formData.agent_id === a.id ? "bg-primary text-white border-primary" : "bg-white/5 border-white/10 text-white/40"
                                                    )}>
                                                        <Bot className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-bold truncate">{a.name}</h4>
                                                        <p className="text-[10px] text-white/40 truncate font-medium">{a.description || "Sin descripción"}</p>
                                                    </div>
                                                    {formData.agent_id === a.id && (
                                                        <motion.div layoutId="active-check" className="text-primary">
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        </motion.div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 border border-dashed border-white/5 rounded-2xl text-center space-y-3">
                                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">No hay agentes para vincular</p>
                                                <Link href="/dashboard/agents" className="text-[10px] text-primary font-black uppercase tracking-widest mt-2 block hover:underline">Ir a crear un agente primero</Link>
                                            </div>
                                        )}
                                    </div>

                                    <SectionHeader icon={Palette} title="2. Apariencia" />
                                    <div className="flex items-center gap-6">
                                        <div className="flex-1 space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/20">Color de la Burbuja (Estilo WhatsApp)</label>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="color" 
                                                    value={formData.bubble_color || "#25D366"}
                                                    onChange={(e) => setFormData({...formData, bubble_color: e.target.value})}
                                                    title="Color"
                                                    className="h-10 w-10 rounded-lg overflow-hidden border-0 bg-transparent cursor-pointer"
                                                />
                                                <input 
                                                    type="text" 
                                                    value={formData.bubble_color || ""}
                                                    onChange={(e) => setFormData({...formData, bubble_color: e.target.value})}
                                                    title="Hex"
                                                    className="flex-1 h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-[10px] font-mono text-white/40"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <SectionHeader icon={Smartphone} title="3. Integración Meta (WhatsApp)" />
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-relaxed">
                                        Cuando el usuario deje su teléfono, se iniciará una conversación automática vía Meta API.
                                    </p>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-tight text-white/60">Estado de Conexión Meta</span>
                                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase rounded-lg border border-emerald-500/20 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" /> Conectado
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-white/20">Plantilla de Handover</label>
                                            <select title="Plantilla" className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-[10px] font-bold text-white/40">
                                                <option>bienvenida_web_widget</option>
                                                <option>seguimiento_prospecto</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20">Mensaje de Bienvenida</label>
                                        <textarea 
                                            value={formData.welcome_message || ""}
                                            onChange={(e) => setFormData({...formData, welcome_message: e.target.value})}
                                            title="Bienvenida"
                                            className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium text-white/80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                        />
                                    </div>

                                    <SectionHeader icon={Code} title="4. Código de Inserción" />
                                    <div className="bg-black/60 rounded-[32px] p-8 border border-white/5 space-y-4">
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                                            Copia este script antes de la etiqueta &lt;/body&gt; de tu sitio web.
                                        </p>
                                        <div className="relative group">
                                            <pre className="p-5 bg-white/[0.02] border border-white/10 rounded-2xl text-[10px] font-mono text-primary/60 overflow-x-auto whitespace-pre-wrap">
                                                {`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/widget/embed.js?id=${selectedWidget.id}" async></script>`}
                                            </pre>
                                            <button onClick={() => copyEmbedCode(selectedWidget.id)} title="Copiar" className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"><Copy className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                            <Globe className="h-20 w-20 mb-6" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Selecciona una Conexión Web</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] mt-2">O crea una nueva para empezar</p>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsCreateModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[40px] p-10 space-y-8">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Nueva Burbuja</h2>
                            <InputField label="Nombre Identificador (ej: Landing Web)" value={formData.name || ""} onChange={(v) => setFormData({...formData, name: v})} />
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 h-14 rounded-2xl bg-white/5 font-black uppercase tracking-widest text-[11px]">Cancelar</button>
                                <button onClick={handleCreate} className="flex-1 h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[11px]">Crear Conexión</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
}

function SectionHeader({ icon: Icon, title }: { icon: LucideIcon | React.ElementType, title: string }) {
    return (
        <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-primary" />
            <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-white/40">{title}</h3>
        </div>
    );
}

function InputField({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/20">{label}</label>
            <input 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                title={label}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
        </div>
    );
}
