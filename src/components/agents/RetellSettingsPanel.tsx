/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";
import {
  Settings2,
  ShieldCheck,
  Link2,
  BellRing,
  Webhook,
  Box,
  SlidersHorizontal,
  Mic,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RetellSettingsPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentData: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAgentData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export function RetellSettingsPanel({ agentData, setAgentData }: RetellSettingsPanelProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateField = (field: string, value: any) => {
    setAgentData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-background text-foreground flex h-full flex-col overflow-y-auto">
      {/* Voice Settings */}
      <div className="border-border border-b p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-xs font-semibold">
          <Mic className="text-muted-foreground h-4 w-4" /> Voice Settings
        </h3>

        <div className="space-y-6">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">Voice Temperature</label>
              <span className="text-muted-foreground text-xs font-medium">
                {agentData.voice_temperature ?? 1}
              </span>
            </div>
            <input
              type="range"
              title="Voice Temperature"
              aria-label="Voice Temperature"
              min="0"
              max="2"
              step="0.1"
              value={agentData.voice_temperature ?? 1}
              onChange={(e) => updateField("voice_temperature", parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">Voice Speed</label>
              <span className="text-muted-foreground text-xs font-medium">
                {agentData.voice_speed ?? 1}x
              </span>
            </div>
            <input
              type="range"
              title="Voice Speed"
              aria-label="Voice Speed"
              min="0.5"
              max="2"
              step="0.1"
              value={agentData.voice_speed ?? 1}
              onChange={(e) => updateField("voice_speed", parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">Volume</label>
              <span className="text-muted-foreground text-xs font-medium">
                {agentData.volume ?? 1}
              </span>
            </div>
            <input
              type="range"
              title="Volume"
              aria-label="Volume"
              min="0.1"
              max="2"
              step="0.1"
              value={agentData.volume ?? 1}
              onChange={(e) => updateField("volume", parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Conversational Behavior */}
      <div className="border-border border-b p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-xs font-semibold">
          <SlidersHorizontal className="text-muted-foreground h-4 w-4" /> Conversational Behavior
        </h3>

        <div className="space-y-6">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">Responsiveness</label>
              <span className="text-muted-foreground text-xs font-medium">
                {agentData.responsiveness ?? 1}
              </span>
            </div>
            <p className="text-muted-foreground mb-2 text-[10px]">
              Lower means more delay before the AI replies.
            </p>
            <input
              type="range"
              title="Responsiveness"
              aria-label="Responsiveness"
              min="0"
              max="1"
              step="0.1"
              value={agentData.responsiveness ?? 1}
              onChange={(e) => updateField("responsiveness", parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">
                Interruption Sensitivity
              </label>
              <span className="text-muted-foreground text-xs font-medium">
                {agentData.interruption_sensitivity ?? 1}
              </span>
            </div>
            <p className="text-muted-foreground mb-2 text-[10px]">
              Higher means AI stops talking more easily when user speaks.
            </p>
            <input
              type="range"
              title="Interruption Sensitivity"
              aria-label="Interruption Sensitivity"
              min="0"
              max="1"
              step="0.1"
              value={agentData.interruption_sensitivity ?? 1}
              onChange={(e) => updateField("interruption_sensitivity", parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">Enable Backchannel</label>
              <button
                onClick={() =>
                  updateField("enable_backchannel", !(agentData.enable_backchannel ?? false))
                }
                title="Toggle Enable Backchannel"
                aria-label="Toggle Enable Backchannel"
                className={cn(
                  "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                  (agentData.enable_backchannel ?? false) ? "bg-purple-500" : "bg-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded-full bg-white transition-transform",
                    (agentData.enable_backchannel ?? false) ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
            <p className="text-muted-foreground text-[10px]">
              AI will say words like &quot;yeah&quot;, &quot;uh-huh&quot; while user speaks.
            </p>
          </div>

          {(agentData.enable_backchannel ?? false) && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-foreground text-sm font-medium">Backchannel Frequency</label>
                <span className="text-muted-foreground text-xs font-medium">
                  {agentData.backchannel_frequency ?? 0.8}
                </span>
              </div>
              <input
                type="range"
                title="Backchannel Frequency"
                aria-label="Backchannel Frequency"
                min="0"
                max="1"
                step="0.1"
                value={agentData.backchannel_frequency ?? 0.8}
                onChange={(e) => updateField("backchannel_frequency", parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Call Settings */}
      <div className="border-border border-b p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-xs font-semibold">
          <Waves className="text-muted-foreground h-4 w-4" /> Call Settings
        </h3>

        <div className="space-y-6">
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Ambient Sound</label>
            <select
              value={agentData.ambient_sound || ""}
              title="Ambient Sound"
              aria-label="Ambient Sound"
              onChange={(e) => updateField("ambient_sound", e.target.value)}
              className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">None</option>
              <option value="coffee-shop">Coffee Shop</option>
              <option value="convention">Convention</option>
              <option value="office">Office</option>
            </select>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Max Call Duration (s)
            </label>
            <input
              type="number"
              value={agentData.max_call_duration || ""}
              onChange={(e) => updateField("max_call_duration", parseInt(e.target.value))}
              className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. 3600 (1 hour)"
            />
          </div>
        </div>
      </div>

      {/* Webhook Settings */}
      <div className="border-border border-b p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-xs font-semibold">
          <Webhook className="text-muted-foreground h-4 w-4" /> Webhook Settings
        </h3>
        <div className="space-y-6">
          <div>
            <label htmlFor="webhook" className="text-foreground mb-1 block text-sm font-medium">
              Agent Level Webhook URL
            </label>
            <p className="text-muted-foreground mb-2 text-xs">
              Webhook URL to receive events from Retell.
            </p>
            <input
              id="webhook"
              type="text"
              value={agentData.webhook_url || ""}
              onChange={(e) => updateField("webhook_url", e.target.value)}
              placeholder="https://..."
              className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
