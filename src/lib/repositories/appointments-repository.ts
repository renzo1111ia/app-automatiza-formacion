// Sprint 1 — Bloque 2.3 (tarea 2-15) Repository appointments + llamadas.

import type {
  Appointment,
  CreateAppointment,
  UpdateAppointment,
  Llamada,
  IntentoLlamada,
} from "@/lib/schemas/appointments";
import { AppointmentStatusEnum } from "@/lib/schemas/_base";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import {
  type RepoResult,
  type RepoListResult,
  type PaginationParams,
  handleSupabaseError,
  paginate,
} from "./_base-repository";

export interface AppointmentFilters extends PaginationParams {
  status?: string;
  advisorId?: string;
  leadId?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

export class AppointmentsRepository {
  async findByTenant(
    tenantId: string,
    filters?: AppointmentFilters
  ): Promise<RepoListResult<Appointment>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { from, to } = paginate(filters);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("appointments")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.advisorId) q = q.eq("advisor_id", filters.advisorId);
      if (filters?.leadId) q = q.eq("lead_id", filters.leadId);
      if (filters?.from) q = q.gte("scheduled_at", filters.from);
      if (filters?.to) q = q.lte("scheduled_at", filters.to);
      q = q.order("scheduled_at", { ascending: true }).range(from, to);
      const { data, error, count } = await q;
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Appointment[], error: null, count: count ?? undefined };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findById(id: string, tenantId: string): Promise<RepoResult<Appointment>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: (data as unknown as Appointment) ?? null, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async findByLead(leadId: string, tenantId: string): Promise<RepoListResult<Appointment>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("lead_id", leadId)
        .eq("tenant_id", tenantId)
        .order("scheduled_at", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Appointment[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, data: CreateAppointment): Promise<RepoResult<Appointment>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase.from("appointments") as any)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as Appointment, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateAppointment
  ): Promise<RepoResult<Appointment>> {
    try {
      const supabase = await getAdminSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updated, error } = await (supabase.from("appointments") as any)
        .update(data)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: updated as Appointment, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }

  async cancel(id: string, tenantId: string, reason?: string): Promise<RepoResult<Appointment>> {
    return this.update(id, tenantId, {
      status: AppointmentStatusEnum.enum.cancelled,
      notes: reason ?? null,
    } as UpdateAppointment);
  }
}

export class CallsRepository {
  async findByTenant(
    tenantId: string,
    params?: PaginationParams
  ): Promise<RepoListResult<Llamada>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { from, to } = paginate(params);
      const { data, error, count } = await supabase
        .from("llamadas")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("fecha_inicio", { ascending: false })
        .range(from, to);
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Llamada[], error: null, count: count ?? undefined };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async findByLead(leadId: string, tenantId: string): Promise<RepoListResult<Llamada>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("llamadas")
        .select("*")
        .eq("id_lead", leadId)
        .eq("tenant_id", tenantId)
        .order("fecha_inicio", { ascending: false });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as Llamada[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async create(tenantId: string, data: Partial<Llamada>): Promise<RepoResult<Llamada>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase.from("llamadas") as any)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as Llamada, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export class AttemptsRepository {
  async findByLead(leadId: string, tenantId: string): Promise<RepoListResult<IntentoLlamada>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const { data, error } = await supabase
        .from("intentos_llamadas")
        .select("*")
        .eq("id_lead", leadId)
        .eq("tenant_id", tenantId)
        .order("numero_intento", { ascending: true });
      if (error) return { data: [], error: handleSupabaseError(error) };
      return { data: (data ?? []) as IntentoLlamada[], error: null };
    } catch (e) {
      return { data: [], error: handleSupabaseError(e) };
    }
  }

  async create(
    tenantId: string,
    data: Partial<IntentoLlamada>
  ): Promise<RepoResult<IntentoLlamada>> {
    try {
      const supabase = await getAdminSupabaseClient();
      const payload = { ...data, tenant_id: tenantId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (supabase.from("intentos_llamadas") as any)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: inserted as IntentoLlamada, error: null };
    } catch (e) {
      return { data: null, error: handleSupabaseError(e) };
    }
  }
}

export const appointmentsRepository = new AppointmentsRepository();
export const callsRepository = new CallsRepository();
export const attemptsRepository = new AttemptsRepository();
