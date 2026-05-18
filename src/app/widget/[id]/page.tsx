"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { 
    Send,
    Bot, Loader2,
    Paperclip, Smile, MoreVertical,
    Phone, Video, Check, CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getWebWidgetConfig, getChatbotResponse } from "@/lib/actions/widget";
import { WebWidget } from "@/types/database";

export default function PublicWidgetPage() {
    const params = useParams();
    const id = params?.id as string;
    const searchParams = useSearchParams();
    
    const [config, setConfig] = useState<WebWidget | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
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
                setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: res.data.welcome_message || "¡Hola! ¿En qué puedo ayudarte?",
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
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

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'sent'
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        // Call AI Action
        const res = await getChatbotResponse({
            widgetId: id,
            leadId: leadId,
            message: input,
            knownVariables: searchParams ? Object.fromEntries(searchParams.entries()) : {}
        });

        if (res.success) {
            if (res.leadId) setLeadId(res.leadId);
            
            setMessages(prev => [...prev, {
                id: Date.now() + 1 + "",
                role: 'assistant',
                content: res.content,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            
            // Update last msg status
            setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: 'read' } : m));
        }

        setIsLoading(false);
    };

    if (!config) return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-[#ece5dd] dark:bg-[#0b141a] font-sans overflow-hidden">
            {/* Header (WhatsApp Style) */}
            <div className="bg-[#075e54] dark:bg-[#202c33] p-4 flex items-center justify-between text-white shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-[#075e54] font-bold">
                        <Bot className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold leading-tight">{config.name}</h2>
                        <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">En línea</p>
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
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar chat-bg"
            >
                <div className="flex justify-center mb-6">
                    <span className="bg-[#dcf8c6] dark:bg-[#111b21]/80 text-[11px] font-bold py-1 px-4 rounded-lg shadow-sm text-slate-500 uppercase tracking-tighter">
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
                                "flex flex-col max-w-[85%] relative",
                                m.role === 'user' ? "ml-auto" : "mr-auto"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl shadow-sm text-sm relative",
                                m.role === 'user' 
                                    ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-slate-900 dark:text-white rounded-tr-none" 
                                    : "bg-white dark:bg-[#202c33] text-slate-900 dark:text-white rounded-tl-none"
                            )}>
                                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-[9px] opacity-50">{m.time}</span>
                                    {m.role === 'user' && (
                                        m.status === 'read' ? <CheckCheck className="h-3 w-3 text-blue-400" /> : <Check className="h-3 w-3 opacity-30" />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-slate-400">
                        <div className="bg-white dark:bg-[#202c33] p-3 rounded-xl rounded-tl-none shadow-sm">
                            <div className="flex gap-1">
                                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" />
                                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-3">
                <div className="flex items-center gap-4 opacity-40 px-2">
                    <Smile className="h-6 w-6" />
                    <Paperclip className="h-5 w-5 -rotate-45" />
                </div>
                <div className="flex-1 relative">
                    <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escribe un mensaje"
                        className="w-full bg-white dark:bg-[#2a3942] border-0 rounded-xl px-4 py-3 text-sm focus:outline-none dark:text-white"
                    />
                </div>
                <button 
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    title="Enviar mensaje"
                    className="h-12 w-12 rounded-full bg-[#00a884] flex items-center justify-center text-white hover:bg-[#008f6f] transition-all disabled:opacity-50"
                >
                    <Send className="h-5 w-5" />
                </button>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .chat-bg {
                    background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
                    background-blend-mode: soft-light;
                }
            `}</style>
        </div>
    );
}
