// Sprint 4 — Derivación de país por prefijo telefónico + validación de columnas
// obligatorias del mapeo (requisito 03-06-2026).

import { describe, it, expect } from "vitest";
import {
  deriveCountryFromPhone,
  resolveLeadCountry,
} from "@/lib/integrations/sheets/phone-country";
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

  // BUG-5-04: prefijo internacional con doble cero (0034) y números demasiado
  // cortos. Regla de negocio Javi HP (08-06-2026): teléfono sin código de país
  // = España; "00" equivale a "+".
  it("BUG-5-04: prefijo 0034 (doble cero) deriva España", () => {
    expect(deriveCountryFromPhone("0034611223344")).toBe("España");
  });
  it("BUG-5-04: prefijo 0052 (doble cero) deriva México", () => {
    expect(deriveCountryFromPhone("0052 55 1234 5678")).toBe("México");
  });
  it("BUG-5-04: menos de 7 dígitos → null (no es un teléfono)", () => {
    expect(deriveCountryFromPhone("12345")).toBeNull();
    expect(deriveCountryFromPhone("+34 123")).toBeNull();
  });
  it("BUG-5-04: número con espacios/guiones sin prefijo → España", () => {
    expect(deriveCountryFromPhone("611 22 33 44")).toBe("España");
  });
});

describe("resolveLeadCountry (regla AF — aplica a TODOS los inputs de leads)", () => {
  it("respeta el país explícito si viene informado", () => {
    expect(resolveLeadCountry("Portugal", "+34611223344")).toBe("Portugal");
    expect(resolveLeadCountry("México", null)).toBe("México");
  });

  it("deriva del teléfono cuando no hay país explícito", () => {
    expect(resolveLeadCountry(null, "+34611223344")).toBe("España");
    expect(resolveLeadCountry("", "+525512345678")).toBe("México");
    expect(resolveLeadCountry(undefined, "+541123456789")).toBe("Argentina");
  });

  it("España por defecto cuando no hay país ni teléfono (regla AF)", () => {
    expect(resolveLeadCountry(null, null)).toBe("España");
    expect(resolveLeadCountry("", "")).toBe("España");
    expect(resolveLeadCountry(undefined, undefined)).toBe("España");
  });

  it("España por defecto cuando el teléfono no permite derivar país", () => {
    expect(resolveLeadCountry(null, "12345")).toBe("España"); // muy corto
    expect(resolveLeadCountry(null, "abc")).toBe("España"); // no es teléfono
  });

  it("país explícito en blanco (solo espacios) se trata como ausente", () => {
    expect(resolveLeadCountry("   ", "+34611223344")).toBe("España");
    expect(resolveLeadCountry("   ", null)).toBe("España");
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
