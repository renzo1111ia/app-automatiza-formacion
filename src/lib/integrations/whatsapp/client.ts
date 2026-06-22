/**
 * SPRINT 5.7 — Meta WhatsApp Client
 * src/lib/integrations/whatsapp/client.ts
 *
 * Dedicated outbound client for the WABA integration sprint.
 * Responsibilities:
 *   - Send template messages via Meta Cloud API
 *   - Sync templates from Meta to the DB (whatsapp_templates)
 *   - Process the outbox queue with rate-limit handling (429 → exponential backoff)
 *   - Opt-out middleware: abort send if phone is in blacklist
 *
 * The legacy WhatsAppBridge (src/lib/integrations/whatsapp.ts) handles
 * INBOUND messages and is kept for backwards compatibility.
 */

import axios, { AxiosError } from "axios";
import { createClient } from "@supabase/supabase-js";
import { getAuthServiceRoleKey } from "@/lib/auth-config";
import { requireEnvAny } from "@/lib/env";
import { normalizeWhatsAppNumber } from "@/lib/utils/phone-helper";
import { createLogger } from "@/lib/utils/logger";
import type { WhatsAppTemplate } from "@/lib/integrations/whatsapp";

const log = createLogger("meta-whatsapp-client");

const META_API_URL = "https://graph.facebook.com/v20.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WABAConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
}

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  language: string;
  /** Resolved components after variable mapping */
  components: MetaTemplateComponent[];
  config: WABAConfig;
  tenantId: string;
  leadId?: string;
  templateId?: string;
  /** If true, writes to outbox for async sending instead of sending inline */
  useOutbox?: boolean;
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  parameters: MetaTemplateParameter[];
}

export interface MetaTemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document";
  text?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  messageSid?: string;
  error?: string;
  errorCode?: string;
  blocked?: "OPT_OUT" | "RATE_LIMIT" | "CONFIG_ERROR";
}

export interface SyncResult {
  success: boolean;
  count: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// MetaWhatsAppClient
// ---------------------------------------------------------------------------

export class MetaWhatsAppClient {
  private getSupabase() {
    const supabaseUrl = requireEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
    return createClient(supabaseUrl, getAuthServiceRoleKey());
  }

  // ─── Opt-Out Check ──────────────────────────────────────────────────────────

  /**
   * Returns true if the phone number is in the opt-out blacklist for this tenant.
   * Fail-closed: if the check cannot be performed, we block the send.
   */
  async isOptedOut(tenantId: string, phone: string): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const normalized = normalizeWhatsAppNumber(phone);
      const { data, error } = await supabase
        .from("whatsapp_opt_out")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("phone", normalized)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        log.warn("Opt-out check failed — blocking (fail-closed)", {
          tenantId,
          phone,
          error: error.message,
        });
        return true; // fail-closed
      }
      return !!data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("Opt-out check threw — blocking (fail-closed)", { tenantId, phone, error: msg });
      return true;
    }
  }

  /**
   * Add a phone number to the opt-out blacklist.
   */
  async addToOptOut(
    tenantId: string,
    phone: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = this.getSupabase();
      const normalized = normalizeWhatsAppNumber(phone);
      const { error } = await supabase
        .from("whatsapp_opt_out")
        .upsert(
          { tenant_id: tenantId, phone: normalized, reason, is_active: true },
          { onConflict: "tenant_id,phone" }
        );
      if (error) return { success: false, error: error.message };
      log.info("Phone added to opt-out list", { tenantId, phone: normalized, reason });
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Remove a phone number from the opt-out blacklist (re-opt-in).
   */
  async removeFromOptOut(
    tenantId: string,
    phone: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = this.getSupabase();
      const normalized = normalizeWhatsAppNumber(phone);
      const { error } = await supabase
        .from("whatsapp_opt_out")
        .update({ is_active: false })
        .eq("tenant_id", tenantId)
        .eq("phone", normalized);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ─── Send Template ───────────────────────────────────────────────────────────

  /**
   * Send a WhatsApp template message directly (inline, no outbox).
   * Checks opt-out before sending.
   */
  async sendTemplate(options: SendTemplateOptions): Promise<SendResult> {
    const { to, templateName, language, components, config, tenantId, leadId, templateId } =
      options;

    // 1. Opt-out check
    const optedOut = await this.isOptedOut(tenantId, to);
    if (optedOut) {
      log.info("Send blocked: phone is in opt-out list", { tenantId, to });
      await this.writeLog(
        tenantId,
        to,
        "failed",
        leadId,
        templateId,
        undefined,
        "OPT_OUT",
        "Number is in opt-out blacklist"
      );
      return { success: false, blocked: "OPT_OUT", error: "Number is in opt-out blacklist" };
    }

    const normalized = normalizeWhatsAppNumber(to);
    const url = `${META_API_URL}/${config.phoneNumberId}/messages`;

    try {
      const response = await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          to: normalized,
          type: "template",
          template: {
            name: templateName,
            language: { code: language },
            components,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const messageSid: string | undefined = response.data?.messages?.[0]?.id;
      log.info("Template sent successfully", { tenantId, to, templateName, messageSid });

      await this.writeLog(tenantId, to, "sent", leadId, templateId, messageSid);
      return { success: true, messageSid };
    } catch (error) {
      const err = error as AxiosError<{ error?: { message?: string; code?: number } }>;
      const errorMessage = err.response?.data?.error?.message ?? err.message ?? "Unknown error";
      const errorCode = String(
        err.response?.data?.error?.code ?? err.response?.status ?? "unknown"
      );

      log.error("Template send failed", { tenantId, to, templateName, errorMessage, errorCode });
      await this.writeLog(
        tenantId,
        to,
        "failed",
        leadId,
        templateId,
        undefined,
        errorCode,
        errorMessage
      );

      // 429: rate limit — caller should use outbox
      if (err.response?.status === 429) {
        return { success: false, blocked: "RATE_LIMIT", error: errorMessage, errorCode };
      }

      return { success: false, error: errorMessage, errorCode };
    }
  }

  // ─── Outbox ──────────────────────────────────────────────────────────────────

  /**
   * Enqueue a template send into the outbox for async processing.
   */
  async enqueueTemplate(
    tenantId: string,
    to: string,
    templateName: string,
    language: string,
    components: MetaTemplateComponent[],
    leadId?: string,
    templateId?: string,
    scheduledAt?: Date
  ): Promise<{ success: boolean; outboxId?: string; error?: string }> {
    // Opt-out check before enqueuing
    const optedOut = await this.isOptedOut(tenantId, to);
    if (optedOut) {
      return { success: false, error: "OPT_OUT: Number is in opt-out blacklist" };
    }

    try {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from("whatsapp_message_outbox")
        .insert({
          tenant_id: tenantId,
          lead_id: leadId ?? null,
          template_id: templateId ?? null,
          phone_to: normalizeWhatsAppNumber(to),
          components,
          template_name: templateName,
          language,
          status: "pending",
          scheduled_at: scheduledAt?.toISOString() ?? new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, outboxId: data.id };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Process pending outbox entries for a given tenant.
   * Called by cron job or inline trigger.
   * Concurrency: processes up to `batchSize` items per run with exponential backoff on 429.
   */
  async processOutbox(
    tenantId: string,
    config: WABAConfig,
    batchSize: number = 5
  ): Promise<{ processed: number; failed: number }> {
    const supabase = this.getSupabase();
    let processed = 0;
    let failed = 0;

    // Claim pending rows
    const { data: rows, error } = await supabase
      .from("whatsapp_message_outbox")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(batchSize);

    if (error || !rows?.length) return { processed: 0, failed: 0 };

    for (const row of rows) {
      // Mark as processing
      await supabase
        .from("whatsapp_message_outbox")
        .update({ status: "processing", attempts: row.attempts + 1 })
        .eq("id", row.id);

      const result = await this.sendTemplate({
        to: row.phone_to,
        templateName: row.template_name,
        language: row.language,
        components: row.components as MetaTemplateComponent[],
        config,
        tenantId,
        leadId: row.lead_id ?? undefined,
        templateId: row.template_id ?? undefined,
      });

      if (result.success) {
        await supabase
          .from("whatsapp_message_outbox")
          .update({ status: "done", processed_at: new Date().toISOString() })
          .eq("id", row.id);
        processed++;
      } else if (result.blocked === "RATE_LIMIT" && row.attempts < row.max_attempts) {
        // Re-schedule with exponential backoff (2^attempts minutes)
        const backoffMs = Math.pow(2, row.attempts) * 60 * 1000;
        const retryAt = new Date(Date.now() + backoffMs).toISOString();
        await supabase
          .from("whatsapp_message_outbox")
          .update({ status: "pending", last_error: result.error, scheduled_at: retryAt })
          .eq("id", row.id);
        log.warn("Rate limited — rescheduled with backoff", {
          tenantId,
          outboxId: row.id,
          retryAt,
        });
      } else {
        await supabase
          .from("whatsapp_message_outbox")
          .update({ status: "failed", last_error: result.error })
          .eq("id", row.id);
        failed++;
      }
    }

    return { processed, failed };
  }

  // ─── Template Sync ───────────────────────────────────────────────────────────

  /**
   * Fetch templates from Meta Cloud API and upsert them into whatsapp_templates.
   */
  async syncTemplates(tenantId: string, config: WABAConfig): Promise<SyncResult> {
    try {
      const url = `${META_API_URL}/${config.wabaId}/message_templates`;
      const response = await axios.get<{ data: WhatsAppTemplate[] }>(url, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });

      const templates: WhatsAppTemplate[] = response.data?.data ?? [];

      if (!templates.length) {
        log.warn("No templates returned from Meta API", { tenantId });
        return { success: true, count: 0 };
      }

      const supabase = this.getSupabase();
      const upsertRows = templates.map((t) => ({
        tenant_id: tenantId,
        meta_id: t.id,
        name: t.name,
        category: t.category,
        language: t.language,
        status: t.status,
        components: t.components ?? [],
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("whatsapp_templates")
        .upsert(upsertRows, { onConflict: "tenant_id,meta_id" });

      if (error) {
        log.error("Failed to upsert templates", { tenantId, error: error.message });
        return { success: false, count: 0, error: error.message };
      }

      log.info("Templates synced successfully", { tenantId, count: templates.length });
      return { success: true, count: templates.length };
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      const errorMessage = err.response?.data?.error?.message ?? err.message ?? "Unknown error";
      log.error("Template sync failed", { tenantId, error: errorMessage });
      return { success: false, count: 0, error: errorMessage };
    }
  }

  /**
   * Get templates stored in the DB for a tenant.
   */
  async getTemplatesFromDB(
    tenantId: string,
    statusFilter?: string
  ): Promise<{ success: boolean; data?: WhatsAppDBTemplate[]; error?: string }> {
    try {
      const supabase = this.getSupabase();
      let query = supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data: data as WhatsAppDBTemplate[] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ─── Delivery Log ────────────────────────────────────────────────────────────

  private async writeLog(
    tenantId: string,
    phoneTo: string,
    status: string,
    leadId?: string,
    templateId?: string,
    messageSid?: string,
    errorCode?: string,
    errorMessage?: string
  ) {
    try {
      const supabase = this.getSupabase();
      await supabase.from("whatsapp_message_logs").insert({
        tenant_id: tenantId,
        lead_id: leadId ?? null,
        template_id: templateId ?? null,
        phone_to: phoneTo,
        message_sid: messageSid ?? null,
        status,
        error_code: errorCode ?? null,
        error_message: errorMessage ?? null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        failed_at: status === "failed" ? new Date().toISOString() : null,
      });
    } catch (e) {
      // Non-fatal: log write failure should not block the send result
      log.warn("Failed to write message log", { tenantId, error: String(e) });
    }
  }

  /**
   * Update a log entry from a Meta delivery/read webhook.
   */
  async updateLogFromWebhook(
    messageSid: string,
    status: "delivered" | "read" | "failed",
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const supabase = this.getSupabase();
      const updates: Record<string, unknown> = { status };
      if (status === "delivered") updates.delivered_at = new Date().toISOString();
      if (status === "read") updates.read_at = new Date().toISOString();
      if (status === "failed") {
        updates.failed_at = new Date().toISOString();
        updates.error_code = errorCode;
        updates.error_message = errorMessage;
      }
      await supabase.from("whatsapp_message_logs").update(updates).eq("message_sid", messageSid);
    } catch (e) {
      log.warn("Failed to update log from webhook", { messageSid, error: String(e) });
    }
  }
}

// ---------------------------------------------------------------------------
// Types from DB
// ---------------------------------------------------------------------------

export interface WhatsAppDBTemplate {
  id: string;
  tenant_id: string;
  meta_id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: MetaTemplateComponent[];
  variable_mapping: Record<string, string>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export type WhatsAppMessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

// Singleton export
export const metaWhatsAppClient = new MetaWhatsAppClient();
