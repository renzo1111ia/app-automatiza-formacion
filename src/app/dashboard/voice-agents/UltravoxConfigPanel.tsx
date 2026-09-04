import React, { useState } from "react";
import { VoiceAgent, VoiceAgentVariant } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, Zap, Save, RefreshCw } from "lucide-react";
import { updateUltravoxAgent } from "@/lib/actions/ultravox-sync";
import { toast } from "@/components/ui/toast";
import { getActiveTenantConfig } from "@/lib/actions/tenant";

interface UltravoxConfigPanelProps {
  agent: VoiceAgent;
  variant: Partial<VoiceAgentVariant>;
  onVariantChange: (variant: Partial<VoiceAgentVariant>) => void;
  voices: { id: string; name: string }[];
  models: { id: string; name: string }[];
  onSave: () => void;
  isSaving: boolean;
}

export function UltravoxConfigPanel({
  agent,
  variant,
  onVariantChange,
  voices,
  models,
  onSave,
  isSaving,
}: UltravoxConfigPanelProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSyncToUltravox = async () => {
    if (!agent.provider_agent_id) return;
    setSyncing(true);
    try {
      const configRes = await getActiveTenantConfig(agent.tenant_id!);
      const uApiKey = (configRes as any)?.ultravox?.api_key;
      
      if (!uApiKey) {
        toast({ variant: "error", title: "Error", description: "API Key de Ultravox no configurada." });
        return;
      }

      const res = await updateUltravoxAgent(uApiKey, agent.provider_agent_id, {
        systemPrompt: variant.prompt_text || "",
        model: agent.retell_llm_id || "fixie-ai/ultravox-70B",
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black tracking-widest text-slate-900 uppercase">
          Configuración Ultravox
        </h3>
        <Button
          onClick={handleSyncToUltravox}
          disabled={syncing || isSaving}
          variant="outline"
          size="sm"
          className="gap-2 text-[10px] font-black tracking-widest uppercase"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          Sincronizar a Ultravox
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
            System Prompt
          </Label>
          <Textarea
            value={variant.prompt_text || ""}
            onChange={(e) => onVariantChange({ ...variant, prompt_text: e.target.value })}
            placeholder="Instrucciones para el agente..."
            className="min-h-[300px] font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Voz
            </Label>
            <select
              title="Voz"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={agent.voice_id || ""}
              onChange={(e) => {
                // Update voice in the parent agent state (mock update for now, usually done via saveVoiceAgent)
                toast({ title: "Atención", description: "Guarda el agente para aplicar la voz" });
              }}
            >
              <option value="">Selecciona una voz</option>
              {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Modelo
            </Label>
            <select
              title="Modelo"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={agent.retell_llm_id || ""}
              onChange={(e) => {
                 toast({ title: "Atención", description: "Guarda el agente para aplicar el modelo" });
              }}
            >
              <option value="">Selecciona un modelo</option>
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <Button onClick={onSave} disabled={isSaving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "Guardando..." : "Guardar Variación"}
        </Button>
      </div>
    </div>
  );
}
