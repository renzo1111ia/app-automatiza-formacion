import { z } from "zod";
import {
  uuidSchema,
  tenantIdSchema,
  timestampSchema,
  nullableTimestampSchema,
  AppointmentStatusEnum,
  CallStatusEnum,
  AttemptTypeEnum,
} from "./_base";

// Tabla: public.appointments (v2.0, en inglés).

export const AppointmentSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  advisor_id: uuidSchema.nullable().optional(),
  lead_id: uuidSchema.nullable().optional(),
  scheduled_at: timestampSchema,
  duration_minutes: z.number().int().positive().default(30),
  status: AppointmentStatusEnum.or(z.string()),
  notes: z.string().nullable().optional(),
  agent_used: z.string().nullable().optional(),
  ab_variant: z.string().nullable().optional(),
  reminder_sent_at: nullableTimestampSchema,
  reminder_scheduled_at: nullableTimestampSchema,
  watchdog_processed: z.boolean().default(false),
  created_at: nullableTimestampSchema,
  updated_at: nullableTimestampSchema,
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const CreateAppointmentSchema = AppointmentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type CreateAppointment = z.infer<typeof CreateAppointmentSchema>;

export const UpdateAppointmentSchema = AppointmentSchema.partial().omit({
  id: true,
  tenant_id: true,
});
export type UpdateAppointment = z.infer<typeof UpdateAppointmentSchema>;

// Tabla legacy: public.agendamientos (en español).
export const AgendamientoSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  id_lead: uuidSchema,
  fecha_agendada_cliente: nullableTimestampSchema,
  fecha_agendada_lead: nullableTimestampSchema,
  confirmado: z.boolean().default(false),
  fecha_creacion: nullableTimestampSchema,
});
export type Agendamiento = z.infer<typeof AgendamientoSchema>;

// Tabla: public.llamadas (Retell/Ultravox call records).
export const LlamadaSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  id_lead: uuidSchema,
  id_llamada_retell: z.string().nullable().optional(),
  tipo_agente: z.string().nullable().optional(),
  nombre_agente: z.string().nullable().optional(),
  estado_llamada: CallStatusEnum.or(z.string()).nullable().optional(),
  razon_termino: z.string().nullable().optional(),
  fecha_inicio: nullableTimestampSchema,
  duracion_segundos: z.number().int().nonnegative().nullable().optional(),
  url_grabacion: z.string().url().nullable().optional(),
  transcripcion: z.string().nullable().optional(),
  resumen: z.string().nullable().optional(),
  fecha_creacion: nullableTimestampSchema,
});
export type Llamada = z.infer<typeof LlamadaSchema>;

// Tabla: public.intentos_llamadas.
export const IntentoLlamadaSchema = z.object({
  id: uuidSchema,
  tenant_id: tenantIdSchema,
  id_lead: uuidSchema,
  id_llamada: uuidSchema.nullable().optional(),
  tipo_intento: AttemptTypeEnum.or(z.string()).nullable().optional(),
  numero_intento: z.number().int().positive().nullable().optional(),
  fecha_reintento: nullableTimestampSchema,
  estado: z.string().nullable().optional(),
  fecha_ejecucion: nullableTimestampSchema,
  fecha_creacion: nullableTimestampSchema,
});
export type IntentoLlamada = z.infer<typeof IntentoLlamadaSchema>;

// Slots de disponibilidad por advisor.
export const AvailabilitySlotSchema = z.object({
  id: uuidSchema,
  advisor_id: uuidSchema,
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  slot_duration_minutes: z.number().int().positive().default(30),
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;
