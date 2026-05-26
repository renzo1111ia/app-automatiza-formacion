/**
 * Schemas Zod para importación de campañas desde Excel/CSV.
 *
 * Sprint 3 phase-08 NEW-09.
 *
 * Reglas de validación:
 * - `nombre`: obligatorio, 1-200 chars.
 * - `telefono`: obligatorio, formato E.164 laxo (+ opcional, 6-15 dígitos).
 * - `email`: opcional, validación standard.
 * - `pais`: opcional, ISO-3166-1 alpha-2 (ES, MX, AR, US, ...).
 * - `tags`: opcional, CSV string que se split en array.
 *
 * Límite por import: 10,000 filas (más que eso → split en múltiples archivos
 * para evitar bloquear el Worker BullMQ).
 */

import { z } from "zod";

export const CampaignImportRowSchema = z.object({
  nombre: z.string().min(1, "nombre vacío").max(200, "nombre >200 chars"),
  telefono: z.string().regex(/^\+?\d{6,15}$/, "teléfono inválido (formato E.164: +34612345678)"),
  email: z.string().email("email inválido").optional().or(z.literal("")),
  pais: z
    .string()
    .length(2, "país debe ser ISO-2 (ES, MX, ...)")
    .toUpperCase()
    .optional()
    .or(z.literal("")),
  tags: z.string().optional().or(z.literal("")),
});

export type CampaignImportRow = z.infer<typeof CampaignImportRowSchema>;

export const CampaignImportSchema = z
  .array(CampaignImportRowSchema)
  .max(10000, "máximo 10,000 filas por import; divide el archivo");

export type CampaignImport = z.infer<typeof CampaignImportSchema>;

export interface CampaignImportError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface CampaignImportResult {
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: CampaignImportError[];
}

/**
 * Normaliza tags CSV → array string limpio (trim, lowercase, dedup).
 */
export function parseTagsField(tags: string | undefined): string[] {
  if (!tags) return [];
  return Array.from(
    new Set(
      tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}
