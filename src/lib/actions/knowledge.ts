"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { uploadToMinio } from "@/lib/integrations/minio";
import { Database } from "@/types/database";

export type KnowledgeItem = {
    id: string;
    name: string;
    description: string | null;
    file_key: string;
    file_url: string | null;
    content_hash: string | null;
    created_at: string;
};

/**
 * Fetches all knowledge base documents for the active tenant.
 */
export async function getKnowledgeBase() {
    const supabase = await getAdminSupabaseClient<Database>();
    const tenantId = await getActiveTenantId();
    
    if (!tenantId) return { success: false, error: "No context." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const supabase = await getAdminSupabaseClient<Database>();
    const tenantId = await getActiveTenantId();
    
    if (!tenantId) return { success: false, error: "No context." };

    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    if (!file) return { success: false, error: "No file provided." };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileKey = `kb/${tenantId}/${Date.now()}_${file.name}`;
        
        // Upload to MinIO/S3
        const fileUrl = await uploadToMinio(fileKey, buffer, file.type);

        // Save to DB
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase
            .from("knowledge_base" as any) as any)
            .insert({
                tenant_id: tenantId,
                name: name || file.name,
                description,
                file_key: fileKey,
                file_url: fileUrl,
                content_hash: Date.now().toString() // Simple versioning for now
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
    }
}

/**
 * Deletes a knowledge base document.
 */
export async function deleteKnowledgeDocument(id: string) {
    const supabase = await getAdminSupabaseClient<Database>();
    const tenantId = await getActiveTenantId();
    
    if (!tenantId) return { success: false, error: "No context." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
        .from("knowledge_base" as any) as any)
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
