import React, { useState } from "react";
import { VoiceAgent, VoiceAgentVariant } from "@/types/database";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, RefreshCw, Download, Upload } from "lucide-react";
import { updateUltravoxAgent, listUltravoxAgents, getUltravoxAgent } from "@/lib/actions/ultravox-sync";
import { saveVoiceAgent, saveVoiceVariant } from "@/lib/actions/voice-agents";
import { toast } from "@/components/ui/toast";
import { getActiveTenantConfig } from "@/lib/actions/tenant";

interface UltravoxConfigPanelProps {
  agent: VoiceAgent;
  variant: Partial<VoiceAgentVariant>;
  onVariantChange: (variant: Partial<VoiceAgentVariant>) => void;
  onAgentChange?: (agent: VoiceAgent) => void;
  voices: { id: string; name: string }[];
  models: { id: string; name: string }[];
  onSave: () => void;
  isSaving: boolean;
}

export function UltravoxConfigPanel({
  agent,
  variant,
  onVariantChange,
  onAgentChange,
  voices,
  models,
  onSave,
  isSaving,
}: UltravoxConfigPanelProps) {
  const [syncing, setSyncing] = useState(false);

  const handlePullFromUltravox = async () => {
    setSyncing(true);
    try {
      const configRes = await getActiveTenantConfig();
      const uApiKey = (configRes as any)?.config?.ultravox?.api_key;
      
      if (!uApiKey) {
        toast({ variant: "error", title: "Error", description: "API Key de Ultravox no configurada." });
        return;
      }

      // 1. Fetch live agents list from Ultravox
      const agentsRes = await listUltravoxAgents(uApiKey);
      const ultravoxAgents = (agentsRes.data || []) as any[];
      
      // Match by provider_agent_id or by name
      let targetAgent = ultravoxAgents.find(
        (a: any) =>
          (a.agentId && a.agentId === agent.provider_agent_id) ||
          (a.id && a.id === agent.provider_agent_id)
      );

      if (!targetAgent && agent.name) {
        targetAgent = ultravoxAgents.find(
          (a: any) => a.name && a.name.toLowerCase().trim() === agent.name.toLowerCase().trim()
        );
      }

      if (!targetAgent && ultravoxAgents.length === 1) {
        targetAgent = ultravoxAgents[0];
      }

      if (!targetAgent) {
        toast({
          variant: "warning",
          title: "No encontrado en Ultravox",
          description: `No se encontró un agente con ID o nombre "${agent.name}" en tu cuenta de Ultravox.`,
        });
        return;
      }

      const targetId = targetAgent.agentId || targetAgent.id;
      const detailRes = await getUltravoxAgent(uApiKey, targetId);
      const detail = detailRes.success && detailRes.data ? detailRes.data : targetAgent;

      const newPrompt =
        detail.callTemplate?.systemPrompt ||
        targetAgent.callTemplate?.systemPrompt ||
        detail.systemPrompt ||
        detail.system_prompt ||
        detail.prompt ||
        detail.promptText ||
        detail.instructions ||
        detail.template?.systemPrompt ||
        detail.template?.prompt ||
        targetAgent.systemPrompt ||
        targetAgent.prompt ||
        "";

      const newVoice =
        detail.callTemplate?.voice ||
        targetAgent.callTemplate?.voice ||
        detail.voice ||
        targetAgent.voice ||
        "";

      const newModel =
        detail.callTemplate?.model ||
        targetAgent.callTemplate?.model ||
        detail.model ||
        targetAgent.model ||
        "";

      // 2. Update React State
      onVariantChange({ ...variant, prompt_text: newPrompt });

      const updatedAgent = {
        ...agent,
        provider_agent_id: targetId,
        voice_id: newVoice || agent.voice_id,
        retell_llm_id: newModel || agent.retell_llm_id,
      };

      if (onAgentChange) {
        onAgentChange(updatedAgent);
      }

      // 3. Persist automatically to local DB if agent exists
      if (agent.id) {
        if (newPrompt) {
          await saveVoiceVariant({
            ...variant,
            agent_id: agent.id,
            prompt_text: newPrompt,
          });
        }
        if (agent.tenant_id) {
          await saveVoiceAgent(updatedAgent, agent.tenant_id);
        }
      }

      toast({
        variant: "success",
        title: "Prompt y Voz Sincronizados",
        description: `Se importó el System Prompt (${newPrompt.length} caracteres) y la voz de "${detail.name || agent.name}".`,
      });
    } catch (e) {
      console.error("[Pull from Ultravox Error]:", e);
      toast({ variant: "error", title: "Error al importar", description: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncToUltravox = async () => {
    if (!agent.provider_agent_id) {
      toast({
        variant: "warning",
        title: "Agente local",
        description: "Guarda el agente primero para sincronizarlo con Ultravox.",
      });
      return;
    }
    setSyncing(true);
    try {
      const configRes = await getActiveTenantConfig();
      const uApiKey = (configRes as any)?.config?.ultravox?.api_key;
      
      if (!uApiKey) {
        toast({ variant: "error", title: "Error", description: "API Key de Ultravox no configurada." });
        return;
      }

      const res = await updateUltravoxAgent(uApiKey, agent.provider_agent_id, {
        systemPrompt: variant.prompt_text || "",
        model: agent.retell_llm_id || "fixie-ai/ultravox-70b",
        voice: agent.voice_id || "",
      });

      if (res.success) {
        toast({ variant: "success", title: "Sincronizado", description: "Configuración enviada a Ultravox." });
      } else {
        toast({ variant: "error", title: "Error", description: res.error });
      }
    } catch (e) {
      toast({ variant: "error", title: "Error", description: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-sm font-black tracking-widest text-foreground uppercase">
            Configuración Ultravox
          </h3>
          <p className="text-xs text-muted-foreground">
            Ajusta el prompt, voz y modelo de inteligencia artificial para tu agente de voz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePullFromUltravox}
            disabled={syncing || isSaving}
            variant="outline"
            size="sm"
            className="gap-1.5 text-[10px] font-black tracking-widest uppercase border-purple-500/30 hover:border-purple-500 hover:text-purple-400"
            title="Traer el prompt y voz configurados en Ultravox"
          >
            <Download className={`h-3 w-3 ${syncing ? "animate-bounce" : ""}`} />
            Traer de Ultravox
          </Button>

          <Button
            onClick={handleSyncToUltravox}
            disabled={syncing || isSaving}
            variant="outline"
            size="sm"
            className="gap-1.5 text-[10px] font-black tracking-widest uppercase"
            title="Enviar cambios a la API de Ultravox"
          >
            <Upload className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            Enviar a Ultravox
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
            System Prompt (Instrucciones)
          </Label>
          <Textarea
            value={variant.prompt_text || ""}
            onChange={(e) => onVariantChange({ ...variant, prompt_text: e.target.value })}
            placeholder="Instrucciones para el agente de voz: personalidad, objetivos, cómo responder a los clientes..."
            className="min-h-[300px] font-mono text-sm leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
              Voz de Ultravox
            </Label>
            <select
              title="Voz"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background text-foreground"
              value={agent.voice_id || ""}
              onChange={(e) => {
                const newVoice = e.target.value;
                if (onAgentChange) {
                  onAgentChange({ ...agent, voice_id: newVoice });
                }
              }}
            >
              <option value="">Selecciona una voz...</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
              Modelo de IA
            </Label>
            <select
              title="Modelo"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background text-foreground"
              value={agent.retell_llm_id || ""}
              onChange={(e) => {
                const newModel = e.target.value;
                if (onAgentChange) {
                  onAgentChange({ ...agent, retell_llm_id: newModel });
                }
              }}
            >
              <option value="">Selecciona un modelo...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={onSave} disabled={isSaving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>
    </div>
  );
}
