/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, PhoneCall, Code, Play, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RetellWebClient } from "retell-client-js-sdk";

interface RetellSimulationPanelProps {
  agentId?: string;
  tenantId?: string;
}

const retellWebClient = new RetellWebClient();

export function RetellSimulationPanel({ agentId, tenantId }: RetellSimulationPanelProps) {
  const [activeTab, setActiveTab] = useState<"audio" | "llm">("audio");
  const [isSimulating, setIsSimulating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    // Setup event listeners
    retellWebClient.on("call_started", () => {
      setIsConnecting(false);
      setIsSimulating(true);
      setLogs((prev) => [...prev, { role: "system", content: "Llamada iniciada. Puedes hablar." }]);
    });

    retellWebClient.on("call_ended", () => {
      setIsSimulating(false);
      setIsConnecting(false);
      setLogs((prev) => [...prev, { role: "system", content: "Llamada terminada." }]);
    });

    retellWebClient.on("agent_start_talking", () => {
      // Could show some animation
    });

    retellWebClient.on("agent_stop_talking", () => {
      // Stop animation
    });

    retellWebClient.on("update", (update) => {
      // Update transcripts if needed. Since `update` contains transcript, we could parse it.
      // But for simplicity, we just rely on audio first.
    });

    retellWebClient.on("error", (err) => {
      console.error("[RetellWebClient Error]", err);
      setError("Error en la conexión con Retell.");
      setIsSimulating(false);
      setIsConnecting(false);
      retellWebClient.stopCall();
    });

    return () => {
      retellWebClient.off("call_started");
      retellWebClient.off("call_ended");
      retellWebClient.off("agent_start_talking");
      retellWebClient.off("agent_stop_talking");
      retellWebClient.off("update");
      retellWebClient.off("error");
      if (isSimulating) {
        retellWebClient.stopCall();
      }
    };
  }, [isSimulating]);

  const toggleCall = async () => {
    if (isSimulating || isConnecting) {
      retellWebClient.stopCall();
      setIsSimulating(false);
      setIsConnecting(false);
      return;
    }

    if (!agentId || !tenantId) {
      setError("Faltan configuraciones del agente.");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setLogs([{ role: "system", content: "Solicitando token para la llamada..." }]);

    try {
      const response = await fetch("/api/calls/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, tenantId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al obtener token.");
      }

      const data = await response.json();

      setLogs((prev) => [
        ...prev,
        { role: "system", content: "Token recibido. Iniciando WebRTC..." },
      ]);

      await retellWebClient.startCall({
        accessToken: data.accessToken,
        sampleRate: 24000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error("[toggleCall]", msg);
      setError(msg);
      setIsConnecting(false);
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-[#0F0F0F] dark:text-white">
      {/* Top Tabs */}
      <div className="flex items-center border-b border-slate-200 p-4 dark:border-white/5">
        <div className="flex w-full gap-2 rounded-lg bg-slate-200 p-1 dark:bg-black/50">
          <button
            onClick={() => setActiveTab("audio")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-colors",
              activeTab === "audio"
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300"
            )}
          >
            <PhoneCall className="h-3.5 w-3.5" /> Test Audio
          </button>
          <button
            onClick={() => setActiveTab("llm")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-colors",
              activeTab === "llm"
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300"
            )}
          >
            <Code className="h-3.5 w-3.5" /> Test LLM
          </button>
        </div>
      </div>

      {/* Main Simulation Area */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        {activeTab === "audio" ? (
          <div className="flex flex-col items-center gap-8">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-200 shadow-inner dark:bg-black/40">
              {isSimulating && (
                <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/20" />
              )}
              <Mic
                className={cn(
                  "h-12 w-12",
                  isSimulating ? "text-purple-500" : "text-slate-400 dark:text-gray-600"
                )}
              />
            </div>

            {error && <p className="max-w-[250px] text-xs text-red-500">{error}</p>}

            <button
              onClick={toggleCall}
              disabled={isConnecting || !agentId}
              className={cn(
                "flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-all",
                isSimulating
                  ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-none dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              )}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Conectando...
                </>
              ) : isSimulating ? (
                <>
                  <Square className="h-4 w-4" fill="currentColor" /> Terminar Prueba
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" fill="currentColor" /> Run Test
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-4">
            <Code className="h-12 w-12 text-slate-400 dark:text-gray-600" />
            <p className="text-sm text-slate-500 dark:text-gray-500">
              Ingresa texto para probar la respuesta del LLM sin usar voz.
            </p>
            <div className="flex w-full gap-2">
              <input
                type="text"
                title="Mensaje de prueba LLM"
                placeholder="Escribe un mensaje..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none dark:border-white/10 dark:bg-black/50 dark:text-white dark:placeholder:text-gray-600"
              />
              <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Logger */}
      <div className="h-48 overflow-y-auto border-t border-slate-200 bg-slate-100 p-4 dark:border-white/5 dark:bg-black/80">
        {logs.map((log, i) => (
          <p
            key={i}
            className={cn(
              "font-mono text-xs",
              log.role === "system"
                ? "text-emerald-600 dark:text-green-400"
                : "text-slate-500 dark:text-gray-400"
            )}
          >
            [{log.role === "system" ? "System" : "Agente"}] {log.content}
          </p>
        ))}
        {logs.length === 0 && (
          <p className="font-mono text-xs text-slate-400 dark:text-gray-600">
            Los logs aparecerán aquí...
          </p>
        )}
      </div>
    </div>
  );
}
