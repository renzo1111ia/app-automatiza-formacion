import { describe, it, expect } from "vitest";
import { summarizeChartData } from "@/lib/utils/chart-summary";

describe("summarizeChartData (WCAG aria-label generator)", () => {
  it("devuelve mensaje vacio para data null", () => {
    expect(summarizeChartData(null)).toBe("Gráfico sin datos disponibles");
  });

  it("devuelve mensaje vacio para data undefined", () => {
    expect(summarizeChartData(undefined)).toBe("Gráfico sin datos disponibles");
  });

  it("devuelve mensaje vacio para data []", () => {
    expect(summarizeChartData([])).toBe("Gráfico sin datos disponibles");
  });

  it("resume 1 punto en singular", () => {
    const data = [{ label: "Llamadas", value: 100 }];
    const result = summarizeChartData(data);
    expect(result).toContain("1 punto de datos");
    expect(result).toContain("Total: 100");
    expect(result).toContain("Máximo: Llamadas con 100");
  });

  it("resume N puntos en plural con total y maximo", () => {
    const data = [
      { label: "Lunes", value: 10 },
      { label: "Martes", value: 25 },
      { label: "Miércoles", value: 15 },
    ];
    const result = summarizeChartData(data);
    expect(result).toContain("3 puntos de datos");
    expect(result).toContain("Total: 50");
    expect(result).toContain("Máximo: Martes con 25");
  });

  it("maneja valores no-numericos defaulteando a 0", () => {
    const data = [
      { label: "A", value: 10 },
      { label: "B", value: NaN },
    ];
    const result = summarizeChartData(data);
    expect(result).toContain("Total: 10");
  });
});
