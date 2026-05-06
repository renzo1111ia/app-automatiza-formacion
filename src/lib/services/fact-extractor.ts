import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Database, Lead } from "@/types/database";
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
        tenantId?: string
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
Analiza el diálogo y extrae la información para estas claves: ${normalizedKeys.join(', ')}.

REGLAS DE ORO:
1. Devuelve ÚNICAMENTE un JSON plano con las claves solicitadas.
2. Sé inteligente: si el usuario describe su trabajo, extráelo para "profesion". Si explica por qué quiere estudiar, extráelo para "motivations".
3. NO inventes datos. Si una información no está en el diálogo, NO incluyas esa clave en el JSON.
4. Si ves patrones como {clave}=valor, tienen prioridad máxima.
5. Normaliza textos cortos (ej: nombres propios con mayúsculas, países correctos).
6. Para la clave "qualified": usa "SI" si el lead es apto e interesado, "NO" si rechaza explícitamente.

EJEMPLO:
{"USER_NAME": "Lucía Pérez", "USER_PROFESION": "Ingeniera de Software", "USER_MOTIVATIONS": "Ascenso laboral", "USER_STUDIES": "Grado en Informática"}`;

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
            
            // Case-insensitive lookup for better robustness
            const lowerExtractedData: Record<string, unknown> = {};
            Object.keys(extractedData).forEach(k => {
                lowerExtractedData[k.toLowerCase()] = extractedData[k];
            });

            const filtered: Record<string, string> = {};
            for (const key of normalizedKeys) {
                const val = lowerExtractedData[key.toLowerCase()];
                if (val !== undefined && val !== null && String(val).trim() !== "") {
                    filtered[key] = String(val);
                }
            }
            
            if (Object.keys(filtered).length > 0) {
                console.log(`[FACT EXTRACTOR] ✅ Captured:`, filtered);
                await this.saveToLeadMetadata(leadId, filtered);

                // 🟢 TRIGGER CRM SYNC (ONE BY ONE LOGIC)
                if (tenantId) {
                    await enqueueLeadStep({
                        leadId,
                        tenantId,
                        action: "CRM_SYNC",
                        step: 0
                    });
                    console.log(`[FACT EXTRACTOR] 🚀 CRM Sync enqueued for lead ${leadId}`);
                }

                return filtered;
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
        const { data: leadFound } = await (supabase.from("lead") as any)
            .select("metadata, nombre, apellido, telefono")
            .eq("id", leadId)
            .single();
        
        const currentMetadata = (leadFound?.metadata as Record<string, unknown>) || {};
        
        // 2. Merge: new data overwrites old values for same keys
        const updatedMetadata = {
            ...currentMetadata,
            ...newData,
            last_fact_update: new Date().toISOString()
        };

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

        const { error } = await (supabase.from("lead") as any)
            .update(mainUpdate)
            .eq("id", leadId);

        if (error) {
            console.error("[FACT EXTRACTOR] ❌ Failed to save metadata:", error.message);
        } else {
            console.log(`[FACT EXTRACTOR] 💾 Metadata saved for lead ${leadId}`);
            
            // 🟣 AUTO-QUALIFICATION CHECK
            const meta = updatedMetadata as any;
            const studies = meta.estudios || meta.nivel_estudios;
            const exp = meta.experiencia || meta.years_experience;

            if (studies && exp) {
                const result = evaluateLeadQualification({
                    nivel_estudios: String(studies),
                    years_experience: exp as any
                });

                if (result.status === "cualificado") {
                    // Get lead to find tenant_id if not passed
                    const { data: lead } = await (supabase.from("lead") as any).select("tenant_id").eq("id", leadId).single();
                    if (lead) {
                        await orchestrator.handleLeadQualification(leadId, lead.tenant_id, result.reason);
                    }
                } else {
                    console.log(`[FACT EXTRACTOR] ℹ️ Lead ${leadId} evaluated but NOT qualified yet: ${result.reason}`);
                }
            }
        }
    }
}
