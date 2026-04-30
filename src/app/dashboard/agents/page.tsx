"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
    Bot, Zap, 
    Save, 
    BarChart3,
    PlusCircle,
    AlarmClock, MessageSquare as MessageSquareIcon,
    Trash2, Edit3,
    Activity,
    UserCheck,
    Terminal,
    Play,
    Cpu, Brain, Database as DbIcon,
    X
} from "lucide-react";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getAIAgents, getAgentVariants, saveAgentVariant, saveAIAgent, deleteAIAgent, getAdvisors } from "@/lib/actions/agents";
import { getKnowledgeBase } from "@/lib/actions/knowledge";
import type { AIAgent, AIAgentVariant, KnowledgeItem } from "@/types/database";

interface Advisor {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
}

export default function AgentsPage() {
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
    const [activeTab, setActiveTab] = useState<'BRAIN' | 'AUTOMATION' | 'CRM' | 'METRICS' | 'INACTIVO'>('BRAIN');
    const [advisors, setAdvisors] = useState<Advisor[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
    const [agentToDelete, setAgentToDelete] = useState<AIAgent | null>(null);

    const [newAgentName, setNewAgentName] = useState("");
    const [newAgentDescription, setNewAgentDescription] = useState("");
    
    const [variantA, setVariantA] = useState<Partial<AIAgentVariant>>({});
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeItem[]>([]);

    const loadData = useCallback(async () => {
        const res = await getAIAgents();
        if (res.success && res.data) {
            setAgents(res.data);
            if (res.data.length > 0 && !selectedAgent) setSelectedAgent(res.data[0]);
        }
        const kbRes = await getKnowledgeBase();
        if (kbRes.success && kbRes.data) setKnowledgeBases(kbRes.data);

        const advRes = await getAdvisors();
        if (advRes.success && advRes.data) setAdvisors(advRes.data as Advisor[]);
    }, [selectedAgent]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (selectedAgent) {
            async function loadVariants(agentId: string) {
                setVariantA({ 
                    agent_id: agentId, 
                    is_variant_b: false, 
                    prompt_text: '', 
                    model_provider: 'OPENAI', 
                    model_name: 'gpt-4o', 
                    automation_rules: {
                        contact_policy: 'auto',
                        working_hours: { start: '09:00', end: '21:00', days: [1,2,3,4,5] },
                        retry_delay: 15,
                        max_retries: 3
                    },
                    scheduling_config: { enabled: false, duration: 30, buffer: 15 }
                } as Partial<AIAgentVariant>);
                
                const res = await getAgentVariants(agentId);
                if (res.success && res.data) {
                    const data = res.data as AIAgentVariant[];
                    const a = data.find(v => !v.is_variant_b);
                    if (a) setVariantA(a);
                }
            }
            loadVariants(selectedAgent.id);
        }
    }, [selectedAgent]);

    const handleCreateAgent = async () => {
        if (!newAgentName.trim()) return;
        setSaving(true);
        const res = await saveAIAgent({ name: newAgentName, description: newAgentDescription, status: 'ACTIVE', type: 'QUALIFY' });
        if (res.success && res.data) {
            await loadData();
            setSelectedAgent(res.data);
            setIsCreateModalOpen(false);
            setNewAgentName("");
            setNewAgentDescription("");
        } else alert("Error al crear");
        setSaving(false);
    };

    const handleUpdateAgent = async () => {
        if (!selectedAgent || !newAgentName.trim()) return;
        setSaving(true);
        const res = await saveAIAgent({ id: selectedAgent.id, name: newAgentName, description: newAgentDescription });
        if (res.success && res.data) {
            await loadData();
            setSelectedAgent(res.data);
            setIsEditModalOpen(false);
        } else alert("Error al actualizar");
        setSaving(false);
    };

    const handleDeleteAgent = async () => {
        if (!agentToDelete) return;
        setSaving(true);
        const res = await deleteAIAgent(agentToDelete.id);
        if (res.success) {
            await loadData();
            if (selectedAgent?.id === agentToDelete.id) setSelectedAgent(null);
            setIsDeleteModalOpen(false);
        } else alert("Error al eliminar");
        setSaving(false);
    };

    const handleSave = async () => {
        if (!selectedAgent) return;
        setIsSaving(true);
        try {
            const res = await saveAgentVariant({
                ...variantA,
                agent_id: selectedAgent.id,
                is_active: true,
                is_variant_b: false
            } as AIAgentVariant);
            if (!res.success) throw new Error(res.error || "Error al guardar");
            alert("¡Agente Maestro actualizado con éxito!");
        } catch (err: unknown) { 
            const error = err as Error;
            alert("Error: " + error.message); 
        } 
        finally { setIsSaving(false); }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 text-white selection:bg-primary/30">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 bg-white/[0.02] border-b border-white/5 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                        <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black uppercase tracking-tight">{selectedAgent?.name || "Agente Maestro"}</h1>
                            {selectedAgent && (
                                <button title="Editar Agente" onClick={() => { 
                                    setNewAgentName(selectedAgent.name); 
                                    setNewAgentDescription(selectedAgent.description || ""); 
                                    setIsEditModalOpen(true); 
                                }} className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"><Edit3 className="h-4 w-4" /></button>
                            )}
                        </div>
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mt-1">Single-Prompt Orchestration Console</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsSimulatorOpen(true)} className="flex items-center gap-2 h-11 px-6 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all shadow-xl">
                        <Terminal className="h-4 w-4 text-primary" />
                        Abrir Simulador
                    </button>
                    <button title="Guardar cambios en el agente" onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 h-11 px-8 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                        <Save className="h-4 w-4" />
                        {isSaving ? "Guardando..." : "Publicar Cambios"}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar */}
                <div className="w-80 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col">
                    <div className="p-6">
                        <button onClick={() => setIsCreateModalOpen(true)} className="w-full h-11 border border-dashed border-primary/40 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all shadow-lg shadow-primary/5">
                            <PlusCircle className="h-4 w-4" /> Nuevo Maestro
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-10 scrollbar-thin scrollbar-thumb-white/5">
                        {agents.map(agent => (
                            <div key={agent.id} onClick={() => setSelectedAgent(agent)} className={cn("w-full p-5 rounded-[24px] text-left transition-all border group cursor-pointer relative overflow-hidden", selectedAgent?.id === agent.id ? "bg-primary/10 border-primary/20 shadow-xl" : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]")}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Activo</span>
                                    </div>
                                    <button title="Borrar Agente" onClick={(e) => { e.stopPropagation(); setAgentToDelete(agent); setIsDeleteModalOpen(true); }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                                <h3 className="font-black text-sm text-white truncate tracking-tight">{agent.name}</h3>
                                <p className="text-[10px] text-white/20 mt-1 line-clamp-1 font-bold">{agent.description || "Sin descripción"}</p>
                                {selectedAgent?.id === agent.id && <motion.div layoutId="activeAgent" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
                    <div className="flex items-center border-b border-white/5 bg-black/40 px-8 backdrop-blur-md">
                        <TabButton active={activeTab === 'BRAIN'} onClick={() => setActiveTab('BRAIN')} icon={Brain} label="Cerebro" />
                        <TabButton active={activeTab === 'AUTOMATION'} onClick={() => setActiveTab('AUTOMATION')} icon={Zap} label="Automatización" />
                        <TabButton active={activeTab === 'INACTIVO'} onClick={() => setActiveTab('INACTIVO')} icon={AlarmClock} label="Inactividad" />
                        <TabButton active={activeTab === 'CRM'} onClick={() => setActiveTab('CRM')} icon={DbIcon} label="CRM Sync" />
                        <TabButton active={activeTab === 'METRICS'} onClick={() => setActiveTab('METRICS')} icon={BarChart3} label="Métricas" />
                    </div>

                    <div className="flex-1 p-10 overflow-y-auto no-scrollbar">
                        <AnimatePresence mode="wait">
                            {activeTab === 'BRAIN' && (
                                <motion.div key="BRAIN" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-6xl mx-auto space-y-12 pb-20">
                                    
                                    {/* SECCIÓN 1: CEREBRO DEL AGENTE */}
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                                                    <Cpu className="h-6 w-6 text-primary" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black uppercase tracking-tight">Cerebro del Agente</h3>
                                                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Selecciona el motor de inteligencia para este maestro</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl">
                                                <button onClick={() => setVariantA(p => ({...p, model_provider: 'OPENAI'}))} className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2", variantA.model_provider === 'OPENAI' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-white/40 hover:text-white")}>
                                                    <Zap className="h-3 w-3" /> OpenAI
                                                </button>
                                                <button onClick={() => setVariantA(p => ({...p, model_provider: 'ANTHROPIC'}))} className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2", variantA.model_provider === 'ANTHROPIC' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-white/40 hover:text-white")}>
                                                    <Brain className="h-3 w-3" /> Claude
                                                </button>
                                                <button onClick={() => setVariantA(p => ({...p, model_provider: 'GEMINI'}))} className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2", variantA.model_provider === 'GEMINI' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-white/40 hover:text-white")}>
                                                    <Zap className="h-3 w-3" /> Gemini
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {variantA.model_provider === 'OPENAI' && (
                                                <>
                                                    <ModelCard active={variantA.model_name === 'gpt-4.1'} onClick={() => setVariantA(p => ({...p, model_name: 'gpt-4.1'}))} label="GPT-4.1 (Omni Series)" desc="Última versión optimizada con razonamiento 4.1" />
                                                    <ModelCard active={variantA.model_name === 'gpt-4.1-mini'} onClick={() => setVariantA(p => ({...p, model_name: 'gpt-4.1-mini'}))} label="GPT-4.1 Mini" desc="Máxima velocidad con inteligencia 4.1" />
                                                    <ModelCard active={variantA.model_name === 'gpt-4o'} onClick={() => setVariantA(p => ({...p, model_name: 'gpt-4o'}))} label="GPT-4o (Standard)" desc="El modelo insignia versátil y rápido" />
                                                    <ModelCard active={variantA.model_name === 'gpt-4o-mini'} onClick={() => setVariantA(p => ({...p, model_name: 'gpt-4o-mini'}))} label="GPT-4o MINI" desc="Económico y ultra-rápido" />
                                                    <ModelCard active={variantA.model_name === 'o3-mini'} onClick={() => setVariantA(p => ({...p, model_name: 'o3-mini'}))} label="o3-mini (Reasoning)" desc="Razonamiento ultra-rápido para lógica compleja" />
                                                    <ModelCard active={variantA.model_name === 'o1'} onClick={() => setVariantA(p => ({...p, model_name: 'o1'}))} label="o1 (Preview)" desc="Razonamiento profundo avanzado" />
                                                    <ModelCard active={variantA.model_name === 'o1-mini'} onClick={() => setVariantA(p => ({...p, model_name: 'o1-mini'}))} label="o1-mini" desc="Razonamiento rápido y eficaz" />
                                                    <ModelCard active={variantA.model_name === 'gpt-4-turbo'} onClick={() => setVariantA(p => ({...p, model_name: 'gpt-4-turbo'}))} label="GPT-4 Turbo" desc="Precisión legacy demostrada" />
                                                </>
                                            )}
                                            {variantA.model_provider === 'ANTHROPIC' && (
                                                <>
                                                    <ModelCard active={variantA.model_name === 'claude-3-5-sonnet-20241022'} onClick={() => setVariantA(p => ({...p, model_name: 'claude-3-5-sonnet-20241022'}))} label="Claude 3.5 Sonnet" desc="Balance perfecto entre velocidad e inteligencia" />
                                                    <ModelCard active={variantA.model_name === 'claude-3-5-haiku-20241022'} onClick={() => setVariantA(p => ({...p, model_name: 'claude-3-5-haiku-20241022'}))} label="Claude 3.5 Haiku" desc="El más rápido de la familia Anthropic" />
                                                    <ModelCard active={variantA.model_name === 'claude-3-opus-20240229'} onClick={() => setVariantA(p => ({...p, model_name: 'claude-3-opus-20240229'}))} label="Claude 3 Opus" desc="Máximo razonamiento y matices" />
                                                </>
                                            )}
                                            {variantA.model_provider === 'GEMINI' && (
                                                <>
                                                    <ModelCard active={variantA.model_name === 'gemini-1.5-pro'} onClick={() => setVariantA(p => ({...p, model_name: 'gemini-1.5-pro'}))} label="Gemini 1.5 Pro" desc="Gran ventana de contexto y alta fidelidad" />
                                                    <ModelCard active={variantA.model_name === 'gemini-1.5-flash'} onClick={() => setVariantA(p => ({...p, model_name: 'gemini-1.5-flash'}))} label="Gemini 1.5 Flash" desc="Optimizado para velocidad y escala" />
                                                </>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-4 flex items-center gap-2">
                                                <Edit3 className="h-3 w-3" /> O introduce un ID de modelo manual
                                            </label>
                                            <input 
                                                type="text" 
                                                value={variantA.model_name || ""} 
                                                onChange={(e) => setVariantA(p => ({...p, model_name: e.target.value}))}
                                                className="w-full h-14 bg-black/60 border border-white/10 rounded-2xl px-6 text-sm font-bold text-white/80 focus:border-primary/40 outline-none transition-all"
                                                placeholder="ej: gpt-4.1-mini"
                                            />
                                        </div>
                                    </div>

                                    {/* SECCIÓN 2: ADN DEL AGENTE (PROMPT) */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                <Terminal className="h-6 w-6 text-amber-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black uppercase tracking-tight">ADN del Agente</h3>
                                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Define el comportamiento y objetivos del maestro</p>
                                            </div>
                                        </div>
                                        <textarea 
                                            value={variantA.prompt_text || ""} 
                                            onChange={(e) => setVariantA(p => ({...p, prompt_text: e.target.value}))} 
                                            className="w-full h-[400px] bg-black/60 border border-white/5 rounded-[40px] p-10 text-base leading-relaxed font-medium focus:ring-4 focus:ring-primary/5 transition-all resize-none outline-none text-white/80 shadow-2xl backdrop-blur-xl border-t-primary/20" 
                                            placeholder="Eres un agente experto en cualificación de leads..." 
                                        />
                                    </div>

                                    {/* SECCIÓN 3: CAPTURAR DATOS (MEMORIA) */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                                    <Brain className="h-6 w-6 text-purple-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black uppercase tracking-tight text-amber-500">Capturar Datos (Memoria del Agente)</h3>
                                                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">La IA detectará estos datos en la charla y los guardará automáticamente</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    title="Nueva etiqueta de memoria"
                                                    type="text" 
                                                    placeholder="Nueva Etiqueta..." 
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                                                            if (val) {
                                                                const current = variantA.tracked_variables || [];
                                                                if (!current.includes(val)) {
                                                                    setVariantA(p => ({...p, tracked_variables: [...current, val]}));
                                                                }
                                                                (e.target as HTMLInputElement).value = '';
                                                            }
                                                        }
                                                    }}
                                                    className="h-11 px-6 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-amber-500/40"
                                                />
                                                <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                                                    <PlusCircle className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-3 p-8 bg-black/20 border border-white/5 rounded-[32px]">
                                            {(variantA.tracked_variables || ['USER_NAME', 'ID_LEAD', 'USER_COUNTRY', 'USER_PHONE', 'COURSE_NAME', 'QUALIFIED', 'CORRECTO']).map(tag => (
                                                <div key={tag} className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl group hover:border-amber-500/50 transition-all cursor-pointer">
                                                    <DbIcon className="h-3 w-3 text-amber-500/40" />
                                                    <span className="text-xs font-black text-amber-500 tracking-wider">{"{{"}{tag}{"}}"}</span>
                                                    <button 
                                                        title={`Eliminar etiqueta ${tag}`}
                                                        onClick={() => setVariantA(p => ({...p, tracked_variables: (p.tracked_variables || []).filter(t => t !== tag)}))}
                                                        className="opacity-0 group-hover:opacity-100 transition-all text-white/20 hover:text-red-400"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {(variantA.tracked_variables || []).length === 0 && (
                                                <p className="text-[10px] font-black uppercase text-white/10 tracking-[0.3em] py-4">No hay etiquetas de memoria configuradas</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* SECCIÓN 4: CREDENCIALES */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                                    <Zap className="h-6 w-6 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black uppercase tracking-tight">Credenciales de Acceso (Model Provider)</h3>
                                                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Llave API exclusiva para este agente maestro</p>
                                                </div>
                                            </div>
                                            <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Mostrar</button>
                                        </div>
                                        
                                        <div className="relative group">
                                            <input 
                                                type="password" 
                                                title="API Key del Proveedor"
                                                value={variantA.api_key || ""} 
                                                onChange={(e) => setVariantA(p => ({...p, api_key: e.target.value}))}
                                                className="w-full h-20 bg-black/40 border border-white/10 rounded-[32px] px-10 text-lg tracking-[0.5em] text-primary focus:border-primary/40 outline-none transition-all shadow-2xl"
                                                placeholder="••••••••••••••••••••••••••••••••••••••••••••••••"
                                            />
                                            <p className="text-[9px] text-white/20 mt-4 italic ml-4">
                                                * Esta llave se usará exclusivamente para las llamadas procesadas por este agente. Si se deja vacía, se usará la llave global del sistema.
                                            </p>
                                        </div>
                                    </div>

                                    {/* SECCIÓN 5: KNOWLEDGE BASE */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                <DbIcon className="h-6 w-6 text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black uppercase tracking-tight">Biblioteca de Conocimiento</h3>
                                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Entrena al agente con tus documentos PDF</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {knowledgeBases.map((kb) => {
                                                const isSelected = variantA.knowledge_base_ids?.includes(kb.id);
                                                return (
                                                    <button 
                                                        key={kb.id}
                                                        onClick={() => {
                                                            const currentIds = variantA.knowledge_base_ids || [];
                                                            const newIds = isSelected 
                                                                ? currentIds.filter(id => id !== kb.id)
                                                                : [...currentIds, kb.id];
                                                            setVariantA(p => ({ ...p, knowledge_base_ids: newIds }));
                                                        }}
                                                        className={cn(
                                                            "p-6 rounded-[32px] border text-left transition-all flex items-center justify-between group h-24",
                                                            isSelected ? "bg-emerald-500/10 border-emerald-500/40 shadow-xl shadow-emerald-500/10" : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4 overflow-hidden">
                                                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-all", isSelected ? "bg-emerald-500 text-white" : "bg-white/5 text-white/20")}>
                                                                <DbIcon className="h-6 w-6" />
                                                            </div>
                                                            <div className="overflow-hidden">
                                                                <h4 className={cn("text-sm font-black uppercase tracking-tight truncate", isSelected ? "text-white" : "text-white/40")}>{kb.name}</h4>
                                                                <p className="text-[10px] text-white/20 font-bold uppercase truncate">{kb.description || "Documento indexado"}</p>
                                                            </div>
                                                        </div>
                                                        {isSelected && <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                </motion.div>
                            )}

                            {activeTab === 'AUTOMATION' && (
                                <motion.div key="AUTOMATION" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-6xl mx-auto space-y-10 pb-20">
                                    <div className="p-12 bg-white/[0.02] border border-white/5 rounded-[56px] space-y-12">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-16 w-16 rounded-[24px] bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-2xl shadow-amber-500/5">
                                                    <UserCheck className="h-8 w-8 text-amber-500" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black uppercase tracking-tight">Round Robin Monitor</h3>
                                                    <p className="text-[11px] text-white/40 font-black uppercase tracking-widest mt-1">Gestión de flujo de leads para asesores humanos</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                                <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                                                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Sincronización en Vivo</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {advisors.map(adv => (
                                                <div key={adv.id} className="p-8 bg-black/40 border border-white/5 rounded-[40px] flex items-center justify-between group hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer">
                                                    <div className="flex items-center gap-5">
                                                        <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center font-black text-white/40 uppercase border border-white/10 text-xl">{adv.name.charAt(0)}</div>
                                                        <div>
                                                            <h4 className="text-base font-black uppercase tracking-tight">{adv.name}</h4>
                                                            <p className="text-xs text-white/20 font-bold tracking-wider">{adv.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                                                        <span className="text-[8px] font-black uppercase text-emerald-500/60">Disponible</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <PolicyCard active={variantA.automation_rules?.contact_policy === 'auto'} onClick={() => setVariantA(prev => ({...prev, automation_rules: {...prev.automation_rules, contact_policy: 'auto'}}))} icon={Zap} label="Auto-Efectivo" desc="Llama o escribe según probabilidad de éxito calculada por IA." />
                                        <PolicyCard active={variantA.automation_rules?.contact_policy === 'call'} onClick={() => setVariantA(prev => ({...prev, automation_rules: {...prev.automation_rules, contact_policy: 'call'}}))} icon={Cpu} label="Prioridad Voz" desc="Inicia siempre con llamada de IA cualificadora." />
                                        <PolicyCard active={variantA.automation_rules?.contact_policy === 'whatsapp'} onClick={() => setVariantA(prev => ({...prev, automation_rules: {...prev.automation_rules, contact_policy: 'whatsapp'}}))} icon={MessageSquareIcon} label="WhatsApp First" desc="Ideal para leads nocturnos o baja señal telefónica." />
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'INACTIVO' && (
                                <motion.div key="INACTIVO" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-6xl mx-auto space-y-12 pb-20">
                                    <div className="p-12 bg-white/[0.02] border border-white/5 rounded-[56px] space-y-12">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-16 w-16 rounded-[24px] bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-2xl shadow-red-500/5">
                                                    <AlarmClock className="h-8 w-8 text-red-500" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black uppercase tracking-tight">Gestión de Inactividad</h3>
                                                    <p className="text-[11px] text-white/40 font-black uppercase tracking-widest mt-1">Reglas automáticas para leads que dejan de responder</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-3 w-3 rounded-full animate-pulse", variantA.automation_rules?.inactivity_enabled ? "bg-emerald-500" : "bg-white/10")} />
                                                <button 
                                                    onClick={() => setVariantA(p => ({...p, automation_rules: {...p.automation_rules, inactivity_enabled: !p.automation_rules?.inactivity_enabled}}))}
                                                    className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", variantA.automation_rules?.inactivity_enabled ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-white/5 text-white/40 border border-white/10")}
                                                >
                                                    {variantA.automation_rules?.inactivity_enabled ? "Sistema Activado" : "Sistema Desactivado"}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Tiempo de Espera Máximo</label>
                                                    <div className="flex items-center gap-4">
                                                        <input 
                                                            type="number" 
                                                            title="Tiempo de espera en minutos"
                                                            placeholder="30"
                                                            value={variantA.automation_rules?.inactivity_timeout || 30} 
                                                            onChange={(e) => setVariantA(p => ({...p, automation_rules: {...p.automation_rules, inactivity_timeout: parseInt(e.target.value)}}))}
                                                            className="flex-1 h-14 bg-black/40 border border-white/10 rounded-2xl px-6 text-sm font-bold text-white outline-none focus:border-primary/40" 
                                                        />
                                                        <select title="Unidad de tiempo" className="h-14 px-6 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase text-white/40 outline-none">
                                                            <option>Minutos</option>
                                                            <option>Horas</option>
                                                        </select>
                                                    </div>
                                                    <p className="text-[9px] text-white/20 italic ml-4">Pasado este tiempo, el agente ejecutará la acción de rescate.</p>
                                                </div>

                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Acción de Rescate</label>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <button onClick={() => setVariantA(p => ({...p, automation_rules: {...p.automation_rules, inactivity_action: 'MESSAGE'}}))} className={cn("p-6 rounded-[24px] border text-left transition-all flex items-center justify-between", variantA.automation_rules?.inactivity_action === 'MESSAGE' ? "bg-primary/10 border-primary/20" : "bg-white/[0.01] border-white/5")}>
                                                            <div className="flex items-center gap-4">
                                                                <MessageSquareIcon className="h-5 w-5 text-primary/40" />
                                                                <span className="text-xs font-black uppercase tracking-tight">Enviar Mensaje de Seguimiento</span>
                                                            </div>
                                                            {variantA.automation_rules?.inactivity_action === 'MESSAGE' && <div className="h-2 w-2 rounded-full bg-primary" />}
                                                        </button>
                                                        <button onClick={() => setVariantA(p => ({...p, automation_rules: {...p.automation_rules, inactivity_action: 'NOTIFY'}}))} className={cn("p-6 rounded-[24px] border text-left transition-all flex items-center justify-between", variantA.automation_rules?.inactivity_action === 'NOTIFY' ? "bg-primary/10 border-primary/20" : "bg-white/[0.01] border-white/5")}>
                                                            <div className="flex items-center gap-4">
                                                                <UserCheck className="h-5 w-5 text-primary/40" />
                                                                <span className="text-xs font-black uppercase tracking-tight">Notificar a un Asesor</span>
                                                            </div>
                                                            {variantA.automation_rules?.inactivity_action === 'NOTIFY' && <div className="h-2 w-2 rounded-full bg-primary" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Mensaje de Rescate (Copy)</label>
                                                <textarea 
                                                    value={variantA.automation_rules?.inactivity_message || ""} 
                                                    onChange={(e) => setVariantA(p => ({...p, automation_rules: {...p.automation_rules, inactivity_message: e.target.value}}))}
                                                    className="w-full h-[250px] bg-black/60 border border-white/5 rounded-[32px] p-8 text-sm leading-relaxed font-medium focus:ring-4 focus:ring-primary/5 transition-all resize-none outline-none text-white/80" 
                                                    placeholder="¡Hola! Sigues ahí? Quería confirmar si tenías alguna duda sobre..." 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'CRM' && (
                                <motion.div key="CRM" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-6xl mx-auto space-y-10 pb-20">
                                    
                                    {/* 1. CONECTAR CRM */}
                                    <div className="p-12 bg-white/[0.02] border border-white/5 rounded-[56px] space-y-10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-16 w-16 rounded-[24px] bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-2xl shadow-blue-500/10">
                                                    <DbIcon className="h-8 w-8 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black uppercase tracking-tight">Conectar CRM (Bridge)</h3>
                                                    <p className="text-[11px] text-white/40 font-black uppercase tracking-widest mt-1">Vincula tu base de datos externa para sincronización</p>
                                                </div>
                                            </div>
                                            <select 
                                                title="Proveedor de CRM"
                                                value={variantA.crm_config?.provider || 'NONE'} 
                                                onChange={(e) => setVariantA(p => ({...p, crm_config: {...p.crm_config, provider: e.target.value}}))} 
                                                className="h-14 px-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs font-black uppercase text-blue-400 outline-none"
                                            >
                                                <option value="NONE">Desconectado</option>
                                                <option value="ZOHO">Zoho CRM Native</option>
                                                <option value="HUBSPOT">HubSpot Integration</option>
                                                <option value="WEBHOOK">Custom Webhook (API)</option>
                                            </select>
                                        </div>

                                        {variantA.crm_config?.provider !== 'NONE' && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">API Key / Client ID</label>
                                                    <input 
                                                        type="text" 
                                                        value={variantA.crm_config?.api_key || ""} 
                                                        onChange={(e) => setVariantA(p => ({...p, crm_config: {...p.crm_config, api_key: e.target.value}}))}
                                                        className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl px-6 text-sm font-bold text-white outline-none focus:border-blue-400/40" 
                                                        placeholder="Introduce tu credencial..." 
                                                    />
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Client Secret / Instance URL</label>
                                                    <input 
                                                        type="password" 
                                                        value={variantA.crm_config?.api_secret || ""} 
                                                        onChange={(e) => setVariantA(p => ({...p, crm_config: {...p.crm_config, api_secret: e.target.value}}))}
                                                        className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl px-6 text-sm font-bold text-white outline-none focus:border-blue-400/40" 
                                                        placeholder="••••••••••••••••" 
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* 2. TRAER LEADS (IMPORTACIÓN) */}
                                    <div className="p-12 bg-white/[0.02] border border-white/5 rounded-[56px] space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                <Zap className="h-6 w-6 text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black uppercase tracking-tight">Traer Leads (Importación)</h3>
                                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Configura la obtención de prospectos desde el CRM</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="p-8 bg-black/40 border border-white/5 rounded-[32px] space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black uppercase tracking-tight text-white/60">Sincronización Automática</span>
                                                    <button 
                                                        onClick={() => setVariantA(p => ({...p, crm_config: {...p.crm_config, auto_import: !p.crm_config?.auto_import}}))}
                                                        className={cn("h-6 w-12 rounded-full transition-all relative", variantA.crm_config?.auto_import ? "bg-emerald-500" : "bg-white/10")}
                                                    >
                                                        <div className={cn("h-4 w-4 rounded-full bg-white absolute top-1 transition-all", variantA.crm_config?.auto_import ? "right-1" : "left-1")} />
                                                    </button>
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/20">Frecuencia de Importación</label>
                                                    <select 
                                                        title="Frecuencia"
                                                        value={variantA.crm_config?.import_frequency || '15'} 
                                                        onChange={(e) => setVariantA(p => ({...p, crm_config: {...p.crm_config, import_frequency: e.target.value}}))}
                                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none"
                                                    >
                                                        <option value="5">Cada 5 minutos</option>
                                                        <option value="15">Cada 15 minutos</option>
                                                        <option value="60">Cada hora</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="p-8 bg-black/40 border border-white/5 rounded-[32px] space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/20">Filtro de Ingesta (CRM Query)</label>
                                                <textarea 
                                                    value={variantA.crm_config?.import_query || ""} 
                                                    onChange={(e) => setVariantA(p => ({...p, crm_config: {...p.crm_config, import_query: e.target.value}}))}
                                                    className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-[11px] font-medium text-white/40 outline-none resize-none"
                                                    placeholder="Ej: status = 'New' AND type = 'WhatsApp'..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. MODIFICAR DATOS Y SUBIR (EXPORTACIÓN) */}
                                    <div className="p-12 bg-white/[0.02] border border-white/5 rounded-[56px] space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                <Edit3 className="h-6 w-6 text-amber-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black uppercase tracking-tight">Modificar Datos y Subir</h3>
                                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Actualiza el CRM con la información extraída por la IA</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Mapeo de Atributos</h4>
                                                <button 
                                                    onClick={() => {
                                                        const currentMapping = variantA.crm_config?.field_mapping || [];
                                                        setVariantA(p => ({...p, crm_config: {...p.crm_config, field_mapping: [...currentMapping, { tag: '', crm_key: '' }]}}));
                                                    }}
                                                    className="text-[9px] font-black uppercase text-blue-400 hover:underline"
                                                >
                                                    + Añadir Atributo
                                                </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 gap-3">
                                                {(variantA.crm_config?.field_mapping || []).map((m: { tag: string, crm_key: string }, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 group">
                                                        <div className="flex-1 flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/20">IA</div>
                                                            <input 
                                                                title="Etiqueta de memoria"
                                                                type="text" 
                                                                placeholder="MEMORIA_TAG" 
                                                                value={m.tag}
                                                                onChange={(e) => {
                                                                    const newMapping = [...(variantA.crm_config?.field_mapping || [])];
                                                                    newMapping[idx].tag = e.target.value;
                                                                    setVariantA(p => ({...p, crm_config: {...p.crm_config, field_mapping: newMapping}}));
                                                                }}
                                                                className="flex-1 bg-transparent border-b border-white/10 text-xs font-bold text-white outline-none" 
                                                            />
                                                        </div>
                                                        <div className="h-px w-8 bg-white/10" />
                                                        <div className="flex-1 flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-400/40">CRM</div>
                                                            <input 
                                                                title="Llave del CRM"
                                                                type="text" 
                                                                placeholder="field_api_name" 
                                                                value={m.crm_key}
                                                                onChange={(e) => {
                                                                    const newMapping = [...(variantA.crm_config?.field_mapping || [])];
                                                                    newMapping[idx].crm_key = e.target.value;
                                                                    setVariantA(p => ({...p, crm_config: {...p.crm_config, field_mapping: newMapping}}));
                                                                }}
                                                                className="flex-1 bg-transparent border-b border-white/10 text-xs font-bold text-white outline-none" 
                                                            />
                                                        </div>
                                                        <button 
                                                            title="Eliminar atributo"
                                                            onClick={() => {
                                                                const newMapping = (variantA.crm_config?.field_mapping || []).filter((_: unknown, i: number) => i !== idx);
                                                                setVariantA(p => ({...p, crm_config: {...p.crm_config, field_mapping: newMapping}}));
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 transition-all text-white/20 hover:text-red-400"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. SINCRONIZACIÓN Y DUPLICADOS */}
                                    <div className="p-12 bg-white/[0.02] border border-white/5 rounded-[56px] space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                                <UserCheck className="h-6 w-6 text-purple-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black uppercase tracking-tight">Sincronización Inteligente</h3>
                                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Lógica para evitar duplicados y mantener integridad</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="p-8 bg-black/40 border border-white/5 rounded-[32px] space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-sm font-black uppercase tracking-tight">Evitar Duplicados</h4>
                                                        <p className="text-[10px] text-white/20 font-bold uppercase mt-1">Verificar existencia antes de crear</p>
                                                    </div>
                                                    <button 
                                                        title="Alternar evitar duplicados"
                                                        onClick={() => setVariantA(p => ({...p, crm_config: {...p.crm_config, prevent_duplicates: !p.crm_config?.prevent_duplicates}}))}
                                                        className={cn("h-6 w-12 rounded-full transition-all relative", variantA.crm_config?.prevent_duplicates ? "bg-purple-500" : "bg-white/10")}
                                                    >
                                                        <div className={cn("h-4 w-4 rounded-full bg-white absolute top-1 transition-all", variantA.crm_config?.prevent_duplicates ? "right-1" : "left-1")} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-8 bg-black/40 border border-white/5 rounded-[32px] space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/20">Criterio de Match (Unicidad)</label>
                                                <div className="flex gap-3">
                                                    <button onClick={() => setVariantA(p => ({...p, crm_config: {...p.crm_config, match_by: 'EMAIL'}}))} className={cn("flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all", variantA.crm_config?.match_by === 'EMAIL' ? "bg-purple-500/20 border-purple-500 text-purple-400" : "bg-white/5 border-white/10 text-white/20")}>Email</button>
                                                    <button onClick={() => setVariantA(p => ({...p, crm_config: {...p.crm_config, match_by: 'PHONE'}}))} className={cn("flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all", variantA.crm_config?.match_by === 'PHONE' ? "bg-purple-500/20 border-purple-500 text-purple-400" : "bg-white/5 border-white/10 text-white/20")}>Teléfono</button>
                                                    <button onClick={() => setVariantA(p => ({...p, crm_config: {...p.crm_config, match_by: 'BOTH'}}))} className={cn("flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all", variantA.crm_config?.match_by === 'BOTH' ? "bg-purple-500/20 border-purple-500 text-purple-400" : "bg-white/5 border-white/10 text-white/20")}>Ambos</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Live Simulator */}
                <AnimatePresence>
                    {isSimulatorOpen && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSimulatorOpen(false)} className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm" />
                            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 bottom-0 w-[500px] z-50 bg-slate-900 border-l border-white/5 shadow-2xl flex flex-col overflow-hidden">
                                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/20">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20"><Terminal className="h-5 w-5 text-primary" /></div>
                                        <div>
                                            <h3 className="text-lg font-black uppercase tracking-tight">Simulador Vivo</h3>
                                            <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">Prueba el Cerebro en Tiempo Real</p>
                                        </div>
                                    </div>
                                    <button title="Cerrar Simulador" onClick={() => setIsSimulatorOpen(false)} className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all text-white/20 hover:text-white"><X className="h-5 w-5" /></button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-white/5">
                                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[24px] space-y-3">
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">Orquestación Log:</p>
                                        <div className="space-y-2">
                                            <LogItem status="success" label="ADN del Agente Cargado" />
                                            <LogItem status="success" label="Round Robin Activo (2 Asesores)" />
                                            <LogItem status="pending" label="Esperando Interacción..." />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-start">
                                            <div className="max-w-[80%] p-4 rounded-[20px] rounded-tl-none bg-white/5 border border-white/10 text-sm text-white/80">
                                                ¡Hola! Estoy configurado con tu nuevo ADN. ¿Qué quieres probar primero?
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 bg-black/40 border-t border-white/5">
                                    <div className="relative">
                                        <input title="Mensaje de prueba" type="text" placeholder="Escribe un mensaje de prueba..." className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 pr-16 text-sm outline-none focus:border-primary/40 transition-all" />
                                        <button title="Enviar mensaje de prueba" className="absolute right-2 top-2 h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20"><Play className="h-4 w-4" /></button>
                                    </div>
                                    <p className="text-[9px] text-white/20 mt-4 text-center font-black uppercase tracking-widest">La IA analizará este mensaje usando el ADN actual</p>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {/* Create Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-xl bg-slate-900 border border-white/5 rounded-[48px] p-12 space-y-10 shadow-2xl">
                            <h3 className="text-3xl font-black uppercase tracking-tight">Nuevo Maestro</h3>
                            <div className="space-y-6">
                                <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="Nombre del Agente" className="w-full h-16 bg-white/[0.02] border border-white/10 rounded-[20px] px-8 text-lg font-bold text-white outline-none focus:border-primary/40" />
                                <textarea value={newAgentDescription} onChange={e => setNewAgentDescription(e.target.value)} placeholder="¿Cuál es su propósito?" rows={3} className="w-full bg-white/[0.02] border border-white/10 rounded-[20px] p-8 text-sm font-medium text-white/60 outline-none resize-none" />
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 h-16 rounded-[20px] bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest">Cancelar</button>
                                <button onClick={handleCreateAgent} disabled={saving || !newAgentName.trim()} className="flex-1 h-16 rounded-[20px] bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-primary/20">{saving ? "Configurando..." : "Crear Ahora"}</button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Edit Modal */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-xl bg-slate-900 border border-white/5 rounded-[48px] p-12 space-y-10 shadow-2xl">
                            <h3 className="text-3xl font-black uppercase tracking-tight">Editar Maestro</h3>
                            <div className="space-y-6">
                                <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="Nombre del Agente" className="w-full h-16 bg-white/[0.02] border border-white/10 rounded-[20px] px-8 text-lg font-bold text-white outline-none focus:border-primary/40" />
                                <textarea value={newAgentDescription} onChange={e => setNewAgentDescription(e.target.value)} placeholder="¿Cuál es su propósito?" rows={3} className="w-full bg-white/[0.02] border border-white/10 rounded-[20px] p-8 text-sm font-medium text-white/60 outline-none resize-none" />
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsEditModalOpen(false)} className="flex-1 h-16 rounded-[20px] bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest">Cancelar</button>
                                <button onClick={handleUpdateAgent} disabled={saving || !newAgentName.trim()} className="flex-1 h-16 rounded-[20px] bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-primary/20">{saving ? "Actualizando..." : "Guardar Cambios"}</button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Delete Modal */}
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md bg-slate-900 border border-white/5 rounded-[48px] p-12 space-y-8 shadow-2xl text-center">
                            <div className="h-20 w-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-red-500"><Trash2 className="h-10 w-10" /></div>
                            <h3 className="text-2xl font-black uppercase tracking-tight">¿Eliminar Agente?</h3>
                            <p className="text-sm text-white/40 font-medium">Esta acción es irreversible y borrará toda la configuración de este Maestro.</p>
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
                                <button onClick={handleDeleteAgent} disabled={saving} className="flex-1 h-14 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-red-500/20">{saving ? "Borrando..." : "Eliminar"}</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: React.ElementType, label: string }) {
    return (
        <button title={label} onClick={onClick} className={cn("flex items-center gap-3 px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative group", active ? "text-primary" : "text-white/20 hover:text-white/40")}>
            <Icon className={cn("h-4 w-4 transition-all", active ? "text-primary scale-110" : "text-white/20")} /> {label}
            {active && <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-4 right-4 h-1 bg-primary rounded-t-full shadow-[0_-4px_12px_rgba(var(--primary-rgb),0.5)]" />}
        </button>
    );
}

function ModelCard({ active, onClick, label, desc }: { active: boolean, onClick: () => void, label: string, desc: string }) {
    return (
        <button 
            onClick={onClick}
            title={`Seleccionar modelo ${label}`}
            className={cn(
                "p-6 rounded-[32px] border text-left transition-all relative group overflow-hidden h-32 flex flex-col justify-between",
                active ? "bg-emerald-500/10 border-emerald-500/40 shadow-2xl shadow-emerald-500/10" : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
            )}
        >
            <div className="flex items-center justify-between">
                <h4 className={cn("text-sm font-black uppercase tracking-tight", active ? "text-emerald-400" : "text-white/40 group-hover:text-white/60")}>{label}</h4>
                {active && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
            </div>
            <p className="text-[10px] text-white/20 font-bold uppercase tracking-tight leading-tight line-clamp-2">{desc}</p>
            {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
        </button>
    );
}

function PolicyCard({ active, onClick, icon: Icon, label, desc }: { active: boolean, onClick: () => void, icon: React.ElementType, label: string, desc: string }) {
    return (
        <button title={`Seleccionar política: ${label}`} onClick={onClick} className={cn("p-8 rounded-[40px] border text-left transition-all relative group overflow-hidden h-full", active ? "bg-primary/10 border-primary/20 shadow-2xl" : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]")}>
            <div className={cn("h-12 w-12 rounded-2xl mb-6 flex items-center justify-center transition-all", active ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20" : "bg-white/5 text-white/20")}>
                <Icon className="h-6 w-6" />
            </div>
            <h4 className={cn("text-xs font-black uppercase tracking-widest mb-2", active ? "text-white" : "text-white/40")}>{label}</h4>
            <p className="text-[10px] text-white/20 leading-relaxed font-bold uppercase tracking-tight line-clamp-2">{desc}</p>
            {active && <div className="absolute top-6 right-8 h-2 w-2 rounded-full bg-primary animate-pulse" />}
        </button>
    );
}

function LogItem({ status, label }: { status: 'success' | 'pending' | 'error', label: string }) {
    return (
        <div className="flex items-center gap-3">
            {status === 'success' ? <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-white/10 animate-pulse" />}
            <span className={cn("text-[9px] font-black uppercase tracking-widest", status === 'success' ? "text-white/60" : "text-white/20")}>{label}</span>
        </div>
    );
}


