"use client";

import React, { useState, useEffect } from "react";
import { 
    Bot, Zap, 
    Save, Settings2, 
    BarChart3, Layers, 
    Sparkles, PlusCircle,
    GitBranch, RotateCcw,
    Key, Eye, EyeOff,
    AlarmClock, Send, MessageSquare as MessageSquareIcon
} from "lucide-react";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getAIAgents, getAgentVariants, saveAgentVariant, saveAIAgent } from "@/lib/actions/agents";
import { AIAgent, AIAgentVariant } from "@/types/database";
import { AgentFlowBuilder } from "@/components/orchestrator/AgentFlowBuilder";
import { Cpu, Brain, Database as DbIcon } from "lucide-react";

const AI_MODELS = {
    OPENAI: {
        label: "OpenAI",
        icon: Zap,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        models: [
            { id: 'gpt-4o', name: 'GPT-4o', description: 'El más capaz y rápido' },
            { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'Eficiente y veloz' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legado, alta confiabilidad' }
        ]
    },
    ANTHROPIC: {
        label: "Claude",
        icon: Brain,
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        models: [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', description: 'Inteligencia superior y matices' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Poder máximo de razonamiento' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Compacto y ultra-rápido' }
        ]
    },
    GEMINI: {
        label: "Gemini",
        icon: Sparkles,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        models: [
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Ventana de contexto masiva' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Optimizado para velocidad' }
        ]
    }
};


export default function AgentsPage() {
    const tenantName = useTenantStore((s) => s.tenantName) || "ESDEN";
    const [agents, setAgents] = useState<AIAgent[]>([]);

    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
    const [activeTab, setActiveTab] = useState<'A' | 'B' | 'CONFIG' | 'METRICS' | 'FLOW' | 'INACTIVO'>('A');

    // Inactivity rule state
    const [inactivityMinutes, setInactivityMinutes] = useState<number>(4);
    const [inactivityAction, setInactivityAction] = useState<'template' | 'agent_message'>('template');
    const [inactivityTemplate, setInactivityTemplate] = useState<string>('');
    const [inactivityMessage, setInactivityMessage] = useState<string>('');
    const [inactivityMode, setInactivityMode] = useState<'fixed' | 'smart'>('fixed');
    const [inactivityMaxRetries, setInactivityMaxRetries] = useState<number>(1);
    const [savingInactivity, setSavingInactivity] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newAgentName, setNewAgentName] = useState("");
    const [newAgentDescription, setNewAgentDescription] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    
    // Form State
    const [variantA, setVariantA] = useState<Partial<AIAgentVariant>>({});
    const [variantB, setVariantB] = useState<Partial<AIAgentVariant>>({});

    const loadAgents = async () => {
        const res = await getAIAgents();
        if (res.success && res.data) {
            setAgents(res.data);
            if (res.data.length > 0 && !selectedAgent) {
                setSelectedAgent(res.data[0]);
            }
        }
    };

    useEffect(() => {
        loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedAgent) {
            async function loadVariants(agentId: string) {
                const res = await getAgentVariants(agentId);
                if (res.success && res.data) {
                    const data = res.data as AIAgentVariant[];
                    const a = data.find(v => !v.is_variant_b);
                    const b = data.find(v => v.is_variant_b);
                    setVariantA(a || { agent_id: agentId, is_variant_b: false, version_label: 'v1.0', prompt_text: '', weight: 0.5, model_provider: 'OPENAI', model_name: 'gpt-4o', api_key: '' });
                    setVariantB(b || { agent_id: agentId, is_variant_b: true, version_label: 'v1.0', prompt_text: '', weight: 0.5, model_provider: 'OPENAI', model_name: 'gpt-4o', api_key: '' });
                }
            }
            loadVariants(selectedAgent.id);

            // Load inactivity rules from flow_config
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inactivity = (selectedAgent.flow_config as any)?.inactivity_rules;
            if (inactivity) {
                setInactivityMinutes(inactivity.timeout_minutes ?? 4);
                setInactivityAction(inactivity.action ?? 'template');
                setInactivityTemplate(inactivity.template_name ?? '');
                setInactivityMessage(inactivity.agent_message ?? '');
                setInactivityMode(inactivity.mode ?? 'fixed');
                setInactivityMaxRetries(inactivity.max_retries ?? 1);
            } else {
                setInactivityMinutes(4);
                setInactivityAction('template');
                setInactivityTemplate('');
                setInactivityMessage('');
                setInactivityMode('fixed');
                setInactivityMaxRetries(1);
            }
        }
    }, [selectedAgent]);

    const handleSaveInactivity = async () => {
        if (!selectedAgent) return;
        setSavingInactivity(true);
        const currentFlow = selectedAgent.flow_config || { nodes: [], edges: [] };
        const updatedFlow = {
            ...currentFlow,
            inactivity_rules: {
                timeout_minutes: inactivityMinutes,
                action: inactivityAction,
                template_name: inactivityTemplate,
                agent_message: inactivityMessage,
                mode: inactivityMode,
                max_retries: inactivityMaxRetries,
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await saveAIAgent({ id: selectedAgent.id, flow_config: updatedFlow } as any);
        setSavingInactivity(false);
        alert('Regla de inactividad guardada.');
    };

    const handleSave = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        try {
            const resA = await saveAgentVariant({
                ...variantA,
                agent_id: selectedAgent.id,
                is_active: true
            });
            const resB = await saveAgentVariant({
                ...variantB,
                agent_id: selectedAgent.id,
                is_active: true
            });
            
            if (resA.success && resA.data) setVariantA(resA.data);
            if (resB.success && resB.data) setVariantB(resB.data);

            alert("Configuración de agente y prompts guardada.");
        } catch (err: unknown) {
            const error = err as Error;
            alert("Error al guardar: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateAgent = async () => {
        if (!newAgentName.trim()) return;
        setSaving(true);
        const res = await saveAIAgent({
            name: newAgentName,
            description: newAgentDescription,
            status: 'PAUSED',
            type: 'QUALIFY',
            flow_config: { nodes: [{ id: "start", type: "flow_trigger", position: { x: 250, y: 0 }, data: {} }], edges: [] }
        });

        if (res.success && res.data) {
            await loadAgents();
            setSelectedAgent(res.data);
            setIsCreateModalOpen(false);
            setNewAgentName("");
            setNewAgentDescription("");
        } else {
            alert("Error al crear el agente: " + (res.error || "Desconocido"));
        }
        setSaving(false);
    };


    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 text-white selection:bg-primary/30">
            {/* Header Area */}
            <div className="flex items-center justify-between px-8 py-6 bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Gestión de Agentes de IA</h1>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest leading-none mt-1">Itera sobre los prompts de tus agentes y configura pruebas A/B.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={loadAgents} 
                        title="Recargar agentes"
                        aria-label="Recargar lista de agentes"
                        className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all font-bold"
                    >
                        <RotateCcw className="h-4 w-4 text-white/40" />
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 h-11 px-6 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[11px] rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "Publicando..." : "Publicar Cambios"}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* ── LEFT PANEL: Agents List ── */}
                <div className="w-80 border-r border-white/5 bg-black/40 flex flex-col">
                    <div className="p-6">
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full h-11 border border-dashed border-primary/40 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all text-center shadow-lg shadow-primary/5"
                            title="Crear nuevo agente"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Nuevo Agente
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-10">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => setSelectedAgent(agent)}
                                className={cn(
                                    "w-full p-4 rounded-2xl text-left transition-all border group",
                                    selectedAgent?.id === agent.id 
                                        ? "bg-primary/10 border-primary/20" 
                                        : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                                )}
                                title={`Seleccionar Agente: ${agent.name}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest",
                                        agent.status === 'ACTIVE' ? "text-emerald-400" : "text-white/20"
                                    )}>
                                        {agent.status === 'ACTIVE' ? 'Activo' : 'Pausado'}
                                    </span>
                                    {agent.status === 'ACTIVE' && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                </div>
                                <h3 className="font-bold text-sm text-white/90 group-hover:text-white">{agent.name}</h3>
                                <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">{agent.description || "Sin descripción"}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── MAIN CONTENT: Editor & Tabs ── */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Tabs Navigation */}
                    <div className="flex items-center border-b border-white/5 bg-black/20 px-8 overflow-x-auto">
                        <TabButton active={activeTab === 'A'} onClick={() => setActiveTab('A')} icon={Zap} label="Prompt A" />
                        <TabButton active={activeTab === 'B'} onClick={() => setActiveTab('B')} icon={Layers} label="Prompt B" />
                        <TabButton active={activeTab === 'FLOW'} onClick={() => setActiveTab('FLOW')} icon={GitBranch} label="Lógica de Flujo" />
                        <TabButton active={activeTab === 'CONFIG'} onClick={() => setActiveTab('CONFIG')} icon={Settings2} label="Config A/B" />
                        <TabButton active={activeTab === 'METRICS'} onClick={() => setActiveTab('METRICS')} icon={BarChart3} label="Métricas" />
                        <TabButton active={activeTab === 'INACTIVO'} onClick={() => setActiveTab('INACTIVO')} icon={AlarmClock} label="Inactividad" />
                    </div>

                    <div className={cn("flex-1 min-h-0 relative overflow-hidden", activeTab !== 'FLOW' && "p-8 overflow-y-auto")}>
                        <AnimatePresence mode="wait">
                            {(activeTab === 'A' || activeTab === 'B') && (
                                <motion.div 
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="h-full flex flex-col space-y-6"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                <Sparkles className="h-4 w-4 text-emerald-400" />
                                            </div>
                                            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Instrucciones del Sistema</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-white/20 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">Version {(activeTab === 'A' ? variantA : variantB).version_label}</span>
                                    </div>

                                    <div className="flex-1 min-h-[400px] relative group text-left">
                                        <textarea 
                                            value={(activeTab === 'A' ? variantA : variantB).prompt_text || ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (activeTab === 'A') setVariantA(prev => ({...prev, prompt_text: val}));
                                                else setVariantB(prev => ({...prev, prompt_text: val}));
                                            }}
                                            className="w-full h-full bg-white/[0.02] border border-white/10 rounded-3xl p-8 text-sm leading-relaxed font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none shadow-inner text-white/80"
                                            placeholder={`Eres un asistente experto de ${tenantName}...`}
                                            aria-label="Editor de prompt"
                                        />

                                    </div>

                                     {/* Model Selector Card */}
                                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[32px] space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                                    <Cpu className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Cerebro del Agente</p>
                                                    <p className="text-xs text-white/80 font-bold uppercase tracking-tight">Selecciona el Modelo de IA</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                                                {(['OPENAI', 'ANTHROPIC', 'GEMINI'] as const).map((provider) => {
                                                    const config = AI_MODELS[provider];
                                                    const Icon = config.icon;
                                                    const isActive = (activeTab === 'A' ? variantA : variantB).model_provider === provider;
                                                    
                                                    return (
                                                        <button
                                                            key={provider}
                                                            onClick={() => {
                                                                const update = { model_provider: provider, model_name: config.models[0].id };
                                                                if (activeTab === 'A') setVariantA(prev => ({...prev, ...update}));
                                                                else setVariantB(prev => ({...prev, ...update}));
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest",
                                                                isActive 
                                                                    ? cn(config.bg, config.color, "border", config.border)
                                                                    : "text-white/20 hover:text-white/40"
                                                            )}
                                                        >
                                                            <Icon className="h-3.5 w-3.5" />
                                                            {config.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            {AI_MODELS[(activeTab === 'A' ? variantA : variantB).model_provider || 'OPENAI'].models.map((model) => {
                                                const isActive = (activeTab === 'A' ? variantA : variantB).model_name === model.id;
                                                const provider = (activeTab === 'A' ? variantA : variantB).model_provider || 'OPENAI';
                                                const config = AI_MODELS[provider as keyof typeof AI_MODELS];

                                                return (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => {
                                                            if (activeTab === 'A') setVariantA(prev => ({...prev, model_name: model.id}));
                                                            else setVariantB(prev => ({...prev, model_name: model.id}));
                                                        }}
                                                        className={cn(
                                                            "p-4 rounded-2xl border text-left transition-all relative group overflow-hidden",
                                                            isActive 
                                                                ? cn(config.border, "bg-white/[0.03]") 
                                                                : "border-white/5 bg-white/[0.01] hover:bg-white/[0.02]"
                                                        )}
                                                    >
                                                        {isActive && (
                                                            <motion.div 
                                                                layoutId="active-model-bg"
                                                                className={cn("absolute inset-0 opacity-10", config.bg)} 
                                                            />
                                                        )}
                                                        <div className="relative z-10">
                                                            <p className={cn(
                                                                "text-[10px] font-black uppercase tracking-widest mb-1",
                                                                isActive ? config.color : "text-white/20"
                                                            )}>
                                                                {model.name}
                                                            </p>
                                                            <p className="text-[10px] text-white/40 leading-tight group-hover:text-white/60 transition-colors">
                                                                {model.description}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* AWS Knowledge Base Config */}
                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <DbIcon className="h-4 w-4 text-emerald-400" />
                                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Memoria de la IA (AWS Bedrock)</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { id: 'G9P0FC3S29', name: 'Automatiza Formación v1', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                                                    { id: 'NONE', name: 'Sin Base de Conocimiento', color: 'bg-white/5 text-white/40 border-white/10' }
                                                ].map((kb) => {
                                                    const isActive = ((activeTab === 'A' ? variantA : variantB).knowledge_base_id || 'NONE') === kb.id;
                                                    return (
                                                        <button
                                                            key={kb.id}
                                                            onClick={() => {
                                                                const val = kb.id === 'NONE' ? null : kb.id;
                                                                if (activeTab === 'A') setVariantA(prev => ({...prev, knowledge_base_id: val}));
                                                                else setVariantB(prev => ({...prev, knowledge_base_id: val}));
                                                            }}
                                                            className={cn(
                                                                "p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-3",
                                                                isActive ? kb.color : "bg-white/[0.01] border-white/5 text-white/20 hover:border-white/10"
                                                            )}
                                                        >
                                                            <div className={cn("h-2 w-2 rounded-full", isActive ? "bg-current animate-pulse" : "bg-white/10")} />
                                                            {kb.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="relative group">
                                                <input 
                                                    type="text"
                                                    value={(activeTab === 'A' ? variantA : variantB).knowledge_base_id || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (activeTab === 'A') setVariantA(prev => ({...prev, knowledge_base_id: val}));
                                                        else setVariantB(prev => ({...prev, knowledge_base_id: val}));
                                                    }}
                                                    placeholder="O introduce un ID personalizado..."
                                                    className="w-full h-12 bg-black/40 border border-white/5 rounded-xl px-4 text-xs font-mono text-white/80 placeholder:text-white/10 focus:border-emerald-500/40 focus:bg-emerald-500/5 transition-all outline-none"
                                                />
                                            </div>
                                            <p className="text-[9px] text-white/20 italic">
                                                * Al seleccionar una base, el agente usará Inteligencia RAG para responder con tus documentos.
                                            </p>
                                        </div>

                                        {/* API Key Input */}
                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Key className="h-4 w-4 text-white/40" />
                                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Credenciales de Acceso (Model Provider)</p>
                                                </div>
                                                <button 
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                    className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
                                                >
                                                    {showApiKey ? "Ocultar" : "Mostrar"}
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type={showApiKey ? "text" : "password"}
                                                    value={(activeTab === 'A' ? variantA : variantB).api_key || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (activeTab === 'A') setVariantA(prev => ({...prev, api_key: val}));
                                                        else setVariantB(prev => ({...prev, api_key: val}));
                                                    }}
                                                    placeholder={`Introduce tu API Key de ${AI_MODELS[(activeTab === 'A' ? variantA : variantB).model_provider || 'OPENAI'].label}...`}
                                                    className="w-full h-12 bg-black/40 border border-white/5 rounded-xl px-4 text-xs font-mono text-white/80 placeholder:text-white/10 focus:border-primary/40 focus:bg-primary/5 transition-all outline-none"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    {showApiKey ? <EyeOff className="h-4 w-4 text-white/20" /> : <Eye className="h-4 w-4 text-white/20" />}
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-white/20 italic">
                                                * Esta llave se usará exclusivamente para las llamadas procesadas por este agente. Si se deja vacía, se usará la llave global del sistema.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'FLOW' && !selectedAgent && (
                                <motion.div
                                    key="no-agent-flow"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center h-full text-center space-y-6 min-h-[500px]"
                                >
                                    <div className="h-24 w-24 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-2xl relative group">
                                        <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <GitBranch className="h-10 w-10 text-white/20 group-hover:text-primary transition-colors relative z-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black uppercase tracking-tight">Flujo Maestro No Seleccionado</h3>
                                        <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
                                            Debes seleccionar o crear un agente para poder vincular la lógica del <span className="text-primary font-bold">Flow Builder Pro</span>.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="h-14 px-10 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[11px] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 border-b-4 border-primary-foreground/20"
                                    >
                                        Crear Nuevo Agente de IA
                                    </button>
                                </motion.div>
                            )}

                            {activeTab === 'FLOW' && selectedAgent && (
                                <motion.div
                                    key="flow-placeholder"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center h-full text-center space-y-8"
                                >
                                    <div className="h-32 w-32 rounded-[40px] bg-primary/10 border border-primary/20 flex items-center justify-center relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-primary/20 animate-pulse group-hover:scale-150 transition-transform duration-1000" />
                                        <GitBranch className="h-12 w-12 text-primary relative z-10" />
                                    </div>
                                    <div className="max-w-md space-y-4">
                                        <h2 className="text-3xl font-black uppercase tracking-tight italic">Flow Builder Pro</h2>
                                        <p className="text-white/40 text-sm font-medium">Estás a punto de entrar al orquestador de lógica maestro. Prepárate para diseñar el comportamiento de {selectedAgent.name}.</p>
                                    </div>
                                    <div className="flex flex-col gap-4 w-full max-w-xs">
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <motion.div 
                                                className="h-full bg-primary"
                                                initial={{ width: "0%" }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                            />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse italic">Iniciando Espacio de Trabajo...</p>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'INACTIVO' && (
                                <motion.div
                                    key="inactivity-config"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="max-w-2xl mx-auto space-y-10 py-12"
                                >
                                    {/* Header */}
                                    <div className="text-center space-y-4">
                                        <div className="inline-flex h-16 w-16 items-center justify-center bg-amber-500/10 rounded-3xl border border-amber-500/20 mb-4 relative">
                                            <AlarmClock className="h-8 w-8 text-amber-400" />
                                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 rounded-full animate-ping opacity-60" />
                                        </div>
                                        <h2 className="text-3xl font-black uppercase tracking-tight">Regla de Inactividad</h2>
                                        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                                            Si el cliente no responde después de X minutos, el sistema actuará automáticamente para reactivarlo.
                                        </p>
                                    </div>

                                    <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[40px] space-y-10 text-left">

                                        {/* Timeout selector */}
                                        <div className="space-y-4">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Tiempo de Espera Sin Respuesta</p>
                                            <div className="flex items-center gap-4">
                                                {[2, 3, 4, 5, 7, 10].map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setInactivityMinutes(m)}
                                                        className={cn(
                                                            "h-14 w-14 rounded-2xl border text-sm font-black transition-all flex flex-col items-center justify-center gap-0.5",
                                                            inactivityMinutes === m
                                                                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/10"
                                                                : "bg-white/[0.02] border-white/5 text-white/30 hover:text-white/60 hover:border-white/20"
                                                        )}
                                                    >
                                                        <span>{m}</span>
                                                        <span className="text-[7px] uppercase tracking-widest opacity-60">min</span>
                                                    </button>
                                                ))}
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Personalizar</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={60}
                                                        value={inactivityMinutes}
                                                        title="Minutos personalizados de inactividad"
                                                        placeholder="4"
                                                        onChange={e => setInactivityMinutes(parseInt(e.target.value) || 4)}
                                                        className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-bold text-amber-400 focus:border-amber-500/40 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action selector */}
                                        <div className="space-y-4">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Acción al Detectar Inactividad</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button
                                                    onClick={() => setInactivityAction('template')}
                                                    className={cn(
                                                        "p-5 rounded-3xl border text-left transition-all space-y-3 group",
                                                        inactivityAction === 'template'
                                                            ? "bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5"
                                                            : "bg-white/[0.02] border-white/5 hover:border-white/15"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                                        inactivityAction === 'template' ? "bg-emerald-500/20" : "bg-white/5 group-hover:bg-white/10"
                                                    )}>
                                                        <Send className={cn("h-5 w-5", inactivityAction === 'template' ? "text-emerald-400" : "text-white/30")} />
                                                    </div>
                                                    <div>
                                                        <p className={cn("text-xs font-black uppercase tracking-tight", inactivityAction === 'template' ? "text-emerald-400" : "text-white/50")}>Plantilla WhatsApp</p>
                                                        <p className="text-[10px] text-white/30 mt-1 leading-relaxed">Envía una plantilla aprobada de Meta al contacto.</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => setInactivityAction('agent_message')}
                                                    className={cn(
                                                        "p-5 rounded-3xl border text-left transition-all space-y-3 group",
                                                        inactivityAction === 'agent_message'
                                                            ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/5"
                                                            : "bg-white/[0.02] border-white/5 hover:border-white/15"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                                        inactivityAction === 'agent_message' ? "bg-primary/20" : "bg-white/5 group-hover:bg-white/10"
                                                    )}>
                                                        <MessageSquareIcon className={cn("h-5 w-5", inactivityAction === 'agent_message' ? "text-primary" : "text-white/30")} />
                                                    </div>
                                                    <div>
                                                        <p className={cn("text-xs font-black uppercase tracking-tight", inactivityAction === 'agent_message' ? "text-primary" : "text-white/50")}>Mensaje del Agente</p>
                                                        <p className="text-[10px] text-white/30 mt-1 leading-relaxed">El agente responde automáticamente con un aviso personalizado.</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mode selector (Fixed vs Smart) */}
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Estilo de Comunicación</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => setInactivityMode('fixed')}
                                                    className={cn(
                                                        "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                        inactivityMode === 'fixed'
                                                            ? "bg-white/10 border border-white/20 text-white"
                                                            : "bg-white/[0.02] border border-white/5 text-white/20 hover:text-white/40"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Bot className="h-3.5 w-3.5" />
                                                        Texto Fijo
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => setInactivityMode('smart')}
                                                    className={cn(
                                                        "h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                        inactivityMode === 'smart'
                                                            ? "bg-primary/20 border border-primary/40 text-primary shadow-lg shadow-primary/10"
                                                            : "bg-white/[0.02] border border-white/5 text-white/20 hover:text-white/40"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                        IA Inteligente
                                                    </div>
                                                </button>
                                            </div>
                                            <p className="text-[9px] text-white/20 italic">
                                                * El modo inteligente permite que la IA redacte un mensaje corto basado en la charla actual.
                                            </p>
                                        </div>

                                        {/* Frequency selector (Max Retries) */}
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Frecuencia Máxima de Rescate</p>
                                            <div className="flex items-center gap-3">
                                                {[1, 2, 3, 5].map(r => (
                                                    <button
                                                        key={r}
                                                        onClick={() => setInactivityMaxRetries(r)}
                                                        className={cn(
                                                            "h-10 px-6 rounded-xl text-[10px] font-black uppercase transition-all",
                                                            inactivityMaxRetries === r
                                                                ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                                                                : "bg-white/[0.02] border border-white/5 text-white/20 hover:text-white/40"
                                                        )}
                                                    >
                                                        {r} {r === 1 ? 'Vez' : 'Veces'}
                                                    </button>
                                                ))}
                                                <span className="text-[9px] text-white/20 italic ml-auto mr-2">¿Cuántas veces insistir?</span>
                                            </div>
                                        </div>

                                        {/* Sub-config based on action */}
                                        {inactivityAction === 'template' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Nombre de la Plantilla Meta</label>
                                                <input
                                                    value={inactivityTemplate}
                                                    onChange={e => setInactivityTemplate(e.target.value)}
                                                    placeholder="Ej: reactivacion_cliente_v1"
                                                    className="w-full h-12 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl px-5 text-sm font-mono text-emerald-200/80 focus:border-emerald-500/50 outline-none transition-all"
                                                />
                                                <p className="text-[9px] text-white/20 italic">
                                                    Debe ser el nombre exacto de la plantilla en tu cuenta de WhatsApp Business Manager.
                                                </p>
                                            </div>
                                        )}

                                        {inactivityAction === 'agent_message' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-primary">Mensaje Automático del Agente</label>
                                                <textarea
                                                    value={inactivityMessage}
                                                    onChange={e => setInactivityMessage(e.target.value)}
                                                    rows={4}
                                                    placeholder="Ej: Hola, ¿sigues ahí? Quería recordarte que tenemos una oferta especial esperándote. ¿Te gustaría continuar?"
                                                    className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-5 text-sm text-white/80 leading-relaxed focus:border-primary/50 outline-none resize-none transition-all"
                                                />
                                                <p className="text-[9px] text-white/20 italic">
                                                    El agente enviará este mensaje cuando el timeout expire. Se puede usar HTML básico o emojis.
                                                </p>
                                            </div>
                                        )}

                                        {/* Summary badge */}
                                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
                                            <AlarmClock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-amber-200/60 leading-relaxed font-medium">
                                                Si el cliente no responde en <span className="text-amber-400 font-black">{inactivityMinutes} minutos</span>, 
                                                el sistema {inactivityAction === 'template'
                                                    ? <> enviará la plantilla <span className="text-emerald-400 font-black">&quot;{inactivityTemplate || 'sin nombre'}&quot;</span></>  
                                                    : <> activará al agente para enviar un mensaje de reactivación <span className="text-primary font-black">({inactivityMode === 'smart' ? 'IA Smart' : 'Texto Fijo'})</span></>} 
                                                hasta <span className="text-amber-400 font-black">{inactivityMaxRetries} {inactivityMaxRetries === 1 ? 'vez' : 'veces'}</span>.
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleSaveInactivity}
                                            disabled={savingInactivity}
                                            className="w-full h-14 rounded-2xl bg-amber-500 text-black font-black uppercase tracking-widest text-[11px] shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            <AlarmClock className="h-4 w-4" />
                                            {savingInactivity ? 'Guardando...' : 'Guardar Regla de Inactividad'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'CONFIG' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-2xl mx-auto space-y-12 py-12"
                                >
                                    <div className="text-center space-y-4">
                                        <div className="inline-flex h-16 w-16 items-center justify-center bg-primary/10 rounded-3xl border border-primary/20 mb-4">
                                            <Zap className="h-8 w-8 text-primary" />
                                        </div>
                                        <h2 className="text-3xl font-black uppercase tracking-tight">Configuración Experimento A/B</h2>
                                        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">Divide el tráfico entrante entre dos versiones de prompt para medir qué agente cualifica mejor a los leads.</p>
                                    </div>

                                    <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[40px] space-y-8 text-left">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <span className="text-xs font-black uppercase tracking-widest text-white/60">Distribución de Tráfico</span>
                                                <span className="text-xs font-black tabular-nums text-primary">{Math.round((variantA.weight || 0.5) * 100)}% / {Math.round((1 - (variantA.weight || 0.5)) * 100)}%</span>
                                            </div>
                                            <div className="h-4 w-full bg-white/5 rounded-full p-1 relative">
                                                <motion.div 
                                                    className="h-full bg-primary rounded-full shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]"
                                                    style={{ width: `${(variantA.weight || 0.5) * 100}%` }}
                                                />
                                                <input 
                                                    type="range" 
                                                    min="0" max="1" step="0.1"
                                                    title="Distribución de tráfico"
                                                    value={variantA.weight || 0.5}
                                                    onChange={(e) => {
                                                        const w = parseFloat(e.target.value);
                                                        setVariantA(prev => ({...prev, weight: w}));
                                                        setVariantB(prev => ({...prev, weight: 1 - w}));
                                                    }}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* ── FLOW BUILDER OVERLAY ── */}
            <AnimatePresence>
                {activeTab === 'FLOW' && selectedAgent && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1.05, filter: "brightness(0.5) blur(10px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "brightness(1) blur(0px)" }}
                        exit={{ opacity: 0, scale: 1.05, filter: "brightness(0.5) blur(10px)" }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed inset-0 z-[200] bg-slate-950 overflow-hidden"
                    >
                        <AgentFlowBuilder 
                            agentName={selectedAgent.name}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            initialFlow={(selectedAgent.flow_config as any) || { nodes: [], edges: [] }}
                            isInline={false}
                            onClose={() => setActiveTab('A')}
                            onSave={async (flow) => {
                                setSaving(true);
                                const res = await saveAIAgent({
                                    id: selectedAgent.id,
                                    flow_config: flow
                                } as Partial<AIAgent>);
                                if (res.success) {
                                    setAgents(prev => prev.map(a => 
                                        a.id === selectedAgent.id ? { ...a, flow_config: flow } : a
                                    ));
                                }
                                setSaving(false);
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── CREATE MODAL ── */}

            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setIsCreateModalOpen(false)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[40px] p-10 shadow-2xl space-y-8"
                        >
                            <div className="text-center space-y-4">
                                <div className="h-16 w-16 bg-primary/10 rounded-3xl border border-primary/20 flex items-center justify-center mx-auto mb-4">
                                    <PlusCircle className="h-8 w-8 text-primary" />
                                </div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Nuevo Agente</h3>
                                <p className="text-white/40 text-sm font-medium">Define la identidad base de tu nuevo agente inteligente.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-4">Nombre del Agente</label>
                                    <input 
                                        autoFocus
                                        value={newAgentName}
                                        onChange={(e) => setNewAgentName(e.target.value)}
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-sm font-bold focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                        placeholder="Ej: Asistente Lead Master"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-4">Descripción / Objetivo</label>
                                    <textarea 
                                        value={newAgentDescription}
                                        onChange={(e) => setNewAgentDescription(e.target.value)}
                                        className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-6 text-sm font-medium focus:border-primary/40 outline-none transition-all resize-none"
                                        placeholder="Define el propósito de este agente..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-bold"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreateAgent}
                                    disabled={saving || !newAgentName.trim()}
                                    className="flex-1 h-14 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {saving ? "Creando..." : "Crear Agente"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean, icon: React.ElementType, label: string, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-6 h-[72px] text-[11px] font-black uppercase tracking-widest transition-all relative",
                active ? "text-primary" : "text-white/30 hover:text-white/60"
            )}
            title={`Pestaña: ${label}`}
        >
            <Icon className="h-4 w-4" />
            {label}
            {active && (
                <motion.div 
                    layoutId="activeTabBadge"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
                />
            )}
        </button>
    );
}
