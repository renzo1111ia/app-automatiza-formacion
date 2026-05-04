/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { uploadToMinio, deleteFromMinio } from "@/lib/integrations/minio";
import type { KnowledgeItem } from "@/types/database";
import OpenAI from "openai";
import { KnowledgeBaseService } from "@/lib/services/knowledge-base";



/**
 * Fetches all knowledge base documents for the active tenant.
 */
export async function getKnowledgeBase() {
    const supabase = await getAdminSupabaseClient();
    const tenantId = await getActiveTenantId();
    
    if (!tenantId) return { success: false, error: "No context." };

    const { data, error } = await (supabase.from("knowledge_base") as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as KnowledgeItem[] };
}

/**
 * Uploads a PDF and creates a knowledge base entry.
 */
export async function uploadKnowledgeDocument(formData: FormData) {
    const supabase = await getAdminSupabaseClient();
    const tenantId = await getActiveTenantId();
    
    if (!tenantId) return { success: false, error: "No context." };

    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    if (!file) return { success: false, error: "No file provided." };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // 1. Generate Content Hash (SHA-256) for deduplication
        const crypto = await import('crypto');
        const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

        // 2. Check if this exact file already exists for this tenant
        const { data: existing } = await (supabase.from("knowledge_base") as any)
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("content_hash", contentHash)
            .maybeSingle();

        if (existing) {
            return { 
                success: false, 
                error: "Este documento ya existe en tu base de conocimiento (detectado por duplicidad de contenido)." 
            };
        }

        const fileKey = `kb/${tenantId}/${Date.now()}_${file.name}`;
        
        // 3. Upload to MinIO/S3
        const fileUrl = await uploadToMinio(fileKey, buffer, file.type);

        // 4. Save to DB
        const { data, error } = await (supabase.from("knowledge_base") as any)
            .insert({
                tenant_id: tenantId,
                name: name || file.name,
                description,
                file_key: fileKey,
                file_url: fileUrl,
                content_hash: contentHash
            })
            .select()
            .single();

        if (error) throw error;

        // 5. VECTORIZATION (PGVector Indexing)
        try {
            const documentData = data as any;
            if (!documentData) throw new Error("No data returned from insert");
            console.log(`[KNOWLEDGE] 📄 Starting indexing for: ${documentData.name}`);
            const pdf = await import('pdf-parse');
            // @ts-expect-error - pdf-parse has legacy export structure
            const textResult = await pdf.default(buffer);
            const text = textResult.text;

            // Simple chunking (approx 1000 chars with some overlap)
            const chunkSize = 1000;
            const overlap = 200;
            const chunks: string[] = [];
            
            for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
                chunks.push(text.slice(i, i + chunkSize));
                if (i + chunkSize >= text.length) break;
            }

            console.log(`[KNOWLEDGE] 🧩 Created ${chunks.length} chunks. Generating embeddings in batches...`);

            // Initialize OpenAI for embeddings
            // Try to find a valid API key from environment or any existing agent variant
            let apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                const { data: variants } = await (supabase.from('ai_agent_variants') as any)
                    .select('api_key')
                    .not('api_key', 'is', null)
                    .limit(1);
                apiKey = (variants as any)?.[0]?.api_key;
            }

            if (!apiKey || apiKey === "your_api_key_here") {
                throw new Error("No se encontró una API Key de OpenAI válida para realizar el indexado.");
            }
            const openai = new OpenAI({ apiKey });

            // Process chunks in batches to avoid rate limits/timeouts
            const batchSize = 100;
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                const batchFiltered = batch.filter(c => c.trim().length >= 20);
                if (batchFiltered.length === 0) continue;

                console.log(`[KNOWLEDGE] 🚀 Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(chunks.length/batchSize)}`);

                const embedRes = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: batchFiltered.map(c => c.replace(/\n/g, ' ')),
                });

                const batchToInsert = batchFiltered.map((chunk, index) => ({
                    content: chunk,
                    embedding: embedRes.data[index].embedding,
                    metadata: {
                        knowledge_base_id: data.id,
                        source_name: data.name,
                        file_key: fileKey
                    },
                    knowledgeBaseId: data.id
                }));

                await KnowledgeBaseService.addEmbeddingsBatch(tenantId, batchToInsert);
            }

            console.log(`[KNOWLEDGE] ✅ Indexing complete for: ${data.name}`);
        } catch (idxError) {
            console.error('⚠️ [KNOWLEDGE_INDEXING] Non-critical error indexing document:', idxError);
            // We don't fail the upload if indexing fails, but it's good to know
        }

        return { success: true, data };
    } catch (error: any) {
        console.error('❌ [UPLOAD_KNOWLEDGE] Critical Error:', error);
        return { 
            success: false, 
            error: error?.message || error?.name || "Error desconocido en el servidor"
        };
    }
}

/**
 * Deletes a knowledge base document.
 */
export async function deleteKnowledgeDocument(id: string) {
    const supabase = await getAdminSupabaseClient();
    const tenantId = await getActiveTenantId();
    
    if (!tenantId) return { success: false, error: "No context." };

    // 1. Get file key first for deletion from MinIO
    const { data: item } = await (supabase
        .from("knowledge_base" as any) as any)
        .select("file_key")
        .eq("id", id)
        .single();

    if ((item as any)?.file_key) {
        await deleteFromMinio((item as any).file_key);
    }

    // 2. Delete from DB
    const { error } = await (supabase
        .from("knowledge_base" as any) as any)
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
