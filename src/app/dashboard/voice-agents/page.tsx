/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
  GitBranch,
  Code2,
  ExternalLink,
  Globe,
} from "lucide-react";

import { RetellIdentityPanel } from "@/components/agents/RetellIdentityPanel";
import { RetellSettingsPanel } from "@/components/agents/RetellSettingsPanel";
import { RetellSimulationPanel } from "@/components/agents/RetellSimulationPanel";
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
import { Tenant } from "@/types/tenant";
import { VoiceConfigModal } from "./RetellConfigModal";
import { VoicesCatalog } from "./VoicesCatalog";
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

// ── Helper: detect Retell response engine type from the agent data ──
function getRetellEngineType(
  agent: VoiceAgent | null
): "retell-llm" | "custom-llm" | "conversation-flow" | null {
  if (!agent || agent.provider !== "RETELL") return null;
  const raw =
    (agent as any)._raw_response_engine_type || (agent.retell_llm_config as any)?._engine_type;
  if (raw) return raw;
  // Heuristic: if has retell_llm_id → retell-llm, if has conversation_flow_id → conversation-flow
  if ((agent as any).conversation_flow_id) return "conversation-flow";
  if (agent.retell_llm_id) return "retell-llm";
  // If config exists but no llm_id it might be custom-llm (llm_websocket_url)
  if ((agent as any).llm_websocket_url) return "custom-llm";
  if (agent.retell_llm_config) return "retell-llm";
  return null;
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

  // When agent changes, load its variants
  useEffect(() => {
    if (selectedAgent?.id) {
      setActiveStateId(null);

      // Initialize editingAgentData with the selected DB agent
      setEditingAgentData(selectedAgent as Partial<VoiceAgent>);

      const loadVariants = async (agentId: string) => {
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
      };
      loadVariants(selectedAgent.id);

      // Auto-fetch Retell advanced configs if it's a Retell agent
      if (selectedAgent.provider === "RETELL" && selectedAgent.provider_agent_id) {
        handleFetchRetellPrompt(selectedAgent.provider_agent_id);
      }
    }
  }, [selectedAgent, retellApiKey]);

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

  const handleSyncRetellResources = async (keyOverride?: string, showToast = false) => {
    const key = keyOverride || retellApiKey;
    if (!key) {
      if (showToast)
        toast({
          variant: "error",
          title: "Error",
          description: "No hay API Key de Retell configurada.",
        });
      return;
    }
    setIsSyncing(true);
    try {
      const res = await syncRetellResources(key);
      if (res.success && res.data) {
        setAvailableAgents(res.data.agents);
        setAvailableNumbers(res.data.numbers);
        setAvailableVoices(res.data.voices);
        if (showToast)
          toast({
            variant: "success",
            title: "Sincronización completa",
            description: "Voces y agentes de Retell actualizados.",
          });
      } else {
        if (showToast)
          toast({
            variant: "error",
            title: "Error",
            description: "Error al sincronizar con Retell.",
          });
      }
    } catch (e) {
      console.error("[Retell Sync] Error:", e);
      if (showToast)
        toast({
          variant: "error",
          title: "Error",
          description: "Fallo de conexión al sincronizar.",
        });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncUltravoxResources = async (keyOverride?: string, showToast = false) => {
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
        if (showToast)
          toast({
            variant: "success",
            title: "Sincronización completa",
            description: "Voces de Ultravox actualizadas.",
          });
      } else {
        if (showToast)
          toast({
            variant: "error",
            title: "Error",
            description: "Error al sincronizar con Ultravox.",
          });
      }
      if (agentsRes.success && agentsRes.data) {
        // Agent state removed as it was reported unused
      }
    } catch (e) {
      console.error("[Ultravox Sync] Error:", e);
      if (showToast)
        toast({
          variant: "error",
          title: "Error",
          description: "Fallo de conexión al sincronizar.",
        });
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
    let tenant = await getActiveTenantConfig();

    // Fallback to Zustand store if the server action fails (e.g., cookie issues)
    if (!tenant) {
      const storeState = useTenantStore.getState();
      if (storeState.tenantId) {
        tenant = {
          id: storeState.tenantId,
          name: storeState.tenantName,
          config: storeState.config,
          api_type: "internal",
          is_admin: storeState.isAdmin,
          username: "",
        } as Tenant;
      }
    }

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
        ...(d._raw as Record<string, any>),
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

      // Step B: Create the Agent pointing to that LLM
      const agentRes = await createRetellAgent(retellApiKey, {
        llm_id: llmRes.data.llm_id,
        agent_name: editingAgentData.name!,
        voice_id: editingAgentData.voice_id!,
        language: "es-ES",
        version_description: editingAgentData.description || undefined,
      });

      if (!agentRes.success || !agentRes.data?.agent_id) {
        toast({
          variant: "error",
          title: "Error creando Agente en Retell",
          description: agentRes.error,
        });
        setSaving(false);
        return;
      }

      agentDataToSave = {
        ...agentDataToSave,
        retell_llm_id: llmRes.data.llm_id,
        provider_agent_id: agentRes.data.agent_id,
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
            voice_temperature: (agentDataToSave as any).voice_temperature,
            voice_speed: (agentDataToSave as any).voice_speed,
            volume: (agentDataToSave as any).volume,
            responsiveness: (agentDataToSave as any).responsiveness,
            interruption_sensitivity: (agentDataToSave as any).interruption_sensitivity,
            enable_backchannel: (agentDataToSave as any).enable_backchannel,
            backchannel_frequency: (agentDataToSave as any).backchannel_frequency,
            backchannel_words: (agentDataToSave as any).backchannel_words,
            ambient_sound: (agentDataToSave as any).ambient_sound,
            webhook_url: (agentDataToSave as any).webhook_url,
            max_call_duration: (agentDataToSave as any).max_call_duration,
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
      toast({
        title: "Agent Saved",
        description: "Configuration synchronized successfully.",
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

  // ── Render for the Prompt Editor area based on Retell engine type ──
  const renderPromptEditor = () => {
    const engineType = getRetellEngineType(selectedAgent);
    const variant = activeTab === "A" ? variantA : variantB;

    // ── CUSTOM-LLM: External WebSocket backend ──
    if (engineType === "custom-llm") {
      const wsUrl = (selectedAgent as any)?.llm_websocket_url || "";
      return (
        <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
            <Code2 className="h-8 w-8 text-orange-400" />
          </div>
          <div className="max-w-md space-y-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
              <span className="text-[10px] font-black tracking-widest text-orange-400 uppercase">
                Custom LLM
              </span>
            </div>
            <h4 className="text-foreground text-lg font-black tracking-tight">
              Este agente usa un LLM Personalizado
            </h4>
            <p className="text-muted-foreground text-sm leading-relaxed">
              El prompt de este agente se gestiona directamente en tu backend externo mediante
              WebSocket. No se puede editar desde aquí, ya que Retell solo actúa como intermediario
              de voz.
            </p>
            {wsUrl && (
              <div className="border-border bg-muted/50 rounded-xl border p-3 text-left">
                <p className="text-muted-foreground mb-1 text-[9px] font-black tracking-widest uppercase">
                  Endpoint WebSocket
                </p>
                <p className="text-foreground font-mono text-[11px] break-all">{wsUrl}</p>
              </div>
            )}
          </div>
          <a
            href="https://docs.retellai.com/api-references/agent/get-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-all"
          >
            <ExternalLink className="h-3 w-3" />
            Ver documentación Custom LLM
          </a>
        </div>
      );
    }

    // ── CONVERSATION-FLOW: Node-based visual builder ──
    if (engineType === "conversation-flow") {
      const flowId = (selectedAgent as any)?.conversation_flow_id || "";
      const nodes = (selectedAgent?.retell_llm_config as any)?.nodes || [];
      return (
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-2">
          {/* Header */}
          <div className="flex items-center gap-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <GitBranch className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase">
                  Conversation Flow
                </span>
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[8px] font-black tracking-widest text-blue-300 uppercase">
                  {nodes.length} nodos
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Este agente usa un flujo conversacional visual de Retell. Cada nodo tiene su propio
                prompt contextual.
              </p>
            </div>
          </div>

          {/* Flow ID chip */}
          {flowId && (
            <div className="border-border bg-muted/50 flex items-center gap-2 rounded-xl border px-3 py-2">
              <Globe className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[8px] font-black tracking-widest uppercase">
                  Conversation Flow ID
                </p>
                <p className="text-foreground truncate font-mono text-[11px]">{flowId}</p>
              </div>
              <a
                href={`https://app.retellai.com/conversation-flow/${flowId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
                title="Abrir en Retell"
              >
                <ExternalLink className="text-muted-foreground h-3.5 w-3.5 transition-colors hover:text-blue-400" />
              </a>
            </div>
          )}

          {/* Nodes list */}
          {nodes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground px-1 text-[9px] font-black tracking-widest uppercase">
                Nodos del flujo
              </p>
              {nodes.map((node: any, idx: number) => (
                <div
                  key={node.id || idx}
                  className="group border-border bg-card rounded-xl border p-4 transition-all hover:border-blue-500/30 hover:bg-blue-500/5"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-400">
                        {idx + 1}
                      </div>
                      <span className="text-foreground text-[11px] font-black">
                        {node.name || node.id || `Nodo ${idx + 1}`}
                      </span>
                      {node.type && (
                        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[8px] font-black tracking-widest uppercase">
                          {node.type}
                        </span>
                      )}
                    </div>
                    {node.edges?.length > 0 && (
                      <span className="text-muted-foreground/60 text-[8px] font-bold">
                        → {node.edges.length} transición{node.edges.length > 1 ? "es" : ""}
                      </span>
                    )}
                  </div>
                  {(node.state_prompt || node.prompt || node.content) && (
                    <p className="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed">
                      {node.state_prompt || node.prompt || node.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center">
              <GitBranch className="text-muted-foreground/30 h-8 w-8" />
              <p className="text-muted-foreground/50 text-[10px] font-black tracking-widest uppercase">
                Sincroniza para ver los nodos del flujo
              </p>
              <button
                onClick={() => handleImportRetellAgents(selectedAgent!)}
                disabled={isImporting}
                className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-[9px] font-black tracking-widest text-blue-400 uppercase transition-all hover:bg-blue-500/20 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3 w-3", isImporting && "animate-spin")} />
                {isImporting ? "Sincronizando..." : "Sincronizar Flujo"}
              </button>
            </div>
          )}

          {/* Link to Retell */}
          <a
            href="https://app.retellai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[10px] font-black tracking-widest uppercase transition-all"
          >
            <ExternalLink className="h-3 w-3" />
            Editar flujo en Retell Studio
          </a>
        </div>
      );
    }

    // ── RETELL-LLM with STATES (multi-prompt) ──
    if (engineType === "retell-llm" && selectedAgent?.retell_llm_config?.states?.length) {
      const states = selectedAgent.retell_llm_config.states;
      return (
        <div className="flex h-full flex-col gap-4">
          {/* State selector tabs */}
          <div className="flex items-center gap-2">
            <div className="border-border bg-muted/30 flex flex-wrap gap-1 rounded-xl border p-1">
              <button
                onClick={() => setActiveStateId(null)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all",
                  activeStateId === null
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                General
              </button>
              {states.map((state) => (
                <button
                  key={state.name}
                  onClick={() => setActiveStateId(state.name)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all",
                    activeStateId === state.name
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {state.name}
                </button>
              ))}
            </div>
            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[8px] font-black tracking-widest text-purple-400 uppercase">
              Multi-Prompt
            </span>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeStateId === null ? (
              <textarea
                value={variant.prompt_text || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeTab === "A") setVariantA((prev) => ({ ...prev, prompt_text: val }));
                  else setVariantB((prev) => ({ ...prev, prompt_text: val }));
                }}
                className="border-border bg-card text-foreground h-full w-full resize-none rounded-3xl border p-8 text-sm leading-relaxed font-medium shadow-inner transition-all focus:ring-4 focus:ring-purple-500/10 focus:outline-none"
                placeholder="Prompt general (se aplica a todos los estados)..."
                title="Editor de prompt general"
              />
            ) : (
              <div className="border-border bg-card h-full w-full overflow-y-auto rounded-3xl border p-8">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span className="text-[10px] font-black tracking-widest text-purple-600 uppercase dark:text-purple-400">
                    Estado: {activeStateId}
                  </span>
                  <span className="text-muted-foreground text-[9px]">
                    (Solo lectura — edita en Retell Studio)
                  </span>
                </div>
                <p className="text-foreground text-sm leading-relaxed font-medium whitespace-pre-wrap">
                  {states.find((s) => s.name === activeStateId)?.state_prompt ||
                    "Sin prompt configurado para este estado."}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── RETELL-LLM simple (single prompt) or default ──
    // This is the editable case
    const isRetellAgentWithoutConfig =
      selectedAgent?.provider === "RETELL" && !selectedAgent.retell_llm_config;

    return (
      <div className="flex h-full flex-col gap-4">
        {isRetellAgentWithoutConfig && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
            <RefreshCw className="h-4 w-4 flex-shrink-0 text-amber-400" />
            <p className="flex-1 text-[11px] text-amber-400/80">
              El prompt se cargará al sincronizar con Retell.
            </p>
            <button
              onClick={() => handleImportRetellAgents(selectedAgent!)}
              disabled={isImporting}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[9px] font-black tracking-widest text-amber-400 uppercase transition-all hover:bg-amber-500/20 disabled:opacity-50"
            >
              {isImporting ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sincronizar
            </button>
          </div>
        )}
        <div className="flex-1">
          <textarea
            value={variant.prompt_text || ""}
            onChange={(e) => {
              const val = e.target.value;
              if (activeTab === "A") setVariantA((prev) => ({ ...prev, prompt_text: val }));
              else setVariantB((prev) => ({ ...prev, prompt_text: val }));
            }}
            className="border-border bg-card text-foreground h-full w-full resize-none rounded-3xl border p-8 text-sm leading-relaxed font-medium shadow-inner transition-all focus:ring-4 focus:ring-purple-500/10 focus:outline-none"
            placeholder={`Eres un agente de ventas telefónico experto de ${tenantName}...`}
            title="Editor de prompt"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background text-foreground flex h-[calc(100vh-80px)] w-full overflow-hidden">
      {/* Left Sidebar: Agents */}
      <div className="border-border bg-card flex w-64 flex-shrink-0 flex-col border-r">
        <div className="border-border flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-sm font-bold tracking-tight">Agents</h2>
          <button
            onClick={() => {
              setSelectedAgent(null);
              setEditingAgentData({
                name: "",
                description: "",
                provider: "RETELL",
                provider_agent_id: "",
                voice_id: "",
                from_number: "",
                prompt_text_retell: "",
                retell_llm_id: "",
              });
              setIsCreateModalOpen(true);
            }}
            className="flex items-center justify-center rounded bg-purple-500/10 p-1.5 text-purple-600 transition-colors hover:bg-purple-500/20"
            title="Create new agent"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {(() => {
            // Combine local agents and unimported Retell agents
            const localIds = new Set(agents.map((a) => a.provider_agent_id).filter(Boolean));

            // Deduplicate availableAgents by id to prevent React key errors
            const uniqueAvailableAgents = Array.from(
              new Map(availableAgents.map((a) => [a.id, a])).values()
            );
            const unimportedRetell = uniqueAvailableAgents.filter((a) => !localIds.has(a.id));

            const hasAnyAgents = agents.length > 0 || unimportedRetell.length > 0;

            if (!hasAnyAgents) {
              return (
                <div className="flex flex-col items-center gap-3 px-3 py-6 text-center text-xs">
                  <p className="text-muted-foreground">No agents found.</p>
                  {!retellApiKey && (
                    <button
                      onClick={() => setIsConfigModalOpen(true)}
                      className="rounded-md bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-500 transition-colors hover:text-purple-400"
                    >
                      Configurar API Key
                    </button>
                  )}
                  {retellApiKey && (
                    <p className="text-[10px] opacity-50">
                      API conectada, pero no hay agentes en Retell.
                    </p>
                  )}
                </div>
              );
            }

            return (
              <>
                {/* Local Agents */}
                {agents.map((a) => (
                  <button
                    key={`local-${a.id}`}
                    onClick={() => setSelectedAgent(a)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedAgent?.id === a.id
                        ? "bg-purple-500/10 font-medium text-purple-600 dark:text-purple-400"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {a.name}
                  </button>
                ))}

                {/* Unimported Retell Agents */}
                {unimportedRetell.map((a) => (
                  <button
                    key={`retell-${a.id}`}
                    onClick={() =>
                      handleImportRetellAgents({ provider_agent_id: a.id } as VoiceAgent)
                    }
                    className="text-muted-foreground/60 hover:bg-muted hover:text-foreground flex w-full items-center justify-between rounded-lg border border-dashed border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-purple-500/30"
                    title="Agente en Retell (Click para importar)"
                  >
                    <span className="truncate">{a.name}</span>
                    <RefreshCw className="h-3 w-3 flex-shrink-0 opacity-50" />
                  </button>
                ))}
              </>
            );
          })()}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Retell Style Header */}
        <div className="border-border bg-card/50 flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
              <Mic className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">Voice Agent Configuration</h1>
                {selectedAgent && (
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-500 uppercase">
                    {selectedAgent.name}
                  </span>
                )}
              </div>
              <div className="text-muted-foreground flex items-center gap-3 text-[10px] font-bold uppercase">
                {selectedAgent?.provider === "RETELL" ? "Retell AI" : selectedAgent?.provider || ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {availableAgents.length > 0 && (
              <button
                onClick={() => handleImportRetellAgents()}
                disabled={isImporting}
                className="flex h-9 items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 text-xs font-bold text-purple-600 transition-all hover:bg-purple-500/20 disabled:opacity-50"
                title="Importar agentes existentes desde Retell"
              >
                <RefreshCw className={cn("h-3 w-3", isImporting && "animate-spin")} />
                {isImporting ? "Importando..." : "Importar de Retell"}
              </button>
            )}
            <button
              onClick={() => {
                handleSaveVariants();
                handleCreateOrUpdateAgent();
              }}
              disabled={saving || !selectedAgent}
              className="bg-foreground text-background flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>

        {/* 3 Columns Layout */}
        {!selectedAgent ? (
          <div className="bg-background flex flex-1 flex-col items-center justify-center">
            <EmptyState
              size="sm"
              icon={<Mic className="h-10 w-10" />}
              title="Sin agente seleccionado"
              description="Selecciona un agente en el menú lateral o crea uno nuevo."
            />
          </div>
        ) : (
          <div className="bg-background flex flex-1 overflow-hidden">
            {/* Column 1: Identity & Prompt (Expands) */}
            <div className="border-border min-w-[400px] flex-1 border-r">
              <RetellIdentityPanel
                selectedAgent={selectedAgent}
                variant={activeTab === "A" ? variantA : variantB}
                setVariant={activeTab === "A" ? setVariantA : setVariantB}
                engineType={getRetellEngineType(selectedAgent)}
                tenantName={tenantName}
                availableVoices={availableVoices}
                onVoiceChange={(voiceId) => {
                  const newAgent = { ...selectedAgent, voice_id: voiceId };
                  setSelectedAgent(newAgent);
                  saveVoiceAgent(newAgent, tenantId);
                  if (retellApiKey && newAgent.provider_agent_id) {
                    updateRetellAgent(retellApiKey, newAgent.provider_agent_id, {
                      voice_id: voiceId,
                    });
                  }
                }}
              />
            </div>

            {/* Column 2: Settings (Fixed Width) */}
            <div className="border-border w-[350px] flex-shrink-0 border-r">
              <RetellSettingsPanel
                agentData={editingAgentData}
                setAgentData={setEditingAgentData}
              />
            </div>

            {/* Column 3: Simulation (Fixed Width) */}
            <div className="w-[380px] flex-shrink-0">
              <RetellSimulationPanel
                agentId={selectedAgent.provider_agent_id || undefined}
                tenantId={tenantId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="border-border bg-card w-full max-w-md rounded-2xl border p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-bold">Crear Nuevo Agente</h3>
              <input
                type="text"
                placeholder="Nombre del Agente"
                value={editingAgentData.name || ""}
                onChange={(e) => setEditingAgentData({ ...editingAgentData, name: e.target.value })}
                className="border-border bg-background mb-4 w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <select
                title="Seleccionar Voz"
                value={editingAgentData.voice_id || ""}
                onChange={(e) =>
                  setEditingAgentData({ ...editingAgentData, voice_id: e.target.value })
                }
                className="border-border bg-background mb-4 w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">Seleccionar Voz...</option>
                {availableVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-muted flex-1 rounded-xl py-3 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateOrUpdateAgent}
                  className="flex-1 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white"
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
      <VoiceConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        currentRetellKey={retellApiKey}
        currentUltravoxKey={ultravoxApiKey}
        tenantId={tenantId}
        onSuccess={() => {
          refreshConfiguration();
          toast({
            title: "Configuración Actualizada",
            description: "API Key guardada correctamente. Recargando agentes...",
            variant: "success",
          });
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
  color = "purple",
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
      className={cn(
        "relative flex h-14 items-center gap-2 px-5 text-[10px] font-black tracking-widest uppercase transition-all",
        active ? `text-${color}-400` : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {active && (
        <motion.div
          layoutId="tab-indicator"
          className={`absolute bottom-0 left-0 h-0.5 w-full bg-${color}-500`}
        />
      )}
    </button>
  );
}
