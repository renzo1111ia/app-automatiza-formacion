"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  User,
  Send,
  Database,
  RotateCcw,
  CheckCircle2,
  BrainCircuit,
  Activity,
  Info,
  MessageSquare,
  Save,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getAIAgents } from "@/lib/actions/agents";
import {
  testAgentVariables,
  saveSimulatorSession,
  getSimulatorSessions,
} from "@/lib/actions/simulator";
import { AIAgent } from "@/types/database";
import { useTenantStore } from "@/store/tenant";

interface SimulatorSession {
  id: string;
  session_name: string;
  created_at: string;
  ai_agents?: { name: string } | null;
}

interface SimulatorMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AgentSimulatorPage() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [memory, setMemory] = useState<Record<string, string | number | boolean>>({});

  const tenantId = useTenantStore((s) => s.tenantId);
  const [sessions, setSessions] = useState<SimulatorSession[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAIAgents().then((res) => {
      if (res.success && res.data) setAgents(res.data);
    });
  }, []);

  const loadSessions = (tid: string) => {
    getSimulatorSessions(tid).then((res) => {
      if (res.success && Array.isArray(res.data)) setSessions(res.data as SimulatorSession[]);
    });
  };

  useEffect(() => {
    if (!tenantId) return;
    loadSessions(tenantId);
  }, [tenantId]);

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

  const handleSaveSession = async () => {
    if (!tenantId || !selectedAgent || messages.length === 0 || isSaving) return;
    const name = window.prompt("Nombre de la sesión:") || "Sesión de prueba";
    setIsSaving(true);
    const res = await saveSimulatorSession({
      tenantId,
      agentId: selectedAgent.id,
      sessionName: name,
      messages,
      variablesCaptured: memory,
    });
    setIsSaving(false);
    if (res.success) {
      loadSessions(tenantId);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ No se pudo guardar la sesión: " + (res.error || "Desconocido"),
        },
      ]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || isTyping) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsTyping(true);

    const res = await testAgentVariables({
      agentId: selectedAgent.id,
      message: userMsg,
      history: messages,
      currentVariables: memory,
    });

    if (res.success && res.response) {
      setMessages((prev) => [...prev, { role: "assistant", content: res.response! }]);
      if (res.extracted) {
        setMemory((prev) => ({ ...prev, ...res.extracted }));
      }
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Error en la simulación: " + (res.error || "Desconocido"),
        },
      ]);
    }
    setIsTyping(false);
  };

  return (
    <div className="bg-background text-foreground flex h-[calc(100vh-80px)] flex-col overflow-hidden transition-colors duration-500">
      {/* Header */}
      <div className="bg-card/20 border-border flex items-center justify-between border-b px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
            <BrainCircuit className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Simulador de Variables</h1>
            <p className="text-muted-foreground mt-1 text-xs leading-none font-bold tracking-widest uppercase">
              Prueba la memoria y extracción de datos de tu IA.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSession}
            disabled={!selectedAgent || messages.length === 0 || isSaving}
            title="Guardar sesión"
            className="flex h-10 items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 text-[10px] font-black tracking-widest text-orange-500 uppercase transition-all hover:bg-orange-500/20 disabled:opacity-40"
          >
            <Save className="h-4 w-4" /> {isSaving ? "Guardando..." : "Guardar"}
          </button>
          <button
            onClick={handleReset}
            title="Reiniciar Sesión"
            className="bg-card/40 border-border hover:bg-card/60 text-foreground flex h-10 items-center gap-2 rounded-xl border px-4 text-[10px] font-black tracking-widest uppercase transition-all"
          >
            <RotateCcw className="h-4 w-4" /> Reiniciar Sesión
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Agents */}
        <div className="border-border bg-card/40 flex w-80 flex-col border-r">
          <div className="p-6">
            <span className="text-muted-foreground/40 text-[10px] font-black tracking-widest uppercase">
              Seleccionar Agente
            </span>
          </div>
          <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                title={`Seleccionar agente ${agent.name}`}
                className={cn(
                  "group w-full rounded-2xl border p-4 text-left transition-all",
                  selectedAgent?.id === agent.id
                    ? "border-orange-500/20 bg-orange-500/10"
                    : "bg-card/40 border-border hover:bg-card/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                      selectedAgent?.id === agent.id
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "bg-card/40 border-border text-muted-foreground"
                    )}
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{agent.name}</p>
                    <p className="text-muted-foreground/40 truncate text-[10px]">
                      {agent.description || "Agente de Texto"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="bg-background/50 flex flex-1 flex-col">
          <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-8">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center space-y-4 text-center opacity-20">
                <MessageSquare className="h-16 w-16" />
                <div>
                  <p className="text-xl font-black tracking-tighter uppercase">
                    Inicia una conversación
                  </p>
                  <p className="mt-1 text-xs font-bold tracking-widest uppercase">
                    Escribe algo para ver cómo la IA extrae variables
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i}
                  className={cn(
                    "mx-auto flex max-w-3xl gap-4",
                    m.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                      m.role === "user"
                        ? "bg-card/40 border-border"
                        : "border-orange-500/20 bg-orange-500/10"
                    )}
                  >
                    {m.role === "user" ? (
                      <User className="text-muted-foreground h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5 text-orange-500" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "rounded-[24px] p-5 text-sm leading-relaxed shadow-sm",
                      m.role === "user"
                        ? "bg-card/60 text-foreground border-border rounded-tr-none border"
                        : "bg-card text-foreground border-border rounded-tl-none border"
                    )}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))
            )}
            {isTyping && (
              <div className="mx-auto flex max-w-3xl gap-4">
                <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
                  <Bot className="h-5 w-5 text-orange-500" />
                </div>
                <div className="bg-card border-border flex gap-1 rounded-[24px] rounded-tl-none border p-5">
                  <span className="bg-muted-foreground/20 h-1.5 w-1.5 animate-bounce rounded-full" />
                  <span className="bg-muted-foreground/20 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0.2s]" />
                  <span className="bg-muted-foreground/20 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          <div className="bg-card/20 border-border border-t p-8">
            <div className="relative mx-auto max-w-3xl">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={
                  selectedAgent
                    ? `Hablar con ${selectedAgent.name}...`
                    : "Selecciona un agente a la izquierda"
                }
                title="Mensaje"
                disabled={!selectedAgent || isTyping}
                className="bg-card/40 border-border text-foreground h-16 w-full rounded-2xl border px-6 pr-16 text-sm font-medium transition-all focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !selectedAgent || isTyping}
                title="Enviar mensaje"
                className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-0"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Memory Monitor */}
        <div className="border-border bg-card/60 flex w-96 flex-col border-l">
          <div className="border-border flex items-center justify-between border-b p-8">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-orange-500" />
              <span className="text-[10px] font-black tracking-widest uppercase">
                Monitor de Memoria
              </span>
            </div>
            <Activity className="h-3 w-3 animate-pulse text-orange-500" />
          </div>

          <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-8">
            <div>
              <p className="text-muted-foreground/40 mb-4 text-[9px] font-black tracking-[0.2em] uppercase">
                Variables Capturadas
              </p>
              <div className="space-y-3">
                {Object.keys(memory).length > 0 ? (
                  Object.entries(memory).map(([key, value]) => (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={key}
                      className="group flex items-center justify-between rounded-2xl border border-orange-500/10 bg-orange-500/5 p-4"
                    >
                      <div>
                        <p className="mb-0.5 text-[9px] font-black tracking-widest text-orange-500 uppercase">
                          {key}
                        </p>
                        <p className="text-foreground/80 text-sm font-bold">{String(value)}</p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    </motion.div>
                  ))
                ) : (
                  <div className="border-border space-y-3 rounded-2xl border border-dashed p-8 text-center opacity-20">
                    <Info className="mx-auto h-8 w-8" />
                    <p className="text-[10px] font-bold tracking-widest uppercase">Memoria vacía</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-muted-foreground/40 mb-4 text-[9px] font-black tracking-[0.2em] uppercase">
                Estado del Sistema
              </p>
              <div className="space-y-4">
                <StatusRow label="Extracción en Tiempo Real" status="Activo" ok />
                <StatusRow label="Detección de Intención" status="Activo" ok />
                <StatusRow label="Persistencia" status="BD" ok />
              </div>
            </div>

            <div>
              <p className="text-muted-foreground/40 mb-4 text-[9px] font-black tracking-[0.2em] uppercase">
                Sesiones Guardadas
              </p>
              <div className="space-y-2">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="bg-card/30 border-border rounded-xl border p-3"
                    >
                      <p className="text-foreground/80 truncate text-xs font-bold">
                        {session.session_name}
                      </p>
                      <div className="text-muted-foreground/40 mt-1 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span className="text-[9px] font-bold tracking-widest uppercase">
                          {session.ai_agents?.name || "Agente"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="border-border space-y-2 rounded-2xl border border-dashed p-6 text-center opacity-20">
                    <Database className="mx-auto h-6 w-6" />
                    <p className="text-[10px] font-bold tracking-widest uppercase">
                      Sin sesiones guardadas
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

function StatusRow({ label, status, ok }: { label: string; status: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground/40 text-[10px] font-bold">{label}</span>
      <span
        className={cn(
          "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase",
          ok
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
            : "bg-card/40 text-muted-foreground/40 border-border"
        )}
      >
        {status}
      </span>
    </div>
  );
}
