// Sprint 4 — Derivación de país por prefijo telefónico + validación de columnas
// obligatorias del mapeo (requisito 03-06-2026).

import { describe, it, expect } from "vitest";
import { deriveCountryFromPhone } from "@/lib/integrations/sheets/phone-country";
import {
  validateMappingRequiredColumns,
  type MappingValidation,
} from "@/lib/integrations/sheets/row-mapper";
import type { ColumnMapping } from "@/lib/integrations/sheets/types";

describe("deriveCountryFromPhone", () => {
  it("deriva España de +34", () => {
    expect(deriveCountryFromPhone("+34611223344")).toBe("España");
  });
  it("deriva México de +52", () => {
    expect(deriveCountryFromPhone("+525512345678")).toBe("México");
  });
  it("deriva Argentina de +54", () => {
    expect(deriveCountryFromPhone("+541123456789")).toBe("Argentina");
  });
  it("antepone + a número largo sin prefijo y deriva", () => {
    expect(deriveCountryFromPhone("34611223344")).toBe("España");
  });
  it("número nacional corto sin prefijo → asume defaultCountry ES", () => {
    expect(deriveCountryFromPhone("611223344")).toBe("España");
  });
  it("vacío o inválido → null", () => {
    expect(deriveCountryFromPhone("")).toBeNull();
    expect(deriveCountryFromPhone(null)).toBeNull();
    expect(deriveCountryFromPhone("abc")).toBeNull();
  });
});

function mappingWith(targets: string[]): ColumnMapping {
  return {
    header_row: 1,
    data_start_row: 2,
    columns: targets.map((t, i) => ({
      letter: String.fromCharCode(65 + i),
      target: t,
      type: "string" as const,
      writeback: false,
    })),
  } as ColumnMapping;
}

describe("validateMappingRequiredColumns", () => {
  it("mapeo completo (email, telefono, nombre, campana) → ok", () => {
    const v: MappingValidation = validateMappingRequiredColumns(
      mappingWith(["lead.email", "lead.telefono", "lead.nombre", "lead.campana", "lead.pais"])
    );
    expect(v.ok).toBe(true);
    expect(v.missing).toHaveLength(0);
    expect(v.paisMissing).toBe(false);
  });

  it("falta campana → missing incluye lead.campana", () => {
    const v = validateMappingRequiredColumns(
      mappingWith(["lead.email", "lead.telefono", "lead.nombre"])
    );
    expect(v.ok).toBe(false);
    expect(v.missing).toContain("lead.campana");
    expect(v.paisMissing).toBe(true);
  });

  it("solo email → faltan telefono, nombre, campana", () => {
    const v = validateMappingRequiredColumns(mappingWith(["lead.email"]));
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(
      expect.arrayContaining(["lead.telefono", "lead.nombre", "lead.campana"])
    );
  });
});
