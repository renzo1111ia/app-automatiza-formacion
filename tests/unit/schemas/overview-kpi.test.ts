import { describe, it, expect } from "vitest";
import {
  OverviewKpiConfigSchema,
  OverviewKpisArraySchema,
  OverviewKpiSizeEnum,
} from "@/lib/schemas/overview-kpi";

const validKpi = {
  id: "ov-total-leads",
  label: "Total Leads",
  icon: "Users",
  color: "bg-blue-600",
  size: "3" as const,
  staticKey: "total_leads",
  isVisible: true,
  group: "OVERVIEW",
  order: 1,
};

describe("OverviewKpiConfigSchema", () => {
  it("acepta KPI valido con todos los campos", () => {
    const result = OverviewKpiConfigSchema.safeParse(validKpi);
    expect(result.success).toBe(true);
  });

  it("acepta KPI valido minimo (sin opcionales)", () => {
    const minimal = {
      id: "ov-min",
      label: "Mínimo",
      icon: "Star",
      color: "bg-slate-500",
      size: "3" as const,
    };
    const result = OverviewKpiConfigSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    // isVisible default true
    if (result.success) expect(result.data.isVisible).toBe(true);
  });

  it("rechaza label > 60 chars", () => {
    const tooLong = { ...validKpi, label: "x".repeat(61) };
    const result = OverviewKpiConfigSchema.safeParse(tooLong);
    expect(result.success).toBe(false);
  });

  it("rechaza size fuera del enum", () => {
    const badSize = { ...validKpi, size: "5" };
    const result = OverviewKpiConfigSchema.safeParse(badSize);
    expect(result.success).toBe(false);
  });

  it("acepta size del enum (12)", () => {
    const ok = { ...validKpi, size: "12" as const };
    expect(OverviewKpiConfigSchema.safeParse(ok).success).toBe(true);
  });

  it("rechaza id vacio", () => {
    const noId = { ...validKpi, id: "" };
    expect(OverviewKpiConfigSchema.safeParse(noId).success).toBe(false);
  });
});

describe("OverviewKpisArraySchema", () => {
  it("acepta array de 4 KPIs (default Overview)", () => {
    const arr = [
      validKpi,
      { ...validKpi, id: "ov-2" },
      { ...validKpi, id: "ov-3" },
      { ...validKpi, id: "ov-4" },
    ];
    expect(OverviewKpisArraySchema.safeParse(arr).success).toBe(true);
  });

  it("rechaza array de 9 KPIs (max 8)", () => {
    const arr = Array.from({ length: 9 }, (_, i) => ({ ...validKpi, id: `ov-${i}` }));
    const result = OverviewKpisArraySchema.safeParse(arr);
    expect(result.success).toBe(false);
  });

  it("acepta array vacio (tenant sin overview customizado → caller debe usar default)", () => {
    expect(OverviewKpisArraySchema.safeParse([]).success).toBe(true);
  });
});

describe("OverviewKpiSizeEnum", () => {
  it("incluye sizes validos del KpiConfig", () => {
    expect(OverviewKpiSizeEnum.options).toEqual(["3", "4", "6", "8", "9", "12"]);
  });
});
