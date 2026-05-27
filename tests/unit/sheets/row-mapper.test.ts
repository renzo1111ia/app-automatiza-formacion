// Sprint 4 - row-mapper unit tests.
//
// Cubre:
//   - letterToIndex / indexToLetter (incluyendo letras dobles AA, AB).
//   - hashRow estable e idempotente.
//   - coercion por tipo (string, email, phone, number, boolean, datetime, enums).
//   - mapRowToLead con catalogo lead/lead_cualificacion/metadata.
//   - buildWritebackCells (solo columnas con writeback=true).

import { describe, it, expect } from "vitest";
import {
  letterToIndex,
  indexToLetter,
  hashRow,
  mapRowToLead,
  buildWritebackCells,
} from "@/lib/integrations/sheets/row-mapper";
import { ColumnMapping, ColumnMappingSchema } from "@/lib/integrations/sheets/types";

describe("letterToIndex / indexToLetter", () => {
  it.each([
    ["A", 0],
    ["B", 1],
    ["Z", 25],
    ["AA", 26],
    ["AB", 27],
    ["AZ", 51],
    ["BA", 52],
  ])("letterToIndex(%s) === %i", (letter, idx) => {
    expect(letterToIndex(letter)).toBe(idx);
  });

  it("indexToLetter es inverso de letterToIndex", () => {
    for (let i = 0; i < 100; i++) {
      const letter = indexToLetter(i);
      expect(letterToIndex(letter)).toBe(i);
    }
  });

  it("letterToIndex rechaza letras invalidas", () => {
    expect(() => letterToIndex("a")).toThrow();
    expect(() => letterToIndex("A1")).toThrow();
    expect(() => letterToIndex("")).toThrow();
  });
});

describe("hashRow", () => {
  it("es estable: misma fila -> mismo hash", () => {
    const row = ["Ana", "ana@ex.com", "+34999"];
    expect(hashRow(row)).toBe(hashRow(row));
  });

  it("hash cambia si cambia un valor", () => {
    expect(hashRow(["A", "B"])).not.toBe(hashRow(["A", "C"]));
  });

  it("trata null/undefined/string-vacio como equivalente", () => {
    expect(hashRow([null, "B"])).toBe(hashRow([undefined, "B"]));
    expect(hashRow(["", "B"])).toBe(hashRow([null, "B"]));
  });
});

describe("mapRowToLead - tipos basicos", () => {
  const mapping: ColumnMapping = ColumnMappingSchema.parse({
    header_row: 1,
    data_start_row: 2,
    columns: [
      { letter: "A", target: "lead.nombre", type: "string" },
      { letter: "B", target: "lead.email", type: "email" },
      { letter: "C", target: "lead.telefono", type: "phone" },
      { letter: "D", target: "metadata.user_age", type: "number" },
      { letter: "E", target: "metadata.ok_whatsapp", type: "boolean" },
      { letter: "F", target: "metadata.fecha_agenda", type: "datetime" },
      { letter: "G", target: "lead.current_stage", type: "enum:lead_stage", writeback: true },
      { letter: "H", target: "metadata.empresa", type: "string" },
      { letter: "I", target: "metadata.cargo", type: "string" },
    ],
  });

  it("mapea fila completa", () => {
    const row = [
      "Ana García",
      "Ana@Example.COM",
      " +34 666 999 999 ",
      "32",
      "sí",
      "15/06/2026 10:30",
      "qualification",
      "Esden Business School",
      "Comercial",
    ];
    const result = mapRowToLead(row, 5, mapping);

    expect(result.lead.nombre).toBe("Ana García");
    expect(result.lead.email).toBe("ana@example.com");
    expect(result.lead.telefono).toBe("+34666999999");
    expect(result.metadata.user_age).toBe(32);
    expect(result.metadata.ok_whatsapp).toBe(true);
    expect(result.metadata.fecha_agenda).toMatch(/^2026-06-15T10:30:00/);
    expect(result.lead.current_stage).toBe("QUALIFICATION");
    expect(result.metadata.empresa).toBe("Esden Business School");
    expect(result.metadata.cargo).toBe("Comercial");
    expect(result.rowIndex).toBe(5);
    expect(result.warnings).toHaveLength(0);
  });

  it("genera warning cuando un valor no convierte", () => {
    const row = ["Ana", "no-es-email", "+34666", "treintaydos", "", "", "", "", ""];
    const result = mapRowToLead(row, 1, mapping);

    expect(result.lead.email).toBeUndefined();
    expect(result.metadata.user_age).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    const targets = result.warnings.map((w) => w.target);
    expect(targets).toContain("lead.email");
    expect(targets).toContain("metadata.user_age");
  });

  it("celdas vacias se omiten sin warning", () => {
    const row = ["Ana", "", null, undefined, "", "", "", "", ""];
    const result = mapRowToLead(row, 1, mapping);
    expect(result.lead.nombre).toBe("Ana");
    expect(result.lead.email).toBeUndefined();
    expect(result.warnings).toHaveLength(0);
  });
});

describe("mapRowToLead - datetime variantes", () => {
  const mapping: ColumnMapping = ColumnMappingSchema.parse({
    header_row: 1,
    data_start_row: 2,
    columns: [{ letter: "A", target: "metadata.fecha_agenda", type: "datetime" }],
  });

  it.each([
    ["15/06/2026", /^2026-06-15T/],
    ["15-06-2026", /^2026-06-15T/],
    ["2026-06-15", /^2026-06-15T/],
    ["15/06/2026 10:30", /^2026-06-15T10:30:00/],
    ["15/06/26 10:30", /^2026-06-15T10:30:00/],
  ])("acepta formato %s", (input, expected) => {
    const result = mapRowToLead([input], 0, mapping);
    expect(String(result.metadata.fecha_agenda)).toMatch(expected);
  });

  it("rechaza fechas invalidas", () => {
    const result = mapRowToLead(["no-es-fecha"], 0, mapping);
    expect(result.metadata.fecha_agenda).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
  });
});

describe("buildWritebackCells", () => {
  const mapping: ColumnMapping = ColumnMappingSchema.parse({
    header_row: 1,
    data_start_row: 2,
    columns: [
      { letter: "A", target: "lead.nombre", type: "string" },
      { letter: "B", target: "lead.current_stage", type: "enum:lead_stage", writeback: true },
      { letter: "C", target: "metadata.fecha_agenda", type: "datetime", writeback: true },
      { letter: "D", target: "metadata.notas", type: "text" }, // no writeback
    ],
  });

  it("solo genera celdas para columnas con writeback=true Y cambios en el payload", () => {
    const cells = buildWritebackCells(mapping, 5, {
      "lead.current_stage": "SCHEDULING",
      "lead.nombre": "Ana", // writeback=false -> no debe escribir
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ letter: "B", rowIndex: 5, value: "SCHEDULING" });
  });

  it("ignora cambios cuyo target no esta en el mapping", () => {
    const cells = buildWritebackCells(mapping, 5, {
      "lead.unknown_field": "X",
    });
    expect(cells).toHaveLength(0);
  });

  it("multiple celdas con writeback=true se incluyen todas", () => {
    const cells = buildWritebackCells(mapping, 3, {
      "lead.current_stage": "COMPLETED",
      "metadata.fecha_agenda": "2026-06-20T10:00:00.000Z",
    });
    expect(cells).toHaveLength(2);
    const letters = cells.map((c) => c.letter).sort();
    expect(letters).toEqual(["B", "C"]);
  });
});
