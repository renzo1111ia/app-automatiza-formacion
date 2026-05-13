import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Programa } from "@/types/database";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

import { AgentFactory, LLMType } from "@/lib/core/multi-agent";
import { AIAgent, AIAgentVariant } from "@/types/database";

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

        // 1. Get Course details for this lead
        const { data: leadProgramas } = await (supabase
            .from("lead_programas" as any) as any)
            .select("id_programa")
            .eq("id_lead", params.leadId);

        let courseDetails = "No se especificó un curso previo.";
        let qualRules = "Busca interés general en formación profesional.";

        if (leadProgramas && leadProgramas.length > 0) {
            const { data: program } = await (supabase
                .from("programas" as any) as any)
                .select("*")
                .eq("id", leadProgramas[0].id_programa)
                .single();
            
            if (program) {
                const p = program as Programa;
                courseDetails = `Curso: ${p.nombre}\nPresentación: ${p.presentacion}\nPrecio: ${p.precio}\nObjetivos: ${p.objetivos}`;
                qualRules = p.requisitos_cualificacion || qualRules;
            }
        }

        // 2. Get the QUALIFY agent for this tenant
        const { data: agent } = await (supabase
            .from("ai_agents" as any) as any)
            .select("id")
            .eq("tenant_id", params.tenantId)
            .eq("type", "QUALIFY")
            .eq("status", "ACTIVE")
            .single();

        let variant: AIAgentVariant | null = null;
        if (agent) {
            const { data: variants } = await (supabase
                .from("ai_agent_variants" as any) as any)
                .select("*")
                .eq("agent_id", agent.id)
                .eq("is_active", true);
            
            if (variants && variants.length > 0) {
                // A/B Selection logic: Simple random for now based on weights
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

        // 3. Create dynamic LLM
        const provider = (variant?.model_provider as LLMType) || "OPENAI";
        let modelName = variant?.model_name || "gpt-4o";
        if (modelName === "gpt-4.1") modelName = "gpt-4o";
        if (modelName === "gpt-4.1-mini") modelName = "gpt-4o-mini";
        const apiKey = variant?.api_key || (provider === "OPENAI" ? process.env.OPENAI_API_KEY : provider === "ANTHROPIC" ? process.env.ANTHROPIC_API_KEY : process.env.GOOGLE_GENERATIVE_AI_API_KEY);

        const llm = AgentFactory.createModel({
            type: provider,
            modelName: modelName,
            apiKey: apiKey || "",
            temperature: 0
        });

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

        // 6. Update Lead Status
        let finalStatus = "EN SEGUIMIENTO";
        if (analysis.interest_score >= 7) finalStatus = "CUALIFICADO";
        else if (analysis.interest_score <= 4) finalStatus = "DESCARTADO";

        await (supabase.from("lead" as any) as any).update({
            tipo_lead: finalStatus
        }).eq("id", params.leadId);

        console.log(`[QUAL-PROCESSOR] ✅ Deep analysis completed for lead ${params.leadId}. Score: ${analysis.interest_score} (Variant: ${variant?.version_label || 'Default'})`);
    }

    private async analyzeTranscript(llm: any, transcript: string, courseInfo: string, rules: string) {
        const parser = StructuredOutputParser.fromZodSchema(
            z.object({
                interest_score: z.number().describe("Puntuación de 1 a 10"),
                summary: z.string().describe("Resumen breve de la cualificación"),
                objections: z.array(z.string()).describe("Lista de objeciones detectadas"),
                profile_fit: z.boolean().describe("¿Encaja con los requisitos de cualificación?"),
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
            { role: "user", content: input } as any
        ]);

        return parser.parse(response.content as string);
    }
}

export const qualificationProcessor = new QualificationProcessor();
