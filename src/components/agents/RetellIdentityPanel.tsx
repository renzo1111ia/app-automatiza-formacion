/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Mic, Zap, Cpu, Code2, GitBranch, ExternalLink, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { LLMSelector } from "./LLMSelector";
import { VoiceSelectorModal } from "./VoiceSelectorModal";
import { VoiceAgent, VoiceAgentVariant } from "@/types/database";

interface RetellIdentityPanelProps {
  selectedAgent: VoiceAgent | null;
  variant: Partial<VoiceAgentVariant>;
  setVariant: React.Dispatch<React.SetStateAction<Partial<VoiceAgentVariant>>>;
  engineType: "retell-llm" | "custom-llm" | "conversation-flow" | null;
  tenantName: string;
  availableVoices: any[];
  onVoiceChange?: (voiceId: string) => void;
}

export function RetellIdentityPanel({
  selectedAgent,
  variant,
  setVariant,
  engineType,
  tenantName,
  availableVoices,
  onVoiceChange,
}: RetellIdentityPanelProps) {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = React.useState(false);
  const isRetellAgentWithoutConfig =
    selectedAgent?.provider === "RETELL" && !selectedAgent.retell_llm_config;

  // Find currently selected voice details
  const currentVoice = availableVoices.find((v) => v.id === selectedAgent?.voice_id);

  return (
    <div className="bg-background text-foreground flex h-full flex-col">
      {/* Top Header */}
      <div className="border-border bg-background relative z-40 flex items-center gap-4 border-b px-6 py-4">
        <LLMSelector
          selectedModelId={(selectedAgent as any)?.model || "gpt-4o-mini"}
          onModelSelect={(model) => console.log("Selected model", model.id)}
        />
        <button
          onClick={() => setIsVoiceModalOpen(true)}
          className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
        >
          <Mic className="h-4 w-4 text-purple-500" />
          <span>{currentVoice ? currentVoice.name : "Select Voice"}</span>
        </button>
        <div className="border-border bg-card text-foreground flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium">
          <span className="text-sm leading-none">🌐</span>
          <span>{(selectedAgent as any)?.language || "Idioma"}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="text-muted-foreground h-4 w-4" /> General Prompt
          </h3>
          <span className="text-muted-foreground text-xs font-medium">
            Define the persona and instructions for your agent
          </span>
        </div>

        {/* Editor Area */}
        {engineType === "custom-llm" ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 text-center">
            <Code2 className="h-8 w-8 text-orange-500" />
            <p className="text-muted-foreground text-sm">
              El prompt de este agente se gestiona directamente en tu backend (Custom LLM).
            </p>
          </div>
        ) : engineType === "conversation-flow" ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-6 text-center">
            <GitBranch className="h-8 w-8 text-blue-500" />
            <p className="text-muted-foreground text-sm">
              Este agente usa un flujo visual de Retell. Edítalo en Retell Studio.
            </p>
            <a
              href="https://app.retellai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir Retell Studio
            </a>
          </div>
        ) : (
          <div className="border-border bg-card relative flex h-[500px] w-full rounded-xl border p-1 transition-all focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50">
            <textarea
              value={variant.prompt_text || ""}
              onChange={(e) => setVariant((prev) => ({ ...prev, prompt_text: e.target.value }))}
              className="text-foreground placeholder:text-muted-foreground h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
              placeholder={`You are an AI assistant for ${tenantName}...`}
            />
          </div>
        )}
      </div>

      <VoiceSelectorModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        availableVoices={availableVoices}
        selectedVoiceId={selectedAgent?.voice_id || undefined}
        onSelectVoice={(id) => onVoiceChange && onVoiceChange(id)}
      />
    </div>
  );
}
