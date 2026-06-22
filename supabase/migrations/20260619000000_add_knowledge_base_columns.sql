-- Agrega las columnas faltantes en la base de conocimientos que se usan en src/lib/actions/knowledge.ts
ALTER TABLE public.knowledge_base
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS file_key TEXT,
ADD COLUMN IF NOT EXISTS content_hash TEXT;
