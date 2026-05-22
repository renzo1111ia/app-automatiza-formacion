import { z } from "zod";
import { uuidSchema, tenantIdSchema, timestampSchema, jsonbSchema } from "./_base";

// Tabla: public.knowledge_base

export const KnowledgeItemSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  file_key: z.string(),
  file_url: z.string().url().nullable(),
  content_hash: z.string().nullable(),
  created_at: timestampSchema,
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

export const CreateKnowledgeItemSchema = KnowledgeItemSchema.omit({ id: true, created_at: true });
export type CreateKnowledgeItem = z.infer<typeof CreateKnowledgeItemSchema>;

// Tabla: public.knowledge_base_embeddings (pgvector).
// El campo `embedding` se serializa como array de números (Postgres vector).
export const KnowledgeEmbeddingSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  content: z.string(),
  embedding: z.array(z.number()),
  metadata: jsonbSchema,
  created_at: timestampSchema,
});
export type KnowledgeEmbedding = z.infer<typeof KnowledgeEmbeddingSchema>;

export const CreateKnowledgeEmbeddingSchema = KnowledgeEmbeddingSchema.omit({
  id: true,
  created_at: true,
});
export type CreateKnowledgeEmbedding = z.infer<typeof CreateKnowledgeEmbeddingSchema>;

// Tabla: public.chat_messages (memoria conversacional).
export const ChatMessageDirectionEnum = z.enum(["inbound", "outbound"]);
export const ChatMessageTypeEnum = z.enum(["text", "image", "audio", "document", "system"]);

export const ChatMessageSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  lead_id: uuidSchema,
  direction: ChatMessageDirectionEnum.or(z.string()),
  message_type: ChatMessageTypeEnum.or(z.string()),
  content: z.string(),
  sent_by: z.string().nullable(),
  status: z.string(),
  created_at: timestampSchema,
  metadata: jsonbSchema,
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const CreateChatMessageSchema = ChatMessageSchema.omit({ id: true, created_at: true });
export type CreateChatMessage = z.infer<typeof CreateChatMessageSchema>;
