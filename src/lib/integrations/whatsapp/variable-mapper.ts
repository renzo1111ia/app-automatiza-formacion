/**
 * SPRINT 5.7 — Template Variable Mapper
 * src/lib/integrations/whatsapp/variable-mapper.ts
 *
 * Resolves template parameter placeholders to real lead field values.
 *
 * Meta templates use positional parameters: {{1}}, {{2}}, etc.
 * The `variable_mapping` column in `whatsapp_templates` maps each position
 * to a lead field name:
 *   { "1": "nombre", "2": "fecha_cita", "3": "nombre_programa" }
 *
 * Lead fields supported:
 *   nombre, apellido, email, telefono, nombre_programa, estado,
 *   fecha_cita, hora_cita, nombre_asesor, origen, ciudad
 *
 * Fallback: if a field is not found on the lead, an empty string "" is used
 * (Meta API rejects undefined parameters).
 */

import type { MetaTemplateComponent, MetaTemplateParameter } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subset of lead fields used for template variable resolution */
export interface LeadSnapshot {
  nombre?: string | null;
  apellido?: string | null;
  email?: string | null;
  telefono?: string | null;
  nombre_programa?: string | null;
  estado?: string | null;
  fecha_cita?: string | null; // ISO date string
  hora_cita?: string | null; // "HH:mm" string
  nombre_asesor?: string | null;
  origen?: string | null;
  ciudad?: string | null;
  [key: string]: string | null | undefined; // allow arbitrary fields
}

/** A raw Meta template component as returned by the API */
export interface RawTemplateComponent {
  type: string;
  text?: string;
  format?: string;
  buttons?: unknown[];
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
}

/** Maps parameter index ("1", "2", ...) to a lead field name */
export type VariableMapping = Record<string, string>;

// ---------------------------------------------------------------------------
// Date/time formatter helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Core mapper
// ---------------------------------------------------------------------------

/**
 * Resolve a single variable position to its value from the lead.
 *
 * @param fieldName - Lead field name from variable_mapping (e.g. "nombre")
 * @param lead      - Lead snapshot object
 * @returns Resolved string value (never undefined — falls back to "")
 */
export function resolveVariable(fieldName: string, lead: LeadSnapshot): string {
  // Special composed fields
  if (fieldName === "nombre_completo") {
    const parts = [lead.nombre, lead.apellido].filter(Boolean);
    return parts.map(capitalizeFirst).join(" ") || "";
  }

  if (fieldName === "fecha_cita_formateada") {
    return formatDate(lead.fecha_cita);
  }

  if (fieldName === "fecha_hora_cita") {
    const fecha = formatDate(lead.fecha_cita);
    const hora = lead.hora_cita ?? "";
    return [fecha, hora].filter(Boolean).join(" a las ") || "";
  }

  // Direct field lookup
  const value = lead[fieldName];
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Map all positional variables in a template component's text to lead values.
 *
 * Replaces {{1}}, {{2}}, ... with the value from variable_mapping.
 *
 * @param text           - Raw template text with {{N}} placeholders
 * @param variableMapping - Maps "1" → "nombre", "2" → "fecha_cita", etc.
 * @param lead           - Lead snapshot
 * @returns Text with all placeholders replaced
 */
export function interpolateText(
  text: string,
  variableMapping: VariableMapping,
  lead: LeadSnapshot
): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => {
    const fieldName = variableMapping[index];
    if (!fieldName) {
      // No mapping found for this index — return empty to avoid Meta rejection
      return "";
    }
    return resolveVariable(fieldName, lead);
  });
}

/**
 * Build the resolved Meta API `components` array for a template send.
 *
 * Iterates over each component in the raw template definition,
 * extracts parameter slots, and fills them with lead values.
 *
 * @param rawComponents  - Template components from Meta (stored in DB)
 * @param variableMapping - Maps parameter index to lead field name
 * @param lead           - Lead snapshot
 * @returns Resolved components ready to pass to the Meta /messages API
 */
export function buildResolvedComponents(
  rawComponents: RawTemplateComponent[],
  variableMapping: VariableMapping,
  lead: LeadSnapshot
): MetaTemplateComponent[] {
  const resolved: MetaTemplateComponent[] = [];

  for (const component of rawComponents) {
    const type = component.type?.toLowerCase() as MetaTemplateComponent["type"];

    // Only HEADER and BODY can have variable parameters in Meta's schema
    if (type === "header" || type === "body") {
      const parameters = extractParameters(component, variableMapping, lead);
      if (parameters.length > 0) {
        resolved.push({ type, parameters });
      }
    }
    // BUTTONS with quick_reply or url variables could be added here in future sprints
  }

  return resolved;
}

/**
 * Extract and resolve parameters from a single component.
 */
function extractParameters(
  component: RawTemplateComponent,
  variableMapping: VariableMapping,
  lead: LeadSnapshot
): MetaTemplateParameter[] {
  const parameters: MetaTemplateParameter[] = [];

  // Detect number of variables by scanning the text for {{N}} patterns
  const text = component.text ?? "";
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];

  if (matches.length === 0) return [];

  // Build unique sorted list of indices found in the component
  const indices = [...new Set(matches.map((m) => m[1]))].sort((a, b) => Number(a) - Number(b));

  for (const index of indices) {
    const fieldName = variableMapping[index];
    const value = fieldName ? resolveVariable(fieldName, lead) : "";
    parameters.push({ type: "text", text: value });
  }

  return parameters;
}

// ---------------------------------------------------------------------------
// Convenience: full pipeline
// ---------------------------------------------------------------------------

export interface MappingResult {
  components: MetaTemplateComponent[];
  /** Preview of the body text after variable resolution (for UI display) */
  previewText: string;
  /** Any fields that were missing from the lead (useful for warnings) */
  missingFields: string[];
}

/**
 * Full pipeline: given a template and a lead, produce the resolved components
 * and a text preview.
 */
export function mapTemplateToLead(
  rawComponents: RawTemplateComponent[],
  variableMapping: VariableMapping,
  lead: LeadSnapshot
): MappingResult {
  const missingFields: string[] = [];

  // Validate required fields
  for (const [_index, fieldName] of Object.entries(variableMapping)) {
    if (!fieldName) continue;
    const value = resolveVariable(fieldName, lead);
    if (!value) {
      missingFields.push(fieldName);
    }
  }

  const components = buildResolvedComponents(rawComponents, variableMapping, lead);

  // Build preview text from BODY component
  const bodyComponent = rawComponents.find((c) => c.type?.toLowerCase() === "body");
  const previewText = bodyComponent?.text
    ? interpolateText(bodyComponent.text, variableMapping, lead)
    : "";

  return { components, previewText, missingFields };
}
