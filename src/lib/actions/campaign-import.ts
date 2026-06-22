"use server";

/**
 * Server Action: importar campaña desde Excel (.xlsx) o CSV.
 *
 * Sprint 3 phase-08 NEW-09.
 *
 * Flow:
 * 1. Recibe Buffer del archivo subido (FormData en el cliente).
 * 2. Parse con exceljs row-by-row (extrae primera worksheet).
 * 3. Valida cada fila con Zod — errores acumulados por fila, NO abortan todo.
 * 4. Inserta leads en batch con ON CONFLICT (dedup por teléfono).
 * 5. Devuelve `{ inserted, skipped, errors[] }` para feedback en UI.
 *
 * Rate-limit: aplicado vía withRateLimit (10 imports/min/tenant — los imports
 * son operaciones pesadas, generan miles de filas).
 */

import ExcelJS from "exceljs";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { createLogger } from "@/lib/utils/logger";
import { withRateLimit } from "@/lib/api/with-rate-limit";
import {
  CampaignImportRowSchema,
  parseTagsField,
  type CampaignImportError,
  type CampaignImportResult,
} from "@/lib/schemas/campaign-import";

const log = createLogger("campaign-import");

const REQUIRED_COLUMNS = ["nombre", "telefono"] as const;

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, unknown>;
}

/**
 * Parsea un Buffer XLSX a array de filas con sus índices (1-based, excluyendo header).
 * Lanza si el archivo no es válido o no tiene primera worksheet.
 */
async function parseXlsxBuffer(buffer: Buffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Archivo Excel sin hojas. Añade al menos una worksheet.");

  // Primera fila = headers (lowercase + trim)
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "")
      .trim()
      .toLowerCase();
  });

  // Verifica columnas obligatorias.
  for (const req of REQUIRED_COLUMNS) {
    if (!headers.includes(req)) {
      throw new Error(
        `Falta columna obligatoria "${req}". Columnas válidas: ${REQUIRED_COLUMNS.join(", ")}, email, pais, tags`
      );
    }
  }

  const rows: ParsedRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const raw: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber - 1];
      if (key) raw[key] = cell.value;
    });
    rows.push({ rowIndex: rowNumber, raw });
  });

  return rows;
}

/**
 * Server Action raw — NO usar directo. Usar `importCampaignFromExcel` (wrapped).
 */
async function _importCampaignFromExcel(input: {
  campaignName: string;
  fileBuffer: Buffer | Uint8Array;
}): Promise<CampaignImportResult | { success: false; error: string }> {
  const tenant = await getActiveTenantConfig();
  if (!tenant) {
    return { success: false, error: "Tenant no encontrado. Inicia sesión de nuevo." };
  }

  const supabase = await getSupabaseServerClient();
  const buffer = Buffer.isBuffer(input.fileBuffer)
    ? input.fileBuffer
    : Buffer.from(input.fileBuffer);

  let parsedRows: ParsedRow[];
  try {
    parsedRows = await parseXlsxBuffer(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error parseando archivo";
    log.error("Excel parse failed", { tenant_id: tenant.id, error: message });
    return { success: false, error: message };
  }

  // Crea campaña (slug auto-generado).
  const slug = input.campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typegen sin actualizar (tabla campaigns Sprint 3)
  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .insert({
      tenant_id: tenant.id,
      name: input.campaignName,
      slug,
      status: "draft",
      source: "excel_import",
    })
    .select("id")
    .single();

  if (campaignErr || !campaign) {
    log.error("Failed to create campaign", {
      tenant_id: tenant.id,
      error: campaignErr?.message,
    });
    return {
      success: false,
      error: `No se pudo crear la campaña: ${campaignErr?.message ?? "error desconocido"}`,
    };
  }

  // Valida + inserta leads.
  const errors: CampaignImportError[] = [];
  const validLeads: {
    tenant_id: string;
    nombre: string;
    telefono: string;
    email: string | null;
    pais: string | null;
    campana: string;
    tags: string[];
  }[] = [];

  for (const { rowIndex, raw } of parsedRows) {
    const parsed = CampaignImportRowSchema.safeParse({
      nombre: String(raw.nombre ?? "").trim(),
      telefono: String(raw.telefono ?? "").trim(),
      email: raw.email ? String(raw.email).trim() : undefined,
      pais: raw.pais ? String(raw.pais).trim() : undefined,
      tags: raw.tags ? String(raw.tags).trim() : undefined,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: rowIndex,
          field: issue.path.join("."),
          message: issue.message,
          value: raw[issue.path[0] as string],
        });
      }
      continue;
    }

    validLeads.push({
      tenant_id: tenant.id,
      nombre: parsed.data.nombre,
      telefono: parsed.data.telefono,
      email: parsed.data.email || null,
      pais: parsed.data.pais || null,
      campana: input.campaignName,
      tags: parseTagsField(parsed.data.tags),
    });
  }

  // Insert batched con upsert por teléfono+tenant (dedup).
  let inserted = 0;
  let skipped = 0;

  if (validLeads.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typegen sin actualizar (columna tags en leads Sprint 3)
    const { data: insertedRows, error: insertErr } = await supabase
      .from("leads")
      .upsert(validLeads, { onConflict: "tenant_id,telefono", ignoreDuplicates: true })
      .select("id");

    if (insertErr) {
      log.error("Bulk insert leads failed", {
        tenant_id: tenant.id,
        campaign_id: campaign.id,
        attempted: validLeads.length,
        error: insertErr.message,
      });
      return {
        success: false,
        error: `Error insertando leads: ${insertErr.message}`,
      };
    }

    inserted = insertedRows?.length ?? 0;
    skipped = validLeads.length - inserted;
  }

  log.info("Campaign import completed", {
    tenant_id: tenant.id,
    campaign_id: campaign.id,
    totalRows: parsedRows.length,
    inserted,
    skipped,
    errorCount: errors.length,
  });

  return {
    totalRows: parsedRows.length,
    inserted,
    skipped,
    errors,
  };
}

/**
 * Server Action pública con rate limit aplicado.
 * Límite: 10 imports/min por tenant (cada uno puede traer hasta 10k leads).
 */
export const importCampaignFromExcel = withRateLimit(_importCampaignFromExcel, {
  key: "campaign-import",
  perMinute: 10,
  identify: async () => {
    const tenant = await getActiveTenantConfig();
    return tenant?.id ?? "";
  },
});
