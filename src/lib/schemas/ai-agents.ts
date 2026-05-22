import { z } from "zod";
import {
  uuidSchema,
  tenantIdSchema,
  nullableTimestampSchema,
  jsonbSchema,
  AiAgentTypeEnum,
  AiAgentStatusEnum,
  LlmProviderEnum,
} from "./_base";

// ─── 2-35: Whitelist de modelos LLM ──────────────────────────────────────
// La lista debe coincidir con (a) los modelos que `AgentFactory` instancia
// vía LangChain (`@langchain/openai`, `@langchain/anthropic`, `@langchain/google-genai`)
// y (b) los que la UI ofrece en `src/app/dashboard/agents/page.tsx` y
// `src/components/onboarding/NodeConfigSidebar.tsx`.
// Mantener sincronizado vía ADR cada vez que se añada un proveedor o modelo.

export const ModelNameSchema = z.enum([
  // OpenAI
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.5-preview",
  // Anthropic
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307",
  "claude-3-opus-20240229",
  // Google Gemini
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
]);
export type ModelName = z.infer<typeof ModelNameSchema>;

// ─── ai_agents ───────────────────────────────────────────────────────────

export const AiAgentSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  type: AiAgentTypeEnum,
  status: AiAgentStatusEnum,
  flow_config: z
    .object({
      nodes: z.array(z.unknown()),
      edges: z.array(z.unknown()),
      automation_rules: jsonbSchema.optional(),
      crm_config: jsonbSchema.optional(),
    })
    .nullable(),
  automation_rules: jsonbSchema.optional(),
  crm_config: jsonbSchema.optional(),
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type AiAgent = z.infer<typeof AiAgentSchema>;

export const CreateAiAgentSchema = AiAgentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type CreateAiAgent = z.infer<typeof CreateAiAgentSchema>;

export const UpdateAiAgentSchema = AiAgentSchema.partial().omit({ id: true, tenant_id: true });
export type UpdateAiAgent = z.infer<typeof UpdateAiAgentSchema>;

// ─── ai_agent_variants (con whitelist 2-35) ─────────────────────────────

export const AiAgentVariantSchema = z.object({
  id: uuidSchema,
  agent_id: uuidSchema,
  version_label: z.string().min(1),
  prompt_text: z.string(),
  model_provider: LlmProviderEnum.optional(),
  model_name: ModelNameSchema.optional(),
  api_key: z.string().nullable().optional(),
  knowledge_base_id: uuidSchema.nullable().optional(),
  is_active: z.boolean(),
  is_variant_b: z.boolean(),
  weight: z.number().min(0).max(1),
  metrics: jsonbSchema.nullable(),
  dynamic_variables: z.union([z.record(z.string(), z.string()), z.array(z.string())]).optional(),
  tracked_variables: z.array(z.string()).optional(),
  automation_rules: jsonbSchema.optional(),
  crm_config: jsonbSchema.optional(),
  knowledge_base_ids: z.array(uuidSchema).optional(),
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type AiAgentVariant = z.infer<typeof AiAgentVariantSchema>;

export const CreateAiAgentVariantSchema = AiAgentVariantSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type CreateAiAgentVariant = z.infer<typeof CreateAiAgentVariantSchema>;

export const UpdateAiAgentVariantSchema = AiAgentVariantSchema.partial().omit({
  id: true,
  agent_id: true,
});
export type UpdateAiAgentVariant = z.infer<typeof UpdateAiAgentVariantSchema>;

// ─── voice_agents (Retell / Ultravox) ───────────────────────────────────

export const VoiceAgentProviderEnum = z.enum(["RETELL", "ULTRAVOX", "INTERNAL"]);

export const VoiceAgentSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  status: AiAgentStatusEnum,
  provider: VoiceAgentProviderEnum,
  provider_agent_id: z.string().nullable(),
  voice_id: z.string().nullable(),
  from_number: z.string().nullable(),
  retell_llm_id: z.string().nullable(),
  prompt_text_retell: z.string().nullable(),
  retell_llm_config: jsonbSchema.nullable(),
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type VoiceAgent = z.infer<typeof VoiceAgentSchema>;
