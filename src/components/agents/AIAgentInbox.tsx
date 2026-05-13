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
import { getActiveTenantConfig, updateTenantConfig } from "@/lib/actions/tenant";


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
    
    // Config
    const [segmentations, setSegmentations] = useState<string[]>(['PUESTO 1', 'REVISADO', 'CUALIFICADO', 'SIN INTERÉS']);
    const [isEditingSegments, setIsEditingSegments] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
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

    // AI Typing Indicator State
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 2000);
        return () => clearInterval(interval);
    }, []);

    // --- Data Loading ---
    const loadLeads = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Pass tenantId from state to ensure we bypass any cookie lag
            const currentTenantId = useTenantStore.getState().tenantId;
            const res = await getInboxLeads(currentTenantId || undefined);
            if (res.success && typeof res.data !== 'undefined') {
                const newLeads = res.data;
                setLeads(newLeads);

                // 🔄 Sync selectedLead if it's currently open
                if (selectedLeadRef.current) {
                    const updatedLead = newLeads.find(l => l.id === selectedLeadRef.current?.id);
                    if (updatedLead) {
                        // Only update if there's an actual change in metadata or status
                        if (JSON.stringify(updatedLead.metadata) !== JSON.stringify(selectedLeadRef.current.metadata) || 
                            updatedLead.tipo_lead !== selectedLeadRef.current.tipo_lead ||
                            updatedLead.segmentacion !== selectedLeadRef.current.segmentacion) {
                            setSelectedLead(updatedLead);
                        }
                    }
                }
            } else if (res.error) {
                console.error("[INBOX] Error loading leads:", res.error);
            }
        } catch (error) {
            console.error("[INBOX] Critical exception in loadLeads:", error);
        } finally {
            if (!silent) setLoading(false);
        }
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
            try {
                // Fetch config
                getActiveTenantConfig().then(config => {
                    if (config?.config?.segmentations) {
                        setSegmentations(config.config.segmentations as string[]);
                    }
                }).catch(e => console.error(e));

                await Promise.all([
                    loadLeads(),
                    loadTemplates(),
                    loadAvailableAgents()
                ]);
            } catch (err) {
                console.error("[INBOX] Initial fetch failed:", err);
            }
        };
        runInitialFetch();

        // 🛡️ Polling Fallback: Check for new messages/leads every 30 seconds
        // Use a recursive timeout to prevent overlapping requests if the network is slow
        let timerId: NodeJS.Timeout;
        const poll = async () => {
            console.log("[POLLING] Syncing inbox...");
            await loadLeads(true); // Silent update
            timerId = setTimeout(poll, 10000);
        };
        
        timerId = setTimeout(poll, 10000);

        return () => clearTimeout(timerId);
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
                    const row = payload.new as { summary: string; lead_id: string };
                    const newSummary = row.summary;
                    const leadId = row.lead_id;

                    if (selectedLeadRef.current?.id === leadId) {
                        const lines = newSummary.split('\n').filter((l: string) => l.trim());
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
                    const lines = newSummary.split('\n').filter((l: string) => l.trim());
                    const lastLine = lines[lines.length - 1];
                    const lastMatch = lastLine?.match(/^\[(.*?)\] (.*?): (.*)$/);
                    
                    if (lastMatch) {
                        const [, , , content] = lastMatch;
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
                        tenant_id: tenantId as string,
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
        
        // Detect variables in BODY and HEADER (Case-insensitive)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyComponent = tpl?.components?.find((c: any) => c.type?.toUpperCase() === "BODY");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headerComponent = tpl?.components?.find((c: any) => c.type?.toUpperCase() === "HEADER");

        const bodyText = bodyComponent?.text || "";
        const headerText = headerComponent?.text || "";

        const bodyVarCount = (bodyText.match(/{{[0-9]+}}/g) || []).length;
        const headerVarCount = (headerText.match(/{{[0-9]+}}/g) || []).length;

        console.log(`[TEMPLATE DEBUG] ${templateName}: BodyVars=${bodyVarCount}, HeaderVars=${headerVarCount}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const components: any[] = [];
        
        // 1. Handle Header Parameters
        if (headerVarCount > 0) {
            const headerParams = [];
            for (let i = 1; i <= headerVarCount; i++) {
                headerParams.push({ type: "text", text: selectedLead.nombre || "Cliente" });
            }
            components.push({ type: "header", parameters: headerParams });
        }

        // 2. Handle Body Parameters
        // If we detect variables OR if we have no component info (cache fail), 
        // we send at least the name as a safety measure for {{1}}
        if (bodyVarCount > 0 || (!bodyComponent && selectedLead.nombre)) {
            const bodyParams = [];
            const count = bodyVarCount > 0 ? bodyVarCount : 1; 
            
            for (let i = 1; i <= count; i++) {
                let val = "";
                if (i === 1) val = selectedLead.nombre || "Cliente";
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                else if (i === 2) val = (selectedLead.metadata as any)?.course_name || (selectedLead.metadata as any)?.curso || "nuestro programa";
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                else if (i === 3) val = (selectedLead.metadata as any)?.appointment_date || "próximamente";
                else val = "...";
                bodyParams.push({ type: "text", text: val });
            }
            components.push({ type: "body", parameters: bodyParams });
        }

        console.log(`[TEMPLATE DEBUG] Sending components:`, JSON.stringify(components, null, 2));

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
            <div className="h-screen bg-background flex flex-col">
                <div className="h-16 px-8 border-b border-border flex items-center justify-between bg-card/40">
                    <div className="flex items-center gap-3">
                        <GitBranch className="h-5 w-5 text-primary" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Constructor de Lógica IA</h2>
                    </div>
                    <button 
                        title="Cerrar constructor de lógica"
                        onClick={() => setActiveView('INBOX')}
                        className="h-10 w-10 rounded-full hover:bg-card flex items-center justify-center transition-all bg-card/40 border border-border"
                    >
                        <X className="h-5 w-5 text-foreground" />
                    </button>
                </div>
                <div className="flex-1 relative">
                    {loadingFlow ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-xl z-50">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Cargando Red Neuronal...</p>
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
    }
    
    // Compute AI Typing state
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const isAITyping = selectedLead?.is_ai_enabled && 
                       lastMessage?.direction === 'INBOUND' && 
                       (now - new Date(lastMessage.created_at).getTime() < 15000);

    return (
        <div className="h-full flex text-foreground selection:bg-primary/30 font-sans overflow-hidden">
            
            {/* ─── COLUMN 1: CONVERSATION LIST (Standard 320px) ───────────────────────── */}
            <div className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-card/40 backdrop-blur-3xl z-20">
                <div className="h-16 px-6 border-b border-border flex items-center justify-between bg-card/20">
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground dark:text-primary">Conversaciones</h2>
                        <div className="px-2 py-0.5 rounded-full bg-background/80 text-[10px] font-black text-foreground/60 dark:text-primary border border-border dark:border-primary/20">{leads.length}</div>
                    </div>
                    <div className="flex items-center gap-1 relative">
                        <button 
                            title="Filtrar" 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center transition-all border shadow-sm",
                                isFilterOpen || segmentFilter || aiFilter !== null 
                                    ? "bg-primary text-primary-foreground border-primary/20" 
                                    : "bg-card border-border text-muted-foreground hover:bg-card/60"
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
                                    className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-2xl p-4 z-50 space-y-4"
                                >
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Segmentación</p>
                                        <div className="flex flex-wrap gap-1">
                                            {['PUESTO 1', 'REVISADO', 'CUALIFICADO', 'SIN INTERÉS'].map(s => (
                                                <button 
                                                    key={s}
                                                    onClick={() => setSegmentFilter(segmentFilter === s ? null : s)}
                                                    className={cn(
                                                        "px-2 py-1 rounded-md text-[9px] font-bold border transition-all",
                                                        segmentFilter === s 
                                                            ? "bg-primary border-primary/20 text-primary-foreground" 
                                                            : "bg-card/40 border-border text-muted-foreground hover:bg-card/60"
                                                    )}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Estado de Agente</p>
                                        <div className="grid grid-cols-2 gap-1">
                                            <button 
                                                onClick={() => setAiFilter(aiFilter === true ? null : true)}
                                                className={cn(
                                                    "px-2 py-1 rounded-md text-[9px] font-bold border transition-all text-center",
                                                    aiFilter === true 
                                                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500" 
                                                        : "bg-card/40 border-border text-muted-foreground hover:bg-card/60"
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
                                                        : "bg-card/40 border-border text-muted-foreground hover:bg-card/60"
                                                )}
                                            >
                                                IA PAUSADA
                                            </button>
                                        </div>
                                    </div>

                                    {(segmentFilter || aiFilter !== null) && (
                                        <button 
                                            onClick={() => { setSegmentFilter(null); setAiFilter(null); }}
                                            className="w-full py-2 rounded-xl bg-card border border-border hover:bg-card/60 text-[9px] font-black uppercase tracking-widest text-muted-foreground transition-all"
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

                <div className="p-4 bg-card border-b border-border">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
                        <input 
                            placeholder="Buscar prospectos..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 bg-background/50 border border-border rounded-xl pl-11 pr-4 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40 text-foreground"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-black/5">
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
                                    "w-full px-6 py-4 flex items-center gap-4 transition-all text-left relative group border-b border-border/20",
                                    selectedLead?.id === lead.id ? "bg-primary/10" : "hover:bg-card/40"
                                )}
                            >
                                {selectedLead?.id === lead.id && <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)] rounded-r-full" />}
                                
                                <div className="h-12 w-12 rounded-2xl bg-card border border-border flex items-center justify-center flex-shrink-0 relative overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-300">
                                    {lead.foto_url ? (
                                        <Image src={lead.foto_url} alt={lead.nombre || ""} width={48} height={48} className="h-full w-full object-cover" unoptimized />
                                    ) : (
                                        <User className="h-6 w-6 text-muted-foreground/20" />
                                    )}
                                    <div className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" title="WhatsApp Activo" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <p className="text-[13px] font-black truncate tracking-tight text-foreground">
                                            {lead.nombre || lead.apellido ? `${lead.nombre || ''} ${lead.apellido || ''}` : lead.telefono || "Sin Nombre"}
                                        </p>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                            {formatTime(lead.last_message_time || undefined)}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "text-[11px] truncate font-medium",
                                        lead.unread_count ? "text-primary font-black" : "text-muted-foreground/60"
                                    )}>
                                        {lead.last_message || "Esperando interacción..."}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ─── COLUMN 2: MAIN CHAT AREA (Flexible Container) ───────────────────────── */}
            <div className="flex-1 flex flex-col bg-background relative border-r border-border shadow-2xl z-10 min-w-0">
                <div className={cn(
                    "h-16 border-b border-border flex items-center justify-between bg-card/60 backdrop-blur-3xl transition-all duration-300",
                    showDetails ? "px-4" : "px-8"
                )}>
                    <div className={cn("flex items-center", showDetails ? "gap-3" : "gap-6")}>
                        {selectedLead ? (
                            <>
                                <div className="h-10 w-10 rounded-2xl bg-card flex items-center justify-center flex-shrink-0 border border-border shadow-sm overflow-hidden group">
                                     {selectedLead.foto_url ? (
                                        <Image src={selectedLead.foto_url} alt="" width={40} height={40} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" unoptimized />
                                    ) : (
                                        <User className="h-5 w-5 text-muted-foreground/20" />
                                    )}
                                </div>
                                
                                <div className="flex flex-col gap-0 min-w-0">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <h2 className="text-[15px] font-black text-foreground leading-tight truncate tracking-tight shrink">
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
                                    <div className="flex items-center gap-2 text-muted-foreground/60">
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
                                        ? "bg-primary border-primary/20 text-primary-foreground" 
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
                                        "h-9 bg-card/40 border border-border rounded-xl text-[9px] font-black uppercase tracking-widest text-primary focus:outline-none focus:border-primary/20 appearance-none cursor-pointer disabled:opacity-50 transition-all",
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
                                    "h-9 w-9 rounded-xl flex items-center justify-center transition-all border shadow-sm",
                                    showDetails ? "bg-primary/20 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground hover:bg-card/60"
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
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground">AI Omnichannel</h2>
                            <p className="text-[9px] uppercase tracking-[0.3em] font-black mt-2 text-muted-foreground">Selecciona un chat para comenzar</p>
                        </div>
                    ) : loadingChat ? (
                        <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        <>
                            {messages.map((msg) => (
                                <ChatMessageBubble 
                                    key={msg.id} 
                                    message={msg} 
                                    templates={templates}
                                />
                            ))}
                            {isAITyping && (
                                <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex gap-4 max-w-[85%] items-end">
                                        <div className="h-8 w-8 rounded-2xl flex-shrink-0 bg-primary/20 border border-primary/40 flex items-center justify-center">
                                            <Bot className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="rounded-2xl rounded-bl-sm px-5 py-4 bg-card/60 border border-border shadow-sm flex items-center gap-1 h-11">
                                            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input Area */}
                {selectedLead && (
                    <div className="p-8 bg-card/80 backdrop-blur-2xl border-t border-border">
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
                                    className="h-9 px-4 rounded-xl bg-card border border-border flex items-center gap-2 hover:bg-card/60 transition-all text-[9px] font-black uppercase tracking-widest text-muted-foreground/60"
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
                                        "w-full bg-background border border-border rounded-2xl px-6 py-4 pr-32 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[60px] max-h-40 custom-scrollbar resize-none text-foreground",
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
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary-foreground">Enviar</span>
                                        <Send className="h-3.5 w-3.5 text-primary-foreground" />
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
                        className="w-80 flex-shrink-0 flex flex-col border-l border-border bg-card relative z-30 h-full overflow-hidden"
                    >
                        <div className="h-16 px-8 border-b border-border flex items-center justify-between bg-card/20">
                            <span className="text-[11px] font-black uppercase tracking-widest text-primary">Detalles del Lead</span>
                            <button 
                                title="Cerrar detalles"
                                onClick={() => setShowDetails(false)} 
                                className="text-muted-foreground/40 hover:text-primary h-8 w-8 flex items-center justify-center rounded-lg hover:bg-card transition-all"
                            >
                                <X className="h-4 w-4"/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
                            {/* Profile Header */}
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="h-24 w-24 rounded-[32px] bg-card border-2 border-primary/20 p-1 shadow-2xl">
                                    <div className="h-full w-full rounded-[28px] overflow-hidden">
                                        {selectedLead.foto_url ? (
                                            <Image src={selectedLead.foto_url} alt="" width={96} height={96} className="h-full w-full object-cover" unoptimized />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center"><User className="h-8 w-8 text-muted-foreground/20" /></div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[16px] font-black tracking-tight text-foreground">{selectedLead.nombre ? `${selectedLead.nombre} ${selectedLead.apellido || ''}` : selectedLead.telefono}</h3>
                                    <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-[0.2em] mt-1">{selectedLead.tipo_lead || 'LEAD SIN REVISAR'}</p>
                                </div>
                            </div>

                            {/* Segmentation Panel */}
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Segmentación</p>
                                        <button 
                                            onClick={() => setIsEditingSegments(!isEditingSegments)}
                                            className="text-[9px] font-bold text-primary hover:text-primary/80 transition-colors uppercase"
                                        >
                                            {isEditingSegments ? "Guardar" : "Editar"}
                                        </button>
                                    </div>
                                    
                                    {isEditingSegments ? (
                                        <div className="space-y-2">
                                            {segmentations.map((seg, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input 
                                                        value={seg}
                                                        onChange={(e) => {
                                                            const newSegs = [...segmentations];
                                                            newSegs[idx] = e.target.value;
                                                            setSegmentations(newSegs);
                                                        }}
                                                        placeholder="Nombre del segmento"
                                                        title={`Editar segmento ${seg}`}
                                                        className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-primary/50"
                                                    />
                                                    <button 
                                                        onClick={() => setSegmentations(segmentations.filter((_, i) => i !== idx))}
                                                        title={`Eliminar segmento ${seg}`}
                                                        aria-label={`Eliminar segmento ${seg}`}
                                                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="flex gap-2 pt-2">
                                                <button 
                                                    onClick={() => setSegmentations([...segmentations, "NUEVO SEGMENTO"])}
                                                    className="flex-1 h-8 rounded-lg bg-card border border-border border-dashed text-[9px] font-black uppercase text-muted-foreground hover:bg-card/60 flex items-center justify-center gap-1"
                                                >
                                                    <PlusCircle className="h-3 w-3" /> Añadir
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        const cleanSegs = segmentations.map(s => s.trim().toUpperCase()).filter(Boolean);
                                                        setSegmentations(cleanSegs);
                                                        setIsEditingSegments(false);
                                                        if (tenantId) {
                                                            await updateTenantConfig(tenantId, { segmentations: cleanSegs });
                                                        }
                                                    }}
                                                    className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-[9px] font-black uppercase hover:bg-primary/90"
                                                >
                                                    Confirmar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {segmentations.map((seg) => (
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
                                                            ? "bg-primary border-primary/20 text-primary-foreground shadow-lg shadow-primary/20" 
                                                            : "bg-card/40 border-border text-muted-foreground hover:bg-card/60"
                                                    )}
                                                >
                                                    {seg}
                                                </button>
                                            ))}
                                        </div>
                                    )}
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
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Variables Capturadas</p>
                                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-tighter animate-pulse">Live</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {typeof selectedLead.metadata?.last_fact_update === 'string' && (
                                            <span className="text-[8px] font-bold text-muted-foreground/20 italic">
                                                v{new Date(selectedLead.metadata.last_fact_update as string).toLocaleTimeString()}
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
                                </div>

                                {/* Build unified list: all metadata keys + pending tracked vars */}
                                {(() => {
                                    const meta = selectedLead.metadata || {};
                                    const SKIP_KEYS = new Set(['last_fact_update', 'meta_id', 'raw', 'media_url']);
                                    
                                    // 1. All captured keys from metadata (excluding system keys)
                                    // Deduplicate case-insensitively for the UI
                                    const rawKeys = Object.keys(meta).filter(k => 
                                        !SKIP_KEYS.has(k) && String(meta[k]).trim() !== ''
                                    );
                                    
                                    const capturedKeys: string[] = [];
                                    const seenKeys = new Set<string>();
                                    // We process in order, but deduplicate by lowercase
                                    rawKeys.forEach(k => {
                                        if (!seenKeys.has(k.toLowerCase())) {
                                            capturedKeys.push(k);
                                            seenKeys.add(k.toLowerCase());
                                        }
                                    });

                                    // 2. Pending tracked vars (those NOT already in metadata)
                                    const pendingVars = trackedVariables
                                        .map(v => v.replace(/^\{\{|\}\}$/g, '').trim())
                                        .filter(k => {
                                            const found = Object.keys(meta).find(mk => 
                                                mk.toLowerCase() === k.toLowerCase() ||
                                                mk.toLowerCase() === `{{${k.toLowerCase()}}}`
                                            );
                                            return !found && String(meta[k] ?? '').trim() === '';
                                        });

                                    const hasAnything = capturedKeys.length > 0 || pendingVars.length > 0;

                                    if (!hasAnything) {
                                        return (
                                            <div className="p-4 rounded-2xl bg-card border border-border border-dashed text-center">
                                                <p className="text-[9px] font-bold text-muted-foreground/20 uppercase tracking-widest">Sin datos capturados aún</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-2">
                                            {/* Captured (green) */}
                                            {capturedKeys.map((key) => (
                                                <div
                                                    key={key}
                                                    className="px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 bg-emerald-500/[0.05] border-emerald-500/15 hover:bg-emerald-500/10 transition-colors"
                                                >
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className="text-[8px] font-black uppercase tracking-tighter text-emerald-500/50">
                                                            {'{{'}{key}{'}}'}
                                                        </span>
                                                        <span className="text-[11px] font-bold truncate text-emerald-400">
                                                            {String(meta[key])}
                                                        </span>
                                                    </div>
                                                    <div className="h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                                                        <Check className="h-2.5 w-2.5 text-emerald-500" />
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Pending tracked vars (gray) */}
                                            {pendingVars.map((key) => (
                                                <div
                                                    key={key}
                                                    className="px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 bg-card border-border transition-colors"
                                                >
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground/20">
                                                            {'{{'}{key}{'}}'}
                                                        </span>
                                                        <span className="text-[11px] font-bold truncate text-muted-foreground/20 italic">
                                                            Pendiente...
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}

                                            <button 
                                                onClick={() => setIsProfileModalOpen(true)}
                                                className="w-full py-2 rounded-xl border border-dashed border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 hover:bg-card/60 hover:text-primary transition-all"
                                            >
                                                Ver Perfil Completo
                                            </button>
                                        </div>
                                    );
                                })()}
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

                        <div className="p-8 border-t border-border bg-card/40 space-y-4">
                              <button 
                                onClick={() => setIsProfileModalOpen(true)}
                                className="w-full h-12 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all text-[10px] font-black uppercase tracking-widest text-primary shadow-sm"
                              >
                                  Ver Perfil Completo
                              </button>
                              <button 
                                onClick={handleDeleteLead}
                                className="w-full h-12 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center justify-center gap-2 shadow-sm"
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
                            className="relative w-full max-w-xl bg-card border border-border rounded-[40px] p-10 shadow-2xl space-y-8 text-foreground"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black uppercase tracking-tight">Plantillas Meta</h3>
                                    <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">Verificación Cloud API de WhatsApp</p>
                                </div>
                                <button title="Cerrar modal" onClick={() => setIsTemplateModalOpen(false)} className="h-12 w-12 flex items-center justify-center rounded-2xl hover:bg-card"><X className="h-6 w-6 text-muted-foreground/40"/></button>
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
                            className="relative w-full max-w-md bg-card border border-border rounded-[40px] p-10 shadow-2xl space-y-8"
                        >
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <Trash2 className="h-8 w-8 text-red-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
                                        {deleteModal.type === 'LEAD' ? 'Eliminar Lead' : 'Vaciar Conversación'}
                                    </h3>
                                    <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest leading-relaxed">
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
                                        deleteModal.includeFacts ? "bg-primary/10 border-primary/20" : "bg-background border-border hover:bg-card/60"
                                    )}
                                >
                                    <div className="space-y-0.5">
                                        <p className={cn("text-[10px] font-black uppercase tracking-widest", deleteModal.includeFacts ? "text-primary" : "text-muted-foreground/60")}>Borrar Memoria IA</p>
                                        <p className="text-[9px] font-medium text-muted-foreground/20">Eliminar variables capturadas (Facts)</p>
                                    </div>
                                    <div className={cn(
                                        "h-5 w-5 rounded flex items-center justify-center border transition-all",
                                        deleteModal.includeFacts ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border"
                                    )}>
                                        {deleteModal.includeFacts && <Check className="h-3 w-3" />}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button 
                                    onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                                    className="h-14 rounded-2xl bg-card border border-border font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 hover:bg-card/60 transition-all"
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
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
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
                active ? "bg-primary/10 border-primary/20 text-primary" : "bg-card border-border text-muted-foreground/20"
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 pb-4">
                <div className="flex items-center justify-between mb-1">
                    <p className={cn("text-[11px] font-black uppercase tracking-widest", active ? "text-foreground" : "text-muted-foreground/40")}>{label}</p>
                    <span className={cn("text-[9px] font-bold uppercase", active ? "text-primary/60" : "text-muted-foreground/20")}>{status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/40 font-medium">{time}</p>
            </div>
        </div>
    );
}

function TemplateCard({ name, description, status, onClick }: { name: string, description: string, status?: string, onClick: () => void }) {
    return (
        <button 
            title={`Usar plantilla ${name}`}
            onClick={onClick}
            className="w-full p-6 rounded-3xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left flex flex-col gap-3 group"
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{name}</span>
                {status && (
                    <span className={cn(
                        "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter border",
                        status === 'APPROVED' ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500" : "bg-card border-border text-muted-foreground/20"
                    )}>{status}</span>
                )}
                <Send className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed font-medium group-hover:text-foreground transition-colors">{description}</p>
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
                    <Icon className="h-3 w-3 text-muted-foreground/40" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{label}</span>
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
                "w-full p-4 rounded-2xl bg-card border border-border flex items-center justify-between group-hover:bg-card transition-colors",
                copyable && !isEditing && "cursor-pointer"
            )}>
                {isEditing ? (
                    <div className="flex-1 flex items-center gap-3">
                        <input 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder={`Editar ${label.toLowerCase()}...`}
                            aria-label={`Editar ${label}`}
                            className="flex-1 bg-transparent border-none text-sm font-bold text-foreground focus:outline-none"
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
                            className="h-7 w-7 rounded-lg bg-card text-muted-foreground/60 flex items-center justify-center hover:bg-card/60"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ) : (
                    <>
                        <span className="text-sm font-bold text-foreground/80">{value}</span>
                        {copyable && <Paperclip className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary transition-colors" />}
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
                <div className="max-w-md px-5 py-3 bg-card border border-border rounded-2xl text-[10px] font-bold tracking-widest text-muted-foreground/40 flex items-center gap-4 group/log hover:bg-card transition-all">
                    <div className="h-[1px] w-6 bg-border/20 rounded-full" />
                    <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-primary/20 group-hover/log:text-primary/40 transition-colors" />
                        <span className="leading-tight uppercase">{message.content}</span>
                    </div>
                    <div className="h-[1px] w-6 bg-border/20 rounded-full" />
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
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
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
                                <User className="h-3 w-3 text-muted-foreground/40" />
                            )}
                        </>
                    ) : (
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Prospecto Validado</span>
                    )}
                </div>

                <div className={cn(
                    "px-6 py-4 rounded-[28px] shadow-lg relative group/bubble transition-all duration-300",
                    isOut 
                        ? "bg-primary rounded-tr-none text-primary-foreground font-medium shadow-[0_10px_40px_rgba(var(--primary-rgb),0.2)]"
                        : (isTemplate ? "bg-emerald-500/10 border border-emerald-500/20 rounded-tl-none text-foreground" : "bg-card border border-border rounded-tl-none text-foreground hover:border-primary/20")
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

