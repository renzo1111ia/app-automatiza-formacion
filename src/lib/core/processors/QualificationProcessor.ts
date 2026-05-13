import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PromptTemplate } from "@langchain/core/prompts";
// @ts-expect-error - External library import path resolution
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import type { Database } from "@/types/database";
// @ts-expect-error - Internal alias resolution in background jobs
import { createLLM } from "@/lib/core/intelligence/llm-factory";

type Programa = Database["public"]["Tables"]["programas"]["Row"];
type AIAgentVariant = Database["public"]["Tables"]["ai_agent_variants"]["Row"];
type LLMType = "OPENAI" | "GROQ" | "ANTHROPIC";

/**
 * Deep Qualification Processor
 * Analyzes call transcripts using Course specific knowledge and extraction rules.
 */
export class QualificationProcessor {
    
    constructor() {}

    /**
     * Entry point to analyze a call and update lead qualification.
     */
    public async process(params: {
        leadId: string;
        tenantId: string;
        transcript: string;
        callId?: string;
    }) {
        const supabase = await getSupabaseServerClient();

        // 1. Get Contextual Rules (Course & Agent Variant)
        const { courseDetails, qualRules, variant } = await this.getContextualRules(params.tenantId, params.leadId);

        // 3. Create dynamic LLM
        const provider = (variant?.model_provider as LLMType) || "OPENAI";
        const modelName = variant?.model_name || "gpt-4o-mini";
        
        const llm = createLLM(provider, modelName, 0);

        // 4. Perform AI Extraction
        const analysis = await this.analyzeTranscript(llm, params.transcript, courseDetails, qualRules);

        // 5. Persist results
        const { error } = await (supabase.from("lead_cualificacion" as any) as any).insert({
            tenant_id: params.tenantId,
            id_lead: params.leadId,
            id_llamada: params.callId,
            cualificacion: analysis.summary,
            calificacion_score: analysis.interest_score,
            objeciones: analysis.objections.join(", "),
            id_variante: variant?.id,
            analisis_profundo: analysis as any,
            fecha_creacion: new Date().toISOString()
        });

        if (error) console.error("[QUAL-PROCESSOR] Error saving results:", error);

        // 6. Update Lead Status and Segmentation
        let finalStatus = "EN SEGUIMIENTO";
        if (analysis.interest_score >= 7) finalStatus = "CUALIFICADO";
        else if (analysis.interest_score <= 4) finalStatus = "DESCARTADO";
        
        const updatePayload: { tipo_lead: string; segmentacion?: string } = {
            tipo_lead: finalStatus
        };

        if (analysis.suggested_segment) {
            updatePayload.segmentacion = analysis.suggested_segment;
        }

        await (supabase.from("lead" as any) as any).update(updatePayload).eq("id", params.leadId);

        console.log(`[QUAL-PROCESSOR] ✅ Deep analysis completed for lead ${params.leadId}. Score: ${analysis.interest_score} (Variant: ${variant?.version_label || 'Default'})`);
    }

    private async getContextualRules(tenantId: string, leadId: string): Promise<{
        courseDetails: string, 
        qualRules: string, 
        variant: AIAgentVariant | null 
    }> {
        const supabase = await getSupabaseServerClient();
        
        // Get Course
        const { data: leadProgramas } = await (supabase.from("lead_programas" as any) as any)
            .select("id_programa")
            .eq("id_lead", leadId);

        let courseDetails = "No se especificó un curso previo.";
        let qualRules = "Busca interés general en formación profesional.";

        if (leadProgramas && leadProgramas.length > 0) {
            const { data: program } = await (supabase.from("programas" as any) as any)
                .select("*")
                .eq("id", leadProgramas[0].id_programa)
                .single();
            
            if (program) {
                const p = program as Programa;
                courseDetails = `Curso: ${p.nombre}\nPresentación: ${p.presentacion}\nPrecio: ${p.precio}\nObjetivos: ${p.objetivos}`;
                qualRules = p.requisitos_cualificacion || qualRules;
            }
        }

        // Get Agent
        const { data: agent } = await (supabase.from("ai_agents" as any) as any)
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("type", "QUALIFY")
            .eq("status", "ACTIVE")
            .single();

        let variant: AIAgentVariant | null = null;
        if (agent) {
            const { data: variants } = await (supabase.from("ai_agent_variants" as any) as any)
                .select("*")
                .eq("agent_id", agent.id)
                .eq("is_active", true);
            
            if (variants && variants.length > 0) {
                const rand = Math.random();
                const totalWeight = variants.reduce((acc: number, v: any) => acc + (v.weight || 0.5), 0);
                let cumulative = 0;
                for (const v of variants) {
                    cumulative += (v.weight || 0.5) / totalWeight;
                    if (rand <= cumulative) {
                        variant = v as AIAgentVariant;
                        break;
                    }
                }
            }
        }
        return { courseDetails, qualRules, variant };
    }

    private async analyzeTranscript(llm: any, transcript: string, courseInfo: string, rules: string) {
        const parser = StructuredOutputParser.fromZodSchema(
            z.object({
                interest_score: z.number().describe("Puntuación de 1 a 10"),
                summary: z.string().describe("Resumen breve de la cualificación"),
                objections: z.array(z.string()).describe("Lista de objeciones detectadas"),
                profile_fit: z.boolean().describe("¿Encaja con los requisitos de cualificación?"),
                suggested_segment: z.string().describe("Segmentación recomendada (PUESTO 1, REVISADO, CUALIFICADO, SIN INTERÉS)"),
                next_steps: z.string().describe("Recomendación de siguiente paso"),
                budget_mentioned: z.boolean().describe("¿Se habló de presupuesto?")
            })
        );

        const prompt = new PromptTemplate({
            template: `Eres un analista experto en ventas para ESDEN Business School.
            Analiza la siguiente transcripción de una llamada entre un Agente IA y un prospecto.
            
            INFORMACIÓN DEL CURSO:
            {courseInfo}
            
            REGLAS DE CUALIFICACIÓN:
            {rules}
            
            TRANSCRIPCIÓN:
            {transcript}
            
            {format_instructions}`,
            inputVariables: ["courseInfo", "rules", "transcript"],
            partialVariables: { format_instructions: parser.getFormatInstructions() }
        });

        const input = await prompt.format({ courseInfo, rules, transcript });
        const response = await llm.invoke([
            { role: "user", content: input }
        ]);

        return parser.parse(response.content as string);
    }
}

export const qualificationProcessor = new QualificationProcessor();
