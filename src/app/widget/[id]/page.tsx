"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Send,
  Bot,
  Loader2,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  Video,
  Check,
  CheckCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  status?: "sent" | "read";
}
import { getWebWidgetConfig, getChatbotResponse } from "@/lib/actions/widget";
import { WebWidget } from "@/types/database";

export default function PublicWidgetPage() {
  const params = useParams();
  const id = params?.id as string;
  const searchParams = useSearchParams();

  const [config, setConfig] = useState<WebWidget | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(searchParams?.get("lead_id") || null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    async function init() {
      if (!id) return;
      const res = await getWebWidgetConfig(id);
      if (res.success && res.data) {
        setConfig(res.data);

        // Welcome message
        setMessages([
          {
            id: "welcome",
            role: "assistant" as const,
            content: res.data.welcome_message || "¡Hola! ¿En qué puedo ayudarte?",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    }
    init();
  }, [id, searchParams]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !id) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Call AI Action
    const res = await getChatbotResponse({
      widgetId: id,
      leadId: leadId,
      message: input,
      knownVariables: searchParams ? Object.fromEntries(searchParams.entries()) : {},
    });

    if (res.success) {
      if (res.leadId) setLeadId(res.leadId);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1 + "",
          role: "assistant" as const,
          content: res.content ?? "",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      // Update last msg status
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, status: "read" as const } : m))
      );
    }

    setIsLoading(false);
  };

  if (!config)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#ece5dd] font-sans dark:bg-[#0b141a]">
      {/* Header (WhatsApp Style) */}
      <div className="z-10 flex items-center justify-between bg-[#075e54] p-4 text-white shadow-md dark:bg-[#202c33]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold text-[#075e54]">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm leading-tight font-bold">{config.name}</h2>
            <p className="text-[10px] font-black tracking-widest uppercase opacity-80">En línea</p>
          </div>
        </div>
        <div className="flex items-center gap-5 opacity-60">
          <Video className="h-5 w-5" />
          <Phone className="h-4 w-4" />
          <MoreVertical className="h-5 w-5" />
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="custom-scrollbar chat-bg flex-1 space-y-4 overflow-y-auto p-4"
      >
        <div className="mb-6 flex justify-center">
          <span className="rounded-lg bg-[#dcf8c6] px-4 py-1 text-[11px] font-bold tracking-tighter text-slate-500 uppercase shadow-sm dark:bg-[#111b21]/80">
            Cifrado de extremo a extremo
          </span>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={cn(
                "relative flex max-w-[85%] flex-col",
                m.role === "user" ? "ml-auto" : "mr-auto"
              )}
            >
              <div
                className={cn(
                  "relative rounded-xl p-3 text-sm shadow-sm",
                  m.role === "user"
                    ? "rounded-tr-none bg-[#dcf8c6] text-slate-900 dark:bg-[#005c4b] dark:text-white"
                    : "rounded-tl-none bg-white text-slate-900 dark:bg-[#202c33] dark:text-white"
                )}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span className="text-[9px] opacity-50">{m.time}</span>
                  {m.role === "user" &&
                    (m.status === "read" ? (
                      <CheckCheck className="h-3 w-3 text-blue-400" />
                    ) : (
                      <Check className="h-3 w-3 opacity-30" />
                    ))}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-slate-400"
          >
            <div className="rounded-xl rounded-tl-none bg-white p-3 shadow-sm dark:bg-[#202c33]">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex items-center gap-3 bg-[#f0f2f5] p-3 dark:bg-[#202c33]">
        <div className="flex items-center gap-4 px-2 opacity-40">
          <Smile className="h-6 w-6" />
          <Paperclip className="h-5 w-5 -rotate-45" />
        </div>
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escribe un mensaje"
            className="w-full rounded-xl border-0 bg-white px-4 py-3 text-sm focus:outline-none dark:bg-[#2a3942] dark:text-white"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          title="Enviar mensaje"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] text-white transition-all hover:bg-[#008f6f] disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .chat-bg {
          background-image: url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png");
          background-blend-mode: soft-light;
        }
      `}</style>
    </div>
  );
}
