/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/actions/session";

import type { KnowledgeItem } from "@/types/database";
import OpenAI from "openai";
import { KnowledgeBaseService } from "@/lib/services/knowledge-base";
import crypto from "crypto";

/**
 * Helper to resolve tenantId from parameter, cookie, or session.
 */
async function resolveTenantId(explicitTenantId?: string): Promise<string | null> {
  if (explicitTenantId) return explicitTenantId;
  const fromCookie = await getActiveTenantId();
  if (fromCookie) return fromCookie;
  const session = await getSessionContext();
  if (session?.tenantId) return session.tenantId;
  return null;
}

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

  const chunkSize = 1200;
  const overlap = 150;
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
    if (i + chunkSize >= text.length) break;
  }

  console.log(`[KNOWLEDGE] 🧩 Created ${chunks.length} chunks for: ${documentName}`);

  let apiKey: string | null = process.env.OPENAI_API_KEY || null;
  const isInvalid = (k: string | null) =>
    !k ||
    k === "your_api_key_here" ||
    k.includes("REPLACE") ||
    k.startsWith("placeholder") ||
    k.length < 20;

  if (isInvalid(apiKey)) {
    const { data: variants } = await supabase
      .from("ai_agent_variants")
      .select("api_key")
      .eq("tenant_id", tenantId)
      .not("api_key", "is", null)
      .limit(1);
    const dbKey = (variants as any)?.[0]?.api_key;
    if (!isInvalid(dbKey)) {
      apiKey = dbKey;
    } else {
      const { data: globalVariants } = await supabase
        .from("ai_agent_variants")
        .select("api_key")
        .not("api_key", "is", null)
        .limit(1);
      const gKey = (globalVariants as any)?.[0]?.api_key;
      if (!isInvalid(gKey)) {
        apiKey = gKey;
      } else {
        apiKey = null;
      }
    }
  }

  if (apiKey && !isInvalid(apiKey)) {
    try {
      const openai = new OpenAI({ apiKey, maxRetries: 0, timeout: 8000 });
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
    } catch (embedError: any) {
      console.warn(
        `[KNOWLEDGE] ⚠️ Skipping vector embeddings for ${documentName} (${embedError?.message || embedError})`
      );
    }
  } else {
    console.warn(
      "[KNOWLEDGE] Skipping embeddings: OpenAI API Key is not configured or is a placeholder."
    );
  }
}

/**
 * Fetches all knowledge base documents for the active tenant.
 */
export async function getKnowledgeBase(tenantIdParam?: string) {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await resolveTenantId(tenantIdParam);

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
 * Resilient PDF text extraction supporting pdf-parse v2 and fallbacks.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Strategy 1: PDFParse v2 class
  try {
    const pdfModule = await import("pdf-parse");
    const PDFParseClass = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse;
    if (typeof PDFParseClass === "function") {
      const parser = new PDFParseClass({ data: buffer });
      const parsePromise = parser.getText();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("PDF extraction timeout")), 8000)
      );
      const res: any = await Promise.race([parsePromise, timeoutPromise]);
      try {
        await parser.destroy();
      } catch {}
      if (res?.text && res.text.trim().length > 0) {
        return res.text;
      }
    }
  } catch (e: any) {
    console.warn("⚠️ [PDF_EXTRACT] Strategy 1 (PDFParse v2) warning:", e?.message || e);
  }

  // Strategy 2: Legacy function fallback
  try {
    const pdfModule = await import("pdf-parse");
    const legacyFunc =
      typeof (pdfModule as any).default === "function"
        ? (pdfModule as any).default
        : typeof pdfModule === "function"
          ? pdfModule
          : null;
    if (typeof legacyFunc === "function") {
      const res = await legacyFunc(buffer);
      if (res?.text && res.text.trim().length > 0) {
        return res.text;
      }
    }
  } catch (e: any) {
    console.warn("⚠️ [PDF_EXTRACT] Strategy 2 (Legacy) warning:", e?.message || e);
  }

  // Strategy 3: Text stream extraction
  try {
    const raw = buffer.toString("latin1");
    const streamMatches = raw.match(/BT[\s\S]*?ET/g);
    if (streamMatches && streamMatches.length > 0) {
      const extracted = streamMatches
        .map((s) => s.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ$€.,:\-\s\n]/g, " "))
        .join("\n")
        .replace(/\s+/g, " ")
        .trim();
      if (extracted.length > 20) {
        return extracted;
      }
    }
  } catch (e: any) {
    console.warn("⚠️ [PDF_EXTRACT] Strategy 3 warning:", e?.message || e);
  }

  // Strategy 4: Raw text cleanup
  return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\táéíóúÁÉÍÓÚñÑ]/g, " ");
}

/**
 * Helper to ensure the knowledge_base storage bucket exists in Supabase.
 */
async function ensureKnowledgeBucket(supabase: any) {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (!error && buckets) {
      const exists = buckets.some(
        (b: any) => b.name === "knowledge_base" || b.id === "knowledge_base"
      );
      if (!exists) {
        await supabase.storage.createBucket("knowledge_base", {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
      }
    }
  } catch (err) {
    console.warn("⚠️ [KNOWLEDGE] Bucket check note:", err);
  }
}

/**
 * Uploads a document (PDF, TXT, MD) using Supabase Storage and creates/updates a knowledge base entry.
 */
export async function uploadKnowledgeDocument(formData: FormData) {
  const supabase = await getAdminSupabaseClient();
  const explicitTenantId = (formData.get("tenant_id") as string) || undefined;
  const tenantId = await resolveTenantId(explicitTenantId);

  if (!tenantId) return { success: false, error: "No se pudo identificar el tenant actual." };

  const file = formData.get("file") as File;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!file) return { success: false, error: "No se proporcionó ningún archivo." };

  try {
    await ensureKnowledgeBucket(supabase);

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Generate Content Hash (SHA-256) for deduplication
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 2. Check if this exact file already exists for this tenant
    const { data: existing } = await (supabase.from("knowledge_base" as any) as any)
      .select("id, file_key")
      .eq("tenant_id", tenantId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    const fileKey =
      existing?.file_key ||
      `kb/${tenantId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // 3. Upload to Supabase Storage
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

    // 4. Save or Update in DB
    let documentId: string;
    let documentData: any;

    if (existing) {
      // Re-index existing document and update metadata
      documentId = existing.id;
      const { data: updated, error: updateErr } = await (supabase.from("knowledge_base" as any) as any)
        .update({
          name: name || file.name,
          description: description || "",
          file_url: fileUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .select()
        .single();

      if (updateErr) throw updateErr;
      documentData = updated;

      // Clean previous embeddings before re-indexing
      try {
        await (supabase.from("knowledge_base_embeddings" as any) as any)
          .delete()
          .eq("knowledge_base_id", documentId);
      } catch {
        // Non-blocking
      }
    } else {
      const { data: inserted, error: insertErr } = await (supabase.from("knowledge_base" as any) as any)
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

      if (insertErr) throw insertErr;
      documentData = inserted;
      documentId = inserted.id;
    }

    // 5. VECTORIZATION & TEXT EXTRACTION
    try {
      let text = "";
      const isPdf = file.type?.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        text = await extractTextFromPdf(buffer);
      } else {
        text = buffer.toString("utf-8");
      }

      await indexKnowledgeText(
        tenantId,
        documentId,
        documentData.name || file.name,
        fileKey,
        text,
        supabase
      );
    } catch (idxError) {
      console.warn("⚠️ [KNOWLEDGE_INDEXING] Document saved but indexing skipped:", idxError);
    }

    return { success: true, data: documentData };
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
  tenant_id?: string;
}) {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await resolveTenantId(payload.tenant_id);

  if (!tenantId) return { success: false, error: "No se pudo identificar el tenant actual." };

  const { name, description = "", content } = payload;
  if (!name?.trim()) return { success: false, error: "El nombre es obligatorio." };
  if (!content?.trim()) return { success: false, error: "El contenido no puede estar vacío." };

  try {
    await ensureKnowledgeBucket(supabase);

    const textBuffer = Buffer.from(content, "utf-8");
    const contentHash = crypto.createHash("sha256").update(textBuffer).digest("hex");

    // Check duplicate
    const { data: existing } = await (supabase.from("knowledge_base" as any) as any)
      .select("id, file_key")
      .eq("tenant_id", tenantId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    const safeName = name.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = existing?.file_key || `text/${tenantId}/${Date.now()}_${safeName}.md`;
    const fileUrl = `text://${fileKey}`;

    // Optional: save backup to Supabase storage as markdown
    try {
      await supabase.storage.from("knowledge_base").upload(fileKey, textBuffer, {
        contentType: "text/markdown; charset=utf-8",
        upsert: true,
      });
    } catch {
      // Non-blocking
    }

    let documentId: string;
    let documentData: any;

    if (existing) {
      documentId = existing.id;
      const { data: updated, error: updateErr } = await (supabase.from("knowledge_base" as any) as any)
        .update({
          name: name.trim(),
          description: description.trim(),
          file_url: fileUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .select()
        .single();

      if (updateErr) throw updateErr;
      documentData = updated;

      try {
        await (supabase.from("knowledge_base_embeddings" as any) as any)
          .delete()
          .eq("knowledge_base_id", documentId);
      } catch {
        // Non-blocking
      }
    } else {
      const { data: inserted, error: insertErr } = await (supabase.from("knowledge_base" as any) as any)
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

      if (insertErr) throw insertErr;
      documentData = inserted;
      documentId = inserted.id;
    }

    // Vectorize directly
    await indexKnowledgeText(
      tenantId,
      documentId,
      documentData.name,
      fileKey,
      content,
      supabase
    );

    return { success: true, data: documentData };
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
export async function deleteKnowledgeDocument(id: string, tenantIdParam?: string) {
  const supabase = await getAdminSupabaseClient();
  const tenantId = await resolveTenantId(tenantIdParam);

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
      // MinIO removed — Supabase Storage is the sole storage backend
    }

    // 2. Delete embeddings
    try {
      await supabase.from("knowledge_base_embeddings").delete().eq("knowledge_base_id", id);
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
