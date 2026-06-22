import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Cpu, Sparkles, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Model Definition
export type LLMModel = {
  id: string;
  name: string;
  price: string;
  provider: "openai" | "anthropic" | "google";
};

// Model Groups based on the Retell UI screenshot
const FAST_AND_COST_EFFICIENT: LLMModel[] = [
  { id: "gpt-4o-mini", name: "GPT 4.o mini", price: "$0.036/min", provider: "openai" },
  { id: "gpt-4o-nano", name: "GPT 4.o nano", price: "$0.010/min", provider: "openai" },
  { id: "gpt-5-mini", name: "GPT 5 mini", price: "$0.012/min", provider: "openai" },
  { id: "gpt-5-nano", name: "GPT 5 nano", price: "$0.003/min", provider: "openai" },
  { id: "gpt-4.1-mini", name: "GPT 4.1 mini", price: "$0.016/min", provider: "openai" },
  { id: "gpt-4.1-nano", name: "GPT 4.1 nano", price: "$0.004/min", provider: "openai" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", price: "$0.025/min", provider: "anthropic" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", price: "$0.014/min", provider: "google" },
  {
    id: "gemini-1.5-flash-8b",
    name: "Gemini 1.5 Flash 8B",
    price: "$0.006/min",
    provider: "google",
  },
];

const SPEECH_TO_SPEECH: LLMModel[] = [
  { id: "gpt-4o-realtime-2", name: "GPT Realtime 2", price: "$0.38/min", provider: "openai" },
  { id: "gpt-4o-realtime-1.5", name: "GPT Realtime 1.5", price: "$0.345/min", provider: "openai" },
  { id: "gpt-4o-realtime", name: "GPT Realtime", price: "$0.345/min", provider: "openai" },
  { id: "gpt-4o-realtime-mini", name: "GPT Realtime mini", price: "$0.07/min", provider: "openai" },
];

// Helper to render provider icon
const ProviderIcon = ({ provider, className }: { provider: string; className?: string }) => {
  if (provider === "anthropic") return <Sparkles className={cn("text-orange-400", className)} />;
  if (provider === "google") return <Zap className={cn("text-blue-400", className)} />;
  return <Cpu className={cn("text-gray-400", className)} />; // OpenAI / Default
};

interface LLMSelectorProps {
  selectedModelId?: string;
  onModelSelect?: (model: LLMModel) => void;
}

export function LLMSelector({ selectedModelId, onModelSelect }: LLMSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Find the selected model object to display in the button
  const allModels = [...FAST_AND_COST_EFFICIENT, ...SPEECH_TO_SPEECH];
  const selectedModel =
    allModels.find((m) => m.id === selectedModelId) || FAST_AND_COST_EFFICIENT[0];

  const handleSelect = (model: LLMModel) => {
    onModelSelect?.(model);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-200 dark:bg-black/40 dark:hover:bg-white/10"
      >
        <ProviderIcon provider={selectedModel.provider} className="h-4 w-4" />
        <span className="text-slate-900 dark:text-white">{selectedModel.name}</span>
        <ChevronDown className="ml-1 h-3 w-3 text-slate-500 dark:text-gray-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="scrollbar-thin absolute top-full left-0 z-50 mt-2 max-h-[400px] w-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#1A1A1A]">
          {/* Section: Fast and cost-efficient */}
          <div className="mb-2">
            <h4 className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-gray-400">
              Fast and cost-efficient
              <ChevronDown className="h-3 w-3" />
            </h4>
            <div className="flex flex-col gap-0.5">
              {FAST_AND_COST_EFFICIENT.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className="group flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <ProviderIcon
                      provider={model.provider}
                      className="h-4 w-4 opacity-70 group-hover:opacity-100"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
                      {model.name}
                    </span>
                    <span className="ml-1 font-mono text-xs text-slate-400 dark:text-gray-500">
                      ({model.price})
                    </span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-600" />
                </button>
              ))}
            </div>
          </div>

          {/* Section: Speech to speech */}
          <div>
            <h4 className="flex items-center justify-between border-t border-slate-100 px-3 py-2 pt-3 text-[11px] font-semibold text-slate-500 dark:border-white/5 dark:text-gray-400">
              Speech to speech
              <ChevronDown className="h-3 w-3" />
            </h4>
            <div className="flex flex-col gap-0.5">
              {SPEECH_TO_SPEECH.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className="group flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <ProviderIcon
                      provider={model.provider}
                      className="h-4 w-4 opacity-70 group-hover:opacity-100"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
                      {model.name}
                    </span>
                    <span className="ml-1 font-mono text-xs text-slate-400 dark:text-gray-500">
                      ({model.price})
                    </span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
