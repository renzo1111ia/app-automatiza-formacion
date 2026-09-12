/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { deleteFromMinio } from "@/lib/integrations/minio";
import type { KnowledgeItem } from "@/types/database";
import OpenAI from "openai";
import { KnowledgeBaseService } from "@/lib/services/knowledge-base";
import crypto from "crypto";

/**
 * Helper to chunk text and generate embeddings with PGVector
 */
async function indexKnowledgeText(
  tenantId: string,
  documentId: string,
  documentName: string,
  fileKey: string,
  text: string,
  supabase: any
) {
  if (!text || text.trim().length === 0) return;

  const chunkSize = 1000;
  const overlap = 200;
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
    if (i + chunkSize >= text.length) break;
  }

  console.log(`[KNOWLEDGE] 🧩 Created ${chunks.length} chunks for: ${documentName}`);

  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
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
          knowledge_base_id: documentId,
          source_name: documentName,
          file_key: fileKey,
        },
        knowledgeBaseId: documentId,
      }));

      await KnowledgeBaseService.addEmbeddingsBatch(tenantId, batchToInsert);
    }
    console.log(`[KNOWLEDGE] ✅ Embeddings created successfully for: ${documentName}`);
  } else {
    console.warn("[KNOWLEDGE] Skipping embeddings: OpenAI API Key not configured.");
  }
}

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
 * Uploads a document (PDF, TXT, MD) using Supabase Storage and creates a knowledge base entry.
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

    // 3. Upload to Supabase Storage (Primary)
    let fileUrl = "";
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
    } catch (storageException) {
      console.warn("⚠️ [KNOWLEDGE] Supabase Storage upload note:", storageException);
      fileUrl = `/storage/${fileKey}`;
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

      await indexKnowledgeText(
        tenantId,
        documentData.id,
        documentData.name,
        fileKey,
        text,
        supabase
      );
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
 * Creates a knowledge base entry directly from text / markdown without requiring file storage.
 */
export async function createDirectTextKnowledge(payload: {
  name: string;
  description?: string;
  content: string;
}) {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await getActiveTenantId();

  if (!tenantId) return { success: false, error: "No context." };

  const { name, description = "", content } = payload;
  if (!name?.trim()) return { success: false, error: "El nombre es obligatorio." };
  if (!content?.trim()) return { success: false, error: "El contenido no puede estar vacío." };

  try {
    const textBuffer = Buffer.from(content, "utf-8");
    const contentHash = crypto.createHash("sha256").update(textBuffer).digest("hex");

    // Check duplicate
    const { data: existing } = await supabase
      .from("knowledge_base")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "Ya existe una entrada idéntica en tu base de conocimiento.",
      };
    }

    const safeName = name.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `text/${tenantId}/${Date.now()}_${safeName}.md`;
    const fileUrl = `text://${fileKey}`;

    // Optional: save backup to Supabase storage as markdown
    try {
      await supabase.storage.from("knowledge_base").upload(fileKey, textBuffer, {
        contentType: "text/markdown; charset=utf-8",
        upsert: true,
      });
    } catch {
      // Non-blocking if bucket does not exist
    }

    // Insert into DB
    const { data, error } = await (supabase.from("knowledge_base" as any) as any)
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        description: description.trim(),
        file_key: fileKey,
        file_url: fileUrl,
        content_hash: contentHash,
      })
      .select()
      .single();

    if (error) throw error;

    // Vectorize directly
    const documentData = data as any;
    await indexKnowledgeText(
      tenantId,
      documentData.id,
      documentData.name,
      fileKey,
      content,
      supabase
    );

    return { success: true, data };
  } catch (error: any) {
    console.error("❌ [CREATE_TEXT_KNOWLEDGE] Error:", error);
    return {
      success: false,
      error: error?.message || "Error al crear la base de conocimiento de texto.",
    };
  }
}

/**
 * Deletes a knowledge base document and its embeddings.
 */
export async function deleteKnowledgeDocument(id: string) {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await getActiveTenantId();

  if (!tenantId) return { success: false, error: "No context." };

  try {
    // 1. Get file key
    const { data: item } = await (supabase.from("knowledge_base" as any) as any)
      .select("file_key")
      .eq("id", id)
      .single();

    const fileKey = (item as any)?.file_key;
    if (fileKey) {
      // Remove from Supabase Storage
      try {
        await supabase.storage.from("knowledge_base").remove([fileKey]);
      } catch {
        // Non-blocking
      }
      // Remove from MinIO if previously used
      try {
        await deleteFromMinio(fileKey);
      } catch {
        // Non-blocking
      }
    }

    // 2. Delete embeddings
    try {
      await supabase
        .from("knowledge_base_embeddings")
        .delete()
        .eq("knowledge_base_id", id);
    } catch {
      // Non-blocking (foreign key cascade might handle it)
    }

    // 3. Delete from DB
    const { error } = await (supabase.from("knowledge_base" as any) as any)
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: any) {
    console.error("❌ [DELETE_KNOWLEDGE] Error:", error);
    return { success: false, error: error.message || "Error al eliminar el documento." };
  }
}

