// Sprint 5 - Zoho CRM entrada de leads (event-driven)
//
// Mapea un CRMLead (forma que devuelve ZohoCRMProvider.getLead) al payload
// interno AF: { lead, lead_cualificacion, metadata }. Aplica el field_mapping
// configurable del tenant; si está vacío usa el mapeo default desde
// CRMLead.fields + raw (Lead_Status -> current_stage, etc.).
//
// Referencias:
//   - src/lib/integrations/crm/providers/zoho.ts (forma CRMLead.fields)
//   - src/lib/integrations/sheets/row-mapper.ts (patrón mapeo + targets)
//   - src/lib/schemas/_base.ts (LeadStageEnum)

import { CRMLead } from "../crm/interface";
import { LeadStageEnum, type LeadStage } from "@/lib/schemas/_base";
import { ZohoFieldMapping } from "./types";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("zoho-pull.lead-mapper");

export interface MappedZohoLead {
  lead: Record<string, unknown>;
  lead_cualificacion: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ─── Normalización de stages Zoho (Lead_Status libre) → LeadStageEnum ───────
//
// El Lead_Status de Zoho es texto libre que cada tenant configura. Mapeamos las
// variantes más comunes (ES + inglés) a nuestro enum. Fallback QUALIFICATION.

const STAGE_LOOKUP: Record<string, LeadStage> = {
  // QUALIFICATION
  nuevo: "QUALIFICATION",
  new: "QUALIFICATION",
  "not contacted": "QUALIFICATION",
  "no contactado": "QUALIFICATION",
  cualificando: "QUALIFICATION",
  "pre-qualified": "QUALIFICATION",
  // SCHEDULING
  contactado: "SCHEDULING",
  contacted: "SCHEDULING",
  cualificado: "SCHEDULING",
  qualified: "SCHEDULING",
  agendando: "SCHEDULING",
  scheduling: "SCHEDULING",
  // COMPLETED
  cita: "COMPLETED",
  "cita confirmada": "COMPLETED",
  booked: "COMPLETED",
  completado: "COMPLETED",
  completed: "COMPLETED",
  converted: "COMPLETED",
  convertido: "COMPLETED",
  // DROPPED
  descartado: "DROPPED",
  dropped: "DROPPED",
  "junk lead": "DROPPED",
  "lost lead": "DROPPED",
  perdido: "DROPPED",
  basura: "DROPPED",
  // UNREACHABLE
  ilocalizable: "UNREACHABLE",
  unreachable: "UNREACHABLE",
  "attempted to contact": "UNREACHABLE",
};

export function normalizeZohoStage(zohoStatus: unknown): LeadStage {
  const key = String(zohoStatus ?? "")
    .trim()
    .toLowerCase();
  if (!key) return LeadStageEnum.enum.QUALIFICATION;
  const matched = STAGE_LOOKUP[key];
  if (matched) return matched;
  log.warn("Lead_Status Zoho sin mapeo, usando QUALIFICATION", {
    // No es PII; es un estado de pipeline (texto de configuración).
    zoho_status: key.slice(0, 40),
  });
  return LeadStageEnum.enum.QUALIFICATION;
}

// ─── Default mapping (cuando field_mapping del tenant está vacío) ───────────

function defaultMap(zohoLead: CRMLead): MappedZohoLead {
  const f = zohoLead.fields ?? {};
  const raw = (zohoLead.raw ?? {}) as Record<string, unknown>;

  const lead: Record<string, unknown> = {};
  if (f.nombre) lead.nombre = String(f.nombre);
  if (f.apellido) lead.apellido = String(f.apellido);
  if (f.email) lead.email = String(f.email);
  if (f.telefono) lead.telefono = String(f.telefono);
  if (f.pais) lead.pais = String(f.pais);
  // El Lead_Source de Zoho ("Zoho Web", "Facebook"...) es la CAMPAÑA/canal de
  // origen del lead, NO nuestro campo `origen` (que es la procedencia del
  // sistema = 'zoho_crm', lo fija el event-processor). Va a `campana` + metadata.
  if (f.source) lead.campana = String(f.source);

  lead.id_lead_externo = zohoLead.id;
  lead.current_stage = normalizeZohoStage(raw.Lead_Status);

  const metadata: Record<string, unknown> = {
    zoho_lead_source: f.source ?? raw.Lead_Source,
    zoho_lead_status: raw.Lead_Status,
  };

  return { lead, lead_cualificacion: {}, metadata };
}

// ─── Custom mapping (field_mapping del tenant) ──────────────────────────────

function setTarget(out: MappedZohoLead, target: string, value: unknown): void {
  const [section, field] = target.split(".");
  if (!field) return;
  if (section === "lead") out.lead[field] = value;
  else if (section === "lead_cualificacion") out.lead_cualificacion[field] = value;
  else if (section === "metadata") out.metadata[field] = value;
}

/**
 * Mapea el CRMLead de Zoho al payload interno. Si `fieldMapping` trae entries,
 * cada `zoho_field` se lee de `raw` (claves originales Zoho) y se vuelca en el
 * `target`. Siempre se asegura `id_lead_externo` y `current_stage`.
 */
export function mapZohoLeadToInternal(
  zohoLead: CRMLead,
  fieldMapping?: ZohoFieldMapping
): MappedZohoLead {
  if (!fieldMapping || fieldMapping.length === 0) {
    return defaultMap(zohoLead);
  }

  const raw = (zohoLead.raw ?? {}) as Record<string, unknown>;
  const out: MappedZohoLead = { lead: {}, lead_cualificacion: {}, metadata: {} };

  for (const entry of fieldMapping) {
    const value = raw[entry.zoho_field];
    if (value === undefined || value === null) continue;
    setTarget(out, entry.target, value);
  }

  // Garantizar campos clave aunque el mapping del tenant no los incluya.
  out.lead.id_lead_externo = out.lead.id_lead_externo ?? zohoLead.id;
  if (out.lead.current_stage === undefined) {
    out.lead.current_stage = normalizeZohoStage(raw.Lead_Status);
  } else {
    // El tenant mapeó un campo crudo de Zoho a current_stage → normalizarlo.
    out.lead.current_stage = normalizeZohoStage(out.lead.current_stage);
  }
  out.metadata.zoho_lead_status = out.metadata.zoho_lead_status ?? raw.Lead_Status;

  return out;
}

// ─── Sugerencia de mapping inicial (UI Fase 04) ─────────────────────────────

/**
 * A partir de las claves de `raw` de un lead de ejemplo, sugiere un field_mapping
 * inicial editable en la UI. Mapea los campos Zoho conocidos a sus targets AF.
 */
export function suggestFieldMapping(sampleLead: CRMLead): ZohoFieldMapping {
  const raw = (sampleLead.raw ?? {}) as Record<string, unknown>;
  const KNOWN: Record<string, string> = {
    First_Name: "lead.nombre",
    Last_Name: "lead.apellido",
    Email: "lead.email",
    Phone: "lead.telefono",
    Mobile: "lead.telefono",
    Country: "lead.pais",
    Lead_Source: "lead.campana",
    Lead_Status: "lead.current_stage",
  };

  const suggestion: ZohoFieldMapping = [];
  for (const zohoField of Object.keys(raw)) {
    const target = KNOWN[zohoField];
    if (target) suggestion.push({ zoho_field: zohoField, target });
  }
  return suggestion;
}
