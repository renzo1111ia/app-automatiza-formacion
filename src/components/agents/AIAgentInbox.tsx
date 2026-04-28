"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
    Search, Phone, 
    Paperclip, Send, Bot, User,
    Check, CheckCheck, Loader2, Zap,
    Archive, Star, PlusCircle, Filter, 
    GitBranch, X, ChevronDown,
    Trash2, Save
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
    getInboxLeads, getChatHistory, sendManualMessage, 
    toggleLeadAI, updateLeadSegment, assignAgentToLead,
    deleteLead, deleteChatHistory, updateLeadInfo,
    deleteLeadFacts, getAgentTrackedVariables,
    type InboxLead, type ChatMessage 
} from "@/lib/actions/inbox";
import { getAIAgents } from "@/lib/actions/agents";
import { AIAgent } from "@/types/database";
import { getOrchestratorConfig, saveOrchestratorConfig } from '@/lib/actions/orchestrator-config';
import { getWhatsAppTemplates } from "@/lib/actions/orchestration";
import { AgentFlowBuilder } from "@/components/orchestrator/AgentFlowBuilder";
import { useTenantStore } from "@/store/tenant";
import { CreateLeadDialog } from "@/components/historial/CreateLeadDialog";
import { getSupabaseClient } from "@/lib/supabase/client";
import { LeadProfileModal } from "./LeadProfileModal";
import type { LucideIcon } from "lucide-react";
import { resolveCountryFromPhone } from "@/lib/utils/location-client";


export default function AIAgentInbox() {
    // --- Tenant Context ---
    const tenantName = useTenantStore((s) => s.tenantName) || "ESDEN";
    const tenantId = useTenantStore((s) => s.tenantId);
    const router = useRouter();

    // --- State ---

    const [leads, setLeads] = useState<InboxLead[]>([]);
    const [selectedLead, setSelectedLead] = useState<InboxLead | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingChat, setLoadingChat] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [currentFlow, setCurrentFlow] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
    const [loadingFlow, setLoadingFlow] = useState(false);
    
    // View Management
    const [activeView, setActiveView] = useState<'INBOX' | 'LOGIC'>('INBOX');
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    
    // Filters
    const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
    const [aiFilter, setAiFilter] = useState<boolean | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [templates, setTemplates] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [availableAgents, setAvailableAgents] = useState<AIAgent[]>([]);
    const [isAssigningAgent, setIsAssigningAgent] = useState(false);
    const [trackedVariables, setTrackedVariables] = useState<string[]>([]);
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        type: 'LEAD' | 'CHAT';
        includeFacts: boolean;
    }>({
        isOpen: false,
        type: 'LEAD',
        includeFacts: true
    });
    
    // Refs
    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- Data Loading ---
    const loadLeads = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        // Pass tenantId from state to ensure we bypass any cookie lag
        const currentTenantId = useTenantStore.getState().tenantId;
        const res = await getInboxLeads(currentTenantId || undefined);
        if (res.success && typeof res.data !== 'undefined') {
            setLeads(res.data);
        }
        if (!silent) setLoading(false);
    }, []);

    const loadChat = useCallback(async (leadId: string) => {
        setLoadingChat(true);
        const res = await getChatHistory(leadId);
        if (res.success && typeof res.data !== 'undefined') {
            setMessages(res.data);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        setLoadingChat(false);
    }, []);

    const loadFlow = useCallback(async () => {
        setLoadingFlow(true);
        try {
            const res = await getOrchestratorConfig();
            if (res.success && res.data?.flow_graph) {
                setCurrentFlow(res.data.flow_graph);
            }
        } finally {
            setLoadingFlow(false);
        }
    }, []);

    const loadTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        const res = await getWhatsAppTemplates();
        if (res.success && typeof res.data !== 'undefined') {
            setTemplates(res.data);
        }
        setLoadingTemplates(false);
    }, []);
    
    const loadAvailableAgents = useCallback(async () => {
        const res = await getAIAgents();
        if (res.success && res.data) {
            setAvailableAgents(res.data);
        }
    }, []);
    
    // Initial Load & Polling Fallback
    useEffect(() => {
        if (!tenantId) return;
        
        // Initial Fetch
        const runInitialFetch = async () => {
            await Promise.all([
                loadLeads(),
                loadTemplates(),
                loadAvailableAgents()
            ]);
        };
        runInitialFetch();

        // 🛡️ Polling Fallback: Check for new messages/leads every 15 seconds
        // This ensures the UI updates even if Realtime (WebSocket) is blocked by RLS/Network
        const pollingInterval = setInterval(() => {
            console.log("[POLLING] Syncing inbox...");
            loadLeads(true); // Silent update
        }, 15000);

        return () => clearInterval(pollingInterval);
    }, [tenantId, loadLeads, loadTemplates, loadAvailableAgents]);

    useEffect(() => {
        if (activeView === 'LOGIC') {
            const timer = setTimeout(() => loadFlow(), 0);
            return () => clearTimeout(timer);
        }
    }, [activeView, loadFlow]);

    // Load chat + tracked variables when selection changes
    const lastSelectedId = useRef<string | null>(null);
    useEffect(() => {
        if (selectedLead && selectedLead.id !== lastSelectedId.current) {
            lastSelectedId.current = selectedLead.id;
            setTimeout(() => loadChat(selectedLead.id), 0);
            // Load the configured tracked variables for this lead's agent
            getAgentTrackedVariables(selectedLead.ai_agent_id || null).then(res => {
                if (res.success && res.data) setTrackedVariables(res.data);
                else setTrackedVariables([]);
            });
        } else if (!selectedLead) {
            if (lastSelectedId.current !== null) {
                lastSelectedId.current = null;
                setTimeout(() => setMessages([]), 0);
                setTrackedVariables([]);
            }
        }
    }, [selectedLead, loadChat]);


    // --- Actions ---
    const handleSendMessage = async () => {
        if (!selectedLead || !messageText.trim()) return;
        setSending(true);
        const res = await sendManualMessage(selectedLead.id, messageText.trim(), "TEXT");
        if (res.success && res.data) {
            // Capture data to ensure TypeScript knows it's not undefined inside the callback
            const newMessage = res.data;
            
            // No need to manually update messages if realtime is working, 
            // but keeping it for immediate feedback feeling.
            setMessages((prev: ChatMessage[]) => {
                if (prev.find(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });
            setMessageText("");
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        setSending(false);
    };

    // --- Realtime Subscription ---
    // Use a ref so the Supabase callback always has the latest selectedLead
    // without needing to re-subscribe on every lead change (stale closure fix)
    const selectedLeadRef = useRef<InboxLead | null>(null);
    useEffect(() => { selectedLeadRef.current = selectedLead; }, [selectedLead]);

    useEffect(() => {
        const supabase = getSupabaseClient();
        const tenantId = useTenantStore.getState().tenantId;
        if (!tenantId) return;

        console.log(`[REALTIME] Subscribing for tenant: ${tenantId}`);

        // ── 1. New or Updated chat messages ─────────────────────────────
        const messageChannel = supabase
            .channel(`inbox:chat_summaries:${tenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_summaries', filter: `tenant_id=eq.${tenantId}` },
                (payload) => {
                    const newSummary = (payload.new as any).summary as string;
                    const leadId = (payload.new as any).lead_id;

                    if (selectedLeadRef.current?.id === leadId) {
                        const lines = newSummary.split('\n').filter(l => l.trim());
                        const messages: ChatMessage[] = lines.map((line, idx) => {
                            const match = line.match(/^\[(.*?)\] (.*?): (.*)$/);
                            if (match) {
                                const [, time, role, content] = match;
                                return {
                                    id: `sum-${leadId}-${idx}`,
                                    tenant_id: tenantId,
                                    lead_id: leadId,
                                    direction: role === 'Usuario' ? 'INBOUND' : 'OUTBOUND',
                                    message_type: 'TEXT',
                                    content: content,
                                    sent_by: role === 'Usuario' ? null : 'AI_AGENT',
                                    status: 'READ',
                                    created_at: new Date().toISOString(),
                                    metadata: { time_label: time }
                                } as ChatMessage;
                            }
                            return null;
                        }).filter(m => m !== null) as ChatMessage[];

                        setMessages(messages);
                        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
                    }

                    // Update the preview in the leads list
                    const lines = newSummary.split('\n').filter(l => l.trim());
                    const lastLine = lines[lines.length - 1];
                    const lastMatch = lastLine?.match(/^\[(.*?)\] (.*?): (.*)$/);
                    
                    if (lastMatch) {
                        const [, time, , content] = lastMatch;
                        setLeads((prev) => {
                            const updated = prev.map(l =>
                                l.id === leadId
                                    ? { ...l, last_message: content, last_message_time: new Date().toISOString() }
                                    : l
                            );
                            return [...updated].sort((a, b) => 
                                new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime()
                            );
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `tenant_id=eq.${tenantId}` },
                (payload) => {
                    const updatedMsg = payload.new as ChatMessage;
                    if (selectedLeadRef.current?.id === updatedMsg.lead_id) {
                        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                    }
                }
            )
            .subscribe();

        // ── 2. New leads (e.g. from WhatsApp inbound) ──────────────────
        const newLeadChannel = supabase
            .channel(`inbox:new_leads:${tenantId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'lead', filter: `tenant_id=eq.${tenantId}` },
                (payload) => {
                    const newLead = payload.new as Record<string, unknown>;
                    console.log('[REALTIME] New lead:', newLead.id);

                    // Normalise phone
                    let phone = (newLead.telefono as string) || null;
                    if (phone && !phone.startsWith('+')) phone = '+' + phone;

                    const inboxLead: InboxLead = {
                        id: newLead.id as string,
                        nombre: (newLead.nombre as string) || null,
                        apellido: (newLead.apellido as string) || null,
                        telefono: phone,
                        foto_url: null,
                        is_ai_enabled: (newLead.is_ai_enabled as boolean) ?? true,
                        ai_agent_id: (newLead.ai_agent_id as string) || null,
                        last_message: 'Nueva conversación',
                        last_message_time: (newLead.fecha_creacion as string) || new Date().toISOString(),
                        created_at: (newLead.fecha_creacion as string) || null,
                        tipo_lead: (newLead.tipo_lead as string) || 'SIN CALIFICAR',
                        pais: (newLead.pais as string) || resolveCountryFromPhone(phone) || 'Identificando...',
                        origen: (newLead.origen as string) || 'WHATSAPP_INBOUND',
                        campana: (newLead.campana as string) || 'General',
                        segmentacion: null,
                        metadata: (newLead.metadata as Record<string, unknown>) || {},
                        unread_count: 1,
                    };

                    setLeads((prev) => {
                        if (prev.find(l => l.id === inboxLead.id)) return prev;
                        router.refresh(); // Force page refresh as requested by user
                        return [inboxLead, ...prev];
                    });
                }
            )
            .subscribe();

        // ── 3. Lead updates (metadata, ai_enabled, segmentation) ───────
        const leadUpdateChannel = supabase
            .channel(`inbox:lead_updates:${tenantId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'lead', filter: `tenant_id=eq.${tenantId}` },
                (payload) => {
                    const updated = payload.new as Partial<InboxLead>;
                    console.log('[REALTIME] Lead updated:', updated.id);

                    setLeads((prev) => prev.map(l => l.id === updated.id
                        ? { ...l, ...updated }
                        : l
                    ));

                    if (selectedLeadRef.current?.id === updated.id) {
                        setSelectedLead((prev) => prev ? { ...prev, ...updated } : (updated as InboxLead));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(messageChannel);
            supabase.removeChannel(newLeadChannel);
            supabase.removeChannel(leadUpdateChannel);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantId]); // Re-subscribe when tenantId changes or becomes available


    const handleSendTemplate = async (templateName: string) => {
        if (!selectedLead) return;
        setSending(true);

        // Find template to get its language and variables
        const tpl = templates.find(t => t.name === templateName);
        const lang = tpl?.language || "es";
        
        // Detect if the template expects parameters in BODY
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasVariables = tpl?.components?.some((c: any) => 
            c.type === "BODY" && c.text?.includes("{{1}}")
        );

        // If no variables detected, send an empty array for components to avoid Meta error #132000
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const components: any[] = hasVariables ? (selectedLead.nombre ? [
            {
                type: "BODY",
                parameters: [{ type: "text", text: selectedLead.nombre }]
            }
        ] : []) : [];

        const res = await sendManualMessage(selectedLead.id, templateName, "TEMPLATE", lang, components);
        if (res.success && res.data) {
            const newMessage = res.data;
            setMessages((prev: ChatMessage[]) => {
                if (prev.find(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });
            setIsTemplateModalOpen(false);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } else if (res.error) {
            alert(res.error);
        }
        setSending(false);
    };

    const handleToggleAI = async () => {
        if (!selectedLead) return;
        const newState = !selectedLead.is_ai_enabled;
        const res = await toggleLeadAI(selectedLead.id, newState);
        if (res.success) {
            const updated = { ...selectedLead, is_ai_enabled: newState };
            setSelectedLead(updated);
            setLeads((prev: InboxLead[]) => prev.map(l => l.id === selectedLead.id ? updated : l));
        } else {
            alert(res.error);
        }
    };

    const handleAssignAgent = async (agentId: string | null) => {
        if (!selectedLead) return;
        setIsAssigningAgent(true);
        const res = await assignAgentToLead(selectedLead.id, agentId);
        if (res.success) {
            const updated = { ...selectedLead, ai_agent_id: agentId };
            setSelectedLead(updated);
            setLeads((prev: InboxLead[]) => prev.map(l => l.id === selectedLead.id ? updated : l));
        } else {
            alert(res.error);
        }
        setIsAssigningAgent(false);
    };

    const handleDeleteLead = async () => {
        if (!selectedLead) return;
        setDeleteModal({ isOpen: true, type: 'LEAD', includeFacts: true });
    };

    const handleDeleteChat = async () => {
        if (!selectedLead) return;
        setDeleteModal({ isOpen: true, type: 'CHAT', includeFacts: false });
    };

    const confirmDelete = async () => {
        if (!selectedLead) return;
        setLoadingChat(true);

        if (deleteModal.type === 'LEAD') {
            const res = await deleteLead(selectedLead.id);
            if (res.success) {
                setLeads((prev) => prev.filter(l => l.id !== selectedLead.id));
                setSelectedLead(null);
            } else {
                alert("Error al eliminar lead: " + res.error);
            }
        } else {
            // Delete Chat
            const res = await deleteChatHistory(selectedLead.id);
            if (res.success) {
                setMessages([]);
                // If requested, also delete facts
                if (deleteModal.includeFacts) {
                    await deleteLeadFacts(selectedLead.id);
                    setSelectedLead(prev => prev ? { ...prev, metadata: {} } : null);
                }
            } else {
                alert("Error al vaciar chat: " + res.error);
            }
        }

        setLoadingChat(false);
        setDeleteModal(prev => ({ ...prev, isOpen: false }));
    };

    // --- Render Helpers ---
    const formatTime = (ts?: string) => {
        if (!ts) return "";
        return new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    };

    if (activeView === 'LOGIC') {
        return (
            <div className="h-screen bg-slate-950 flex flex-col">
                <div className="h-16 px-8 border-b border-white/5 flex items-center justify-between bg-black/40">
                    <div className="flex items-center gap-3">
                        <GitBranch className="h-5 w-5 text-primary" />
                        <h2 className="text-sm font-black uppercase tracking-widest">Constructor de Lógica IA</h2>
                    </div>
                    <button 
                        title="Cerrar constructor de lógica"
                        onClick={() => setActiveView('INBOX')}
                        className="h-10 w-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-all bg-white/5"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1 relative">
                    {loadingFlow ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/50 backdrop-blur-xl z-50">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Cargando Red Neuronal...</p>
                        </div>
                    ) : (
                        <AgentFlowBuilder 
                            agentName={`Agente de Texto ${tenantName}`}
                            initialFlow={currentFlow}
                            onClose={() => setActiveView('INBOX')}
                            onSave={async (flow) => {
                                console.log("[SAVE] Executing saveOrchestratorConfig...", flow);
                                const res = await saveOrchestratorConfig({
                                    flow_graph: flow
                                });
                                
                                if (res.success) {
                                    setCurrentFlow(flow);
                                    setActiveView('INBOX');
                                } else {
                                    alert("Error al guardar flujo: " + res.error);
                                }
                            }}
                        />
                    )}
                </div>
            </div>
        );
    }    return (
        <div className="h-full flex text-slate-900 dark:text-white selection:bg-primary/30 font-sans overflow-hidden">
            
            {/* ─── COLUMN 1: CONVERSATION LIST (Standard 320px) ───────────────────────── */}
            <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 backdrop-blur-3xl z-20">
                <div className="h-16 px-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white dark:bg-black/20">
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-primary">Conversaciones</h2>
                        <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-primary/20 text-[10px] font-black text-slate-500 dark:text-primary border border-slate-200 dark:border-primary/20">{leads.length}</div>
                    </div>
                    <div className="flex items-center gap-1 relative">
                        <button 
                            title="Filtrar" 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center transition-all border",
                                isFilterOpen || segmentFilter || aiFilter !== null 
                                    ? "bg-primary/20 border-primary/40 text-primary" 
                                    : "hover:bg-white/5 border-white/5 text-slate-500 dark:text-white/40"
                            )}
                        >
                            <Filter className="h-3.5 w-3.5" />
                        </button>
                        
                        <AnimatePresence>
                            {isFilterOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full right-0 mt-2 w-56 bg-[#0b0e14] border border-white/10 rounded-2xl shadow-2xl p-4 z-50 space-y-4"
                                >
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20 px-1">Segmentación</p>
                                        <div className="flex flex-wrap gap-1">
                                            {['PUESTO 1', 'REVISADO', 'CUALIFICADO', 'SIN INTERÉS'].map(s => (
                                                <button 
                                                    key={s}
                                                    onClick={() => setSegmentFilter(segmentFilter === s ? null : s)}
                                                    className={cn(
                                                        "px-2 py-1 rounded-md text-[9px] font-bold border transition-all",
                                                        segmentFilter === s 
                                                            ? "bg-primary border-primary/20 text-white" 
                                                            : "bg-white/5 border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/10"
                                                    )}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20 px-1">Estado de Agente</p>
                                        <div className="grid grid-cols-2 gap-1">
                                            <button 
                                                onClick={() => setAiFilter(aiFilter === true ? null : true)}
                                                className={cn(
                                                    "px-2 py-1 rounded-md text-[9px] font-bold border transition-all text-center",
                                                    aiFilter === true 
                                                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500" 
                                                        : "bg-white/5 border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/10"
                                                )}
                                            >
                                                IA ACTIVA
                                            </button>
                                            <button 
                                                onClick={() => setAiFilter(aiFilter === false ? null : false)}
                                                className={cn(
                                                    "px-2 py-1 rounded-md text-[9px] font-bold border transition-all text-center",
                                                    aiFilter === false 
                                                        ? "bg-amber-500/20 border-amber-500/40 text-amber-500" 
                                                        : "bg-white/5 border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/10"
                                                )}
                                            >
                                                IA PAUSADA
                                            </button>
                                        </div>
                                    </div>

                                    {(segmentFilter || aiFilter !== null) && (
                                        <button 
                                            onClick={() => { setSegmentFilter(null); setAiFilter(null); }}
                                            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40 transition-all border border-white/5"
                                        >
                                            Limpiar Filtros
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button 
                            title="Nuevo Prospecto" 
                            onClick={() => setIsCreateLeadModalOpen(true)}
                            className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center transition-all hover:bg-primary/20"
                        >
                            <PlusCircle className="h-3.5 w-3.5 text-primary" />
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-black/10 border-b border-slate-200 dark:border-white/5">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-400 dark:text-white/20 group-focus-within:text-primary transition-colors" />
                        <input 
                            placeholder="Buscar prospectos..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-4 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-300 dark:text-white/10 text-slate-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/5">
                    {loading ? (
                        <div className="flex justify-center py-20 opacity-30"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : (
                        leads
                            .filter(lead => {
                                const matchesSearch = 
                                    !searchQuery || 
                                    (lead.nombre || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (lead.apellido || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (lead.telefono || "").includes(searchQuery);
                                
                                const matchesSegment = !segmentFilter || lead.segmentacion === segmentFilter;
                                const matchesAI = aiFilter === null || lead.is_ai_enabled === aiFilter;

                                return matchesSearch && matchesSegment && matchesAI;
                            })
                            .map(lead => (
                            <button
                                key={lead.id}
                                onClick={() => setSelectedLead(lead)}
                                className={cn(
                                    "w-full px-6 py-4 flex items-center gap-4 transition-all text-left relative group border-b border-slate-100 dark:border-white/[0.02]",
                                    selectedLead?.id === lead.id ? "bg-slate-50 dark:bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                                )}
                            >
                                {selectedLead?.id === lead.id && <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)] rounded-r-full" />}
                                
                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center flex-shrink-0 relative overflow-hidden shadow-2xl group-hover:scale-105 transition-transform duration-300">
                                    {lead.foto_url ? (
                                        <Image src={lead.foto_url} alt={lead.nombre || ""} width={48} height={48} className="h-full w-full object-cover" unoptimized />
                                    ) : (
                                        <User className="h-6 w-6 text-slate-400 dark:text-white/20" />
                                    )}
                                    <div className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#030712]" title="WhatsApp Activo" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <p className="text-[13px] font-black truncate tracking-tight text-slate-900 dark:text-slate-900 dark:text-white/90">
                                            {lead.nombre || lead.apellido ? `${lead.nombre || ''} ${lead.apellido || ''}` : lead.telefono || "Sin Nombre"}
                                        </p>
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 dark:text-white/20 uppercase tracking-tighter">
                                            {formatTime(lead.last_message_time || undefined)}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "text-[11px] truncate font-medium",
                                        lead.unread_count ? "text-blue-600 dark:text-white font-black" : "text-slate-500 dark:text-slate-500 dark:text-white/40"
                                    )}>
                                        {lead.last_message || "Esperando interacción..."}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Automation Link (Condensed) */}
                <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/30 dark:bg-black/20">
                    <button 
                        onClick={() => setActiveView('LOGIC')}
                        className="w-full p-4 rounded-2xl border border-blue-500/20 dark:border-blue-500/10 bg-white dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md"
                    >
                        <Zap className="h-4 w-4 text-blue-500 group-hover:animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Neural Logic Editor</span>
                    </button>
                </div>
            </div>

            {/* ─── COLUMN 2: MAIN CHAT AREA (Flexible Container) ───────────────────────── */}
            <div className="flex-1 flex flex-col bg-white dark:bg-[#0b0e14] relative border-r border-slate-200 dark:border-white/5 shadow-2xl z-10 min-w-0">
                <div className={cn(
                    "h-16 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white/80 dark:bg-black/60 backdrop-blur-3xl transition-all duration-300",
                    showDetails ? "px-4" : "px-8"
                )}>
                    <div className={cn("flex items-center", showDetails ? "gap-3" : "gap-6")}>
                        {selectedLead ? (
                            <>
                                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-2xl overflow-hidden group">
                                     {selectedLead.foto_url ? (
                                        <Image src={selectedLead.foto_url} alt="" width={40} height={40} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" unoptimized />
                                    ) : (
                                        <User className="h-5 w-5 text-slate-400 dark:text-white/20" />
                                    )}
                                </div>
                                
                                <div className="flex flex-col gap-0 min-w-0">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <h2 className="text-[15px] font-black text-slate-900 dark:text-white leading-tight truncate tracking-tight shrink">
                                            {selectedLead.nombre ? `${selectedLead.nombre} ${selectedLead.apellido || ''}` : selectedLead.telefono}
                                        </h2>
                                        {selectedLead.segmentacion && (
                                            <div className={cn(
                                                "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.1em] border flex-shrink-0",
                                                selectedLead.segmentacion === 'CUALIFICADO' ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500" :
                                                selectedLead.segmentacion === 'REVISADO' ? "bg-blue-500/20 border-blue-500/40 text-blue-500" :
                                                selectedLead.segmentacion === 'PUESTO 1' ? "bg-primary/20 border-primary/40 text-primary" :
                                                "bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-500 dark:text-slate-500 dark:text-white/40"
                                            )}>
                                                {selectedLead.segmentacion}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 dark:text-white/40">
                                        <span className="text-[9px] font-bold tracking-wider truncate">{selectedLead.telefono}</span>
                                        {!showDetails && (
                                            <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                                <div className="h-1 w-1 rounded-full bg-emerald-500" />
                                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70 truncate">WhatsApp Cloud API</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-4 opacity-10">
                                <div className="h-10 w-10 border border-dashed border-white/20 rounded-2xl" />
                                <div className="space-y-1.5">
                                    <div className="h-3 w-32 bg-white/10 rounded-full" />
                                    <div className="h-2 w-24 bg-white/5 rounded-full" />
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedLead && (
                        <div className={cn("flex items-center", showDetails ? "gap-2" : "gap-4")}>
                            {/* AGENT TOGGLE */}
                            <button 
                                onClick={handleToggleAI}
                                title={selectedLead?.is_ai_enabled ? "Pausar Agente IA" : "Activar Agente IA"}
                                className={cn(
                                    "h-9 transition-all flex items-center justify-center border shadow-lg overflow-hidden",
                                    showDetails ? "w-9 rounded-xl px-0" : "px-3 rounded-xl gap-2",
                                    selectedLead?.is_ai_enabled 
                                        ? "bg-primary border-primary/20 text-white" 
                                        : "bg-amber-500 border-amber-500/20 text-white animate-pulse"
                                )}
                            >
                                <Zap className="h-3.5 w-3.5" />
                                {!showDetails && <span className="text-[9px] font-black uppercase tracking-widest">{selectedLead?.is_ai_enabled ? "Agente IA: ON" : "Agente IA: PAUSA"}</span>}
                            </button>

                            {/* AGENT SELECTOR */}
                            <div className="relative group/agent">
                                <select 
                                    value={selectedLead?.ai_agent_id || ""}
                                    disabled={isAssigningAgent}
                                    onChange={(e) => handleAssignAgent(e.target.value || null)}
                                    title="Vincular este lead a un agente específico"
                                    className={cn(
                                        "h-9 bg-black/40 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-primary focus:outline-none focus:border-primary/20 appearance-none cursor-pointer disabled:opacity-50 transition-all",
                                        showDetails ? "w-9 px-0 text-center flex items-center justify-center" : "px-4 pr-8"
                                    )}
                                >
                                    {availableAgents.map(agent => (
                                        <option key={agent.id} value={agent.id} className="bg-slate-900">{agent.name}</option>
                                    ))}
                                </select>
                                {!showDetails && <ChevronDown className="h-3 w-3 absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none group-hover/agent:scale-110 transition-transform" />}
                            </div>

                            <button 
                                onClick={handleDeleteChat}
                                title="Vaciar conversación"
                                className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            <button 
                                onClick={() => setShowDetails(!showDetails)}
                                title={showDetails ? "Ocultar detalles" : "Mostrar detalles"}
                                className={cn(
                                    "h-9 w-9 rounded-xl flex items-center justify-center transition-all border",
                                    showDetails ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/10"
                                )}
                            >
                                <Archive className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Messages Window */}
                <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
                    {!selectedLead ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                            <Bot className="h-16 w-16 text-primary mb-6" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter">AI Omnichannel</h2>
                            <p className="text-[9px] uppercase tracking-[0.3em] font-black mt-2">Selecciona un chat para comenzar</p>
                        </div>
                    ) : loadingChat ? (
                        <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        messages.map((msg) => (
                            <ChatMessageBubble 
                                key={msg.id} 
                                message={msg} 
                                templates={templates}
                            />
                        ))
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input Area */}
                {selectedLead && (
                    <div className="p-8 bg-white/80 dark:bg-black/60 backdrop-blur-2xl border-t border-slate-200 dark:border-white/5">
                        <div className="max-w-5xl mx-auto space-y-4">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => {
                                        setIsTemplateModalOpen(true);
                                        loadTemplates();
                                    }}
                                    className="h-9 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 hover:bg-emerald-500/20 transition-all text-[9px] font-black uppercase tracking-widest text-emerald-400"
                                >
                                    <Star className="h-3.5 w-3.5" /> Enviar Plantilla Meta
                                </button>
                                <button 
                                    title="Añadir nota privada"
                                    className="h-9 px-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 hover:bg-white/10 transition-all text-[9px] font-black uppercase tracking-widest text-white/30"
                                >
                                    <Archive className="h-3.5 w-3.5" /> Nota Privada
                                </button>
                            </div>

                            <div className="relative">
                                <textarea 
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                                    }}
                                    placeholder={selectedLead.is_ai_enabled ? "El agente IA está respondiendo... (Pausa para responder tú)" : "Escribe tu mensaje aquí..."}
                                    className={cn(
                                        "w-full bg-slate-50 dark:bg-[#111622] border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 pr-32 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[60px] max-h-40 custom-scrollbar resize-none text-slate-900 dark:text-white",
                                        selectedLead.is_ai_enabled && "opacity-50 cursor-not-allowed"
                                    )}
                                    readOnly={selectedLead.is_ai_enabled}
                                />
                                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                                    <button 
                                        disabled={sending || !messageText.trim() || selectedLead.is_ai_enabled}
                                        onClick={handleSendMessage}
                                        className="h-10 px-5 bg-primary rounded-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-20 shadow-lg shadow-primary/20"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Enviar</span>
                                        <Send className="h-3.5 w-3.5 text-white" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── COLUMN 3: LEAD DETAILS (Fixed Right Sidebar) ───────────────────────── */}
            <AnimatePresence>
                {selectedLead && showDetails && (
                    <motion.div 
                        initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="w-80 flex-shrink-0 flex flex-col border-l border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/40 relative z-30 h-full overflow-hidden"
                    >
                        <div className="h-16 px-8 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white dark:bg-black/20">
                            <span className="text-[11px] font-black uppercase tracking-widest text-primary">Detalles del Lead</span>
                            <button 
                                title="Cerrar detalles"
                                onClick={() => setShowDetails(false)} 
                                className="text-slate-400 dark:text-white/20 hover:text-white h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all"
                            >
                                <X className="h-4 w-4"/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
                            {/* Profile Header */}
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="h-24 w-24 rounded-[32px] bg-slate-800 border-2 border-primary/20 p-1 shadow-2xl">
                                    <div className="h-full w-full rounded-[28px] overflow-hidden">
                                        {selectedLead.foto_url ? (
                                            <Image src={selectedLead.foto_url} alt="" width={96} height={96} className="h-full w-full object-cover" unoptimized />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center"><User className="h-8 w-8 text-slate-300 dark:text-white/10" /></div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[16px] font-black tracking-tight text-slate-900 dark:text-white">{selectedLead.nombre ? `${selectedLead.nombre} ${selectedLead.apellido || ''}` : selectedLead.telefono}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-white/30 uppercase tracking-[0.2em] mt-1">{selectedLead.tipo_lead || 'LEAD SIN REVISAR'}</p>
                                </div>
                            </div>

                            {/* Segmentation Panel */}
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">Segmentación</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['PUESTO 1', 'REVISADO', 'CUALIFICADO', 'SIN INTERÉS'] as const).map((seg) => (
                                            <button
                                                key={seg}
                                                onClick={async () => {
                                                    console.log("Segmenting lead:", selectedLead.id, "to:", seg);
                                                    
                                                    // OPTIMISTIC UI: Update immediately
                                                    const previousSegment = selectedLead.segmentacion;
                                                    
                                                    // Functional updates to avoid closure issues
                                                    setSelectedLead((prev: InboxLead | null) => prev ? { ...prev, segmentacion: seg } : null);
                                                    setLeads((prev: InboxLead[]) => prev.map(l => l.id === selectedLead.id ? { ...l, segmentacion: seg } : l));

                                                    const res = await updateLeadSegment(selectedLead.id, seg);
                                                    
                                                    if (!res.success) {
                                                        setSelectedLead((prev: InboxLead | null) => prev ? { ...prev, segmentacion: previousSegment } : null);
                                                        setLeads((prev: InboxLead[]) => prev.map(l => l.id === selectedLead.id ? { ...l, segmentacion: previousSegment } : l));
                                                        alert("Error al guardar segmentación: " + res.error);
                                                    }
                                                }}
                                                className={cn(
                                                    "px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                                                    selectedLead.segmentacion === seg 
                                                        ? "bg-primary border-primary/20 text-white shadow-lg shadow-primary/20" 
                                                        : "bg-white/5 border-white/5 text-slate-500 dark:text-white/40 hover:bg-white/10"
                                                )}
                                            >
                                                {seg}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <DetailField 
                                    label="Teléfono" 
                                    value={selectedLead.telefono || 'Desconocido'} 
                                    icon={Phone} 
                                    copyable 
                                    editable
                                    onSave={async (newVal) => {
                                        const res = await updateLeadInfo(selectedLead.id, { telefono: newVal });
                                        if (res.success) {
                                            const updated = { ...selectedLead, telefono: newVal };
                                            setSelectedLead(updated);
                                            setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
                                        } else {
                                            alert("Error al actualizar teléfono: " + res.error);
                                        }
                                    }}
                                />
                                <DetailField label="País" value={selectedLead.pais || resolveCountryFromPhone(selectedLead.telefono) || 'Identificando...'} icon={Star} />
                                <DetailField label="Origen" value={selectedLead.origen || 'Campaña Orgánica'} icon={GitBranch} />
                            </div>

                            {/* Captured Variables (Live Memory) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">Variables Capturadas</p>
                                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-tighter animate-pulse">Live</span>
                                    </div>
                                    {selectedLead.metadata?.last_fact_update && typeof selectedLead.metadata.last_fact_update === 'string' && (
                                        <span className="text-[8px] font-bold text-slate-400 dark:text-white/10 italic">
                                            Actualizado: {new Date(selectedLead.metadata.last_fact_update).toLocaleTimeString()}
                                        </span>
                                    )}
                                    <button 
                                        onClick={async () => {
                                            if (confirm("¿Estás seguro de que deseas borrar todas las variables capturadas para este lead? Esto reiniciará la memoria de la IA.")) {
                                                const res = await deleteLeadFacts(selectedLead.id);
                                                if (res.success) {
                                                    const updated = { ...selectedLead, metadata: {} };
                                                    setSelectedLead(updated);
                                                    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
                                                } else {
                                                    alert("Error al borrar variables: " + res.error);
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all group"
                                    >
                                        <Trash2 className="h-3 w-3 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Depurar</span>
                                    </button>
                                </div>
                                {trackedVariables.length > 0 ? (
                                    <div className="space-y-2">
                                        {trackedVariables.map((varName) => {
                                            // Strip {{ }} wrapping from variable name
                                            const key = varName.replace(/^\{\{|\}\}$/g, '');
                                            // Robust lookup: check exact match, then case-insensitive match
                                            let capturedValue = selectedLead.metadata?.[key];
                                            if (capturedValue === undefined) {
                                                const metaKeys = Object.keys(selectedLead.metadata || {});
                                                const match = metaKeys.find(k => k.toLowerCase() === key.toLowerCase());
                                                if (match) capturedValue = selectedLead.metadata![match];
                                            }
                                            const hasCaptured = capturedValue !== undefined && capturedValue !== null && String(capturedValue).trim() !== '';
                                            return (
                                                <div
                                                    key={key}
                                                    className={cn(
                                                        "px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors",
                                                        hasCaptured
                                                            ? "bg-emerald-50 dark:bg-emerald-500/[0.05] border-emerald-500/20 dark:border-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/10"
                                                            : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5"
                                                    )}
                                                >
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className={cn(
                                                            "text-[8px] font-black uppercase tracking-tighter",
                                                            hasCaptured ? "text-emerald-600 dark:text-emerald-500/50" : "text-slate-500 dark:text-white/20"
                                                        )}>{'{{' + key + '}}'}</span>
                                                        <span className={cn(
                                                            "text-[11px] font-bold truncate",
                                                            hasCaptured ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-white/15 italic"
                                                        )}>
                                                            {hasCaptured ? String(capturedValue) : 'Pendiente...'}
                                                        </span>
                                                    </div>
                                                    {hasCaptured && (
                                                        <div className="h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                                                            <Check className="h-2.5 w-2.5 text-emerald-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 border-dashed text-center">
                                        <p className="text-[9px] font-bold text-white/15 uppercase tracking-widest">Sin variables configuradas en el agente</p>
                                    </div>
                                )}
                            </div>

                            {/* Automation Timeline */}
                            <div className="space-y-6 pt-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20 px-1">Progreso de Automatización</p>
                                <div className="space-y-4">
                                    <TimelineItem 
                                        label="Entrada CRM" 
                                        time={selectedLead.created_at || 'Hace 2h'} 
                                        status="COMPLETO" 
                                        icon={Bot} 
                                        active 
                                    />
                                    <TimelineItem 
                                        label="Llamada de Cualificación" 
                                        time="Hace 1h" 
                                        status={messages.some(m => m.message_type === 'SYSTEM_LOG' && m.content.includes('Llamada')) ? 'COMPLETO' : 'PENDIENTE'} 
                                        icon={Phone} 
                                        active={messages.some(m => m.message_type === 'SYSTEM_LOG' && m.content.includes('Llamada'))}
                                    />
                                    <TimelineItem 
                                        label="Mensaje de Bienvenida" 
                                        time="Hace 30m" 
                                        status="COMPLETO" 
                                        icon={Send} 
                                        active 
                                    />
                                    <TimelineItem 
                                        label="Cualificación WhatsApp" 
                                        time="En curso" 
                                        status="PROCESANDO" 
                                        icon={Zap} 
                                        active 
                                        isLast
                                    />
                                </div>
                            </div>

                        </div>

                        <div className="p-8 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 space-y-4">
                              <button 
                                onClick={() => setIsProfileModalOpen(true)}
                                className="w-full h-12 rounded-xl bg-blue-100 dark:bg-primary/10 border border-blue-200 dark:border-primary/20 hover:bg-blue-200 dark:hover:bg-primary/20 transition-all text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-primary shadow-sm"
                              >
                                  Ver Perfil Completo
                              </button>
                              <button 
                                onClick={handleDeleteLead}
                                className="w-full h-12 rounded-xl bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-500 flex items-center justify-center gap-2 shadow-sm"
                              >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Eliminar Lead Completamente</span>
                              </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── LEAD PROFILE MODAL ─── */}
            <AnimatePresence>
                {isProfileModalOpen && selectedLead && (
                    <LeadProfileModal 
                        lead={selectedLead}
                        onClose={() => setIsProfileModalOpen(false)}
                        onUpdate={(updated) => {
                            setSelectedLead(updated);
                            setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                        }}
                    />
                )}
            </AnimatePresence>

            {/* ─── TEMPLATE SELECTOR MODAL ─── */}
            <AnimatePresence>
                {isTemplateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
                            onClick={() => setIsTemplateModalOpen(false)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-xl bg-[#0b0e14] border border-white/10 rounded-[40px] p-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] space-y-8"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black uppercase tracking-tight">Plantillas Meta</h3>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-white/20 uppercase tracking-widest">Verificación Cloud API de WhatsApp</p>
                                </div>
                                <button title="Cerrar modal" onClick={() => setIsTemplateModalOpen(false)} className="h-12 w-12 flex items-center justify-center rounded-2xl hover:bg-white/5"><X className="h-6 w-6 text-slate-500 dark:text-white/40"/></button>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                {loadingTemplates ? (
                                    <div className="flex flex-col items-center py-20 opacity-30">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                        <p className="text-[10px] uppercase font-black tracking-widest">Sincronizando con Meta...</p>
                                    </div>
                                ) : templates.length > 0 ? (
                                    templates.map((tpl: { id: string; name: string; category: string; language: string; status?: string }) => (
                                        <TemplateCard 
                                            key={tpl.id}
                                            name={tpl.name} 
                                            description={`Categoría: ${tpl.category} | Idioma: ${tpl.language}`} 
                                            onClick={() => handleSendTemplate(tpl.name)}
                                            status={tpl.status}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-10 opacity-30">
                                        <p className="text-xs font-bold">No se encontraron plantillas sincronizadas.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {isCreateLeadModalOpen && (
                <CreateLeadDialog 
                    onClose={() => setIsCreateLeadModalOpen(false)}
                    onSuccess={() => {
                        loadLeads();
                    }}
                />
            )}

            {/* ─── DELETE CONFIRMATION MODAL ─── */}
            <AnimatePresence>
                {deleteModal.isOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
                            onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-[#0b0e14] border border-white/10 rounded-[40px] p-10 shadow-2xl space-y-8"
                        >
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <Trash2 className="h-8 w-8 text-red-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black uppercase tracking-tight text-white">
                                        {deleteModal.type === 'LEAD' ? 'Eliminar Lead' : 'Vaciar Conversación'}
                                    </h3>
                                    <p className="text-xs font-bold text-white/30 uppercase tracking-widest leading-relaxed">
                                        {deleteModal.type === 'LEAD' 
                                            ? '¿Estás seguro de que deseas borrar este lead completamente? Se eliminarán todos sus mensajes y datos de memoria.' 
                                            : '¿Deseas vaciar todos los mensajes de esta conversación?'}
                                    </p>
                                </div>
                            </div>

                            {deleteModal.type === 'CHAT' && (
                                <div 
                                    onClick={() => setDeleteModal(prev => ({ ...prev, includeFacts: !prev.includeFacts }))}
                                    className={cn(
                                        "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                                        deleteModal.includeFacts ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )}
                                >
                                    <div className="space-y-0.5">
                                        <p className={cn("text-[10px] font-black uppercase tracking-widest", deleteModal.includeFacts ? "text-primary" : "text-slate-500 dark:text-white/40")}>Borrar Memoria IA</p>
                                        <p className="text-[9px] font-medium text-slate-400 dark:text-white/20">Eliminar variables capturadas (Facts)</p>
                                    </div>
                                    <div className={cn(
                                        "h-5 w-5 rounded flex items-center justify-center border transition-all",
                                        deleteModal.includeFacts ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10"
                                    )}>
                                        {deleteModal.includeFacts && <Check className="h-3 w-3" />}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button 
                                    onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                                    className="h-14 rounded-2xl bg-white/5 border border-white/5 font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="h-14 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-red-500 transition-all shadow-lg shadow-red-600/20"
                                >
                                    {deleteModal.type === 'LEAD' ? 'Eliminar Todo' : 'Confirmar'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
            `}</style>
        </div>
    );
}

// --- Sub-components ---
function TimelineItem({ label, time, status, icon: Icon, active, isLast }: { label: string, time: string, status: string, icon: LucideIcon, active?: boolean, isLast?: boolean }) {
    return (
        <div className="flex gap-4 relative">
            {!isLast && <div className={cn("absolute left-4 top-8 bottom-0 w-[1px]", active ? "bg-primary/20" : "bg-white/5")} />}
            <div className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center border transition-all z-10",
                active ? "bg-primary/10 border-primary/20 text-primary" : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400 dark:text-white/10"
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 pb-4">
                <div className="flex items-center justify-between mb-1">
                    <p className={cn("text-[11px] font-black uppercase tracking-widest", active ? "text-slate-900 dark:text-white/80" : "text-slate-400 dark:text-white/20")}>{label}</p>
                    <span className={cn("text-[9px] font-bold uppercase", active ? "text-primary/60" : "text-slate-300 dark:text-white/10")}>{status}</span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-white/20 font-medium">{time}</p>
            </div>
        </div>
    );
}

function TemplateCard({ name, description, status, onClick }: { name: string, description: string, status?: string, onClick: () => void }) {
    return (
        <button 
            title={`Usar plantilla ${name}`}
            onClick={onClick}
            className="w-full p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all text-left flex flex-col gap-3 group"
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{name}</span>
                {status && (
                    <span className={cn(
                        "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter border",
                        status === 'APPROVED' ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500" : "bg-white/10 border-white/20 text-slate-400 dark:text-white/20"
                    )}>{status}</span>
                )}
                <Send className="h-3.5 w-3.5 text-slate-300 dark:text-white/10 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-[12px] text-slate-500 dark:text-white/40 leading-relaxed font-medium group-hover:text-white transition-colors">{description}</p>
        </button>
    );
}

function DetailField({ 
    label, 
    value, 
    icon: Icon, 
    copyable, 
    editable, 
    onSave 
}: { 
    label: string, 
    value: string, 
    icon: LucideIcon, 
    copyable?: boolean, 
    editable?: boolean, 
    onSave?: (val: string) => Promise<void> 
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setEditValue(value);
    }, [value]);

    const handleSave = async () => {
        if (!onSave) return;
        setIsSaving(true);
        await onSave(editValue);
        setIsSaving(false);
        setIsEditing(false);
    };

    return (
        <div className="space-y-2 group">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3 text-slate-400 dark:text-white/20" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">{label}</span>
                </div>
                {editable && !isEditing && (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="text-[9px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        Editar
                    </button>
                )}
            </div>
            <div className={cn(
                "w-full p-4 rounded-2xl bg-slate-100/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 flex items-center justify-between group-hover:bg-slate-100 dark:group-hover:bg-white/5 transition-colors",
                copyable && !isEditing && "cursor-pointer"
            )}>
                {isEditing ? (
                    <div className="flex-1 flex items-center gap-3">
                        <input 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder={`Editar ${label.toLowerCase()}...`}
                            aria-label={`Editar ${label}`}
                            className="flex-1 bg-transparent border-none text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                            autoFocus
                        />
                        <button 
                            disabled={isSaving}
                            title="Guardar cambios"
                            onClick={handleSave}
                            className="h-7 w-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin"/> : <Save className="h-3 w-3" />}
                        </button>
                        <button 
                            title="Cancelar"
                            onClick={() => { setIsEditing(false); setEditValue(value); }}
                            className="h-7 w-7 rounded-lg bg-white/5 text-slate-500 dark:text-white/40 flex items-center justify-center hover:bg-white/10"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ) : (
                    <>
                        <span className="text-sm font-bold text-slate-900 dark:text-white/80">{value}</span>
                        {copyable && <Paperclip className="h-3 w-3 text-slate-300 dark:text-white/10 group-hover:text-primary transition-colors" />}
                    </>
                )}
            </div>
        </div>
    );
}


interface MetaTemplate {
    name: string;
    components?: Array<{
        type: string;
        text?: string;
    }>;
}

function ChatMessageBubble({ message, templates = [] }: { message: ChatMessage; templates?: MetaTemplate[] }) {
    const isOut = message.direction === "OUTBOUND";
    const isBot = message.sent_by?.toLowerCase().includes("agente") || message.message_type === "TEMPLATE";
    const time = new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

    // --- Template Parsing ---
    const isTemplate = message.message_type === "TEMPLATE";
    let displayContent = message.content;

    if (isTemplate) {
        // Try to find the template in the loaded list to get the actual body text
        const template = templates.find(t => t.name === message.content);
        if (template) {
            // Meta structure: components[type=BODY].text
            const bodyComp = template.components?.find(c => c.type === 'BODY');
            if (bodyComp?.text) {
                displayContent = bodyComp.text;
            }
        }
    }

    if (message.message_type === "SYSTEM_LOG") {
        return (
            <div className="flex justify-center my-6">
                <div className="max-w-md px-5 py-3 bg-white/[0.01] border border-white/[0.03] rounded-2xl text-[10px] font-bold tracking-widest text-slate-300 dark:text-white/10 flex items-center gap-4 group/log hover:bg-white/[0.03] transition-all">
                    <div className="h-[1px] w-6 bg-white/5 rounded-full" />
                    <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-primary/20 group-hover/log:text-primary/40 transition-colors" />
                        <span className="leading-tight uppercase">{message.content}</span>
                    </div>
                    <div className="h-[1px] w-6 bg-white/5 rounded-full" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex group animate-in fade-in slide-in-from-bottom-2 duration-500", isOut ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[65%] relative flex flex-col gap-2",
                isOut ? "items-end" : "items-start"
            )}>
                {/* Meta Indicator */}
                <div className={cn(
                    "flex items-center gap-2 mb-1 px-2",
                    isOut ? "flex-row-reverse" : "flex-row"
                )}>
                    {isOut ? (
                        <>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/20">
                                {isTemplate ? "Plantilla Meta" : isBot ? "Neural Agent" : "Asesor Senior"}
                            </span>
                            {isBot ? (
                                <div className={cn(
                                    "h-4 w-4 rounded-md flex items-center justify-center border",
                                    isTemplate ? "bg-emerald-500/20 border-emerald-500/20 text-emerald-500" : "bg-primary/20 border-primary/20 text-primary"
                                )}>
                                    <Bot className="h-2.5 w-2.5" />
                                </div>
                            ) : (
                                <User className="h-3 w-3 text-slate-400 dark:text-white/20" />
                            )}
                        </>
                    ) : (
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/20">Prospecto Validado</span>
                    )}
                </div>

                <div className={cn(
                    "px-6 py-4 rounded-[28px] shadow-2xl relative group/bubble transition-all duration-300",
                    isOut 
                        ? (isTemplate ? "bg-emerald-50 dark:bg-[#0b1410] border border-emerald-500/20 rounded-tr-none text-slate-900 dark:text-white/90" : "bg-slate-100 dark:bg-[#111622] border border-slate-200 dark:border-white/10 rounded-tr-none text-slate-900 dark:text-white/90 hover:border-slate-300 dark:hover:border-white/20")
                        : "bg-blue-600 dark:bg-primary rounded-tl-none text-white font-medium shadow-[0_10px_40px_rgba(var(--primary-rgb),0.2)]"
                )}>
                    {isTemplate && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-500/50">
                            <Star className="h-3 w-3" />
                            <span>Contenido de Plantilla</span>
                        </div>
                    )}
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{displayContent}</p>
                    
                    {/* Status Icons */}
                    <div className={cn(
                        "flex items-center gap-2 mt-3 pt-2 border-t border-white/[0.05]",
                        isOut ? "justify-end" : "justify-start"
                    )}>
                        <span className="text-[9px] opacity-30 font-bold tabular-nums uppercase tracking-widest">{time}</span>
                        {isOut && (
                            <div className="flex items-center ml-1">
                                {message.status === 'READ' ? (
                                    <CheckCheck className="h-3 w-3 text-emerald-400 opacity-80" />
                                ) : (
                                    <Check className="h-3 w-3 opacity-40" />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

