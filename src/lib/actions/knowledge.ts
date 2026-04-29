/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { uploadToMinio, deleteFromMinio } from "@/lib/integrations/minio";
import { KnowledgeItem } from "@/types/database";

/**
 * Fetches all knowledge base documents for the active tenant.
 */
export async function getKnowledgeBase() {
    const supabase = await getAdminSupabaseClient();
    const tenantId = await getActiveTenantId();
    
    if (!tenantId) return { success: false, error: "No context." };

    const { data, error } = await (supabase
        .from("knowledge_base" as any) as any)
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
        const { data: existing } = await (supabase
            .from("knowledge_base" as any) as any)
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
        const { data, error } = await (supabase
            .from("knowledge_base" as any) as any)
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
