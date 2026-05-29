import { getSupabaseServerClient } from "@/lib/supabase/server";
import { toZonedTime } from "date-fns-tz";
import { startOfWeek, endOfWeek } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * NATIVE SCHEDULER — Round Robin Appointment Engine
 * Assigns leads to advisors based on availability and workload balance.
 */

export interface AdvisorWithLoad {
  id: string;
  name: string;
  email: string | null;
  appointmentsThisWeek: number;
}

export interface AppointmentResult {
  success: boolean;
  appointmentId?: string;
  advisorId?: string;
  advisorName?: string;
  scheduledAt?: string;
  error?: string;
}

/**
 * Cast Supabase client to a plain client without Database generics.
 * Used for tables where Supabase TS inference returns `never` due to
 * index signatures ([key: string]: unknown) in related Row types.
 * This is a project-wide pattern — see also analytics.ts, inbox.ts.
 */
function asPlainClient(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>
): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Shape of availability_slots rows joined with advisors used in findAvailableAdvisor. */
interface AvailabilitySlotWithAdvisor {
  advisor_id: string;
  advisors: {
    id: string;
    name: string;
    email: string | null;
  };
}

/** Shape returned from advisor_programas select. */
interface AdvisorProgramaRow {
  advisor_id: string;
}

/** Shape returned from appointments load count query. */
interface AppointmentLoadRow {
  advisor_id: string;
}

/** Shape returned from appointment insert select. */
interface AppointmentInsertRow {
  id: string;
}

/**
 * ROUND ROBIN: Finds the best available advisor for a given time slot.
 * Returns the advisor with the least appointments who is available at that time.
 */
export async function findAvailableAdvisor(
  tenantId: string,
  requestedAt: Date,
  options: {
    timezone?: string;
    programaId?: string;
  } = {}
): Promise<AdvisorWithLoad | null> {
  const timezone = options.timezone || "Europe/Madrid";
  const supabase = await getSupabaseServerClient();
  const db = asPlainClient(supabase);

  // 1. Get the local time in the tenant's timezone
  const localTime = toZonedTime(requestedAt, timezone);
  const dayOfWeek = localTime.getDay();
  const timeStr = `${String(localTime.getHours()).padStart(2, "0")}:${String(localTime.getMinutes()).padStart(2, "0")}`;

  // 2. Find all active advisors with an availability slot matching this day + time
  let query = db
    .from("availability_slots")
    .select("advisor_id, advisors!inner(id, name, email, is_active, tenant_id)")
    .eq("day_of_week", dayOfWeek)
    .lte("start_time", timeStr)
    .gte("end_time", timeStr)
    .eq("advisors.tenant_id", tenantId)
    .eq("advisors.is_active", true);

  // Filter by program specialization if provided
  if (options.programaId) {
    const { data: specialists } = (await db
      .from("advisor_programas")
      .select("advisor_id")
      .eq("programa_id", options.programaId)) as {
      data: AdvisorProgramaRow[] | null;
      error: unknown;
    };

    if (specialists && specialists.length > 0) {
      query = query.in(
        "advisor_id",
        specialists.map((s) => s.advisor_id)
      );
    }
  }

  const { data: slots, error: slotsError } = (await query) as {
    data: AvailabilitySlotWithAdvisor[] | null;
    error: unknown;
  };

  if (slotsError || !slots || slots.length === 0) {
    console.warn(
      `[SCHEDULER] No advisors available on day ${dayOfWeek} at ${timeStr} for tenant ${tenantId}`
    );
    return null;
  }

  const advisorIds = slots.map((s) => s.advisor_id);

  // 3. Count appointments this week for each advisor
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: weeklyLoad } = (await db
    .from("appointments")
    .select("advisor_id")
    .in("advisor_id", advisorIds)
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", weekStart.toISOString())
    .lte("scheduled_at", weekEnd.toISOString())
    .neq("status", "CANCELLED")) as { data: AppointmentLoadRow[] | null; error: unknown };

  // Count load per advisor
  const loadMap: Record<string, number> = {};
  advisorIds.forEach((id: string) => (loadMap[id] = 0));
  (weeklyLoad ?? []).forEach((apt) => {
    loadMap[apt.advisor_id] = (loadMap[apt.advisor_id] || 0) + 1;
  });

  // 4. Build sorted list (least loaded first = Round Robin)
  const advisorList: AdvisorWithLoad[] = slots.map((slot) => {
    const advisor = slot.advisors;
    return {
      id: advisor.id,
      name: advisor.name,
      email: advisor.email,
      appointmentsThisWeek: loadMap[advisor.id] || 0,
    };
  });

  // Remove duplicates (same advisor might have multiple matching slots)
  const seen = new Set<string>();
  const unique = advisorList.filter((a: AdvisorWithLoad) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Sort ascending by load → first in list has least appointments
  unique.sort((a, b) => a.appointmentsThisWeek - b.appointmentsThisWeek);

  console.log(
    `[SCHEDULER] Round Robin candidates: ${unique.map((a) => `${a.name}(${a.appointmentsThisWeek})`).join(", ")}`
  );

  return unique[0]; // The winner
}

/**
 * Books an appointment for a lead with the best available advisor.
 */
export async function bookAppointment(
  leadId: string,
  tenantId: string,
  requestedAt: Date,
  options: {
    agentUsed?: string;
    abVariant?: "A" | "B";
    durationMinutes?: number;
    notes?: string;
    timezone?: string;
  } = {}
): Promise<AppointmentResult> {
  const supabase = await getSupabaseServerClient();
  const db = asPlainClient(supabase);

  // 1. Find advisor via Round Robin
  const advisor = await findAvailableAdvisor(tenantId, requestedAt, {
    timezone: options.timezone || "Europe/Madrid",
    // We'll need to pass programaId here eventually from the lead context
  });

  if (!advisor) {
    return {
      success: false,
      error: "No hay asesores disponibles para el horario solicitado.",
    };
  }

  // 2. Check for double-booking this advisor at this exact time
  const slotEnd = new Date(requestedAt.getTime() + (options.durationMinutes || 30) * 60 * 1000);
  const { data: conflicts } = (await db
    .from("appointments")
    .select("id")
    .eq("advisor_id", advisor.id)
    .gte("scheduled_at", requestedAt.toISOString())
    .lt("scheduled_at", slotEnd.toISOString())
    .neq("status", "CANCELLED")) as { data: { id: string }[] | null; error: unknown };

  if (conflicts && conflicts.length > 0) {
    return {
      success: false,
      error: `Asesor ${advisor.name} ya tiene una cita en ese horario.`,
    };
  }

  // 3. Create the appointment
  const { data: appointment, error } = (await db
    .from("appointments")
    .insert({
      tenant_id: tenantId,
      advisor_id: advisor.id,
      lead_id: leadId,
      scheduled_at: requestedAt.toISOString(),
      duration_minutes: options.durationMinutes || 30,
      status: "PENDING",
      agent_used: options.agentUsed || null,
      ab_variant: options.abVariant || null,
      notes: options.notes || null,
    })
    .select()
    .single()) as { data: AppointmentInsertRow | null; error: { message: string } | null };

  if (error) {
    return { success: false, error: error.message };
  }

  console.log(
    `[SCHEDULER] ✅ Appointment booked: Lead ${leadId} → Advisor ${advisor.name} at ${requestedAt.toISOString()}`
  );

  return {
    success: true,
    appointmentId: appointment?.id,
    advisorId: advisor.id,
    advisorName: advisor.name,
    scheduledAt: requestedAt.toISOString(),
  };
}

/**
 * Logs an orchestration step result to orchestration_logs.
 */
export async function logOrchestrationStep(params: {
  tenantId: string;
  leadId: string;
  workflowId?: string;
  step: number;
  actionType: string;
  agentUsed?: string;
  abVariant?: "A" | "B";
  result: "SUCCESS" | "FAILED" | "SKIPPED" | "QUEUED";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await getSupabaseServerClient();
    const db = asPlainClient(supabase);
    await db.from("orchestration_logs").insert({
      tenant_id: params.tenantId,
      lead_id: params.leadId,
      workflow_id: params.workflowId || null,
      step_number: params.step,
      action_type: params.actionType,
      agent_used: params.agentUsed || null,
      ab_variant: params.abVariant || null,
      result: params.result,
      error_message: params.errorMessage || null,
      metadata: params.metadata || {},
    });
  } catch (e) {
    console.error("[SCHEDULER] Failed to write orchestration log:", e);
  }
}
