/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo } from "react";
import { X, Play, Search, Plus, Check, Settings2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceModel {
  id: string;
  name: string;
  provider: string;
  gender?: string;
  accent?: string;
  preview_url?: string;
}

interface VoiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableVoices: VoiceModel[];
  selectedVoiceId?: string;
  onSelectVoice: (voiceId: string) => void;
}

const PROVIDERS = ["All", "MiniMax", "Fish Audio", "ElevenLabs", "Cartesia", "OpenAI"];

// Mock Recommended Voices
const RECOMMENDED_VOICES = [
  {
    id: "11labs-Cimo",
    name: "Cimo",
    trait: "American · Middle Aged · retell",
    avatar: "https://i.pravatar.cc/150?u=Cimo",
  },
  {
    id: "11labs-Grace",
    name: "Grace",
    trait: "American · Middle Aged · retell",
    avatar: "https://i.pravatar.cc/150?u=Grace",
  },
  {
    id: "11labs-Hailey",
    name: "Hailey",
    trait: "American · Young · preset",
    avatar: "https://i.pravatar.cc/150?u=Hailey",
  },
  {
    id: "11labs-Nia",
    name: "Nia",
    trait: "American · Young · preset",
    avatar: "https://i.pravatar.cc/150?u=Nia",
  },
  {
    id: "11labs-Nico",
    name: "Nico",
    trait: "American · Middle Aged · preset",
    avatar: "https://i.pravatar.cc/150?u=Nico",
  },
];

export function VoiceSelectorModal({
  isOpen,
  onClose,
  availableVoices,
  selectedVoiceId,
  onSelectVoice,
}: VoiceSelectorModalProps) {
  const [mainTab, setMainTab] = useState<"platform" | "custom">("custom");
  const [activeProvider, setActiveProvider] = useState("All");
  const [search, setSearch] = useState("");
  const [tempSelectedId, setTempSelectedId] = useState<string | undefined>(selectedVoiceId);

  // Filter voices
  const filteredVoices = useMemo(() => {
    return availableVoices.filter((v) => {
      const providerName = (v.provider || "").toLowerCase();
      const active = activeProvider.toLowerCase();

      const providerMatches =
        active === "all" ||
        providerName === active ||
        (active === "elevenlabs" &&
          (providerName.includes("11labs") || providerName.includes("elevenlabs"))) ||
        (active === "openai" && providerName.includes("openai")) ||
        (active === "cartesia" && providerName.includes("cartesia")) ||
        (active === "minimax" && providerName.includes("minimax")) ||
        (active === "fish audio" && providerName.includes("fish"));

      const searchMatches =
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.id.toLowerCase().includes(search.toLowerCase());
      return providerMatches && searchMatches;
    });
  }, [availableVoices, activeProvider, search]);

  const currentlySelectedVoice = availableVoices.find((v) => v.id === tempSelectedId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#1A1A1A] dark:text-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Select Voice{" "}
            <span className="ml-2 text-xs text-gray-500">
              ({availableVoices.length} total loaded)
            </span>
          </h2>
          <button
            onClick={onClose}
            title="Close"
            className="rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4 text-slate-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-6 border-b border-slate-200 px-6 pt-4 dark:border-white/10">
          <button
            onClick={() => setMainTab("platform")}
            className={cn(
              "border-b-2 pb-3 text-sm font-medium transition-colors",
              mainTab === "platform"
                ? "border-purple-600 text-purple-600 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-300"
            )}
          >
            Platform Voices
          </button>
          <button
            onClick={() => setMainTab("custom")}
            className={cn(
              "border-b-2 pb-3 text-sm font-medium transition-colors",
              mainTab === "custom"
                ? "border-purple-600 text-purple-600 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-300"
            )}
          >
            Custom Providers
          </button>
        </div>

        {(mainTab === "custom" || mainTab === "platform") && (
          <>
            {/* Providers Sub-nav */}
            <div className="flex gap-2 bg-slate-50 px-6 py-2 dark:bg-[#25262b]">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider}
                  onClick={() => setActiveProvider(provider)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-sm font-medium transition-all",
                    activeProvider === provider
                      ? "bg-white text-slate-900 shadow-sm dark:bg-[#373a40] dark:text-white"
                      : "text-slate-500 hover:bg-slate-200 dark:text-gray-400 dark:hover:bg-[#2c2e33]"
                  )}
                >
                  {provider}
                </button>
              ))}
            </div>

            {/* Filters Bar */}
            <div className="flex items-center gap-3 px-6 py-4">
              <button className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                <Plus className="h-4 w-4" /> Add custom voice
              </button>

              <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/5 dark:bg-[#25262b] dark:text-gray-300 dark:hover:bg-[#2c2e33]">
                Gender <ChevronDown className="h-4 w-4 text-slate-400 dark:text-gray-500" />
              </div>
              <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/5 dark:bg-[#25262b] dark:text-gray-300 dark:hover:bg-[#2c2e33]">
                Accent <ChevronDown className="h-4 w-4 text-slate-400 dark:text-gray-500" />
              </div>
              <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/5 dark:bg-[#25262b] dark:text-gray-300 dark:hover:bg-[#2c2e33]">
                Types <ChevronDown className="h-4 w-4 text-slate-400 dark:text-gray-500" />
              </div>

              <div className="relative ml-auto max-w-sm flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none dark:border-white/10 dark:bg-[#25262b] dark:text-white dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Recommended Voices */}
            <div className="px-6 py-2">
              <h3 className="mb-3 text-xs font-semibold text-slate-500 dark:text-gray-400">
                Recommended Voices
              </h3>
              <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-4">
                {RECOMMENDED_VOICES.map((v) => (
                  <div
                    key={v.id}
                    className="flex min-w-[280px] cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-[#25262b] dark:hover:bg-[#2c2e33]"
                    onClick={() => setTempSelectedId(v.id)}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={v.avatar}
                        alt={v.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {v.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-gray-500">{v.trait}</p>
                        <p className="text-[9px] text-slate-400 dark:text-gray-600">ID: {v.id}</p>
                      </div>
                    </div>
                    <button
                      title="Play voice preview"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200 dark:bg-[#1a1b1e] dark:hover:bg-white/10"
                    >
                      <Play
                        className="h-3 w-3 text-slate-900 dark:text-white"
                        fill="currentColor"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="scrollbar-thin mx-6 mb-4 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-white/5 dark:bg-[#25262b]">
              <table className="w-full text-left text-sm text-slate-700 dark:text-gray-300">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-white/5 dark:bg-[#2c2e33] dark:text-gray-400">
                  <tr>
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-4 py-3">Voice</th>
                    <th className="px-4 py-3">Trait</th>
                    <th className="px-4 py-3">Voice ID</th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredVoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-slate-500 dark:text-gray-500"
                      >
                        No voices found for this provider.
                      </td>
                    </tr>
                  ) : (
                    filteredVoices.map((v) => {
                      const isSelected = tempSelectedId === v.id;
                      return (
                        <tr
                          key={v.id}
                          onClick={() => setTempSelectedId(v.id)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-slate-50 dark:bg-white/5"
                              : "hover:bg-slate-50/50 dark:hover:bg-[#2c2e33]"
                          )}
                        >
                          <td className="px-4 py-3">
                            <button
                              title="Play voice"
                              className="p-1 transition-colors hover:text-slate-900 dark:hover:text-white"
                            >
                              <Play className="h-3.5 w-3.5 text-slate-400 dark:text-gray-400" />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                                {v.name.charAt(0)}
                              </div>
                              <span className="font-semibold text-slate-900 dark:text-gray-200">
                                {v.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {v.accent && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-[#1a1b1e] dark:text-gray-400">
                                  {v.accent}
                                </span>
                              )}
                              {v.gender && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-[#1a1b1e] dark:text-gray-400">
                                  {v.gender}
                                </span>
                              )}
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-[#1a1b1e] dark:text-gray-400">
                                Provider
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-gray-500">
                            {v.id}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isSelected && (
                              <Check className="inline-block h-4 w-4 text-purple-600 dark:text-white" />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-[#1a1b1e]">
          <div className="flex items-center gap-3">
            <button
              title="Play selected voice"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 transition-colors hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <Play className="h-3 w-3 text-slate-900 dark:text-white" fill="currentColor" />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {currentlySelectedVoice ? currentlySelectedVoice.name : "Select a voice"}
              </p>
              {currentlySelectedVoice && (
                <p className="text-[10px] text-slate-500 dark:text-gray-500">
                  {currentlySelectedVoice.id}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white">
              <Settings2 className="h-4 w-4" /> Expressive mode:{" "}
              <span className="text-slate-700 dark:text-gray-600">Off</span>{" "}
              <ChevronDown className="h-3 w-3" />
            </div>
            <div className="cursor-pointer px-2 text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white">
              More Settings <ChevronDown className="inline h-3 w-3" />
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:text-gray-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (tempSelectedId) onSelectVoice(tempSelectedId);
                onClose();
              }}
              disabled={!tempSelectedId}
              className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
