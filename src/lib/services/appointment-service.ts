import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { fromZonedTime, toZonedTime, format } from "date-fns-tz";

/**
 * Appointment Service.
 * DI: usa getAdminSupabaseClient centralizado (Sprint 1 tarea 2-02.b),
 * sin createClient inline. Mockable a nivel de modulo en tests.
 */
export class AppointmentService {
  private static DEFAULT_TIMEZONE = "Europe/Madrid";

  private static async getSupabase() {
    return getAdminSupabaseClient();
  }

  static async getLeadAppointments(leadId: string) {
    const supabase = await this.getSupabase();
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, start_time, duration, title, status, notes, advisors(name)")
      .eq("lead_id", leadId)
      .neq("status", "CANCELLED")
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("[GET LEAD APPOINTMENTS] Error:", error);
      return [];
    }
    return appointments || [];
  }

  private static normalizeDate(dateStr: string): string {
    if (!dateStr) {
      return new Date().toISOString().split("T")[0];
    }
    const lower = dateStr.toLowerCase().trim();
    if (lower === "mañana" || lower === "manana") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    }
    if (lower === "hoy") {
      return new Date().toISOString().split("T")[0];
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.split("T")[0];
    }
    return dateStr;
  }

  static async bookAppointment(
    tenantId: string,
    leadId: string,
    date: string,
    time?: string,
    notes?: string
  ) {
    const cleanDate = this.normalizeDate(date);
    console.log(
      `[BOOK APPOINTMENT] 🚀 Starting! Tenant: ${tenantId}, Lead: ${leadId}, Date: ${cleanDate}, Time: ${time}`
    );
    const supabase = await this.getSupabase();

    let scheduledAt: string;

    if (time) {
      const timeStr = time.includes(":")
        ? time.split(":").length === 2
          ? `${time}:00`
          : time
        : `${time}:00:00`;
      const fullLocalString = `${cleanDate} ${timeStr}`;
      try {
        const utcDate = fromZonedTime(fullLocalString, this.DEFAULT_TIMEZONE);
        scheduledAt = utcDate.toISOString();
      } catch (e) {
        console.warn(
          `[BOOK APPOINTMENT] Timezone conversion failed for ${fullLocalString}, falling back to UTC`,
          e
        );
        scheduledAt = `${cleanDate}T${timeStr}Z`;
      }
    } else {
      scheduledAt = `${cleanDate}T00:00:00Z`;
    }

    try {
      try {
        await supabase
          .from("appointments")
          .update({ status: "CANCELLED" } as never)
          .eq("lead_id", leadId)
          .gte("scheduled_at", `${cleanDate}T00:00:00Z`)
          .lte("scheduled_at", `${cleanDate}T23:59:59Z`);
      } catch (e) {
        console.warn("[BOOK APPOINTMENT] Auto-cancel skipped (non-fatal):", e);
      }

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("config")
        .eq("id", tenantId)
        .single();

      if (!tenantData) {
        throw new Error("Error al obtener datos del tenant");
      }

      let programName: string | null = null;
      try {
        const { data: lp } = await supabase
          .from("lead_programas")
          .select("programas(nombre)")
          .eq("lead_id", leadId)
          .eq("status", "ACTIVE")
          .limit(1)
          .maybeSingle();
        programName =
          (lp as unknown as { programas?: { nombre: string } })?.programas?.nombre || null;
      } catch (e) {
        console.warn("[BOOK APPOINTMENT] Could not fetch program name, skipping...", e);
      }

      const notesValue = notes
        ? `${notes}${programName ? ` (Programa: ${programName})` : ""}`
        : programName
          ? `Interesado en: ${programName}`
          : null;

      const scheduledDate = new Date(scheduledAt);
      const dateForValidation = format(scheduledDate, "yyyy-MM-dd");
      const availability = await this.checkAvailability(tenantId, dateForValidation);

      const requestedTimeMadrid = format(
        toZonedTime(scheduledDate, this.DEFAULT_TIMEZONE),
        "HH:mm"
      );
      const isAvailable = availability.available_slots.some(
        (s) => s.madrid_time === requestedTimeMadrid
      );

      if (!isAvailable) {
        throw new Error(
          `La hora seleccionada (${requestedTimeMadrid} hora España) no está disponible o está fuera del horario de atención.`
        );
      }

      const basePayload: Record<string, unknown> = {
        tenant_id: tenantId,
        lead_id: leadId,
        scheduled_at: scheduledAt,
      };

      const currentData: Record<string, unknown> = {
        ...basePayload,
        status: "PENDING",
        advisor_id: null,
        duration_minutes: 30,
        notes: notesValue,
        metadata: { source: "ai_wa_processor", extracted_program: programName },
      };

      const stripOrder = ["metadata", "notes", "duration_minutes", "advisor_id", "status"];

      let appointment: Record<string, unknown> | null = null;
      let lastError: any = null;

      for (let i = 0; i <= stripOrder.length; i++) {
        const result = await supabase
          .from("appointments")
          .insert((i === 0 ? currentData : { ...currentData }) as never)
          .select()
          .single();

        if (!result.error) {
          appointment = result.data as Record<string, unknown>;
          lastError = null;
          console.log(`[BOOK APPOINTMENT] ✅ Insert succeeded on attempt ${i + 1}`);
          break;
        }

        lastError = result.error;
        const msg: string = lastError?.message || "";
        const isSchemaError =
          msg.includes("column") || msg.includes("schema cache") || lastError?.code === "PGRST204";

        if (!isSchemaError) break;

        if (i < stripOrder.length) {
          let fieldToRemove = stripOrder[i];
          delete currentData[fieldToRemove];
        } else {
          const { error: syncError } = await supabase.from("google_calendar_sync").insert({
            tenant_id: tenantId,
            appointment_id: (appointment as any)?.id,
            status: "PENDING",
            sync_attempts: 0,
          } as never);
          break;
        }
      }

      if (lastError) {
        throw new Error(`Error persistente en base de datos al agendar: ${lastError.message}`);
      }

      return appointment;
    } catch (err: unknown) {
      console.error(`[BOOK APPOINTMENT] Critical failure:`, err);
      throw err;
    }
  }

  static async cancelAppointment(appointmentId: string, tenantId: string) {
    const supabase = await this.getSupabase();
    const { error: cancelError } = await supabase
      .from("appointments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() } as never)
      .eq("tenant_id", tenantId)
      .eq("id", appointmentId);
    if (cancelError) throw cancelError;
    return { success: true };
  }

  static async rescheduleAppointment(
    appointmentId: string,
    tenantId: string,
    newDate: string,
    newTime?: string
  ) {
    const supabase = await this.getSupabase();
    let scheduledAt = newDate;
    if (newTime) {
      const timeStr = newTime.includes(":") ? newTime : `${newTime}:00:00`;
      try {
        scheduledAt = fromZonedTime(`${newDate} ${timeStr}`, this.DEFAULT_TIMEZONE).toISOString();
      } catch {
        scheduledAt = `${newDate}T${timeStr}Z`;
      }
    }

    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appointment) throw new Error("Cita no encontrada para reprogramar.");

    const scheduledDate = new Date(scheduledAt);
    const dateForValidation = format(scheduledDate, "yyyy-MM-dd");
    const availability = await this.checkAvailability(tenantId, dateForValidation);

    const requestedTimeMadrid = format(toZonedTime(scheduledDate, this.DEFAULT_TIMEZONE), "HH:mm");
    const isAvailable = availability.available_slots.some(
      (s) => s.madrid_time === requestedTimeMadrid
    );

    if (!isAvailable) {
      throw new Error(`La nueva hora (${requestedTimeMadrid} hora España) no está disponible.`);
    }

    const { error } = await supabase
      .from("appointments")
      .update({ scheduled_at: scheduledAt, status: "SCHEDULED" } as never)
      .eq("id", appointmentId);
    if (error) throw error;
    return { success: true, newTime: scheduledAt };
  }

  static async checkAvailability(tenantId: string, date: string, leadTimezone?: string) {
    const cleanDate = this.normalizeDate(date);
    const supabase = await this.getSupabase();
    const referenceDate = fromZonedTime(`${cleanDate} 12:00:00`, this.DEFAULT_TIMEZONE);
    const dayOfWeek = referenceDate.getDay();

    const { data: tenantAdvisors } = await supabase
      .from("advisors")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    const advisorIds = ((tenantAdvisors as { id: string }[]) || []).map((a) => a.id);

    let rangesQuery = supabase.from("availability_slots").select("*").eq("day_of_week", dayOfWeek);

    if (advisorIds.length > 0) {
      // Include both advisor-specific slots AND general tenant slots (advisor_id IS NULL)
      rangesQuery = rangesQuery.or(
        `advisor_id.in.(${advisorIds.join(",")}),and(tenant_id.eq.${tenantId},advisor_id.is.null)`
      );
    } else {
      // No advisors configured — fall back to general tenant-level slots
      rangesQuery = rangesQuery.eq("tenant_id", tenantId).is("advisor_id", null);
      console.warn(
        `[CHECK AVAILABILITY] ⚠️ No active advisors found for tenant ${tenantId}. Using general tenant slots.`
      );
    }

    const { data: ranges } = (await rangesQuery) as {
      data:
        | {
            start_time: string;
            end_time: string;
            slot_duration_minutes: number | null;
            advisor_id: string;
          }[]
        | null;
    };

    // Define the time range for the day in UTC
    const startOfDayUTC = fromZonedTime(
      `${cleanDate} 00:00:00`,
      this.DEFAULT_TIMEZONE
    ).toISOString();
    const endOfDayUTC = fromZonedTime(`${cleanDate} 23:59:59`, this.DEFAULT_TIMEZONE).toISOString();

    // Get tenant config for default slot duration
    let globalSlotDuration = 15; // Default if nothing else found
    try {
      const tenantResponse = await supabase
        .from("tenants")
        .select("config")
        .eq("id", tenantId)
        .single();
      const tenant = tenantResponse.data as {
        config: { scheduling?: { slot_duration?: number } };
      } | null;
      const config = tenant?.config?.scheduling;
      if (config?.slot_duration) {
        globalSlotDuration = Number(config.slot_duration);
      }
    } catch (e) {
      console.warn("[CHECK AVAILABILITY] Could not fetch tenant config:", e);
    }

    // Get existing appointments for that day
    const { data: existing } = await supabase
      .from("appointments")
      .select("scheduled_at, advisor_id")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", startOfDayUTC)
      .lte("scheduled_at", endOfDayUTC)
      .neq("status", "CANCELLED");

    const availableSlots: { time: string; madrid_time: string; advisor_id: string }[] = [];

    if (ranges) {
      for (const range of ranges) {
        const startTime = range.start_time;
        const endTime = range.end_time;
        const duration = range.slot_duration_minutes || globalSlotDuration;
        const advisorId = range.advisor_id;

        let currentMin = this.parseTimeToMinutes(startTime);
        const endMin = this.parseTimeToMinutes(endTime);

        while (currentMin < endMin) {
          const timeStr = this.minutesToTimeString(currentMin);
          const slotFullString = `${cleanDate} ${timeStr}`;
          const slotUTC = fromZonedTime(slotFullString, this.DEFAULT_TIMEZONE).toISOString();

          const isBooked = (existing as { scheduled_at: string; advisor_id: string }[])?.some(
            (e) => {
              const existingISO = new Date(e.scheduled_at).toISOString();
              return existingISO === slotUTC && e.advisor_id === advisorId;
            }
          );

          if (!isBooked) {
            const nowUTC = new Date();
            const slotDate = new Date(slotUTC);

            // If checking for today, skip slots that already passed (plus 15 min buffer)
            const isPast = slotDate.getTime() < nowUTC.getTime() + 15 * 60 * 1000;
            // Compare using Madrid timezone to avoid UTC date mismatch (e.g. UTC is still yesterday)
            const todayInMadrid = format(toZonedTime(nowUTC, this.DEFAULT_TIMEZONE), "yyyy-MM-dd");
            const isToday = cleanDate === todayInMadrid;

            if (!(isToday && isPast)) {
              let finalTime = timeStr.substring(0, 5);
              let localHour = -1;

              if (leadTimezone) {
                try {
                  const zoned = toZonedTime(new Date(slotUTC), leadTimezone);
                  finalTime = format(zoned, "HH:mm", { timeZone: leadTimezone });
                  localHour = zoned.getHours();
                } catch (e) {
                  console.warn(
                    `[CHECK AVAILABILITY] Failed to convert ${slotUTC} to ${leadTimezone}`,
                    e
                  );
                }
              }

              // Skip slots that fall in the dead of night for the lead (00:00–06:59 local time)
              if (leadTimezone && localHour >= 0 && localHour < 7) {
                console.log(
                  `[CHECK AVAILABILITY] ⏭️ Skipping slot ${finalTime} (${leadTimezone}) — unreasonable local hour`
                );
                currentMin += duration;
                continue;
              }

              availableSlots.push({
                time: finalTime,
                madrid_time: timeStr.substring(0, 5),
                advisor_id: advisorId,
              });
            }
          }
          currentMin += duration;
        }
      }
    }

    console.log(`[CHECK AVAILABILITY] ✅ Found ${availableSlots.length} available slots.`);
    return {
      date: cleanDate,
      timezone: leadTimezone || this.DEFAULT_TIMEZONE,
      available_slots: availableSlots,
    };
  }

  private static parseTimeToMinutes(timeStr: string): number {
    const actualTime = timeStr.includes("T") ? timeStr.split("T")[1].substring(0, 5) : timeStr;
    const [h, m] = actualTime.split(":").map(Number);
    return h * 60 + m;
  }

  private static minutesToTimeString(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
}
