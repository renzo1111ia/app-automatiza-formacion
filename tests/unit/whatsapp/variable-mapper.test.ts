/**
 * SPRINT 5.7 — Unit tests: Variable Mapper
 * tests/unit/whatsapp/variable-mapper.test.ts
 *
 * Tests the core mapping logic: resolveVariable, interpolateText,
 * buildResolvedComponents, and mapTemplateToLead.
 */

import { describe, it, expect } from "vitest";
import {
  resolveVariable,
  interpolateText,
  buildResolvedComponents,
  mapTemplateToLead,
} from "@/lib/integrations/whatsapp/variable-mapper";
import type {
  LeadSnapshot,
  VariableMapping,
  RawTemplateComponent,
} from "@/lib/integrations/whatsapp/variable-mapper";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const lead: LeadSnapshot = {
  nombre: "María",
  apellido: "García",
  email: "maria@example.com",
  telefono: "+34612345678",
  nombre_programa: "MBA Internacional",
  estado: "cualificado",
  fecha_cita: "2026-07-15T10:00:00.000Z",
  hora_cita: "10:00",
  nombre_asesor: "Carlos López",
  origen: "Facebook Ads",
  ciudad: "Madrid",
};

const mapping: VariableMapping = {
  "1": "nombre",
  "2": "nombre_programa",
  "3": "fecha_cita_formateada",
  "4": "nombre_asesor",
};

// ---------------------------------------------------------------------------
// resolveVariable
// ---------------------------------------------------------------------------

describe("resolveVariable", () => {
  it("returns the direct field value from the lead", () => {
    expect(resolveVariable("nombre", lead)).toBe("María");
    expect(resolveVariable("email", lead)).toBe("maria@example.com");
    expect(resolveVariable("ciudad", lead)).toBe("Madrid");
  });

  it("returns empty string for missing fields", () => {
    expect(resolveVariable("campo_inexistente", lead)).toBe("");
  });

  it("returns empty string for null field values", () => {
    expect(resolveVariable("nombre_asesor", { ...lead, nombre_asesor: null })).toBe("");
  });

  it("composes nombre_completo from nombre + apellido", () => {
    const result = resolveVariable("nombre_completo", lead);
    expect(result).toBe("María García");
  });

  it("handles nombre_completo with only nombre", () => {
    const result = resolveVariable("nombre_completo", { nombre: "Ana", apellido: null });
    expect(result).toBe("Ana");
  });

  it("formats fecha_cita_formateada as human-readable Spanish date", () => {
    const result = resolveVariable("fecha_cita_formateada", lead);
    // Should contain month name and year
    expect(result).toContain("2026");
    expect(result.length).toBeGreaterThan(5);
  });

  it("composes fecha_hora_cita with both date and time", () => {
    const result = resolveVariable("fecha_hora_cita", lead);
    expect(result).toContain("10:00");
    expect(result).toContain("a las");
  });

  it("returns empty string for fecha_hora_cita when both are null", () => {
    const result = resolveVariable("fecha_hora_cita", { ...lead, fecha_cita: null, hora_cita: null });
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// interpolateText
// ---------------------------------------------------------------------------

describe("interpolateText", () => {
  it("replaces all {{N}} placeholders correctly", () => {
    const text = "Hola {{1}}, te confirmo tu cita para {{2}} el {{3}} con {{4}}.";
    const result = interpolateText(text, mapping, lead);

    expect(result).toContain("María");
    expect(result).toContain("MBA Internacional");
    expect(result).toContain("Carlos López");
    expect(result).not.toContain("{{");
  });

  it("replaces unmapped index with empty string", () => {
    const text = "Hola {{1}}, tu código es {{99}}.";
    const result = interpolateText(text, { "1": "nombre" }, lead);
    expect(result).toBe("Hola María, tu código es .");
  });

  it("handles text with no placeholders unchanged", () => {
    const text = "Gracias por tu interés.";
    expect(interpolateText(text, mapping, lead)).toBe(text);
  });

  it("handles repeated placeholder correctly", () => {
    const text = "{{1}} es {{1}}";
    const result = interpolateText(text, { "1": "nombre" }, lead);
    expect(result).toBe("María es María");
  });
});

// ---------------------------------------------------------------------------
// buildResolvedComponents
// ---------------------------------------------------------------------------

describe("buildResolvedComponents", () => {
  const rawComponents: RawTemplateComponent[] = [
    { type: "header", text: "Confirmación para {{1}}", format: "TEXT" },
    { type: "body", text: "Tu programa {{2}} tiene cita el {{3}}." },
    { type: "footer", text: "Responde STOP para darte de baja." },
  ];

  it("builds components with resolved text parameters", () => {
    const components = buildResolvedComponents(rawComponents, mapping, lead);

    // HEADER and BODY should be resolved, FOOTER has no variables
    const header = components.find((c) => c.type === "header");
    const body = components.find((c) => c.type === "body");

    expect(header).toBeDefined();
    expect(header!.parameters[0].text).toBe("María");

    expect(body).toBeDefined();
    expect(body!.parameters[0].text).toBe("MBA Internacional");
  });

  it("excludes footer component (no variables)", () => {
    const components = buildResolvedComponents(rawComponents, mapping, lead);
    const footer = components.find((c) => (c.type as string) === "footer");
    expect(footer).toBeUndefined();
  });

  it("returns empty array if no components have variables", () => {
    const noVarComponents: RawTemplateComponent[] = [
      { type: "body", text: "Gracias por contactarnos." },
    ];
    const components = buildResolvedComponents(noVarComponents, mapping, lead);
    expect(components).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mapTemplateToLead (full pipeline)
// ---------------------------------------------------------------------------

describe("mapTemplateToLead", () => {
  const rawComponents: RawTemplateComponent[] = [
    { type: "body", text: "Hola {{1}}, tu cita en {{2}} es el {{3}}." },
  ];

  it("returns resolved components and preview text", () => {
    const result = mapTemplateToLead(rawComponents, mapping, lead);

    expect(result.previewText).toContain("María");
    expect(result.previewText).toContain("MBA Internacional");
    expect(result.components).toHaveLength(1);
    expect(result.components[0].parameters).toHaveLength(3);
  });

  it("reports missing fields when lead data is incomplete", () => {
    const incompleteLead: LeadSnapshot = { nombre: "Ana" }; // no program, no date
    const result = mapTemplateToLead(rawComponents, mapping, incompleteLead);

    // nombre_programa (idx 2) and fecha_cita_formateada (idx 3) should be missing
    expect(result.missingFields).toContain("nombre_programa");
    expect(result.missingFields).toContain("fecha_cita_formateada");
  });

  it("returns empty missingFields when all variables are present", () => {
    const result = mapTemplateToLead(rawComponents, mapping, lead);
    expect(result.missingFields).toHaveLength(0);
  });

  it("returns empty previewText when no body component exists", () => {
    const noBody: RawTemplateComponent[] = [
      { type: "header", text: "Hola {{1}}" },
    ];
    const result = mapTemplateToLead(noBody, { "1": "nombre" }, lead);
    expect(result.previewText).toBe("");
  });
});
