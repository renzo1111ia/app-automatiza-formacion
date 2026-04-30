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
    Cpu, Brain, Database as DbIcon
} from "lucide-react";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getAIAgents, getAgentVariants, saveAgentVariant, saveAIAgent, deleteAIAgent, getAdvisors } from "@/lib/actions/agents";
import { getKnowledgeBase, KnowledgeItem } from "@/lib/actions/knowledge";
import { AIAgent, AIAgentVariant } from "@/types/database";

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                } as any);
                
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
        } catch (err: any) { alert("Error: " + err.message); } 
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
                                <motion.div key="BRAIN" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto space-y-10">
                                    <div className="grid grid-cols-1 gap-10">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20"><Terminal className="h-5 w-5 text-primary" /></div>
                                                    <div>
                                                        <h3 className="text-lg font-black uppercase tracking-tight">Prompt Maestro</h3>
                                                        <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Instrucciones únicas para cualificación y cierre</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4">
                                                    <select title="Modelo de IA" value={variantA.model_name} onChange={(e) => setVariantA(p => ({...p, model_name: e.target.value}))} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-white/60 outline-none hover:border-primary/40 transition-all">
                                                        <option value="gpt-4o">GPT-4o (Standard)</option>
                                                        <option value="gpt-4o-mini">GPT-4o mini (Fast)</option>
                                                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <textarea value={variantA.prompt_text || ""} onChange={(e) => setVariantA(p => ({...p, prompt_text: e.target.value}))} className="w-full h-[350px] bg-black/60 border border-white/5 rounded-[40px] p-10 text-base leading-relaxed font-medium focus:ring-4 focus:ring-primary/5 transition-all resize-none outline-none text-white/80 shadow-2xl backdrop-blur-xl" placeholder="Escribe aquí el ADN de tu agente..." />
                                         </div>

                                         <div className="space-y-6">
                                             <div className="flex items-center gap-3">
                                                 <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><DbIcon className="h-5 w-5 text-emerald-400" /></div>
                                                 <div>
                                                     <h3 className="text-lg font-black uppercase tracking-tight">Biblioteca de Conocimiento</h3>
                                                     <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Selecciona los documentos que este agente puede consultar</p>
                                                 </div>
                                             </div>
                                             
                                             <div className="grid grid-cols-2 gap-4">
                                                 {knowledgeBases.length === 0 ? (
                                                     <div className="col-span-2 p-10 border border-dashed border-white/10 rounded-[32px] text-center space-y-4">
                                                         <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">No hay documentos en la biblioteca</p>
                                                         <button onClick={() => window.location.href='/dashboard/knowledge'} className="px-6 h-10 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20 text-emerald-400">Ir a Biblioteca</button>
                                                     </div>
                                                 ) : (
                                                     knowledgeBases.map((kb) => {
                                                         const isSelected = variantA.knowledge_base_ids?.includes(kb.id) || variantA.knowledge_base_id === kb.id;
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
                                                                     "p-5 rounded-2xl border text-left transition-all flex items-center justify-between group",
                                                                     isSelected ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5" : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                                                                 )}
                                                             >
                                                                 <div className="flex items-center gap-4 overflow-hidden">
                                                                     <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-all", isSelected ? "bg-emerald-500 text-white" : "bg-white/5 text-white/20")}>
                                                                         <DbIcon className="h-5 w-5" />
                                                                     </div>
                                                                     <div className="overflow-hidden">
                                                                         <h4 className={cn("text-xs font-black uppercase tracking-tight truncate", isSelected ? "text-white" : "text-white/40")}>{kb.name}</h4>
                                                                         <p className="text-[8px] text-white/20 font-bold uppercase truncate">{kb.description || "Sin descripción"}</p>
                                                                     </div>
                                                                 </div>
                                                                 {isSelected && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] flex-shrink-0 ml-4" />}
                                                             </button>
                                                         );
                                                     })
                                                 )}
                                             </div>
                                         </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'AUTOMATION' && (
                                <motion.div key="AUTOMATION" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-5xl mx-auto space-y-10">
                                    <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[48px] space-y-10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-[20px] bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-xl shadow-amber-500/5"><UserCheck className="h-7 w-7 text-amber-500" /></div>
                                                <div>
                                                    <h3 className="text-xl font-black uppercase tracking-tight">Round Robin Monitor</h3>
                                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1">Asesores activos y disponibilidad real</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                                <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
                                                <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Sincronizado</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            {advisors.map(adv => (
                                                <div key={adv.id} className="p-6 bg-black/40 border border-white/5 rounded-[32px] flex items-center justify-between group hover:bg-primary/5 hover:border-primary/20 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-white/40 uppercase border border-white/10">{adv.name.charAt(0)}</div>
                                                        <div>
                                                            <h4 className="text-sm font-black uppercase tracking-tight">{adv.name}</h4>
                                                            <p className="text-[10px] text-white/20 font-bold">{adv.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                                </div>
                                            ))}
                                            {advisors.length === 0 && (
                                                <div className="col-span-2 p-10 border border-dashed border-white/10 rounded-[32px] text-center space-y-4">
                                                    <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">No hay asesores configurados para el Round Robin</p>
                                                    <button title="Ir a configuración de asesores" className="px-6 h-10 bg-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all border border-white/5">Configurar Asesores</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        <PolicyCard active={variantA.automation_rules?.contact_policy === 'auto'} onClick={() => setVariantA(prev => ({...prev, automation_rules: {...prev.automation_rules, contact_policy: 'auto'}}))} icon={Zap} label="Auto-Efectivo" desc="Llama o escribe según probabilidad." />
                                        <PolicyCard active={variantA.automation_rules?.contact_policy === 'call'} onClick={() => setVariantA(prev => ({...prev, automation_rules: {...prev.automation_rules, contact_policy: 'call'}}))} icon={Cpu} label="Prioridad Voz" desc="Inicia siempre con llamada de IA." />
                                        <PolicyCard active={variantA.automation_rules?.contact_policy === 'whatsapp'} onClick={() => setVariantA(prev => ({...prev, automation_rules: {...prev.automation_rules, contact_policy: 'whatsapp'}}))} icon={MessageSquareIcon} label="WhatsApp First" desc="Ideal para leads nocturnos." />
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'CRM' && (
                                <motion.div key="CRM" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto space-y-10">
                                    <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[48px] space-y-10 text-left">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-[20px] bg-blue-500/10 flex items-center justify-center border border-blue-500/20"><DbIcon className="h-7 w-7 text-blue-400" /></div>
                                                <div>
                                                    <h3 className="text-xl font-black uppercase tracking-tight">CRM Bridge</h3>
                                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Sincronización bidireccional automática</p>
                                                </div>
                                            </div>
                                            <select title="Proveedor CRM" value={variantA.crm_config?.provider || 'NONE'} onChange={(e) => setVariantA(p => ({...p, crm_config: {...p.crm_config, provider: e.target.value}}))} className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-6 py-3 text-xs font-black uppercase text-blue-400 outline-none">
                                                <option value="NONE">Desconectado</option>
                                                <option value="ZOHO">Zoho CRM</option>
                                                <option value="WEBHOOK">Webhook (Global)</option>
                                            </select>
                                        </div>
                                        <div className="p-10 bg-black/40 border border-white/5 rounded-[32px] text-center space-y-4">
                                            <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">Configura tu puente de datos para que la IA inyecte los prospectos cualificados.</p>
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
                                    <button title="Cerrar Simulador" onClick={() => setIsSimulatorOpen(false)} className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all text-white/20 hover:text-white"><XIcon className="h-5 w-5" /></button>
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

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button title={label} onClick={onClick} className={cn("flex items-center gap-3 px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative group", active ? "text-primary" : "text-white/20 hover:text-white/40")}>
            <Icon className={cn("h-4 w-4 transition-all", active ? "text-primary scale-110" : "text-white/20")} /> {label}
            {active && <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-4 right-4 h-1 bg-primary rounded-t-full shadow-[0_-4px_12px_rgba(var(--primary-rgb),0.5)]" />}
        </button>
    );
}

function PolicyCard({ active, onClick, icon: Icon, label, desc }: { active: boolean, onClick: () => void, icon: any, label: string, desc: string }) {
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

function XIcon({ className }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>; }
