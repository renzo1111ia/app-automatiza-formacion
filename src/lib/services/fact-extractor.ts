import OpenAI from "openai";
import { enqueueLeadStep } from "@/lib/core/queue/lead-sequence-queue";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
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
            // Fetch tenant segmentations to instruct AI
            const supabase = await getAdminSupabaseClient();
            let validSegments = ['PUESTO 1', 'REVISADO', 'CUALIFICADO', 'SIN INTERÉS'];
            
            if (tenantId) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: tenant } = await (supabase.from("tenants") as any).select("config").eq("id", tenantId).single();
                if (tenant?.config?.segmentations) {
                    validSegments = tenant.config.segmentations as string[];
                }
            }

            // Fetch Agent finalization criteria
            let finalizationRules = "El usuario se despidió, la cita quedó confirmada, o se descartó explícitamente.";
            const { data: agent } = await (supabase.from("ai_agents" as any) as any)
                .select("id, ai_agent_variants(automation_rules)")
                .eq("tenant_id", tenantId)
                .eq("status", "ACTIVE")
                .limit(1)
                .single();
            
            const variantRules = (agent?.ai_agent_variants?.[0] as any)?.automation_rules;
            if (variantRules?.finalization_criteria) {
                finalizationRules = variantRules.finalization_criteria;
            }

            const systemPrompt = `Eres un extractor de datos ultra-preciso especializado en leads para educación (Esden Business School).
Analiza el diálogo y extrae la información relevante del perfil del lead.

CLAVES PRIORITARIAS OBLIGATORIAS: ${normalizedKeys.join(', ')}.

REGLAS CRÍTICAS:
1. Devuelve ÚNICAMENTE un JSON plano. Debes incluir SIEMPRE las CLAVES PRIORITARIAS OBLIGATORIAS. Si el valor de alguna clave aún no se menciona en la charla, asigna el valor null.
2. DISCOVERY: Además de las CLAVES PRIORITARIAS, si encuentras otros datos útiles (ej. empresa, cargo, experiencia, disponibilidad, interes_especifico), inclúyelos también en el JSON con nombres de clave descriptivos en español. ¡NO DEJES NADA FUERA!
3. FLOW ANALYSIS: Intenta deducir "REGLA_APLICADA" o "QA_TOPIC" basándote en la lógica del asistente.
4. NO INVENTES: Si el usuario no ha mencionado algo, usa null para las prioritarias y omite para las extra.
5. PRECISIÓN: Extrae valores específicos.
6. "qualified": Siempre intenta evaluar si el lead está "SI", "NO" o "PENDIENTE" basándote en la conversación.
7. "user_name": Si el usuario dice su nombre, extráelo SIEMPRE.
8. "segmentacion": Determina en qué segmento se encuentra el lead. DEBES elegir SOLO UNA de las siguientes opciones válidas: [${validSegments.map(s => `"${s}"`).join(', ')}].
9. "ha_respondido": Extrae "SI" si el lead ha contestado al asistente, o "NO" si no lo ha hecho.
10. "requiere_seguimiento": Extrae "SI" si hay que volver a contactar a este lead en el futuro, o "NO" si ya se cerró/descartó.
11. "estado_conversacion": Evalúa si la conversación está "EN_CURSO" o "FINALIZADA".
    CRITERIOS PARA "FINALIZADA": ${finalizationRules}

¡EXTRAE EL MÁXIMO DE INFORMACIÓN POSIBLE PARA EL CRM!

EJEMPLO DE SALIDA:
{"user_name": "Carlos Ruiz", "qualified": "SI", "segmentacion": "${validSegments[0] || 'REVISADO'}", "estado_conversacion": "FINALIZADA"}`;

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
                    const trackedMatch = varsToTrack.find(v => FactExtractionService.normalizeKey(v).toLowerCase() === key.toLowerCase());
                    const finalKey = trackedMatch ? FactExtractionService.normalizeKey(trackedMatch) : key;
                    result[finalKey] = String(val);
                }
            });

            // Always save metadata if we have at least system facts or extracted data
            if (Object.keys(result).length > 0) {
                console.log(`[FACT_EXTRACTOR] ✅ Captured facts:`, Object.keys(result));
                await FactExtractionService.saveToLeadMetadata(leadId, result);

                if (tenantId) {
                    await enqueueLeadStep({ leadId, tenantId, action: "CRM_SYNC", step: 0 });
                    if (result.estado_conversacion?.toUpperCase() === 'FINALIZADA') {
                        const { enqueueQualificationAnalysis } = await import("@/lib/core/queue/lead-sequence-queue");
                        await enqueueQualificationAnalysis({ leadId, tenantId, transcript: dialogue, callId: "whatsapp" });
                    }
                }
            }

            return result;
        } catch (err) {
            console.error("[FACT EXTRACTOR] ❌ Error:", err);
            // Even on error, try to save what we already have (preFilledData)
            if (preFilledData && Object.keys(preFilledData).length > 0) {
                await FactExtractionService.saveToLeadMetadata(leadId, preFilledData).catch(() => {});
            }
            return null;
        }
    }

    private static async saveToLeadMetadata(leadId: string, newData: Record<string, string>) {
        const supabase = await getAdminSupabaseClient();

        // 1. Get current metadata
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadFound, error: fetchError } = await (supabase.from("lead") as any)
            .select("metadata, nombre, apellido, telefono, tenant_id")
            .eq("id", leadId)
            .single();
        
        if (fetchError) {
            console.error(`[FACT_EXTRACTOR] ❌ Error fetching lead ${leadId}:`, fetchError.message);
            // Log to system_logs for visibility
            await (supabase.from("system_logs" as any) as any).insert({
                tenant_id: (leadFound as any)?.tenant_id || "00000000-0000-0000-0000-000000000000",
                level: "ERROR",
                message: `Error obteniendo metadatos del lead: ${fetchError.message}`,
                metadata: { leadId, error: fetchError }
            }).catch(() => {});
            return;
        }
        
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
        // Propagate qualification to tipo_lead
        if (newData.qualified) {
            const q = newData.qualified.toUpperCase();
            if (q === 'SI') mainUpdate.tipo_lead = 'CUALIFICADO';
            else if (q === 'NO') mainUpdate.tipo_lead = 'DESCARTADO';
            else if (q === 'PENDIENTE') mainUpdate.tipo_lead = 'EN SEGUIMIENTO';
        }
        // Propagate AI-predicted segmentacion to the main lead record
        if (newData.segmentacion && String(newData.segmentacion).trim() !== "") {
            mainUpdate.segmentacion = String(newData.segmentacion).trim().toUpperCase();
        }

        // 🟢 AUTO-FILL SYSTEM VARIABLES
        if (!updatedMetadata.USER_PHONE && leadFound?.telefono) {
            updatedMetadata.USER_PHONE = leadFound.telefono;
        }

        if (!updatedMetadata.USER_COUNTRY && leadFound?.telefono) {
            const phone = leadFound.telefono.replace(/\D/g, "");
            const countryMap: Record<string, string> = {
                "56": "Chile",
                "591": "Bolivia",
                "57": "Colombia",
                "34": "España",
                "52": "México",
                "54": "Argentina",
                "51": "Perú",
                "593": "Ecuador",
                "502": "Guatemala",
                "503": "El Salvador",
                "504": "Honduras",
                "505": "Nicaragua",
                "506": "Costa Rica",
                "507": "Panamá",
                "1": "USA/Canada",
            };
            // Check prefixes
            for (const [prefix, country] of Object.entries(countryMap)) {
                if (phone.startsWith(prefix)) {
                    updatedMetadata.USER_COUNTRY = country;
                    break;
                }
            }
        }

        if (!updatedMetadata.USER_NAME && (leadFound?.nombre || leadFound?.apellido)) {
            updatedMetadata.USER_NAME = `${leadFound.nombre || ""} ${leadFound.apellido || ""}`.trim();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("lead") as any)
            .update(mainUpdate)
            .eq("id", leadId);

        if (updateError) {
            console.error(`[FACT_EXTRACTOR] ❌ Failed to save metadata:`, updateError.message);
            // Log to system_logs for visibility
            await (supabase.from("system_logs" as any) as any).insert({
                tenant_id: (leadFound as any)?.tenant_id || "00000000-0000-0000-0000-000000000000",
                level: "ERROR",
                message: `Error guardando metadatos del lead: ${updateError.message}`,
                metadata: { leadId, error: updateError, mainUpdate }
            }).catch(() => {});
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
