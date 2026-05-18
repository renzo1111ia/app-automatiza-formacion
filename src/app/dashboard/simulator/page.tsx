"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
    Bot, User, Send, 
    Database, RotateCcw, 
    CheckCircle2, 
    BrainCircuit,
    Activity, Info,
    MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getAIAgents } from "@/lib/actions/agents";
import { testAgentVariables } from "@/lib/actions/simulator";
import { AIAgent } from "@/types/database";

interface SimulatorMessage {
    role: 'user' | 'assistant';
    content: string;
}

export default function AgentSimulatorPage() {
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
    const [messages, setMessages] = useState<SimulatorMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [memory, setMemory] = useState<Record<string, string | number | boolean>>({});
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getAIAgents().then(res => {
            if (res.success && res.data) setAgents(res.data);
        });
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSelectAgent = (agent: AIAgent) => {
        setSelectedAgent(agent);
        setMessages([]);
        setMemory({});
    };

    const handleReset = () => {
        setMessages([]);
        setMemory({});
        setInput("");
    };

    const handleSend = async () => {
        if (!input.trim() || !selectedAgent || isTyping) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsTyping(true);

        const res = await testAgentVariables({
            agentId: selectedAgent.id,
            message: userMsg,
            history: messages,
            currentVariables: memory
        });

        if (res.success && res.response) {
            setMessages(prev => [...prev, { role: 'assistant', content: res.response! }]);
            if (res.extracted) {
                setMemory(prev => ({ ...prev, ...res.extracted }));
            }
        } else {
            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Error en la simulación: " + (res.error || "Desconocido") }]);
        }
        setIsTyping(false);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-background text-foreground overflow-hidden transition-colors duration-500">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 bg-card/20 border-b border-border">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                        <BrainCircuit className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Simulador de Variables</h1>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest leading-none mt-1">Prueba la memoria y extracción de datos de tu IA.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleReset}
                        title="Reiniciar Sesión"
                        className="flex items-center gap-2 h-10 px-4 bg-card/40 border border-border rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-card/60 transition-all text-foreground"
                    >
                        <RotateCcw className="h-4 w-4" /> Reiniciar Sesión
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar: Agents */}
                <div className="w-80 border-r border-border bg-card/40 flex flex-col">
                    <div className="p-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Seleccionar Agente</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => handleSelectAgent(agent)}
                                title={`Seleccionar agente ${agent.name}`}
                                className={cn(
                                    "w-full p-4 rounded-2xl border text-left transition-all group",
                                    selectedAgent?.id === agent.id ? "bg-orange-500/10 border-orange-500/20" : "bg-card/40 border-border hover:bg-card/60"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center border transition-all",
                                        selectedAgent?.id === agent.id ? "bg-orange-500 text-white border-orange-500" : "bg-card/40 border-border text-muted-foreground"
                                    )}>
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">{agent.name}</p>
                                        <p className="text-[10px] text-muted-foreground/40 truncate">{agent.description || "Agente de Texto"}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-background/50">
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                                <MessageSquare className="h-16 w-16" />
                                <div>
                                    <p className="text-xl font-black uppercase tracking-tighter">Inicia una conversación</p>
                                    <p className="text-xs font-bold uppercase tracking-widest mt-1">Escribe algo para ver cómo la IA extrae variables</p>
                                </div>
                            </div>
                        ) : (
                            messages.map((m, i) => (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={i} 
                                    className={cn("flex gap-4 max-w-3xl mx-auto", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
                                >
                                    <div className={cn(
                                        "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border",
                                        m.role === 'user' ? "bg-card/40 border-border" : "bg-orange-500/10 border-orange-500/20"
                                    )}>
                                        {m.role === 'user' ? <User className="h-5 w-5 text-muted-foreground" /> : <Bot className="h-5 w-5 text-orange-500" />}
                                    </div>
                                    <div className={cn(
                                        "p-5 rounded-[24px] text-sm leading-relaxed shadow-sm",
                                        m.role === 'user' ? "bg-card/60 text-foreground rounded-tr-none border border-border" : "bg-card text-foreground rounded-tl-none border border-border"
                                    )}>
                                        {m.content}
                                    </div>
                                </motion.div>
                            ))
                        )}
                        {isTyping && (
                            <div className="flex gap-4 max-w-3xl mx-auto">
                                <div className="h-10 w-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center animate-pulse">
                                    <Bot className="h-5 w-5 text-orange-500" />
                                </div>
                                <div className="p-5 bg-card rounded-[24px] rounded-tl-none border border-border flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-muted-foreground/20 rounded-full animate-bounce" />
                                    <span className="w-1.5 h-1.5 bg-muted-foreground/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <span className="w-1.5 h-1.5 bg-muted-foreground/20 rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-8 bg-card/20 border-t border-border">
                        <div className="max-w-3xl mx-auto relative">
                            <input 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder={selectedAgent ? `Hablar con ${selectedAgent.name}...` : "Selecciona un agente a la izquierda"}
                                title="Mensaje"
                                disabled={!selectedAgent || isTyping}
                                className="w-full h-16 bg-card/40 border border-border rounded-2xl px-6 pr-16 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all disabled:opacity-50 text-foreground"
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim() || !selectedAgent || isTyping}
                                title="Enviar mensaje"
                                className="absolute right-3 top-3 h-10 w-10 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-0"
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Memory Monitor */}
                <div className="w-96 border-l border-border bg-card/60 flex flex-col">
                    <div className="p-8 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Database className="h-4 w-4 text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Monitor de Memoria</span>
                        </div>
                        <Activity className="h-3 w-3 text-orange-500 animate-pulse" />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Variables Capturadas</p>
                            <div className="space-y-3">
                                {Object.keys(memory).length > 0 ? (
                                    Object.entries(memory).map(([key, value]) => (
                                        <motion.div 
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            key={key} 
                                            className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-orange-500 mb-0.5 tracking-widest">{key}</p>
                                                <p className="text-sm font-bold text-foreground/80">{String(value)}</p>
                                            </div>
                                            <CheckCircle2 className="h-4 w-4 text-orange-500" />
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="p-8 border border-dashed border-border rounded-2xl text-center space-y-3 opacity-20">
                                        <Info className="h-8 w-8 mx-auto" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">Memoria vacía</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Estado del Sistema</p>
                            <div className="space-y-4">
                                <StatusRow label="Extracción en Tiempo Real" status="Activo" ok />
                                <StatusRow label="Detección de Intención" status="Activo" ok />
                                <StatusRow label="Persistencia" status="Sandbox" ok={false} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
}

 function StatusRow({ label, status, ok }: { label: string, status: string, ok: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground/40">{label}</span>
            <span className={cn(
                "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border",
                ok ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-card/40 text-muted-foreground/40 border-border"
            )}>{status}</span>
        </div>
    );
}
