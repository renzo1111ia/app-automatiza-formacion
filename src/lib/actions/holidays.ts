"use server";

/**
 * Server Actions: gestión de festivos manuales por país (NEW-10).
 *
 * Sprint 3 phase-08.
 *
 * Tabla `tenant_holidays` (RLS multi-tenant). El admin del tenant añade festivos
 * de los países donde opera. El BullMQ scheduler de campañas respeta estos festivos
 * via `isBusinessDay(tenantId, date)` (ver helper más abajo).
 */

import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("holidays");

const HolidayInputSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha debe ser YYYY-MM-DD"),
  name: z.string().min(1).max(200),
});

const YearRangeSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  year: z.number().int().min(2020).max(2100),
});

export interface Holiday {
  id: string;
  tenantId: string;
  countryCode: string;
  date: string;
  name: string;
}

export async function getHolidays(input: {
  countryCode: string;
  year: number;
}): Promise<{ success: true; holidays: Holiday[] } | { success: false; error: string }> {
  const parsed = YearRangeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "input inválido" };
  }

  const tenant = await getActiveTenantConfig();
  if (!tenant) return { success: false, error: "Tenant no encontrado" };

  const supabase = await getSupabaseServerClient();
  const startDate = `${parsed.data.year}-01-01`;
  const endDate = `${parsed.data.year}-12-31`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typegen sin actualizar
  const { data, error } = await (supabase.from("tenant_holidays" as any) as any)
    .select("id, tenant_id, country_code, date, name")
    .eq("country_code", parsed.data.countryCode)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    log.error("getHolidays failed", { tenant_id: tenant.id, error: error.message });
    return { success: false, error: error.message };
  }

  const holidays: Holiday[] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typegen sin actualizar
    (data as any[] | null)?.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      countryCode: row.country_code,
      date: row.date,
      name: row.name,
    })) ?? [];

  return { success: true, holidays };
}

export async function addHoliday(input: {
  countryCode: string;
  date: string;
  name: string;
}): Promise<{ success: true; holiday: Holiday } | { success: false; error: string }> {
  const parsed = HolidayInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "input inválido" };
  }

  const tenant = await getActiveTenantConfig();
  if (!tenant) return { success: false, error: "Tenant no encontrado" };

  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typegen sin actualizar
  const { data, error } = await (supabase.from("tenant_holidays" as any) as any)
    .insert({
      tenant_id: tenant.id,
      country_code: parsed.data.countryCode,
      date: parsed.data.date,
      name: parsed.data.name,
    })
    .select("id, tenant_id, country_code, date, name")
    .single();

  if (error) {
    // Unique constraint violation → duplicado.
    if (error.code === "23505") {
      return {
        success: false,
        error: `Ya existe festivo para ${parsed.data.date} en ${parsed.data.countryCode}`,
      };
    }
    log.error("addHoliday failed", { tenant_id: tenant.id, error: error.message });
    return { success: false, error: error.message };
  }

  log.info("Holiday added", {
    tenant_id: tenant.id,
    country: parsed.data.countryCode,
    date: parsed.data.date,
  });

  return {
    success: true,
    holiday: {
      id: data.id,
      tenantId: data.tenant_id,
      countryCode: data.country_code,
      date: data.date,
      name: data.name,
    },
  };
}

export async function removeHoliday(input: {
  holidayId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const tenant = await getActiveTenantConfig();
  if (!tenant) return { success: false, error: "Tenant no encontrado" };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_holidays")
    .delete()
    .eq("id", input.holidayId)
    .eq("tenant_id", tenant.id); // doble check defensivo

  if (error) {
    log.error("removeHoliday failed", { tenant_id: tenant.id, error: error.message });
    return { success: false, error: error.message };
  }

  log.info("Holiday removed", { tenant_id: tenant.id, holidayId: input.holidayId });
  return { success: true };
}

/**
 * Helper: ¿es la fecha un día laboral para el tenant en el país dado?
 *
 * Reglas:
 * - Fin de semana (sábado/domingo) → NO laboral.
 * - Día en `tenant_holidays` → NO laboral.
 * - Resto → laboral.
 *
 * Uso típico desde BullMQ scheduler de campañas (NEW-09):
 *
 * ```ts
 * if (!await isBusinessDay(tenant.id, "ES", new Date())) {
 *   // postponer envíos al próximo laboral
 * }
 * ```
 */
export async function isBusinessDay(
  tenantId: string,
  countryCode: string,
  date: Date
): Promise<boolean> {
  const day = date.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const dateStr = date.toISOString().slice(0, 10);
  const supabase = await getSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typegen sin actualizar
  const { data, error } = await (supabase.from("tenant_holidays" as any) as any)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("country_code", countryCode.toUpperCase())
    .eq("date", dateStr)
    .limit(1);

  if (error) {
    log.warn("isBusinessDay query failed, defaulting to business day", {
      tenant_id: tenantId,
      error: error.message,
    });
    return true; // fail-open: si BD cae, no bloqueamos
  }

  return (data?.length ?? 0) === 0;
}
