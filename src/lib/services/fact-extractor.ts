import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { enqueueLeadStep } from "@/lib/core/queue/lead-sequence-queue";
import { evaluateLeadQualification } from "@/lib/core/intelligence/qualifier";
import { orchestrator } from "@/lib/core/orchestrator";

/**
 * FACT EXTRACTION SERVICE
 * Analyzes conversation to extract structured data based on tracked variables.
 * Variables are stored with {{}} but keys in metadata are stored without them.
 */
export class FactExtractionService {
    
    /**
     * Strips {{ }} from a variable name: "{{user_name}}" → "user_name"
     */
    private static normalizeKey(varName: string): string {
        return varName.replace(/^\{\{|\}\}$/g, "").trim();
    }

    /**
     * Analyzes the conversation to find values for tracked variables.
     * @param leadId - Lead ID to update
     * @param dialogue - Full or recent conversation text
     * @param varsToTrack - Array of variable names, e.g. ["{{user_name}}", "{{user_country}}"]
     * @param apiKey - OpenAI API key
     */
    static async extractFromDialogue(
        leadId: string, 
        dialogue: string, 
        varsToTrack: string[],
        apiKey: string,
        tenantId?: string,
        preFilledData?: Record<string, string>
    ) {
        if (!varsToTrack || varsToTrack.length === 0) return null;

        // Normalize: strip {{ }} so OpenAI returns clean JSON keys
        const normalizedKeys = varsToTrack.map(v => this.normalizeKey(v));

        console.log(`[FACT EXTRACTOR] 🧠 Extracting for lead ${leadId}: [${normalizedKeys.join(', ')}]`);

        try {
            if (!apiKey || apiKey === "your_api_key_here") {
                console.error(`[FACT EXTRACTOR] ❌ OpenAI API Key missing or invalid for lead ${leadId}`);
                return null;
            }
            const openai = new OpenAI({ apiKey });
            
            const systemPrompt = `Eres un extractor de datos ultra-preciso especializado en leads para educación (Esden Business School).
Analiza el diálogo y extrae la información relevante del perfil del lead.

CLAVES PRIORITARIAS: ${normalizedKeys.join(', ')}.

REGLAS CRÍTICAS:
1. Devuelve ÚNICAMENTE un JSON plano.
2. DISCOVERY: Además de las CLAVES PRIORITARIAS, si encuentras otros datos útiles (nombre real, email, ciudad, motivación, nivel de estudios, etc.), inclúyelos también en el JSON con nombres de clave descriptivos en español (ej: "nombre_completo", "interes_especifico").
3. FLOW ANALYSIS: Si te piden claves como "REGLA_APLICADA" o "QA_TOPIC", intenta deducirlas basándote en la lógica que el asistente está siguiendo en la conversación.
4. NO INVENTES: Si el usuario no ha mencionado algo, NO lo rellenes. Si no existe la información, omite la clave.
5. PRECISIÓN: Extrae valores específicos. Ejemplo: "Aprender marketing digital" en lugar de "Estudios".
6. "qualified": Siempre intenta evaluar si el lead está "SI", "NO" o "PENDIENTE" basándote en la conversación.
7. "user_name": Si el usuario dice su nombre, extráelo SIEMPRE.

EJEMPLO DE SALIDA:
{"user_name": "Carlos Ruiz", "user_profesion": "Arquitecto", "user_motivation": "Especialización en BIM", "qualified": "SI"}`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `CONVERSACIÓN:\n${dialogue}` }
                ],
                response_format: { type: "json_object" },
                temperature: 0,
                max_tokens: 200
            });

            const rawResult = completion.choices[0]?.message?.content;
            if (!rawResult) return null;

            const extractedData = JSON.parse(rawResult) as Record<string, unknown>;
            
            // 0. Start with pre-filled data (system variables)
            const result: Record<string, string> = { ...(preFilledData || {}) };
            
            // 1. Process tracked variables (maintaining their specific casing)
            // 2. Process EVERYTHING else the AI discovered (Discovery mode)
            Object.entries(extractedData).forEach(([key, val]) => {
                if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).toLowerCase() !== "unknown") {
                    // Find if this matches a tracked var (case-insensitive)
                    const trackedMatch = varsToTrack.find(v => this.normalizeKey(v).toLowerCase() === key.toLowerCase());
                    const finalKey = trackedMatch ? this.normalizeKey(trackedMatch) : key;
                    result[finalKey] = String(val);
                }
            });

            if (Object.keys(result).length > 0) {
                console.log(`[FACT_EXTRACTOR] ✅ Captured ${Object.keys(result).length} facts:`, result);
                await this.saveToLeadMetadata(leadId, result);

                // 🟢 TRIGGER CRM SYNC (ONE BY ONE LOGIC)
                if (tenantId) {
                    await enqueueLeadStep({
                        leadId,
                        tenantId,
                        action: "CRM_SYNC",
                        step: 0
                    });
                    console.log(`[FACT_EXTRACTOR] 🚀 CRM Sync enqueued for lead ${leadId}`);
                }

                return result;
            }

            console.log(`[FACT EXTRACTOR] ℹ️ No new data found in this exchange`);
            return null;
        } catch (err) {
            console.error("[FACT EXTRACTOR] ❌ Error:", err);
            return null;
        }
    }

    private static async saveToLeadMetadata(leadId: string, newData: Record<string, string>) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient<Database>(url!, key!, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        // 1. Get current metadata
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadFound } = await (supabase.from("lead") as any)
            .select("metadata, nombre, apellido, telefono")
            .eq("id", leadId)
            .single();
        
        const currentMetadata = (leadFound?.metadata as Record<string, unknown>) || {};
        
        // 2. Case-insensitive Merge: new data overwrites old values for same keys (regardless of case)
        const updatedMetadata = { ...currentMetadata };
        
        Object.entries(newData).forEach(([newKey, newVal]) => {
            const existingKey = Object.keys(updatedMetadata).find(
                k => k.toLowerCase() === newKey.toLowerCase()
            );
            if (existingKey) {
                updatedMetadata[existingKey] = newVal;
            } else {
                updatedMetadata[newKey] = newVal;
            }
        });

        updatedMetadata.last_fact_update = new Date().toISOString();

        // 3. Propagate name fields to main lead columns
        const mainUpdate: Record<string, unknown> = { metadata: updatedMetadata };
        
        // If user_name was captured, split into nombre/apellido
        if (newData.user_name) {
            const parts = newData.user_name.trim().split(' ');
            mainUpdate.nombre = parts[0];
            if (parts.length > 1) mainUpdate.apellido = parts.slice(1).join(' ');
        }
        // Legacy support for "nombre" key
        if (newData.nombre) {
            const parts = newData.nombre.trim().split(' ');
            mainUpdate.nombre = parts[0];
            if (parts.length > 1) mainUpdate.apellido = parts.slice(1).join(' ');
        }
        if (newData.apellido) {
            mainUpdate.apellido = newData.apellido;
        }
        // Propagate phone if captured
        if (newData.user_phone && !leadFound?.telefono) {
            mainUpdate.telefono = newData.user_phone;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("lead") as any)
            .update(mainUpdate)
            .eq("id", leadId);

        if (error) {
            console.error("[FACT EXTRACTOR] ❌ Failed to save metadata:", error.message);
        } else {
            console.log(`[FACT EXTRACTOR] 💾 Metadata saved for lead ${leadId}`);
            
            // 🟣 AUTO-QUALIFICATION CHECK
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const meta = updatedMetadata as any;
            const studies = meta.estudios || meta.nivel_estudios;
            const exp = meta.experiencia || meta.years_experience;

            if (studies && exp) {
                const result = evaluateLeadQualification({
                    nivel_estudios: String(studies),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    years_experience: exp as any
                });

                if (result.status === "cualificado") {
                    // Get lead to find tenant_id if not passed
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: lead } = await (supabase.from("lead") as any).select("tenant_id").eq("id", leadId).single();
                    if (lead) {
                        await orchestrator.handleLeadQualification(leadId, lead.tenant_id, result.reason);
                    }
                } else {
                    console.log(`[FACT EXTRACTOR] ℹ️ Lead ${leadId} evaluated but NOT qualified yet: ${result.reason}`);
                    
                    // 🟢 DYNAMIC RESUME: If we captured new data but not qualified, 
                    // ask orchestrator to check if we can skip the wait
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: lead } = await (supabase.from("lead") as any).select("tenant_id").eq("id", leadId).single();
                    if (lead) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await orchestrator.triggerDynamicResume(leadId, (lead as any).tenant_id);
                    }
                }
            } else if (Object.keys(newData).length > 0) {
                // Even if not enough for auto-qual, trigger resume to see if we skip wait
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: lead } = await (supabase.from("lead") as any).select("tenant_id").eq("id", leadId).single();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (lead) await orchestrator.triggerDynamicResume(leadId, (lead as any).tenant_id);
            }
        }
    }
}
