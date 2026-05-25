import { describe, it, expect } from "vitest";
import { mapKpiGeneralesToOverview } from "@/lib/mappers/kpi-overview";
import type { KpiGenerales } from "@/lib/actions/analytics";

const baseKpi: KpiGenerales = {
  total_llamadas: 100,
  total_segundos: 6000,
  total_leads: 200,
  total_leads_alcanzados: 150,
  total_contactados: 120,
  total_no_contacto: 30,
  tasa_contacto: 0,
  tasa_agendamiento: 0,
  tasa_conversion: 0,
  tasa_ilocalizables: 0,
  total_minutos: 100,
  duracion_media_segundos: 60,
  total_agendados: 40,
  tiempo_respuesta_promedio_minutos: 5,
  total_cualificados: 80,
  total_no_cualificados: 60,
  por_estado_llamada: [],
  por_razon_termino: [],
  por_origen: [],
  por_tipo_lead: [],
  por_cualificacion: [],
  por_motivo_anulacion: [],
  agendados_por_fecha: [],
  primer_contacto_por_fecha: [],
  minutos_ahorrados: 540,
  horas_ahorradas: 9,
  tiempo_ahorrado_formateado: "9h 0m",
  total_whatsapp_conversaciones: 35,
};

describe("mapKpiGeneralesToOverview", () => {
  it("mapea campos basicos correctamente", () => {
    const out = mapKpiGeneralesToOverview(baseKpi);
    expect(out.total_leads).toBe(200);
    expect(out.leads_alcanzados).toBe(150);
    expect(out.leads_contactados).toBe(120);
    expect(out.leads_cualificados).toBe(80);
    expect(out.leads_agendados).toBe(40);
    expect(out.tiempo_ahorrado_formateado).toBe("9h 0m");
    expect(out.horas_ahorradas).toBe(9);
  });

  it("calcula tasas correctamente (round %)", () => {
    const out = mapKpiGeneralesToOverview(baseKpi);
    expect(out.tasa_contacto).toBe(60); // 120/200 = 60%
    expect(out.tasa_cualificacion).toBe(40); // 80/200 = 40%
    expect(out.tasa_agendamiento).toBe(20); // 40/200 = 20%
  });

  it("safeDiv: tasas = 0 cuando total_leads = 0", () => {
    const empty = {
      ...baseKpi,
      total_leads: 0,
      total_contactados: 0,
      total_cualificados: 0,
      total_agendados: 0,
    };
    const out = mapKpiGeneralesToOverview(empty);
    expect(out.tasa_contacto).toBe(0);
    expect(out.tasa_cualificacion).toBe(0);
    expect(out.tasa_agendamiento).toBe(0);
  });

  it("canales: llamadas y whatsapp del input, web=0 (MVP decision 24-05)", () => {
    const out = mapKpiGeneralesToOverview(baseKpi);
    expect(out.canales.llamadas).toBe(100);
    expect(out.canales.whatsapp).toBe(35);
    expect(out.canales.web).toBe(0);
  });

  it("output respeta KpiOverviewOutputSchema (Zod parse no lanza)", () => {
    expect(() => mapKpiGeneralesToOverview(baseKpi)).not.toThrow();
  });

  it("redondea tasas (no decimales)", () => {
    // 1/3 → 33% (no 33.33). Resetear cualificados/agendados para no romper schema.
    const odd = {
      ...baseKpi,
      total_leads: 3,
      total_contactados: 1,
      total_cualificados: 1,
      total_agendados: 0,
    };
    const out = mapKpiGeneralesToOverview(odd);
    expect(out.tasa_contacto).toBe(33);
    expect(out.tasa_cualificacion).toBe(33);
    expect(out.tasa_agendamiento).toBe(0);
    expect(Number.isInteger(out.tasa_contacto)).toBe(true);
  });

  it("cap tasas a 100% si numerador > denominador (race condition ingesta)", () => {
    // Caso real: llamadas (120) puede ser > leads en window (80) → no mostrar 150%
    const overflow = {
      ...baseKpi,
      total_leads: 80,
      total_contactados: 120,
      total_cualificados: 90,
      total_agendados: 40,
    };
    const out = mapKpiGeneralesToOverview(overflow);
    expect(out.tasa_contacto).toBe(100); // cap 150% → 100%
    expect(out.tasa_cualificacion).toBe(100); // cap 113% → 100%
    expect(out.tasa_agendamiento).toBe(50); // 40/80 = 50%, no capeado
  });

  it("acepta zeros completos (KpiGenerales vacio)", () => {
    const zero: KpiGenerales = {
      ...baseKpi,
      total_llamadas: 0,
      total_segundos: 0,
      total_leads: 0,
      total_leads_alcanzados: 0,
      total_contactados: 0,
      total_no_contacto: 0,
      total_minutos: 0,
      duracion_media_segundos: 0,
      total_agendados: 0,
      tiempo_respuesta_promedio_minutos: null,
      total_cualificados: 0,
      total_no_cualificados: 0,
      minutos_ahorrados: 0,
      horas_ahorradas: 0,
      tiempo_ahorrado_formateado: "0h 0m",
      total_whatsapp_conversaciones: 0,
    };
    const out = mapKpiGeneralesToOverview(zero);
    expect(out.total_leads).toBe(0);
    expect(out.canales.llamadas).toBe(0);
    expect(out.canales.whatsapp).toBe(0);
    expect(out.tasa_contacto).toBe(0);
  });
});
