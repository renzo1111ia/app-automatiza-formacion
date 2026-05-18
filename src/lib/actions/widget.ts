"use server";

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { WebWidget, AIAgentVariant } from "@/types/database";
import OpenAI from "openai";
import { ChatMemoryService } from "@/lib/services/chat-memory";
import { KnowledgeBaseService, ChatSummaryService } from "@/lib/services/knowledge-base";
import { FactExtractionService } from "@/lib/services/fact-extractor";

export async function getWebWidgetConfig(id: string) {
    const supabase = await getAdminSupabaseClient();
    const { data, error } = await supabase
        .from("web_widgets")
        .select("*")
        .eq("id", id)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WebWidget };
}

interface ChatbotRequest {
    widgetId: string;
    leadId: string | null;
    message: string;
    knownVariables?: Record<string, string>;
}

export async function getChatbotResponse({ widgetId, leadId, message, knownVariables }: ChatbotRequest) {
    console.log(`[WIDGET AI] 🤖 Message from widget ${widgetId} for lead ${leadId}`);

    try {
        const supabase = await getAdminSupabaseClient();

        // 1. Get Widget & Agent Context
        const { data: widgetData, error: widgetError } = await supabase.from("web_widgets").select("*").eq("id", widgetId).single();
        if (widgetError || !widgetData) return { success: false, error: "Widget not found" };

        const widget = widgetData as WebWidget;
        const agentId = widget.agent_id;
        if (!agentId) return { success: false, error: "No agent assigned to this widget" };

        const { data: variantsData } = await supabase
            .from("ai_agent_variants")
            .select("*")
            .eq("agent_id", agentId)
            .eq("is_active", true)
            .limit(1);

        if (!variantsData || variantsData.length === 0) return { success: false, error: "No active agent variant" };
        const activeVariant = variantsData[0] as AIAgentVariant;
        const apiKey = activeVariant.api_key || process.env.OPENAI_API_KEY;
        if (!apiKey) return { success: false, error: "API Key missing" };

        // 2. Resolve or Create Lead
        let currentLeadId = leadId;
        let leadData: Record<string, any> | null = null;

        if (currentLeadId) {
            const { data: lead } = await supabase.from("lead").select("*").eq("id", currentLeadId).single();
            if (lead) leadData = lead as Record<string, any>;
        }

        if (!leadData) {
            const email = knownVariables?.email;
            const phone = knownVariables?.telefono || knownVariables?.phone;

            if (email || phone) {
                let query = supabase.from("lead").select("*");
                if (email) query = query.eq("email", email);
                else if (phone) query = query.eq("telefono", phone);
                
                const { data: existingLeads } = await query.limit(1);
                if (existingLeads && existingLeads.length > 0) {
                    leadData = existingLeads[0] as Record<string, any>;
                    currentLeadId = leadData.id;
                }
            }
        }

        const leadUpdates = {
            tenant_id: widget.tenant_id,
            origen: "WEB_WIDGET",
            campana: widget.name,
            ai_agent_id: agentId,
            ...knownVariables
        };

        if (currentLeadId) {
            await supabase.from("lead").update(leadUpdates as never).eq("id", currentLeadId);
        } else {
            const { data: newLead } = await supabase.from("lead").insert([leadUpdates] as never).select().single();
            if (newLead) {
                leadData = newLead as Record<string, any>;
                currentLeadId = leadData.id;
            }
        }

        if (!currentLeadId) return { success: false, error: "Could not resolve lead" };

        // 3. Prepare AI Context
        const recentHistory = await ChatMemoryService.getRecentContext(currentLeadId);
        const chatSummary = await ChatSummaryService.getSummary(currentLeadId);
        
        let localKnowledge = "";
        try {
            const openai = new OpenAI({ apiKey });
            const embedRes = await openai.embeddings.create({ model: "text-embedding-3-small", input: message });
            const kbResults = await KnowledgeBaseService.search(widget.tenant_id, embedRes.data[0].embedding, 0.4, 3);
            localKnowledge = kbResults.map(r => `- ${r.content}`).join("\n");
        } catch {
            // KB error fallback
        }

        const variableMap: Record<string, string | number | boolean | null> = {
            nombre: leadData?.nombre || knownVariables?.nombre || 'usuario',
            email: leadData?.email || knownVariables?.email || '',
            telefono: leadData?.telefono || knownVariables?.telefono || '',
            ...(leadData?.metadata as Record<string, any> || {}),
            ...knownVariables
        };

        let finalPrompt = activeVariant.prompt_text;
        Object.keys(variableMap).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, "g");
            finalPrompt = finalPrompt.replace(regex, String(variableMap[key] || ""));
        });

        const aiFacts = Object.entries(variableMap)
            .filter(([key, val]) => !!val && key !== "id")
            .map(([key, val]) => `- ${key}: ${val}`)
            .join("\n");

        const systemPrompt = `
${finalPrompt}

IMPORTANT: You are interacting via a WEB CHAT WIDGET that looks like WhatsApp. 
The following information is ALREADY KNOWN about the user. DO NOT ask for it:
${aiFacts}

KNOWLEDGE BASE:
${localKnowledge || "No specific info."}

SUMMARY:
${chatSummary || "New interaction."}
`;

        // 4. Call LLM
        let modelName = activeVariant.model_name || "gpt-4o";
        if (modelName === "gpt-4.1") modelName = "gpt-4o";
        if (modelName === "gpt-4.1-mini") modelName = "gpt-4o-mini";

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                ...recentHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
                { role: "user", content: message }
            ],
            temperature: 0.7
        });

        const aiResponse = completion.choices[0]?.message?.content || "";

        if (aiResponse) {
            // 5. Update Memory
            await ChatMemoryService.addMessage(currentLeadId, 'user', message);
            await ChatMemoryService.addMessage(currentLeadId, 'assistant', aiResponse);

            // 6. Log to chat_messages
            await supabase.from("chat_messages").insert({
                tenant_id: widget.tenant_id,
                lead_id: currentLeadId,
                direction: "INBOUND",
                message_type: "TEXT",
                content: message,
                status: "READ",
                metadata: { source: "WEB_WIDGET", widget_id: widgetId }
            } as never);

            await supabase.from("chat_messages").insert({
                tenant_id: widget.tenant_id,
                lead_id: currentLeadId,
                direction: "OUTBOUND",
                message_type: "TEXT",
                content: aiResponse,
                sent_by: "AI_WIDGET",
                status: "SENT",
                metadata: { source: "WEB_WIDGET", widget_id: widgetId, variant_id: activeVariant.id }
            } as never);

            // 7. Extract Facts
            const trackedVars = (activeVariant.tracked_variables as string[]) || [];
            if (trackedVars.length > 0) {
                FactExtractionService.extractFromDialogue(currentLeadId, `User: ${message}\nAI: ${aiResponse}`, trackedVars, apiKey).catch(err => console.error(err));
            }

            return { success: true, content: aiResponse, leadId: currentLeadId };
        }

        return { success: false, error: "Empty AI response" };
    } catch (err: unknown) {
        console.error("[WIDGET AI] Error:", err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
