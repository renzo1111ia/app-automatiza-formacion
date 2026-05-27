// Sprint 4 - ColumnMappingSchema validation tests.

import { describe, it, expect } from "vitest";
import {
  ColumnMappingSchema,
  ColumnMappingEntrySchema,
  PurposeEnum,
  QualifiedEnum,
  EstadoEnum,
  MotivoDescarteEnum,
  NivelEstudiosEnum,
} from "@/lib/integrations/sheets/types";

describe("ColumnMappingSchema", () => {
  it("acepta mapping minimo valido", () => {
    const result = ColumnMappingSchema.safeParse({
      header_row: 1,
      data_start_row: 2,
      columns: [{ letter: "A", target: "lead.nombre", type: "string" }],
    });
    expect(result.success).toBe(true);
  });

  it("aplica defaults header_row=1 y data_start_row=2", () => {
    const result = ColumnMappingSchema.parse({
      columns: [{ letter: "A", target: "lead.nombre", type: "string" }],
    });
    expect(result.header_row).toBe(1);
    expect(result.data_start_row).toBe(2);
  });

  it("rechaza columns vacio", () => {
    const result = ColumnMappingSchema.safeParse({
      header_row: 1,
      data_start_row: 2,
      columns: [],
    });
    expect(result.success).toBe(false);
  });

  it("acepta targets metadata.<custom>", () => {
    const result = ColumnMappingEntrySchema.safeParse({
      letter: "A",
      target: "metadata.mi_campo_custom",
      type: "string",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza target con prefijo desconocido", () => {
    const result = ColumnMappingEntrySchema.safeParse({
      letter: "A",
      target: "tabla_invalida.campo",
      type: "string",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza letter en minuscula", () => {
    const result = ColumnMappingEntrySchema.safeParse({
      letter: "a",
      target: "lead.nombre",
      type: "string",
    });
    expect(result.success).toBe(false);
  });

  it("acepta letras dobles AA, AB", () => {
    const result = ColumnMappingEntrySchema.safeParse({
      letter: "AB",
      target: "metadata.x",
      type: "string",
    });
    expect(result.success).toBe(true);
  });

  it("writeback por defecto es false", () => {
    const result = ColumnMappingEntrySchema.parse({
      letter: "A",
      target: "lead.nombre",
      type: "string",
    });
    expect(result.writeback).toBe(false);
  });
});

describe("Enums alineados con VARIABLES DEFINIDAS de la clienta", () => {
  it("PurposeEnum incluye 4 valores", () => {
    expect(PurposeEnum.options).toEqual(["leads_inbound", "leads_export", "reporting", "custom"]);
  });

  it("QualifiedEnum acepta apto, no apto y cadena vacia", () => {
    expect(QualifiedEnum.safeParse("apto").success).toBe(true);
    expect(QualifiedEnum.safeParse("no apto").success).toBe(true);
    expect(QualifiedEnum.safeParse("").success).toBe(true);
    expect(QualifiedEnum.safeParse("aceptado").success).toBe(false);
  });

  it("EstadoEnum incluye matriculado e ilocalizable", () => {
    expect(EstadoEnum.safeParse("matriculado").success).toBe(true);
    expect(EstadoEnum.safeParse("ilocalizable").success).toBe(true);
    expect(EstadoEnum.safeParse("inventado").success).toBe(false);
  });

  it("MotivoDescarteEnum incluye los listados oficiales", () => {
    expect(MotivoDescarteEnum.safeParse("No cumple requisitos").success).toBe(true);
    expect(MotivoDescarteEnum.safeParse("Se matricula en la competencia").success).toBe(true);
    expect(MotivoDescarteEnum.safeParse("N/A").success).toBe(true);
  });

  it("NivelEstudiosEnum acepta los 6 valores del .docx", () => {
    expect(NivelEstudiosEnum.safeParse("Postgrado/master").success).toBe(true);
    expect(NivelEstudiosEnum.safeParse("universitario").success).toBe(true);
    expect(NivelEstudiosEnum.safeParse("técnico").success).toBe(true);
    expect(NivelEstudiosEnum.safeParse("preuniversitario").success).toBe(true);
    expect(NivelEstudiosEnum.safeParse("básico").success).toBe(true);
    expect(NivelEstudiosEnum.safeParse("sin estudios").success).toBe(true);
  });
});
