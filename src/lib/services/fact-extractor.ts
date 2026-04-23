/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

/**
 * FACT EXTRACTION SERVICE
 * analyzed conversation text to extract structured data based on tracked variables.
 */
export class FactExtractionService {
    
    /**
     * Analyzes the last dialogue exchange to find values for tracked variables.
     */
    static async extractFromDialogue(
        leadId: string, 
        dialogue: string, 
        varsToTrack: string[],
        apiKey: string
    ) {
        if (!varsToTrack || varsToTrack.length === 0) return null;

        console.log(`[FACT EXTRACTOR] 🧠 Analyzing dialogue for lead ${leadId} to extract: ${varsToTrack.join(', ')}`);

        try {
            const openai = new OpenAI({ apiKey });
            
            const systemPrompt = `
Eres un extractor de datos ultra-preciso. Tu tarea es analizar el diálogo adjunto y extraer SOLO los valores para las siguientes claves: ${varsToTrack.join(', ')}.

REGLAS:
1. Si no encuentras información para una clave, NO la incluyas en el resultado.
2. Devuelve los datos ÚNICAMENTE en formato JSON plano.
3. Si el usuario corrige un dato previo, usa el más reciente.
4. Para nombres, capitaliza correctamente.
5. Para números, extrae solo la cifra si es posible.

EJEMPLO DE SALIDA:
{
  "nombre": "Juan Perez",
  "sede_interes": "Madrid"
}
`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", // Use mini for extraction (fast & cheap)
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `DIÁLOGO:\n${dialogue}` }
                ],
                response_format: { type: "json_object" },
                temperature: 0
            });

            const rawResult = completion.choices[0]?.message?.content;
            if (!rawResult) return null;

            const extractedData = JSON.parse(rawResult);
            
            if (Object.keys(extractedData).length > 0) {
                console.log(`[FACT EXTRACTOR] ✅ Data extracted:`, extractedData);
                await this.saveToLeadMetadata(leadId, extractedData);
                return extractedData;
            }

            return null;
        } catch (err) {
            console.error("[FACT EXTRACTOR] ❌ Error during extraction:", err);
            return null;
        }
    }

    private static async saveToLeadMetadata(leadId: string, newData: Record<string, any>) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient<Database>(url!, key!);

        // 1. Get current metadata
        const { data: lead } = await supabase
            .from("leads")
            .select("metadata")
            .eq("id", leadId)
            .single();
        
        const currentMetadata = (lead as any)?.metadata || {};
        
        // 2. Merge and update
        const updatedMetadata = {
            ...currentMetadata,
            ...newData,
            last_fact_update: new Date().toISOString()
        };

        await (supabase.from("leads") as any).update({ metadata: updatedMetadata }).eq("id", leadId);
    }
}
