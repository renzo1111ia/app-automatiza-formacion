// Sprint 5 - Zoho CRM lead-mapper: tests unitarios puros (sin I/O).
//
// Cubre:
//   - mapZohoLeadToInternal con field_mapping vacío (defaultMap).
//   - mapZohoLeadToInternal con field_mapping custom.
//   - normalizeZohoStage: variantes ES + EN + fallback.
//   - suggestFieldMapping: sugerencia inicial desde claves raw.

import { describe, it, expect, vi } from "vitest";

// logger no hace I/O en tests — mock ligero.
vi.mock("@/lib/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  mapZohoLeadToInternal,
  normalizeZohoStage,
  suggestFieldMapping,
} from "@/lib/integrations/zoho-pull/lead-mapper";
import type { CRMLead } from "@/lib/integrations/crm/interface";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const BASE_LEAD: CRMLead = {
  id: "zoho-lead-001",
  fields: {
    nombre: "Ana",
    apellido: "García",
    email: "ana@example.com",
    telefono: "+34600000001",
    pais: "España",
    source: "Web Form",
  },
  raw: {
    First_Name: "Ana",
    Last_Name: "García",
    Email: "ana@example.com",
    Phone: "+34600000001",
    Country: "España",
    Lead_Source: "Web Form",
    Lead_Status: "New",
    Modified_Time: "2026-06-08T10:00:00+02:00",
  },
};

// ─── mapZohoLeadToInternal — field_mapping vacío ─────────────────────────────

describe("mapZohoLeadToInternal — default mapping (field_mapping vacío)", () => {
  it("produce { lead, lead_cualificacion, metadata } con shape correcto", () => {
    const result = mapZohoLeadToInternal(BASE_LEAD, []);
    expect(result).toHaveProperty("lead");
    expect(result).toHaveProperty("lead_cualificacion");
    expect(result).toHaveProperty("metadata");
  });

  it("mapea nombre, apellido, email, telefono, pais desde fields", () => {
    const { lead } = mapZohoLeadToInternal(BASE_LEAD, []);
    expect(lead.nombre).toBe("Ana");
    expect(lead.apellido).toBe("García");
    expect(lead.email).toBe("ana@example.com");
    expect(lead.telefono).toBe("+34600000001");
    expect(lead.pais).toBe("España");
  });

  // BUG-5-03: Lead_Source de Zoho es la CAMPAÑA/canal, NO `origen`. `origen` lo
  // fija el event-processor a 'zoho_crm' (procedencia del sistema).
  it("BUG-5-03: Lead_Source de Zoho mapea a `campana`, no a `origen`", () => {
    const { lead } = mapZohoLeadToInternal(BASE_LEAD, []);
    expect(lead.campana).toBe("Web Form");
    expect(lead.origen).toBeUndefined();
  });

  it("incluye id_lead_externo igual al id del CRMLead", () => {
    const { lead } = mapZohoLeadToInternal(BASE_LEAD, []);
    expect(lead.id_lead_externo).toBe("zoho-lead-001");
  });

  it("normaliza Lead_Status 'New' a QUALIFICATION en current_stage", () => {
    const { lead } = mapZohoLeadToInternal(BASE_LEAD, []);
    expect(lead.current_stage).toBe("QUALIFICATION");
  });

  it("expone zoho_lead_status en metadata", () => {
    const { metadata } = mapZohoLeadToInternal(BASE_LEAD, []);
    expect(metadata.zoho_lead_status).toBe("New");
  });

  it("sin field_mapping undefined es equivalente a vacío", () => {
    const resultUndefined = mapZohoLeadToInternal(BASE_LEAD, undefined);
    const resultEmpty = mapZohoLeadToInternal(BASE_LEAD, []);
    expect(resultUndefined.lead.nombre).toBe(resultEmpty.lead.nombre);
    expect(resultUndefined.lead.current_stage).toBe(resultEmpty.lead.current_stage);
  });

  it("lead con Lead_Status 'Contacted' → current_stage SCHEDULING", () => {
    const lead: CRMLead = {
      ...BASE_LEAD,
      raw: { ...(BASE_LEAD.raw as Record<string, unknown>), Lead_Status: "Contacted" },
    };
    const { lead: mapped } = mapZohoLeadToInternal(lead, []);
    expect(mapped.current_stage).toBe("SCHEDULING");
  });
});

// ─── mapZohoLeadToInternal — field_mapping custom ────────────────────────────

describe("mapZohoLeadToInternal — custom field_mapping", () => {
  it("aplica el mapeo custom y vuelca en el target correcto", () => {
    const mapping = [
      { zoho_field: "First_Name", target: "lead.nombre" },
      { zoho_field: "Email", target: "lead.email" },
      { zoho_field: "Lead_Source", target: "metadata.zoho_lead_source" },
    ];
    const { lead, metadata } = mapZohoLeadToInternal(BASE_LEAD, mapping);
    expect(lead.nombre).toBe("Ana");
    expect(lead.email).toBe("ana@example.com");
    expect(metadata.zoho_lead_source).toBe("Web Form");
  });

  it("garantiza id_lead_externo aunque el mapping no lo incluya", () => {
    const mapping = [{ zoho_field: "First_Name", target: "lead.nombre" }];
    const { lead } = mapZohoLeadToInternal(BASE_LEAD, mapping);
    expect(lead.id_lead_externo).toBe("zoho-lead-001");
  });

  it("normaliza current_stage aunque venga de un campo mapeado explícitamente", () => {
    // El tenant mapea Lead_Status → lead.current_stage. El raw del lead tiene
    // Lead_Status="Contacted" (SCHEDULING); verificamos que se normaliza.
    const leadContacted: CRMLead = {
      ...BASE_LEAD,
      raw: { ...(BASE_LEAD.raw as Record<string, unknown>), Lead_Status: "Contacted" },
    };
    const mapping = [{ zoho_field: "Lead_Status", target: "lead.current_stage" }];
    const { lead } = mapZohoLeadToInternal(leadContacted, mapping);
    // "Contacted" → SCHEDULING (post-normalización)
    expect(lead.current_stage).toBe("SCHEDULING");
  });

  it("ignora campos raw ausentes sin lanzar excepción", () => {
    const mapping = [
      { zoho_field: "Non_Existent_Field", target: "lead.nombre" },
      { zoho_field: "Email", target: "lead.email" },
    ];
    const { lead } = mapZohoLeadToInternal(BASE_LEAD, mapping);
    expect(lead.nombre).toBeUndefined();
    expect(lead.email).toBe("ana@example.com");
  });

  it("puede volcar campos en lead_cualificacion y metadata", () => {
    const mapping = [
      { zoho_field: "Lead_Source", target: "lead_cualificacion.canal_origen" },
      { zoho_field: "Lead_Status", target: "metadata.estado_zoho" },
    ];
    const { lead_cualificacion, metadata } = mapZohoLeadToInternal(BASE_LEAD, mapping);
    expect(lead_cualificacion.canal_origen).toBe("Web Form");
    // Lead_Status "New" → metadata.estado_zoho no se normaliza cuando va a metadata
    expect(metadata.estado_zoho).toBe("New");
  });
});

// ─── normalizeZohoStage ────────────────────────────────────────────────────

describe("normalizeZohoStage", () => {
  // QUALIFICATION
  it.each([
    ["New", "QUALIFICATION"],
    ["new", "QUALIFICATION"],
    ["Nuevo", "QUALIFICATION"],
    ["nuevo", "QUALIFICATION"],
    ["Not Contacted", "QUALIFICATION"],
    ["not contacted", "QUALIFICATION"],
    ["No Contactado", "QUALIFICATION"],
    ["Pre-Qualified", "QUALIFICATION"],
  ])("'%s' → QUALIFICATION", (input, expected) => {
    expect(normalizeZohoStage(input)).toBe(expected);
  });

  // SCHEDULING
  it.each([
    ["Contacted", "SCHEDULING"],
    ["contacted", "SCHEDULING"],
    ["Contactado", "SCHEDULING"],
    ["Cualificado", "SCHEDULING"],
    ["Qualified", "SCHEDULING"],
    ["Agendando", "SCHEDULING"],
    ["scheduling", "SCHEDULING"],
  ])("'%s' → SCHEDULING", (input, expected) => {
    expect(normalizeZohoStage(input)).toBe(expected);
  });

  // COMPLETED
  it.each([
    ["Converted", "COMPLETED"],
    ["converted", "COMPLETED"],
    ["Convertido", "COMPLETED"],
    ["Booked", "COMPLETED"],
    ["Completado", "COMPLETED"],
    ["Cita", "COMPLETED"],
    ["Cita Confirmada", "COMPLETED"],
  ])("'%s' → COMPLETED", (input, expected) => {
    expect(normalizeZohoStage(input)).toBe(expected);
  });

  // DROPPED
  it.each([
    ["Junk Lead", "DROPPED"],
    ["junk lead", "DROPPED"],
    ["Dropped", "DROPPED"],
    ["Descartado", "DROPPED"],
    ["Lost Lead", "DROPPED"],
    ["Perdido", "DROPPED"],
    ["Basura", "DROPPED"],
  ])("'%s' → DROPPED", (input, expected) => {
    expect(normalizeZohoStage(input)).toBe(expected);
  });

  // UNREACHABLE
  it.each([
    ["Attempted to Contact", "UNREACHABLE"],
    ["attempted to contact", "UNREACHABLE"],
    ["Ilocalizable", "UNREACHABLE"],
    ["Unreachable", "UNREACHABLE"],
  ])("'%s' → UNREACHABLE", (input, expected) => {
    expect(normalizeZohoStage(input)).toBe(expected);
  });

  // Fallback
  it("status desconocido → QUALIFICATION (fallback seguro)", () => {
    expect(normalizeZohoStage("Estado Raro Inventado")).toBe("QUALIFICATION");
  });

  it("null / undefined → QUALIFICATION", () => {
    expect(normalizeZohoStage(null)).toBe("QUALIFICATION");
    expect(normalizeZohoStage(undefined)).toBe("QUALIFICATION");
  });

  it("cadena vacía → QUALIFICATION", () => {
    expect(normalizeZohoStage("")).toBe("QUALIFICATION");
  });

  it("espacios extra en el status son tolerados", () => {
    expect(normalizeZohoStage("  New  ")).toBe("QUALIFICATION");
    expect(normalizeZohoStage("  Contacted  ")).toBe("SCHEDULING");
  });
});

// ─── suggestFieldMapping ──────────────────────────────────────────────────

describe("suggestFieldMapping", () => {
  it("sugiere entries para campos Zoho conocidos", () => {
    const suggestion = suggestFieldMapping(BASE_LEAD);
    // BASE_LEAD.raw tiene First_Name, Last_Name, Email, Phone, Country, Lead_Source, Lead_Status
    const targets = suggestion.map((e) => e.target);
    expect(targets).toContain("lead.nombre");
    expect(targets).toContain("lead.apellido");
    expect(targets).toContain("lead.email");
    expect(targets).toContain("lead.telefono");
    expect(targets).toContain("lead.pais");
    // BUG-5-03: Lead_Source se sugiere como `campana`, no `origen`.
    expect(targets).toContain("lead.campana");
    expect(targets).not.toContain("lead.origen");
    expect(targets).toContain("lead.current_stage");
  });

  it("no sugiere campos raw desconocidos (sin target en KNOWN)", () => {
    const leadWithExtra: CRMLead = {
      ...BASE_LEAD,
      raw: { ...(BASE_LEAD.raw as Record<string, unknown>), Custom_Field_XYZ: "valor_custom" },
    };
    const suggestion = suggestFieldMapping(leadWithExtra);
    const zohoFields = suggestion.map((e) => e.zoho_field);
    expect(zohoFields).not.toContain("Custom_Field_XYZ");
  });

  it("devuelve array vacío si el lead no tiene campos raw conocidos", () => {
    const emptyLead: CRMLead = { id: "x", fields: {}, raw: {} };
    expect(suggestFieldMapping(emptyLead)).toHaveLength(0);
  });

  it("cada entry tiene zoho_field y target como strings no vacíos", () => {
    const suggestion = suggestFieldMapping(BASE_LEAD);
    for (const entry of suggestion) {
      expect(typeof entry.zoho_field).toBe("string");
      expect(entry.zoho_field.length).toBeGreaterThan(0);
      expect(typeof entry.target).toBe("string");
      expect(entry.target).toMatch(/^(lead|lead_cualificacion|metadata)\./);
    }
  });
});
