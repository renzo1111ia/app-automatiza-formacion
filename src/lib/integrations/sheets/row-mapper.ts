// Sprint 4 - Google Sheets bidireccional
//
// Convierte una fila Sheet (array de valores por columna) en un payload
// estructurado { lead, lead_cualificacion, metadata } segun el column_mapping
// de la SheetConnection. Aplica coercion por tipo y validacion estricta.
//
// Tambien expone helpers para hashear filas (idempotencia) y traducir letras
// de columna Sheet (A, B, ..., AA, AB, ...) a indices numericos.

import { createHash } from "crypto";
import {
  ColumnMapping,
  ColumnMappingEntry,
  ColumnType,
  EstadoEnum,
  MotivoDescarteEnum,
  NivelEstudiosEnum,
  QualifiedEnum,
  SheetsAdapterError,
} from "./types";
import { LeadStageEnum } from "@/lib/schemas/_base";

// ─── Helpers de columnas Sheet ─────────────────────────────────────────────

/** Convierte "A" -> 0, "B" -> 1, "Z" -> 25, "AA" -> 26, "AB" -> 27. */
export function letterToIndex(letter: string): number {
  if (!/^[A-Z]+$/.test(letter)) {
    throw new SheetsAdapterError("MAPPING_INVALID", `Letra de columna inválida: ${letter}`);
  }
  let n = 0;
  for (const ch of letter) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** Inversa: 0 -> "A", 26 -> "AA". Usada por write-back para componer rangos. */
export function indexToLetter(index: number): string {
  if (index < 0) throw new SheetsAdapterError("MAPPING_INVALID", `Índice negativo: ${index}`);
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ─── Hash de fila (idempotencia) ───────────────────────────────────────────

/**
 * SHA-256 de la fila. Si el hash coincide con el ultimo procesado para esa
 * (sheet_connection_id, row_index), se skipea sin tocar el lead.
 *
 * `ignoreIndices`: columnas (0-based) a EXCLUIR del hash. Se usa para la columna
 * de estado AF (semáforo): nuestra app la escribe, y como esa escritura dispara
 * un webhook Drive, si entrara en el hash provocaría un re-pull en bucle. Al
 * excluirla, escribir en AF nunca cambia el hash → el re-pull hace SKIP.
 */
export function hashRow(rowValues: unknown[], ignoreIndices: number[] = []): string {
  const ignore = new Set(ignoreIndices);
  const serialized = JSON.stringify(
    rowValues.map((v, idx) =>
      ignore.has(idx) ? null : v === undefined || v === null ? "" : String(v)
    )
  );
  return createHash("sha256").update(serialized).digest("hex");
}

// ─── Coercion por tipo ─────────────────────────────────────────────────────

function parseBoolean(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (["true", "sí", "si", "yes", "y", "1", "x", "verdadero"].includes(s)) return true;
  if (["false", "no", "n", "0", "", "falso"].includes(s)) return false;
  return null;
}

function parseNumber(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Formatos aceptados: ISO 8601, DD/MM/YYYY [HH:mm], DD-MM-YYYY [HH:mm], YYYY-MM-DD [HH:mm].
function parseDateTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO directo
  const direct = new Date(s);
  if (!isNaN(direct.getTime()) && /\d{4}-\d{2}-\d{2}/.test(s)) {
    return direct.toISOString();
  }

  // DD/MM/YYYY o DD-MM-YYYY [HH:mm[:ss]]
  const m = s.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const [, d, mo, yRaw, h = "0", mi = "0", se = "0"] = m;
    const y = yRaw.length === 2 ? "20" + yRaw : yRaw;
    const iso = new Date(
      Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se))
    );
    if (!isNaN(iso.getTime())) return iso.toISOString();
  }
  return null;
}

function coerceValue(raw: unknown, type: ColumnType): unknown {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (str === "") return null;

  switch (type) {
    case "string":
    case "text":
    case "json":
      return type === "json" ? safeParseJson(str) : str;
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) ? str.toLowerCase() : null;
    case "phone":
      return str.replace(/[^\d+]/g, "") || null;
    case "url":
      try {
        return new URL(str).toString();
      } catch {
        return null;
      }
    case "number":
      return parseNumber(str);
    case "boolean":
      return parseBoolean(str);
    case "date":
    case "datetime":
      return parseDateTime(str);
    case "enum:lead_stage": {
      const r = LeadStageEnum.safeParse(str.toUpperCase());
      return r.success ? r.data : null;
    }
    case "enum:qualified": {
      const r = QualifiedEnum.safeParse(str.toLowerCase());
      return r.success ? r.data : null;
    }
    case "enum:estado": {
      const r = EstadoEnum.safeParse(str.toLowerCase());
      return r.success ? r.data : null;
    }
    case "enum:motivo_descarte": {
      const r = MotivoDescarteEnum.safeParse(str);
      return r.success ? r.data : null;
    }
    case "enum:nivel_estudios": {
      const r = NivelEstudiosEnum.safeParse(str);
      return r.success ? r.data : null;
    }
    default:
      return str;
  }
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ─── Mapear fila a payload ─────────────────────────────────────────────────

export interface MappedRow {
  lead: Record<string, unknown>;
  lead_cualificacion: Record<string, unknown>;
  metadata: Record<string, unknown>;
  /** Indice 0-based de la fila en la Sheet (real, no relativo a data_start_row). */
  rowIndex: number;
  /** Hash de la fila completa para idempotencia. */
  rowHash: string;
  /** Errores no fatales por columna (se reportan pero no bloquean). */
  warnings: Array<{ letter: string; target: string; reason: string }>;
}

/**
 * Mapea una fila Sheet (array indexado por posicion de columna 0-based) usando
 * el ColumnMapping al payload estructurado.
 */
export function mapRowToLead(
  rowValues: unknown[],
  rowIndex: number,
  mapping: ColumnMapping
): MappedRow {
  // La columna semáforo AF (status_column) se excluye del hash: nuestra app la
  // escribe y no debe contar como "cambio de la fila" (evita bucle de re-pull).
  const ignoreIdx = mapping.status_column ? [letterToIndex(mapping.status_column)] : [];
  const out: MappedRow = {
    lead: {},
    lead_cualificacion: {},
    metadata: {},
    rowIndex,
    rowHash: hashRow(rowValues, ignoreIdx),
    warnings: [],
  };

  for (const col of mapping.columns) {
    const idx = letterToIndex(col.letter);
    const raw = rowValues[idx];
    const coerced = coerceValue(raw, col.type);

    if (coerced === null && raw !== undefined && raw !== null && String(raw).trim() !== "") {
      out.warnings.push({
        letter: col.letter,
        target: col.target,
        reason: `No se pudo convertir "${raw}" a tipo ${col.type}`,
      });
      continue;
    }
    if (coerced === null) continue;

    const [bucket, field] = col.target.split(".") as [
      "lead" | "lead_cualificacion" | "metadata",
      string,
    ];
    out[bucket][field] = coerced;
  }

  return out;
}

// ─── Validación de columnas obligatorias del mapeo ─────────────────────────

/**
 * Columnas que el flujo agéntico AF necesita SÍ o SÍ para procesar un lead
 * (verificado contra orchestrator.ts, 03-06-2026):
 *  - lead.email     → identidad + sync CRM.
 *  - lead.telefono  → canal de contacto IA (llamada / WhatsApp).
 *  - lead.nombre    → personalización de mensajes.
 *  - lead.campana   → entry_filters del orquestador (allowed_campaigns). Además
 *    justifica el modelo "un contacto, N leads por campaña/formación distinta".
 *
 * `lead.pais` NO es obligatorio en la Sheet: se deriva del prefijo telefónico;
 * solo si no se puede derivar la UI lo pedirá durante el mapeo.
 */
export const REQUIRED_MAPPING_TARGETS = [
  "lead.email",
  "lead.telefono",
  "lead.nombre",
  "lead.campana",
] as const;

export interface MappingValidation {
  ok: boolean;
  /** Targets obligatorios que faltan en el mapeo. */
  missing: string[];
  /** true si falta mapear lead.pais (se podrá derivar del teléfono, pero conviene avisar). */
  paisMissing: boolean;
}

/** Etiqueta legible (español) de cada target obligatorio, para el aviso UI. */
export const MAPPING_TARGET_LABEL: Record<string, string> = {
  "lead.email": "Email",
  "lead.telefono": "Teléfono",
  "lead.nombre": "Nombre",
  "lead.campana": "Campaña",
  "lead.pais": "País",
};

/**
 * Comprueba que el mapeo cubre las columnas obligatorias. Lógica pura
 * (testeable). La UI del wizard la usa para avisar antes de guardar.
 */
export function validateMappingRequiredColumns(mapping: ColumnMapping): MappingValidation {
  const mappedTargets = new Set(mapping.columns.map((c) => c.target));
  const missing = REQUIRED_MAPPING_TARGETS.filter((t) => !mappedTargets.has(t));
  return {
    ok: missing.length === 0,
    missing,
    paisMissing: !mappedTargets.has("lead.pais"),
  };
}

// ─── Inverso para write-back: payload -> celdas a escribir ────────────────

export interface WritebackCell {
  letter: string;
  rowIndex: number;
  value: string | number | boolean | null;
}

/**
 * Dado un mapping y un set de cambios al lead, devuelve las celdas concretas
 * a actualizar en la Sheet (solo columnas con writeback=true).
 */
export function buildWritebackCells(
  mapping: ColumnMapping,
  rowIndex: number,
  changes: Record<string, unknown>
): WritebackCell[] {
  const cells: WritebackCell[] = [];
  for (const col of mapping.columns) {
    if (!col.writeback) continue;
    if (!(col.target in changes)) continue;
    const value = changes[col.target];
    cells.push({
      letter: col.letter,
      rowIndex,
      value: formatCellValue(value, col),
    });
  }
  return cells;
}

function formatCellValue(
  value: unknown,
  col: ColumnMappingEntry
): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (col.type === "boolean") return Boolean(value);
  if (col.type === "number") return typeof value === "number" ? value : Number(value) || 0;
  if (col.type === "datetime" || col.type === "date") {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return d.toISOString();
  }
  return String(value);
}
