"use server";

// Sprint 4 - Server actions Google Sheets.
//
// Gestionan el ciclo de vida de las sheet_connections de un tenant:
//   - saveAppCredentialsAction: Client ID/Secret de la app del tenant.
//   - listConnectedSheetsAction: lista las Sheets conectadas.
//   - connectSheetAction: registra una Sheet seleccionada por Picker + watch.
//   - updateSheetMappingAction: cambia column_mapping de una Sheet.
//   - toggleSheetActiveAction: pausa/reactiva sync.
//   - disconnectSheetAction: borra connection + stopWatch + cleanup.
//   - getConnectionStatusAction: estado para UI (OAuth conectado, email, etc.).
//   - triggerManualPullAction: encola un pull manual (boton "sincronizar ya").

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { requireCurrentTenant } from "./session";
import { getAppCredentials, getSheetsIntegration, setAppCredentials } from "./credentials";
import { GoogleSheetsAdapter } from "./adapter";
import {
  ColumnMapping,
  ColumnMappingSchema,
  PurposeEnum,
  SheetConnection,
  SheetsAdapterError,
} from "./types";
import { enqueueSheetPull } from "./queue";

const REVALIDATE_PATH = "/dashboard/settings/integraciones/google-sheets";

// ─── Save app credentials ──────────────────────────────────────────────────

const SaveCredentialsSchema = z.object({
  clientId: z.string().min(10, "Client ID demasiado corto"),
  clientSecret: z.string().min(10, "Client Secret demasiado corto"),
});

export async function saveAppCredentialsAction(
  input: z.infer<typeof SaveCredentialsSchema>
): Promise<{ ok: true; integrationId: string } | { ok: false; error: string }> {
  try {
    const parsed = SaveCredentialsSchema.parse(input);
    const { tenantId } = await requireCurrentTenant();
    const integrationId = await setAppCredentials(tenantId, parsed);
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, integrationId };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── List connected sheets ─────────────────────────────────────────────────

export async function listConnectedSheetsAction(): Promise<
  | {
      ok: true;
      integration: { connected: boolean; email: string | null } | null;
      sheets: SheetConnection[];
    }
  | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getSheetsIntegration(tenantId);
    const supabase = await getAdminSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("sheet_connections" as any) as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const connected = Boolean(integration?.credentials_cipher);
    const email =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (integration?.metadata as any)?.connected_email ?? null;

    return {
      ok: true,
      integration: integration ? { connected, email } : null,
      sheets: (data as SheetConnection[]) ?? [],
    };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── Connect new Sheet (post-Picker) ───────────────────────────────────────

const ConnectSheetSchema = z.object({
  spreadsheetId: z.string().min(10),
  spreadsheetName: z.string().optional(),
  sheetTabName: z.string().default("Hoja 1"),
  purpose: PurposeEnum.default("leads_inbound"),
  columnMapping: ColumnMappingSchema,
  writebackEnabled: z.boolean().default(false),
});

export async function connectSheetAction(
  input: z.infer<typeof ConnectSheetSchema>
): Promise<{ ok: true; sheetConnectionId: string } | { ok: false; error: string }> {
  try {
    const parsed = ConnectSheetSchema.parse(input);
    const { tenantId, userId } = await requireCurrentTenant();
    const integration = await getSheetsIntegration(tenantId);
    if (!integration) {
      throw new SheetsAdapterError(
        "OAUTH_MISSING",
        "Conecta primero tu cuenta Google antes de añadir una Sheet"
      );
    }

    const supabase = await getAdminSupabaseClient();

    // 1. Insert row sin watch (caso fallback) - aseguramos atomicidad luego.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insertErr } = await (
      supabase.from("sheet_connections" as any) as any
    )
      .insert({
        tenant_id: tenantId,
        integration_id: integration.id,
        spreadsheet_id: parsed.spreadsheetId,
        spreadsheet_name: parsed.spreadsheetName ?? null,
        sheet_tab_name: parsed.sheetTabName,
        purpose: parsed.purpose,
        column_mapping: parsed.columnMapping,
        writeback_enabled: parsed.writebackEnabled,
        is_active: true,
        created_by: userId,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      throw new Error(`Error creando connection: ${insertErr?.message ?? "unknown"}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sheetConnectionId = (inserted as any).id as string;

    // 2. setupWatch (best-effort - si falla la connection queda sin webhook,
    // el tenant puede reintentar desde la UI).
    try {
      const adapter = await GoogleSheetsAdapter.forTenant(tenantId);
      const watch = await adapter.setupWatch(parsed.spreadsheetId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("sheet_connections" as any) as any)
        .update({
          drive_channel_id: watch.channelId,
          drive_channel_token: watch.channelToken,
          drive_resource_id: watch.resourceId,
          drive_channel_expiry: watch.expiry.toISOString(),
        })
        .eq("id", sheetConnectionId);
    } catch (watchErr) {
      console.warn("[connectSheetAction] setupWatch falló (connection creada igual):", watchErr);
    }

    // 3. Disparar primer pull manual para sincronizar lo existente.
    try {
      await enqueueSheetPull({
        sheet_connection_id: sheetConnectionId,
        tenant_id: tenantId,
        trigger: "manual",
        triggered_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[connectSheetAction] enqueue inicial fallo:", e);
    }

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, sheetConnectionId };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── Update mapping ───────────────────────────────────────────────────────

const UpdateMappingSchema = z.object({
  sheetConnectionId: z.string().uuid(),
  columnMapping: ColumnMappingSchema,
  purpose: PurposeEnum.optional(),
  writebackEnabled: z.boolean().optional(),
  sheetTabName: z.string().optional(),
});

export async function updateSheetMappingAction(
  input: z.infer<typeof UpdateMappingSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = UpdateMappingSchema.parse(input);
    const { tenantId } = await requireCurrentTenant();
    const supabase = await getAdminSupabaseClient();

    const updates: Record<string, unknown> = { column_mapping: parsed.columnMapping };
    if (parsed.purpose !== undefined) updates.purpose = parsed.purpose;
    if (parsed.writebackEnabled !== undefined) updates.writeback_enabled = parsed.writebackEnabled;
    if (parsed.sheetTabName !== undefined) updates.sheet_tab_name = parsed.sheetTabName;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("sheet_connections" as any) as any)
      .update(updates)
      .eq("id", parsed.sheetConnectionId)
      .eq("tenant_id", tenantId);
    if (error) throw error;

    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── Toggle active ─────────────────────────────────────────────────────────

export async function toggleSheetActiveAction(
  sheetConnectionId: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("sheet_connections" as any) as any)
      .update({ is_active: isActive })
      .eq("id", sheetConnectionId)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── Disconnect (eliminar) ─────────────────────────────────────────────────

export async function disconnectSheetAction(
  sheetConnectionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const supabase = await getAdminSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (supabase.from("sheet_connections" as any) as any)
      .select("drive_channel_id, drive_resource_id")
      .eq("id", sheetConnectionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // best-effort stopWatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    if (r?.drive_channel_id && r?.drive_resource_id) {
      try {
        const adapter = await GoogleSheetsAdapter.forTenant(tenantId);
        await adapter.stopWatch(r.drive_channel_id, r.drive_resource_id);
      } catch (e) {
        console.warn("[disconnectSheetAction] stopWatch falló (ignorable):", e);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("sheet_connections" as any) as any)
      .delete()
      .eq("id", sheetConnectionId)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── Trigger manual pull ───────────────────────────────────────────────────

export async function triggerManualPullAction(
  sheetConnectionId: string
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const jobId = await enqueueSheetPull({
      sheet_connection_id: sheetConnectionId,
      tenant_id: tenantId,
      trigger: "manual",
      triggered_at: new Date().toISOString(),
    });
    return { ok: true, jobId };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── OAuth connect status ──────────────────────────────────────────────────

export async function getConnectionStatusAction(): Promise<
  | {
      ok: true;
      hasCredentials: boolean;
      oauthConnected: boolean;
      email: string | null;
      sheetsCount: number;
    }
  | { ok: false; error: string }
> {
  try {
    const { tenantId } = await requireCurrentTenant();
    const integration = await getSheetsIntegration(tenantId);
    const hasCredentials =
      Boolean(integration?.app_client_id_cipher) && Boolean(integration?.app_client_secret_cipher);
    const oauthConnected = Boolean(integration?.credentials_cipher);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const email = (integration?.metadata as any)?.connected_email ?? null;

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase.from("sheet_connections" as any) as any)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    return {
      ok: true,
      hasCredentials,
      oauthConnected,
      email,
      sheetsCount: count ?? 0,
    };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ─── Sugerencia de mapping inicial a partir de cabeceras ───────────────────

const SuggestMappingSchema = z.object({
  spreadsheetId: z.string().min(10),
  sheetTabName: z.string().default("Hoja 1"),
});

export async function suggestMappingAction(input: z.infer<typeof SuggestMappingSchema>): Promise<
  | {
      ok: true;
      headers: string[];
      suggestedMapping: ColumnMapping;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = SuggestMappingSchema.parse(input);
    const { tenantId } = await requireCurrentTenant();
    const adapter = await GoogleSheetsAdapter.forTenant(tenantId);
    const rows = await adapter.readRows(parsed.spreadsheetId, parsed.sheetTabName);
    const headers = (rows[0] ?? []).map((v) => String(v ?? "").trim());

    const suggested = suggestMappingFromHeaders(headers);
    return { ok: true, headers, suggestedMapping: suggested };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// Heuristica para mapear nombres comunes de columnas a targets del catalogo.
function suggestMappingFromHeaders(headers: string[]): ColumnMapping {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

  const map: Array<{ patterns: string[]; target: string; type: string; writeback?: boolean }> = [
    {
      patterns: ["id externo", "id lead", "id_externo"],
      target: "lead.id_lead_externo",
      type: "string",
    },
    { patterns: ["nombre", "name", "first name"], target: "lead.nombre", type: "string" },
    {
      patterns: ["apellido", "apellidos", "last name", "surname"],
      target: "lead.apellido",
      type: "string",
    },
    { patterns: ["email", "correo", "e-mail"], target: "lead.email", type: "email" },
    {
      patterns: ["telefono", "teléfono", "phone", "movil", "móvil", "celular"],
      target: "lead.telefono",
      type: "phone",
    },
    { patterns: ["pais", "país", "country"], target: "lead.pais", type: "string" },
    { patterns: ["origen", "source", "fuente"], target: "lead.origen", type: "string" },
    { patterns: ["campana", "campaña", "campaign"], target: "lead.campana", type: "string" },
    {
      patterns: ["estado", "state", "stage"],
      target: "lead.current_stage",
      type: "enum:lead_stage",
      writeback: true,
    },
    { patterns: ["empresa", "company", "centro"], target: "metadata.empresa", type: "string" },
    { patterns: ["cargo", "puesto", "position", "job"], target: "metadata.cargo", type: "string" },
    { patterns: ["edad", "age"], target: "metadata.user_age", type: "number" },
    {
      patterns: ["profesion", "profesión", "profession"],
      target: "metadata.user_profession",
      type: "string",
    },
    {
      patterns: ["años exp", "anos exp", "years exp", "experiencia"],
      target: "metadata.year_experience",
      type: "number",
    },
    { patterns: ["estudios", "studies"], target: "metadata.user_studies", type: "string" },
    {
      patterns: ["nivel estudios", "nivel"],
      target: "metadata.nivel_estudios",
      type: "enum:nivel_estudios",
    },
    {
      patterns: ["motivacion", "motivación", "motivation"],
      target: "metadata.user_motivations",
      type: "text",
    },
    { patterns: ["curso", "course", "programa"], target: "metadata.curse_name", type: "string" },
    {
      patterns: ["cualificacion", "cualificación", "qualified"],
      target: "lead_cualificacion.cualificacion",
      type: "enum:qualified",
      writeback: true,
    },
    {
      patterns: ["motivo descarte", "motivo descarte", "descarte"],
      target: "lead_cualificacion.motivo_anulacion",
      type: "enum:motivo_descarte",
      writeback: true,
    },
    {
      patterns: ["fecha agenda", "agenda", "cita"],
      target: "metadata.fecha_agenda",
      type: "datetime",
      writeback: true,
    },
    { patterns: ["whatsapp", "ok whatsapp"], target: "metadata.ok_whatsapp", type: "boolean" },
    { patterns: ["notas", "notes", "observaciones"], target: "metadata.notas", type: "text" },
  ];

  const columns: ColumnMapping["columns"] = [];
  headers.forEach((header, idx) => {
    if (!header) return;
    const h = norm(header);
    const match = map.find((m) => m.patterns.some((p) => h.includes(p)));
    if (!match) return;
    columns.push({
      letter: indexToLetter(idx),
      header,
      target: match.target,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: match.type as any,
      writeback: match.writeback ?? false,
    });
  });

  return {
    header_row: 1,
    data_start_row: 2,
    columns:
      columns.length > 0
        ? columns
        : [
            // Si no hubo match, devolver al menos 1 columna (la primera con header) para que la UI muestre algo editable.
            {
              letter: "A",
              header: headers[0] ?? "Columna A",
              target: "metadata.notas",
              type: "string",
              writeback: false,
            },
          ],
  };
}

function indexToLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function errMsg(err: unknown): string {
  if (err instanceof SheetsAdapterError) return `[${err.code}] ${err.message}`;
  if (err instanceof z.ZodError) {
    return err.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}
