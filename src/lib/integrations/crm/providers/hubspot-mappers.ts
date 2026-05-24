/**
 * Field mapping HubSpot ↔ VARIABLES DEFINIDAS del proyecto.
 *
 * Ref:
 *   - docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx
 *   - plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-01-hubspot.md §5
 */
import { CRMLead } from "../interface";

/** Mapeo VARIABLES DEFINIDAS → propiedades HubSpot (default contact schema). */
export const FIELD_MAP_TO_HUBSPOT: Record<string, string> = {
  nombre: "firstname",
  apellido: "lastname",
  email: "email",
  telefono: "phone",
  pais: "country",
  origen: "af_origen",
  ciudad: "city",
  empresa: "company",
};

/** Inverso para mapear contacto HubSpot → CRMLead.fields. */
export const FIELD_MAP_FROM_HUBSPOT: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAP_TO_HUBSPOT).map(([k, v]) => [v, k])
);

/** Properties HubSpot que SIEMPRE pedimos en GET para poder construir el lead normalizado. */
export const DEFAULT_HUBSPOT_PROPERTIES = [
  ...Object.values(FIELD_MAP_TO_HUBSPOT),
  "af_metadata_extra",
  "lifecyclestage",
  "createdate",
];

/** HubSpot contact (raw) → CRMLead normalizado. */
export function mapHubSpotContactToLead(raw: Record<string, unknown>): CRMLead {
  const properties = ((raw.properties ?? {}) as Record<string, unknown>) || {};
  const fields: Record<string, unknown> = {};
  for (const [hsProp, internalKey] of Object.entries(FIELD_MAP_FROM_HUBSPOT)) {
    if (properties[hsProp] !== undefined && properties[hsProp] !== null) {
      fields[internalKey] = properties[hsProp];
    }
  }
  // af_metadata_extra es JSON-stringified — intentamos parsear.
  if (typeof properties.af_metadata_extra === "string" && properties.af_metadata_extra) {
    try {
      fields.metadata_extra = JSON.parse(properties.af_metadata_extra);
    } catch {
      fields.metadata_extra = properties.af_metadata_extra;
    }
  }
  return { id: String(raw.id ?? ""), fields, raw };
}

/**
 * VARIABLES DEFINIDAS payload → properties HubSpot listas para POST/PATCH.
 * Truncate `af_metadata_extra` a 60k chars (HubSpot max 65k texto).
 */
export function mapLeadToHubSpotProperties(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [internalKey, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const hsProp = FIELD_MAP_TO_HUBSPOT[internalKey] ?? internalKey;
    if (internalKey === "metadata_extra" || internalKey === "af_metadata_extra") {
      out.af_metadata_extra = stringifyTruncated(value, 60_000);
    } else {
      out[hsProp] = typeof value === "string" ? value : String(value);
    }
  }
  return out;
}

function stringifyTruncated(value: unknown, maxLen: number): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  if (raw.length <= maxLen) return raw;
  console.warn(`[HubSpotMappers] af_metadata_extra truncado a ${maxLen} chars (raw ${raw.length})`);
  return raw.slice(0, maxLen);
}
