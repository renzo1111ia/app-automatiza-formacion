/**
 * Tests del schema Zod de campaign-import (NEW-09).
 */
import { describe, it, expect } from "vitest";
import {
  CampaignImportRowSchema,
  CampaignImportSchema,
  parseTagsField,
} from "@/lib/schemas/campaign-import";

describe("CampaignImportRowSchema", () => {
  it("acepta fila válida mínima (nombre + telefono)", () => {
    const r = CampaignImportRowSchema.safeParse({ nombre: "Ana López", telefono: "+34612345678" });
    expect(r.success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    const r = CampaignImportRowSchema.safeParse({ nombre: "", telefono: "+34612345678" });
    expect(r.success).toBe(false);
  });

  it("rechaza nombre >200 chars", () => {
    const r = CampaignImportRowSchema.safeParse({ nombre: "x".repeat(201), telefono: "612345678" });
    expect(r.success).toBe(false);
  });

  it("acepta teléfono sin + (formato laxo)", () => {
    const r = CampaignImportRowSchema.safeParse({ nombre: "X", telefono: "612345678" });
    expect(r.success).toBe(true);
  });

  it("rechaza teléfono con letras", () => {
    const r = CampaignImportRowSchema.safeParse({ nombre: "X", telefono: "612-ABC-678" });
    expect(r.success).toBe(false);
  });

  it("acepta email vacío como opcional", () => {
    const r = CampaignImportRowSchema.safeParse({ nombre: "X", telefono: "612345678", email: "" });
    expect(r.success).toBe(true);
  });

  it("rechaza email inválido", () => {
    const r = CampaignImportRowSchema.safeParse({
      nombre: "X",
      telefono: "612345678",
      email: "not-an-email",
    });
    expect(r.success).toBe(false);
  });

  it("normaliza país a uppercase", () => {
    const r = CampaignImportRowSchema.safeParse({
      nombre: "X",
      telefono: "612345678",
      pais: "es",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pais).toBe("ES");
  });

  it("rechaza país con length != 2", () => {
    const r = CampaignImportRowSchema.safeParse({
      nombre: "X",
      telefono: "612345678",
      pais: "ESP",
    });
    expect(r.success).toBe(false);
  });
});

describe("CampaignImportSchema (array)", () => {
  it("rechaza array > 10,000 filas", () => {
    const arr = Array.from({ length: 10001 }, () => ({ nombre: "X", telefono: "612345678" }));
    const r = CampaignImportSchema.safeParse(arr);
    expect(r.success).toBe(false);
  });

  it("acepta array de 10,000 filas exactas", () => {
    const arr = Array.from({ length: 10000 }, () => ({ nombre: "X", telefono: "612345678" }));
    const r = CampaignImportSchema.safeParse(arr);
    expect(r.success).toBe(true);
  });
});

describe("parseTagsField", () => {
  it("retorna array vacío para undefined", () => {
    expect(parseTagsField(undefined)).toEqual([]);
  });

  it("split por comas + trim", () => {
    expect(parseTagsField("hot, warm, premium")).toEqual(["hot", "warm", "premium"]);
  });

  it("lowercase + dedup", () => {
    expect(parseTagsField("HOT, hot, Warm")).toEqual(["hot", "warm"]);
  });

  it("filtra strings vacíos", () => {
    expect(parseTagsField("hot,,warm,")).toEqual(["hot", "warm"]);
  });
});
