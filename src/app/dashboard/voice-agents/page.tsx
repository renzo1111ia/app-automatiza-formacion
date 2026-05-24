/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import {
  Mic,
  Zap,
  Save,
  Settings2,
  BarChart3,
  Layers,
  Sparkles,
  PlusCircle,
  RotateCcw,
  Volume2,
  Phone,
  Building2,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

import { cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenant";
import { motion, AnimatePresence } from "framer-motion";
import {
  getVoiceAgents,
  getVoiceAgentVariants,
  saveVoiceAgent,
  saveVoiceVariant,
  importRetellAgents,
} from "@/lib/actions/voice-agents";
import {
  syncRetellResources,
  getRetellAgent,
  updateRetellAgentPrompt,
  updateRetellAgent,
  bindAgentToPhoneNumber,
  createRetellLLM,
  createRetellAgent,
} from "@/lib/actions/retell-sync";
import {
  syncUltravoxResources,
  listUltravoxAgents,
  getUltravoxCallTranscript,
  createUltravoxAgent,
  updateUltravoxAgent,
  listUltravoxCalls,
} from "@/lib/actions/ultravox-sync";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { VoiceAgent, VoiceAgentVariant } from "@/types/database";
import { VoiceConfigModal } from "./RetellConfigModal";
import { toast } from "@/components/ui/toast";

interface CallLog {
  callId: string;
  created: string;
  status: string;
  medium?: {
    twilio?: {
      toNumber?: string;
    };
  };
}

interface TranscriptMessage {
  role: string;
  text: string;
}

export default function VoiceAgentsPage() {
  const tenantName = useTenantStore((s) => s.tenantName) || "ESDEN";
  const [agents, setAgents] = useState<VoiceAgent[]>([]);

  const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null);
  const [activeTab, setActiveTab] = useState<"A" | "B" | "CONFIG" | "METRICS" | "VOCES">("A");
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeStateId, setActiveStateId] = useState<string | null>(null); // null = General Prompt

  // Create/Edit Agent Flow State
  const [editingAgentData, setEditingAgentData] = useState<Partial<VoiceAgent>>({
    name: "",
    description: "",
    provider: "RETELL",
    provider_agent_id: "",
    voice_id: "",
    from_number: "",
    prompt_text_retell: "",
  });

  // Resource Selection State — rich type from list-agents AgentResponse
  const [availableAgents, setAvailableAgents] = useState<
    {
      id: string;
      name: string;
      llm_id: string | null;
      voice_id: string | null;
      language: string;
      is_published: boolean;
      version: number;
    }[]
  >([]);
  const [availableVoices, setAvailableVoices] = useState<
    {
      id: string;
      name: string;
      provider: string;
      gender: string;
      accent: string;
      preview_url?: string;
    }[]
  >([]);
  const [availableNumbers, setAvailableNumbers] = useState<{ id: string; name: string }[]>([]);
  const [availableUltravoxVoices, setAvailableUltravoxVoices] = useState<
    { id: string; name: string }[]
  >([]);
  const [availableUltravoxModels, setAvailableUltravoxModels] = useState<
    { id: string; name: string }[]
  >([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [retellApiKey, setRetellApiKey] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Form State for Variants
  const [variantA, setVariantA] = useState<Partial<VoiceAgentVariant>>({});
  const [variantB, setVariantB] = useState<Partial<VoiceAgentVariant>>({});

  const loadAgents = async (tid?: string) => {
    const id = tid || tenantId;
    if (!id) return;
    const res = await getVoiceAgents(id);
    if (res.success && res.data) {
      setAgents(res.data);
      if (res.data.length > 0 && !selectedAgent) {
        setSelectedAgent(res.data[0]);
      }
    }
  };

  // Initial load is triggered after tenantId is fetched — see fetchKey useEffect below
  useEffect(() => {
    if (selectedAgent) {
      async function loadVariants(agentId: string) {
        const res = await getVoiceAgentVariants(agentId);
        if (res.success && res.data) {
          const data = res.data as VoiceAgentVariant[];
          const a = data.find((v) => !v.is_variant_b);
          const b = data.find((v) => v.is_variant_b);
          setVariantA(
            a || {
              agent_id: agentId,
              is_variant_b: false,
              version_label: "v1.0",
              prompt_text: "",
              weight: 0.5,
            }
          );
          setVariantB(
            b || {
              agent_id: agentId,
              is_variant_b: true,
              version_label: "v1.0",
              prompt_text: "",
              weight: 0.5,
            }
          );
        }
      }
      loadVariants(selectedAgent.id);
    }
  }, [selectedAgent]);

  const handleSaveVariants = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      await saveVoiceVariant(variantA);
      await saveVoiceVariant(variantB);
      toast({
        variant: "success",
        title: "Cambios publicados",
        description: "Cambios de voz publicados correctamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncRetellResources = async (keyOverride?: string) => {
    const key = keyOverride || retellApiKey;
    if (!key) return;
    setIsSyncing(true);
    try {
      const res = await syncRetellResources(key);
      if (res.success && res.data) {
        setAvailableAgents(res.data.agents);
        setAvailableNumbers(res.data.numbers);
        setAvailableVoices(res.data.voices);
      }
    } catch (e) {
      console.error("[Retell Sync] Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncUltravoxResources = async (keyOverride?: string) => {
    const key = keyOverride || ultravoxApiKey;
    if (!key) return;
    setIsSyncing(true);
    try {
      const [res, agentsRes] = await Promise.all([
        syncUltravoxResources(key),
        listUltravoxAgents(key),
      ]);

      if (res.success && res.data) {
        setAvailableUltravoxVoices(res.data.voices);
        setAvailableUltravoxModels(res.data.models);
      }
      if (agentsRes.success && agentsRes.data) {
        // Agent state removed as it was reported unused
      }
    } catch (e) {
      console.error("[Ultravox Sync] Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadCallLogs = async (agentId?: string) => {
    if (!ultravoxApiKey) return;
    const targetId = agentId || selectedAgent?.provider_agent_id;
    if (!targetId || selectedAgent?.provider !== "ULTRAVOX") return;

    setIsSyncing(true);
    try {
      const res = await listUltravoxCalls(ultravoxApiKey, targetId);
      if (res.success && res.data) {
        setCallLogs(res.data);
      }
    } catch (e) {
      console.error("[Ultravox Calls] Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleViewTranscript = async (callId: string) => {
    if (!ultravoxApiKey) return;
    setSelectedCallId(callId);
    setLoadingTranscript(true);
    try {
      const res = await getUltravoxCallTranscript(ultravoxApiKey, callId);
      if (res.success && res.data) {
        setTranscript(res.data);
      }
    } catch (e) {
      console.error("[Ultravox Transcript] Error:", e);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handleImportRetellAgents = async (specificAgent?: VoiceAgent) => {
    const agentsToImport = specificAgent
      ? availableAgents.filter((a) => a.id === specificAgent.provider_agent_id)
      : availableAgents;

    if (!tenantId || agentsToImport.length === 0 || !retellApiKey) return;
    setIsImporting(true);
    try {
      const res = await importRetellAgents(tenantId, agentsToImport, retellApiKey);
      if (res.success) {
        if (specificAgent) {
          toast({
            variant: "success",
            title: "Agente sincronizado",
            description: `Datos de "${specificAgent.name}" sincronizados correctamente.`,
          });
        } else {
          toast({
            variant: "success",
            title: "Agentes importados",
            description: `Importados/Actualizados: ${res.imported} agentes.`,
          });
        }
        loadAgents(tenantId); // Refresh the left panel
      } else {
        toast({ variant: "error", title: "Error al importar", description: res.error });
      }
    } catch (e) {
      toast({ variant: "error", title: "Error inesperado al importar", description: String(e) });
    } finally {
      setIsImporting(false);
    }
  };

  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [ultravoxApiKey, setUltravoxApiKey] = useState("");

  const refreshConfiguration = async () => {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return;

    setTenantId(tenant.id);
    const config = (tenant.config as any) || {};

    const rKey = config.retell?.api_key || "";
    const uKey = config.ultravox?.api_key || "";

    const providers: string[] = [];
    if (rKey) {
      providers.push("RETELL");
      setRetellApiKey(rKey);
      handleSyncRetellResources(rKey);
    } else {
      setRetellApiKey("");
    }

    if (uKey) {
      providers.push("ULTRAVOX");
      setUltravoxApiKey(uKey);
      handleSyncUltravoxResources(uKey);
    } else {
      setUltravoxApiKey("");
    }

    setAvailableProviders(providers);

    if (providers.length === 1) {
      setEditingAgentData((prev) => ({
        ...prev,
        provider: providers[0] as VoiceAgent["provider"],
      }));
    }

    if (tenant.id) {
      loadAgents(tenant.id);
    }
  };

  // Load Retell/Ultravox API Key and tenant ID on mount — auto-sync if keys exist
  useEffect(() => {
    refreshConfiguration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetchRetellPrompt = async (agentId: string) => {
    if (!retellApiKey || !agentId) return;
    setIsSyncing(true);
    const res = await getRetellAgent(retellApiKey, agentId);
    if (res.success && res.data) {
      const d = res.data;
      setEditingAgentData((prev) => ({
        ...prev,
        // Auto-fill name from Retell agent_name if user hasn't typed one yet
        name: prev.name?.trim() ? prev.name : d.agent_name || prev.name || "",
        prompt_text_retell: d.prompt,
        retell_llm_id: d.llm_id,
        voice_id: d.voice_id || prev.voice_id,
      }));
      // Mirror prompt to variant A
      setVariantA((prev) => ({ ...prev, prompt_text: d.prompt }));
    }
    setIsSyncing(false);
  };

  const handleCreateOrUpdateAgent = async () => {
    if (!editingAgentData.name?.trim()) return;
    setSaving(true);

    let agentDataToSave = { ...editingAgentData };

    // 0. AUTO-CREATE IN RETELL: If no provider_agent_id, create LLM + Agent from scratch
    if (
      retellApiKey &&
      editingAgentData.provider === "RETELL" &&
      !editingAgentData.provider_agent_id &&
      editingAgentData.voice_id
    ) {
      const prompt = variantA.prompt_text || "";

      // Step A: Create the LLM with the prompt
      const llmRes = await createRetellLLM(retellApiKey, prompt);
      if (!llmRes.success || !llmRes.data?.llm_id) {
        toast({
          variant: "error",
          title: "Error creando LLM en Retell",
          description: llmRes.error,
        });
        setSaving(false);
        return;
      }

      // Step B: Create the Agent with the LLM ID
      const agentRes = await createRetellAgent(retellApiKey, {
        llm_id: llmRes.data.llm_id,
        agent_name: editingAgentData.name || "Nuevo Agente",
        voice_id: editingAgentData.voice_id,
        version_description: editingAgentData.description || undefined,
      });
      if (!agentRes.success || !agentRes.data?.agent_id) {
        toast({
          variant: "error",
          title: "Error creando agente en Retell",
          description: agentRes.error,
        });
        setSaving(false);
        return;
      }

      agentDataToSave = {
        ...agentDataToSave,
        provider_agent_id: agentRes.data.agent_id,
        retell_llm_id: agentRes.data.llm_id,
      };
    }

    // 0.B AUTO-CREATE IN ULTRAVOX: If no provider_agent_id
    if (
      ultravoxApiKey &&
      editingAgentData.provider === "ULTRAVOX" &&
      !editingAgentData.provider_agent_id
    ) {
      const agentRes = await createUltravoxAgent(ultravoxApiKey, {
        name: editingAgentData.name || "Nuevo Agente Ultravox",
        systemPrompt: variantA.prompt_text || "Eres un asistente virtual...",
        voice: editingAgentData.voice_id || "terrence",
        model: (editingAgentData as any).provider_agent_id || "fixie-ai/ultravox-70b",
      });
      if (!agentRes.success || !agentRes.data?.agentId) {
        toast({
          variant: "error",
          title: "Error creando agente en Ultravox",
          description: agentRes.error || "Desconocido",
        });
        setSaving(false);
        return;
      }
      agentDataToSave = {
        ...agentDataToSave,
        provider_agent_id: agentRes.data.agentId,
      };
    }

    // 1. SYNC AGENT METADATA: If editing an existing Retell agent, PATCH its name/voice/language
    //    Runs in parallel with the LLM prompt mirror below since they're independent
    const agentMetaUpdatePromise =
      retellApiKey && agentDataToSave.provider_agent_id && agentDataToSave.provider === "RETELL"
        ? updateRetellAgent(retellApiKey, agentDataToSave.provider_agent_id, {
            agent_name: agentDataToSave.name || undefined,
            voice_id: agentDataToSave.voice_id || undefined,
            version_description: agentDataToSave.description || undefined,
          })
        : Promise.resolve(null);

    // Steps 1+2 run in parallel — both are independent Retell API calls:
    //   1. PATCH /update-agent  → sync name, voice_id, description
    //   2. PATCH /update-retell-llm → sync the prompt
    const [, promptPushResult] = await Promise.all([
      agentMetaUpdatePromise,
      (() => {
        const llmIdForSync = agentDataToSave.retell_llm_id || editingAgentData.retell_llm_id;
        if (editingAgentData.provider === "RETELL" && llmIdForSync && variantA.prompt_text) {
          return updateRetellAgentPrompt(retellApiKey, llmIdForSync, variantA.prompt_text);
        }
        return Promise.resolve(null);
      })(),
    ]);

    if (promptPushResult && !promptPushResult.success) {
      console.error("Retell Mirror Push Failed:", (promptPushResult as { error?: string }).error);
    }

    // 2.B SYNC ULTRAVOX METADATA
    if (
      ultravoxApiKey &&
      agentDataToSave.provider_agent_id &&
      agentDataToSave.provider === "ULTRAVOX"
    ) {
      await updateUltravoxAgent(ultravoxApiKey, agentDataToSave.provider_agent_id, {
        name: agentDataToSave.name || undefined,
        systemPrompt: variantA.prompt_text || undefined,
        voice: agentDataToSave.voice_id || undefined,
      });
    }

    // 3. Save to local DB
    const res = await saveVoiceAgent(
      {
        ...agentDataToSave,
        status: agentDataToSave.id ? agentDataToSave.status : "PAUSED",
      },
      tenantId
    );

    if (res.success && res.data) {
      // Also save variant A with the mirrored prompt
      await saveVoiceVariant({ ...variantA, agent_id: res.data.id });

      // 3. BIND agent to phone number in Retell (if number is configured)
      if (retellApiKey && res.data.provider_agent_id && res.data.from_number) {
        await bindAgentToPhoneNumber(
          retellApiKey,
          res.data.from_number,
          res.data.provider_agent_id,
          { also_inbound: false }
        );
      }

      await loadAgents();
      setSelectedAgent(res.data);
      setIsCreateModalOpen(false);
      setEditingAgentData({
        name: "",
        description: "",
        provider: "RETELL",
        provider_agent_id: "",
        voice_id: "",
        from_number: "",
        prompt_text_retell: "",
      });
    } else {
      toast({
        variant: "error",
        title: "Error al guardar el agente",
        description: res.error || "Desconocido",
      });
    }
    setSaving(false);
  };

  return (
    <div className="bg-background text-foreground flex h-[calc(100vh-80px)] flex-col overflow-hidden transition-colors duration-500">
      {/* Header Area */}
      <div className="bg-card/20 border-border flex items-center justify-between border-b px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10">
            <Mic className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">
              Gestión de Agentes de Voz
            </h1>
            <p className="text-muted-foreground mt-1 text-xs leading-none font-bold tracking-widest uppercase">
              Configura Retell AI y Ultravox AI para llamadas inteligentes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* API STATUS INDICATOR */}
          <div
            onClick={() => setIsConfigModalOpen(true)}
            className={cn(
              "group flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 transition-all",
              retellApiKey || ultravoxApiKey
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
                : "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
            )}
            title="Configurar Conexión API (Retell / Ultravox)"
          >
            <div
              className={cn(
                "h-1.5 w-1.5 animate-pulse rounded-full",
                retellApiKey || ultravoxApiKey ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            <span className="text-[10px] font-black tracking-widest uppercase">
              {retellApiKey && ultravoxApiKey
                ? "Retell & Ultravox OK"
                : retellApiKey
                  ? "Retell Conectado"
                  : ultravoxApiKey
                    ? "Ultravox Conectado"
                    : "Configurar API"}
            </span>
            <Settings2 className="ml-1 h-3 w-3 text-white/20 transition-colors group-hover:text-white" />
          </div>

          <button
            onClick={() => refreshConfiguration()}
            title="Recargar agentes"
            aria-label="Recargar agentes"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 font-bold transition-all hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4 text-white/40" />
          </button>
          <button
            onClick={handleSaveVariants}
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-xl bg-purple-600 px-6 text-[11px] font-black tracking-widest text-white uppercase shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Publicando..." : "Publicar Cambios"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL: Agents List ── */}
        <div className="border-border bg-card/40 flex w-80 flex-col border-r">
          <div className="space-y-3 p-6">
            {availableProviders.length === 0 && (
              <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center">
                <Cpu className="mx-auto mb-2 h-8 w-8 text-red-400 opacity-50" />
                <h4 className="text-[10px] font-black tracking-tight text-red-400 uppercase">
                  Sin Configuración de Voz
                </h4>
                <p className="mt-1 text-[9px] leading-tight tracking-tight text-white/40 uppercase">
                  Configura Retell o Ultravox en los ajustes del sistema.
                </p>
                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className="mt-3 w-full rounded-xl bg-red-600 px-3 py-2 text-[9px] font-black tracking-widest text-white uppercase transition-all hover:bg-red-700"
                >
                  Ir a Ajustes
                </button>
              </div>
            )}
            <button
              onClick={async () => {
                if (availableProviders.length === 0) {
                  toast({
                    variant: "warning",
                    title: "Configura una API Key",
                    description:
                      "Primero configura al menos una API Key de voz (Retell o Ultravox).",
                  });
                  setIsConfigModalOpen(true);
                  return;
                }
                setEditingAgentData({
                  name: "",
                  description: "",
                  provider: availableProviders[0] as any,
                  provider_agent_id: "",
                  voice_id: "",
                  from_number: "",
                  prompt_text_retell: "",
                });
                setIsCreateModalOpen(true);
                if (availableProviders.includes("RETELL")) handleSyncRetellResources();
              }}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-purple-500/40 text-center text-[10px] font-black tracking-widest text-purple-400 uppercase shadow-lg shadow-purple-500/5 transition-all hover:bg-purple-500/5"
              title="Crear nuevo agente de voz"
            >
              <PlusCircle className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Nuevo Agente de Voz
            </button>

            {/* Retell Sync Status Row */}
            {retellApiKey && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncRetellResources()}
                    disabled={isSyncing}
                    title="Sincronizar agentes y números desde Retell"
                    className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[9px] font-black tracking-widest text-white/40 uppercase transition-all hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                    {isSyncing ? "Sync..." : "Sync"}
                  </button>
                  <div className="flex gap-2 text-[9px] font-bold tracking-widest text-white/30 uppercase">
                    <span
                      className={
                        availableAgents.length > 0 ? "text-emerald-400/70" : "text-white/20"
                      }
                    >
                      {availableAgents.length} agentes
                    </span>
                    <span>·</span>
                    <span
                      className={
                        availableNumbers.length > 0 ? "text-emerald-400/70" : "text-white/20"
                      }
                    >
                      {availableNumbers.length} números
                    </span>
                  </div>
                </div>
                {/* Import button — only visible when Retell has agents not yet in local DB */}
                {availableAgents.length > agents.length && (
                  <button
                    onClick={() => handleImportRetellAgents()}
                    disabled={isImporting}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-black tracking-widest text-emerald-400 uppercase transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                    title="Importar todos los agentes de Retell al panel"
                  >
                    {isImporting ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <PlusCircle className="h-3 w-3" />
                    )}
                    {isImporting
                      ? "Importando..."
                      : `Importar ${availableAgents.length - agents.length} de Retell`}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-10">
            {agents.length === 0 && (
              <EmptyState
                size="sm"
                icon={<Mic className="h-10 w-10" />}
                title="Sin agentes de voz"
                description="Importa o crea un agente de voz con Retell o Ultravox para empezar."
                className="mx-2 mt-2"
              />
            )}
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={cn(
                  "group w-full rounded-2xl border p-4 text-left transition-all",
                  selectedAgent?.id === agent.id
                    ? "border-purple-500/20 bg-purple-500/10"
                    : "border-white/5 bg-white/[0.01] hover:bg-white/[0.03]"
                )}
                title={`Seleccionar Agente: ${agent.name}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[9px] font-black tracking-widest uppercase",
                      agent.status === "ACTIVE" ? "text-emerald-400" : "text-white/20"
                    )}
                  >
                    {agent.status === "ACTIVE" ? "Activo" : "Pausado"}
                  </span>
                  {agent.status === "ACTIVE" && (
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-white/90 group-hover:text-white">
                  {agent.name}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-black tracking-widest text-white/40 uppercase">
                    {agent.provider}
                  </span>
                  <p className="line-clamp-1 text-[10px] text-white/30">
                    {agent.voice_id || "Voz base"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── MAIN CONTENT: Editor & Tabs ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Tabs Navigation */}
          <div className="flex items-center border-b border-white/5 bg-black/20 px-8">
            <TabButton
              active={activeTab === "A"}
              onClick={() => setActiveTab("A")}
              icon={Zap}
              label="Prompt A"
              color="purple"
            />
            <TabButton
              active={activeTab === "B"}
              onClick={() => setActiveTab("B")}
              icon={Layers}
              label="Prompt B"
              color="purple"
            />
            <TabButton
              active={activeTab === "CONFIG"}
              onClick={() => setActiveTab("CONFIG")}
              icon={Settings2}
              label="Config A/B"
              color="purple"
            />
            <TabButton
              active={activeTab === "VOCES"}
              onClick={() => setActiveTab("VOCES")}
              icon={Volume2}
              label="Voces"
              color="purple"
            />
            <TabButton
              active={activeTab === "METRICS"}
              onClick={() => {
                setActiveTab("METRICS");
                handleLoadCallLogs();
              }}
              icon={BarChart3}
              label="Historial"
              color="purple"
            />
            <button
              onClick={() => {
                if (selectedAgent) {
                  setEditingAgentData(selectedAgent);
                  setIsCreateModalOpen(true);
                }
              }}
              title="Ajustes técnicos"
              className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-[10px] font-black tracking-widest text-white/40 uppercase transition-all hover:bg-white/10 hover:text-white"
            >
              <Settings2 className="h-3 w-3" />
              Ajustes Técnicos
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">
              {(activeTab === "A" || activeTab === "B") && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex h-full flex-col space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                        <Sparkles className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase">
                        Instrucciones Conversacionales
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {selectedAgent?.provider === "RETELL" &&
                        selectedAgent.retell_llm_config?.states && (
                          <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-white/5 p-1">
                            <button
                              onClick={() => setActiveStateId(null)}
                              className={cn(
                                "rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all",
                                activeStateId === null
                                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                                  : "text-white/40 hover:text-white/60"
                              )}
                            >
                              General
                            </button>
                            {selectedAgent.retell_llm_config.states.map((state) => (
                              <button
                                key={state.name}
                                onClick={() => setActiveStateId(state.name)}
                                className={cn(
                                  "rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all",
                                  activeStateId === state.name
                                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                                    : "text-white/40 hover:text-white/60"
                                )}
                              >
                                {state.name}
                              </button>
                            ))}
                          </div>
                        )}
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold tracking-widest text-white/20 uppercase">
                        Version {(activeTab === "A" ? variantA : variantB).version_label}
                      </span>
                    </div>
                  </div>

                  <div className="group relative min-h-[400px] flex-1 text-left">
                    {selectedAgent?.provider === "RETELL" && !selectedAgent.retell_llm_config && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl border border-white/5 bg-black/60 p-8 text-center backdrop-blur-sm">
                        <div className="max-w-md space-y-4">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10">
                            <RefreshCw className="h-8 w-8 text-purple-400" />
                          </div>
                          <h4 className="text-xl font-black tracking-tight uppercase">
                            Multiprompt no sincronizado
                          </h4>
                          <p className="text-sm text-white/40">
                            Este agente de Retell puede tener múltiples estados (prompts), pero no
                            se han cargado todavía en el dashboard.
                          </p>
                          <button
                            onClick={() => handleImportRetellAgents(selectedAgent)}
                            disabled={isImporting}
                            className="h-12 rounded-xl bg-purple-600 px-8 text-[11px] font-black tracking-widest text-white uppercase shadow-lg shadow-purple-500/20 transition-all hover:scale-105 disabled:opacity-50"
                          >
                            {isImporting ? "Sincronizando..." : "Sincronizar Estados Ahora"}
                          </button>
                        </div>
                      </div>
                    )}

                    {activeStateId ? (
                      <div className="h-full w-full overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-sm leading-relaxed font-medium whitespace-pre-wrap text-white/80 shadow-inner">
                        <div className="mb-4 flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                          <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase">
                            Estado: {activeStateId} (Lectura)
                          </span>
                        </div>
                        {selectedAgent?.retell_llm_config?.states?.find(
                          (s) => s.name === activeStateId
                        )?.state_prompt || "Sin prompt configurado para este estado."}
                      </div>
                    ) : (
                      <textarea
                        value={(activeTab === "A" ? variantA : variantB).prompt_text || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activeTab === "A")
                            setVariantA((prev) => ({ ...prev, prompt_text: val }));
                          else setVariantB((prev) => ({ ...prev, prompt_text: val }));
                        }}
                        className="h-full w-full resize-none rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-sm leading-relaxed font-medium text-white/80 shadow-inner transition-all focus:ring-4 focus:ring-purple-500/10 focus:outline-none"
                        placeholder={`Eres un agente de ventas telefónico experto de ${tenantName}...`}
                        title="Editor de prompt"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                      <Volume2 className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] leading-none font-bold tracking-widest text-white/40 uppercase">
                        Optimización de Voz
                      </p>
                      <p className="text-xs leading-none font-medium text-white/80">
                        Este prompt está configurado para la voz{" "}
                        <span className="text-purple-400">
                          {selectedAgent?.voice_id || "Estándar"}
                        </span>{" "}
                        en {selectedAgent?.provider}.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "VOCES" && (
                <motion.div
                  key="voces"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex h-full flex-col space-y-6"
                >
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-pink-500/20 bg-pink-500/10">
                        <Volume2 className="h-4 w-4 text-pink-400" />
                      </div>
                      <span className="text-[11px] font-black tracking-widest text-pink-400 uppercase">
                        Catálogo de Voces Sincronizadas
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold tracking-widest text-white/20 uppercase">
                        {availableVoices.length} voces detectadas
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pb-20 md:grid-cols-2 lg:grid-cols-3">
                    {availableVoices.length === 0 && (
                      <div className="rounded-3xl border border-white/5 bg-white/[0.02] py-20 text-center md:col-span-2 lg:col-span-3">
                        <Volume2 className="mx-auto mb-4 h-10 w-10 text-white/10" />
                        <p className="text-[10px] font-black tracking-widest text-white/20 uppercase">
                          Sincroniza con Retell para ver el catálogo de voces
                        </p>
                      </div>
                    )}
                    {availableVoices.map((voice) => (
                      <div
                        key={voice.id}
                        className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-left transition-all hover:border-white/10 hover:bg-white/[0.06]"
                      >
                        <div className="absolute top-0 right-0 p-3">
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] font-black tracking-widest text-white/40 uppercase">
                            {voice.provider}
                          </span>
                        </div>

                        <h4 className="mb-1 text-sm font-bold text-white/90">{voice.name}</h4>
                        <p className="mb-4 truncate font-mono text-[9px] text-white/20">
                          {voice.id}
                        </p>

                        <div className="mb-6 flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-lg px-2 py-0.5 text-[8px] font-black tracking-widest uppercase",
                              voice.gender === "male"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-pink-500/10 text-pink-400"
                            )}
                          >
                            {voice.gender === "male" ? "HOMBRE" : "MUJER"}
                          </span>
                          <span className="rounded-lg border border-white/5 bg-white/5 px-2 py-0.5 text-[8px] font-black tracking-widest text-white/40 uppercase">
                            {voice.accent}
                          </span>
                        </div>

                        {voice.preview_url ? (
                          <div className="relative pt-2">
                            <audio
                              controls
                              className="h-8 w-full opacity-20 transition-opacity hover:opacity-100"
                            >
                              <source src={voice.preview_url} type="audio/mpeg" />
                            </audio>
                          </div>
                        ) : (
                          <div className="flex h-8 items-center justify-center rounded-lg border border-dashed border-white/5">
                            <span className="text-[8px] font-black tracking-widest text-white/10 uppercase">
                              Sin vista previa
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setEditingAgentData((prev) => ({ ...prev, voice_id: voice.id }));
                            setIsCreateModalOpen(true);
                          }}
                          title={`Seleccionar voz ${voice.name}`}
                          className="absolute top-0 left-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === "METRICS" && (
                <motion.div
                  key="metrics"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex h-full flex-col space-y-6"
                >
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                        <BarChart3 className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="text-[11px] font-black tracking-widest text-blue-400 uppercase">
                        Últimas Llamadas del Agente
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col overflow-hidden rounded-[40px] border border-white/10 bg-white/[0.02]">
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 z-10 border-b border-white/5 bg-white/5">
                          <tr>
                            <th className="px-6 py-4 font-black tracking-widest text-white/40 uppercase">
                              ID / Fecha
                            </th>
                            <th className="px-6 py-4 font-black tracking-widest text-white/40 uppercase">
                              Estado
                            </th>
                            <th className="px-6 py-4 font-black tracking-widest text-white/40 uppercase">
                              Destino
                            </th>
                            <th className="px-6 py-4 font-black tracking-widest text-white/40 uppercase">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {callLogs.map((call) => (
                            <tr
                              key={call.callId}
                              className={cn(
                                "transition-colors",
                                selectedCallId === call.callId
                                  ? "bg-purple-500/5"
                                  : "hover:bg-white/[0.02]"
                              )}
                            >
                              <td className="px-6 py-4">
                                <div className="mb-1 font-mono text-[10px] text-white/40">
                                  {call.callId.slice(0, 12)}...
                                </div>
                                <div className="text-[10px] font-bold text-white/60">
                                  {new Date(call.created).toLocaleString()}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase",
                                    call.status === "ended"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-blue-500/10 text-blue-400"
                                  )}
                                >
                                  {call.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-white/60">
                                {call.medium?.twilio?.toNumber || "N/A"}
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleViewTranscript(call.callId)}
                                  className="text-[10px] font-black tracking-widest text-purple-400 uppercase transition-colors hover:text-purple-300"
                                >
                                  {loadingTranscript && selectedCallId === call.callId
                                    ? "Cargando..."
                                    : "Ver Transcripción"}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {callLogs.length === 0 && !isSyncing && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-6 py-12 text-center font-black tracking-widest text-white/20 uppercase"
                              >
                                Sin llamadas registradas
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Dynamic Transcript View for Ultravox */}
                    <div className="flex-1 space-y-6 overflow-y-auto border-t border-white/5 bg-black/40 p-8">
                      {loadingTranscript ? (
                        <div className="flex h-32 items-center justify-center">
                          <RefreshCw className="h-8 w-8 animate-spin text-purple-500/40" />
                        </div>
                      ) : transcript.length > 0 ? (
                        transcript.map((msg, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-start gap-4",
                              msg.role === "user" ? "flex-row-reverse" : ""
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-black uppercase",
                                msg.role === "user"
                                  ? "border-blue-500/30 bg-blue-500/20 text-blue-400"
                                  : "border-purple-500/30 bg-purple-500/20 text-purple-400"
                              )}
                            >
                              {msg.role === "user" ? "U" : "AI"}
                            </div>
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl border p-4 text-sm",
                                msg.role === "user"
                                  ? "rounded-tr-none border-blue-500/20 bg-blue-500/10 text-right font-medium text-white/80"
                                  : "rounded-tl-none border-purple-500/20 bg-purple-500/10 text-white/80"
                              )}
                            >
                              {msg.text}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-white/20">
                          <BarChart3 className="mb-4 h-12 w-12 opacity-10" />
                          <p className="text-[10px] font-black tracking-widest uppercase">
                            Selecciona una llamada para ver la conversación
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-left">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsCreateModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative max-h-[90vh] w-full max-w-2xl space-y-8 overflow-y-auto rounded-[40px] border border-white/10 bg-slate-900 p-10 shadow-2xl"
            >
              <div className="space-y-4 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-500/20 bg-purple-500/10">
                  <Volume2 className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="text-3xl font-black tracking-tight uppercase">
                  {editingAgentData.id ? "Editar Agente" : "Nuevo Agente de Voz"}
                </h3>
                <p className="text-sm font-medium text-white/40">
                  Vincula los parámetros técnicos del proveedor de voz.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3 md:col-span-2">
                  <label className="ml-4 text-[10px] font-black tracking-widest text-white/30 uppercase">
                    Nombre Comercial
                  </label>
                  <input
                    autoFocus
                    value={editingAgentData.name}
                    onChange={(e) =>
                      setEditingAgentData({ ...editingAgentData, name: e.target.value })
                    }
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold transition-all outline-none focus:border-purple-500/40 focus:ring-4 focus:ring-purple-500/10"
                    placeholder="Ej: Retell Sales Agent v2"
                    title="Nombre del agente"
                  />
                </div>

                <div className="space-y-3">
                  <label
                    className="ml-4 flex items-center gap-2 text-[10px] font-black tracking-widest text-white/30 uppercase"
                    htmlFor="provider-select"
                  >
                    <Building2 className="h-3 w-3" /> Proveedor
                  </label>
                  <select
                    id="provider-select"
                    value={editingAgentData.provider}
                    onChange={(e) =>
                      setEditingAgentData({ ...editingAgentData, provider: e.target.value as any })
                    }
                    className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold transition-all outline-none focus:border-purple-500/40"
                    title="Seleccionar proveedor de voz"
                  >
                    {availableProviders.includes("RETELL") && (
                      <option value="RETELL" className="bg-slate-900">
                        Retell AI
                      </option>
                    )}
                    {availableProviders.includes("ULTRAVOX") && (
                      <option value="ULTRAVOX" className="bg-slate-900">
                        Ultravox AI
                      </option>
                    )}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="ml-4 flex items-center gap-2 text-[10px] font-black tracking-tight text-white/30 uppercase">
                    <Cpu className="h-3 w-3" />
                    {editingAgentData.provider === "RETELL"
                      ? "ID del Agente (Retell)"
                      : "Modelo de IA (Ultravox)"}
                  </label>

                  {editingAgentData.provider === "RETELL" ? (
                    availableAgents.length > 0 ? (
                      <select
                        title="Seleccionar ID del Agente"
                        value={editingAgentData.provider_agent_id || ""}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const cached = availableAgents.find((a) => a.id === selectedId);
                          setEditingAgentData((prev) => ({
                            ...prev,
                            provider_agent_id: selectedId,
                            retell_llm_id: cached?.llm_id || prev.retell_llm_id || "",
                            voice_id: cached?.voice_id || prev.voice_id || "",
                          }));
                          if (selectedId) handleFetchRetellPrompt(selectedId);
                        }}
                        className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold transition-all outline-none focus:border-purple-500/40"
                      >
                        <option value="">✨ Crear Nuevo en Retell...</option>
                        {availableAgents.map((a) => (
                          <option key={a.id} value={a.id} className="bg-slate-900">
                            {a.is_published ? "✓ " : ""}
                            {a.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={editingAgentData.provider_agent_id || ""}
                        onChange={(e) =>
                          setEditingAgentData({
                            ...editingAgentData,
                            provider_agent_id: e.target.value,
                          })
                        }
                        className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 font-mono text-sm transition-all outline-none focus:border-purple-500/40"
                        placeholder="Déjalo vacío para crear automáticamente"
                      />
                    )
                  ) : (
                    <select
                      title="Seleccionar Modelo de IA"
                      value={editingAgentData.provider_agent_id || ""}
                      onChange={(e) =>
                        setEditingAgentData({
                          ...editingAgentData,
                          provider_agent_id: e.target.value,
                        })
                      }
                      className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold transition-all outline-none focus:border-purple-500/40"
                    >
                      <option value="">Selecciona un Modelo...</option>
                      {availableUltravoxModels.map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-900">
                          {m.name}
                        </option>
                      ))}
                      {availableUltravoxModels.length === 0 && (
                        <option value="fixie-ai/ultravox-70b" className="bg-slate-900">
                          Ultravox 70B (Default)
                        </option>
                      )}
                    </select>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="ml-4 flex items-center gap-2 text-[10px] font-black tracking-tight text-white/30 uppercase">
                    <Volume2 className="h-3 w-3" /> Voz del Agente
                  </label>

                  <select
                    title="Seleccionar Voz del Agente"
                    value={editingAgentData.voice_id || ""}
                    onChange={(e) =>
                      setEditingAgentData({ ...editingAgentData, voice_id: e.target.value })
                    }
                    className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold transition-all outline-none focus:border-purple-500/40"
                  >
                    <option value="">Selecciona una Voz...</option>
                    {editingAgentData.provider === "RETELL" ? (
                      <>
                        {availableVoices.length > 0 ? (
                          availableVoices.map((v) => (
                            <option key={v.id} value={v.id} className="bg-slate-900">
                              {v.name} ({v.accent} - {v.gender === "male" ? "M" : "F"})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="terrence" className="bg-slate-900">
                              Terrence (Retell)
                            </option>
                            <option value="sarah" className="bg-slate-900">
                              Sarah (Retell)
                            </option>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {availableUltravoxVoices.map((v) => (
                          <option key={v.id} value={v.id} className="bg-slate-900">
                            {v.name}
                          </option>
                        ))}
                        {availableUltravoxVoices.length === 0 && (
                          <option value="terrence" className="bg-slate-900">
                            Terrence (Ultravox)
                          </option>
                        )}
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="ml-4 flex items-center gap-2 text-[10px] font-black tracking-widest text-white/30 uppercase">
                    <Phone className="h-3 w-3" /> Número de Salida
                  </label>
                  {availableNumbers.length > 0 ? (
                    <select
                      value={editingAgentData.from_number || ""}
                      onChange={(e) =>
                        setEditingAgentData({ ...editingAgentData, from_number: e.target.value })
                      }
                      className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold transition-all outline-none focus:border-purple-500/40"
                      title="Seleccionar número de salida"
                    >
                      <option value="">Selecciona un Número...</option>
                      {availableNumbers.map((n) => (
                        <option key={n.id} value={n.id} className="bg-slate-900">
                          {n.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={editingAgentData.from_number || ""}
                      onChange={(e) =>
                        setEditingAgentData({ ...editingAgentData, from_number: e.target.value })
                      }
                      className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 font-mono text-sm transition-all outline-none focus:border-purple-500/40"
                      placeholder="+1..."
                      title="Número de teléfono de salida"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <label
                    className="ml-4 text-[10px] font-black tracking-widest text-white/30 uppercase"
                    htmlFor="status-select"
                  >
                    Estado Inicial
                  </label>
                  <select
                    id="status-select"
                    value={editingAgentData.status}
                    onChange={(e) =>
                      setEditingAgentData({ ...editingAgentData, status: e.target.value as any })
                    }
                    className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold transition-all outline-none focus:border-purple-500/40"
                    title="Seleccionar estado"
                  >
                    <option value="PAUSED" className="bg-slate-900">
                      Pausado (Draft)
                    </option>
                    <option value="ACTIVE" className="bg-slate-900">
                      Activo (Listo)
                    </option>
                  </select>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <div className="mb-2 flex items-center justify-between px-4">
                    <label className="text-[10px] font-black tracking-widest text-white/30 uppercase">
                      Notas Internas
                    </label>
                    {isSyncing && (
                      <span className="animate-pulse text-[9px] font-black tracking-widest text-purple-400 uppercase">
                        Sincronizando con Retell...
                      </span>
                    )}
                  </div>
                  <textarea
                    value={editingAgentData.description || ""}
                    onChange={(e) =>
                      setEditingAgentData({ ...editingAgentData, description: e.target.value })
                    }
                    className="h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-6 text-sm font-medium transition-all outline-none focus:border-purple-500/40"
                    placeholder="Ej: Este agente se usará para campañas de Outbound en México..."
                    title="Descripción interna"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-14 flex-1 rounded-2xl border border-white/10 bg-white/5 text-[10px] font-black font-bold tracking-widest uppercase transition-all hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateOrUpdateAgent}
                  disabled={saving || !editingAgentData.name?.trim()}
                  className="h-14 flex-1 rounded-2xl bg-purple-600 text-[10px] font-black tracking-widest text-white uppercase shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Agente"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <VoiceConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        currentRetellKey={retellApiKey}
        currentUltravoxKey={ultravoxApiKey}
        tenantId={tenantId}
        onSuccess={(provider, newKey) => {
          if (provider === "retell") {
            setRetellApiKey(newKey);
            handleSyncRetellResources(newKey);
          } else {
            setUltravoxApiKey(newKey);
            handleSyncUltravoxResources(newKey);
          }
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
  color = "primary",
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={`Pestaña ${label}`}
      className={cn(
        "relative flex h-[72px] items-center gap-3 px-6 text-[11px] font-black tracking-widest uppercase transition-all",
        active ? `text-${color}-400` : "text-white/30 hover:text-white/60"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {active && (
        <motion.div
          layoutId="activeTabBadgeVoice"
          className={cn(
            "absolute right-0 bottom-0 left-0 h-1 rounded-t-full",
            color === "purple"
              ? "bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              : "bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
          )}
        />
      )}
    </button>
  );
}
