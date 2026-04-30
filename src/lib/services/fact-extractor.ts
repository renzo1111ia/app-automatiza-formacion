/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { enqueueLeadStep } from "@/lib/core/queue/lead-sequence-queue";

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
            const openai = new OpenAI({ apiKey });
            
            const systemPrompt = `Eres un extractor de datos ultra-preciso. Analiza el diálogo y extrae SOLO los valores para estas claves: ${normalizedKeys.join(', ')}.

REGLAS ESTRICTAS:
1. Devuelve ÚNICAMENTE un JSON plano con las claves exactas listadas arriba.
2. Si no hay información clara para una clave, omítela del JSON.
3. PRIORIDAD: El diálogo puede contener patrones como {clave}=valor o {CLAVE}=valor. Si los ves, úsalos como fuente principal de verdad.
4. Si el usuario menciona su nombre, úsalo para "user_name" o "nombre".
5. Para países o ciudades, normaliza el nombre (ej: "España", "Bolivia").
6. Para "qualified": usa "SI" si muestra interés claro, "NO" si rechaza, omite si no está claro.
7. NO inventes datos. Solo extrae lo que se haya mencionado explícitamente en el diálogo.

EJEMPLO de salida válida:
{"USER_NAME": "Carlos", "USER_COUNTRY": "Bolivia", "CURSE_NAME": "MBA", "QUALIFICATION_SUMMARY": "Interesado en MBA para el próximo semestre."}`;

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

            const extractedData = JSON.parse(rawResult);
            
            // Filter to only keep keys that were actually requested
            const filtered: Record<string, string> = {};
            for (const key of normalizedKeys) {
                if (extractedData[key] !== undefined && extractedData[key] !== null && String(extractedData[key]).trim() !== "") {
                    filtered[key] = String(extractedData[key]);
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
                        action: "CRM_SYNC" as any,
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

    private static async saveToLeadMetadata(leadId: string, newData: Record<string, any>) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient<Database>(url!, key!, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        // 1. Get current metadata
        const { data: leadFound } = await (supabase.from("lead") as any)
            .select("metadata, nombre, apellido")
            .eq("id", leadId)
            .single();
        
        const currentMetadata = (leadFound as any)?.metadata || {};
        
        // 2. Merge: new data overwrites old values for same keys
        const updatedMetadata = {
            ...currentMetadata,
            ...newData,
            last_fact_update: new Date().toISOString()
        };

        // 3. Propagate name fields to main lead columns
        const mainUpdate: Record<string, any> = { metadata: updatedMetadata };
        
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
        if (newData.user_phone && !(leadFound as any)?.telefono) {
            mainUpdate.telefono = newData.user_phone;
        }

        const { error } = await (supabase.from("lead") as any).update(mainUpdate).eq("id", leadId);
        if (error) {
            console.error("[FACT EXTRACTOR] ❌ Failed to save metadata:", error.message);
        } else {
            console.log(`[FACT EXTRACTOR] 💾 Metadata saved for lead ${leadId}`);
        }
    }
}
