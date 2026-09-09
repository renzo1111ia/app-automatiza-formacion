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

  const { data, error } = await supabase
    .from("knowledge_base")
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
    const crypto = await import("crypto");
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 2. Check if this exact file already exists for this tenant
    const { data: existing } = await supabase
      .from("knowledge_base")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error:
          "Este documento ya existe en tu base de conocimiento (detectado por duplicidad de contenido).",
      };
    }

    const fileKey = `kb/${tenantId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // 3. Upload to Storage (Supabase Storage fallback if MinIO not available)
    let fileUrl = "";
    try {
      fileUrl = await uploadToMinio(fileKey, buffer, file.type);
    } catch (minioErr) {
      console.warn(
        "⚠️ [KNOWLEDGE] MinIO not available, attempting Supabase Storage or fallback URL:",
        minioErr
      );
      try {
        const { data: storageData, error: storageErr } = await supabase.storage
          .from("knowledge_base")
          .upload(fileKey, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: true,
          });

        if (!storageErr && storageData) {
          const { data: publicUrlData } = supabase.storage
            .from("knowledge_base")
            .getPublicUrl(fileKey);
          fileUrl = publicUrlData?.publicUrl || `/storage/${fileKey}`;
        } else {
          fileUrl = `/storage/${fileKey}`;
        }
      } catch {
        fileUrl = `/storage/${fileKey}`;
      }
    }

    // 4. Save to DB
    const { data, error } = await (supabase.from("knowledge_base" as any) as any)
      .insert({
        tenant_id: tenantId,
        name: name || file.name,
        description: description || "",
        file_key: fileKey,
        file_url: fileUrl,
        content_hash: contentHash,
      })
      .select()
      .single();

    if (error) throw error;

    // 5. VECTORIZATION & TEXT EXTRACTION
    try {
      const documentData = data as any;
      if (!documentData) throw new Error("No data returned from insert");
      console.log(`[KNOWLEDGE] 📄 Starting text extraction and indexing for: ${documentData.name}`);

      let text = "";
      const isPdf = file.type?.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        try {
          const pdf = await import("pdf-parse");
          // @ts-expect-error - pdf-parse has legacy export structure
          const textResult = await (pdf.default || pdf)(buffer);
          text = textResult.text || "";
        } catch (pdfErr) {
          console.warn("[KNOWLEDGE] Error parsing PDF structure, trying raw text:", pdfErr);
          text = buffer.toString("utf-8");
        }
      } else {
        // Plain text, markdown, CSV, etc.
        text = buffer.toString("utf-8");
      }

      if (text && text.trim().length > 0) {
        // Simple chunking (approx 1000 chars with some overlap)
        const chunkSize = 1000;
        const overlap = 200;
        const chunks: string[] = [];

        for (let i = 0; i < text.length; i += chunkSize - overlap) {
          chunks.push(text.slice(i, i + chunkSize));
          if (i + chunkSize >= text.length) break;
        }

        console.log(`[KNOWLEDGE] 🧩 Created ${chunks.length} chunks. Generating embeddings...`);

        // Initialize OpenAI for embeddings if available
        let apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          const { data: variants } = await supabase
            .from("ai_agent_variants")
            .select("api_key")
            .not("api_key", "is", null)
            .limit(1);
          apiKey = (variants as any)?.[0]?.api_key;
        }

        if (apiKey && apiKey !== "your_api_key_here") {
          const openai = new OpenAI({ apiKey });

          const batchSize = 100;
          for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const batchFiltered = batch.filter((c) => c.trim().length >= 10);
            if (batchFiltered.length === 0) continue;

            const embedRes = await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: batchFiltered.map((c) => c.replace(/\n/g, " ")),
            });

            const batchToInsert = batchFiltered.map((chunk, index) => ({
              content: chunk,
              embedding: embedRes.data[index].embedding,
              metadata: {
                knowledge_base_id: documentData.id,
                source_name: documentData.name,
                file_key: fileKey,
              },
              knowledgeBaseId: documentData.id,
            }));

            await KnowledgeBaseService.addEmbeddingsBatch(tenantId, batchToInsert);
          }
          console.log(`[KNOWLEDGE] ✅ Embeddings created successfully for: ${documentData.name}`);
        } else {
          console.warn(
            "[KNOWLEDGE] Skipping embeddings generation: OpenAI API Key not configured."
          );
        }
      }
    } catch (idxError) {
      console.warn("⚠️ [KNOWLEDGE_INDEXING] Document saved but indexing skipped:", idxError);
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("❌ [UPLOAD_KNOWLEDGE] Critical Error:", error);
    return {
      success: false,
      error: error?.message || error?.name || "Error desconocido al procesar el documento",
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
  const { data: item } = await (supabase.from("knowledge_base" as any) as any)
    .select("file_key")
    .eq("id", id)
    .single();

  if ((item as any)?.file_key) {
    await deleteFromMinio((item as any).file_key);
  }

  // 2. Delete from DB
  const { error } = await (supabase.from("knowledge_base" as any) as any)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
