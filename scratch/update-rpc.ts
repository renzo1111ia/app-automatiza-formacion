
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSearchFunction() {
    console.log("Updating match_knowledge_base RPC to support multi-id filtering...");
    
    const sql = `
    CREATE OR REPLACE FUNCTION match_knowledge_base (
      query_embedding vector(1536),
      match_threshold float,
      match_count int,
      p_tenant_id uuid,
      p_knowledge_base_ids text[] DEFAULT NULL
    )
    RETURNS TABLE (
      id uuid,
      content text,
      metadata jsonb,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        knowledge_base_embeddings.id,
        knowledge_base_embeddings.content,
        knowledge_base_embeddings.metadata,
        1 - (knowledge_base_embeddings.embedding <=> query_embedding) AS similarity
      FROM knowledge_base_embeddings
      WHERE knowledge_base_embeddings.tenant_id = p_tenant_id
        AND (p_knowledge_base_ids IS NULL OR (knowledge_base_embeddings.metadata->>'knowledge_base_id') = ANY(p_knowledge_base_ids))
        AND 1 - (knowledge_base_embeddings.embedding <=> query_embedding) > match_threshold
      ORDER BY similarity DESC
      LIMIT match_count;
    END;
    $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
        console.error("Migration failed via RPC 'exec_sql':", error.message);
        console.log("You may need to run this SQL manually in the Supabase Dashboard.");
    } else {
        console.log("Migration successful! RPC updated.");
    }
}

updateSearchFunction();
