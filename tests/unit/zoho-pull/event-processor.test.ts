// Sprint 5 - event-processor: cubre las ramas clave de processZohoLeadEvent.
//
// Ramas testeadas:
//   1. Lead nuevo (no existe en zoho_lead_synced):
//      → INSERT lead con autorelleno (origen='zoho_crm', tipo_lead='zoho_import',
//        fecha_ingreso_crm presente, id_lead_externo=zohoLeadId)
//      → INSERT zoho_lead_synced
//      → orchestrator.handleNewLead() llamado
//   2. Lead existente con MISMO Modified_Time → skip (guard anti-bucle).
//   3. provider.getLead devuelve null (404/borrado) → skip sin crash.
//   4. IDs vacíos en el job → resultado vacío sin llamadas al provider.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// vi.hoisted garantiza que los mocks están disponibles cuando vi.mock() los usa
// (necesario en Vitest 4 para referencias a variables externas en factories).
const { getLeadMock, handleNewLeadMock } = vi.hoisted(() => ({
  getLeadMock: vi.fn(),
  handleNewLeadMock: vi.fn().mockResolvedValue(undefined),
}));

// CRMFactory — devuelve un provider con getLead mock.
vi.mock("@/lib/integrations/crm/factory", () => ({
  CRMFactory: {
    getProviderForIntegration: vi.fn().mockResolvedValue({
      getLead: getLeadMock,
    }),
  },
}));

// orchestrator — solo debe llamarse en lead nuevo.
vi.mock("@/lib/core/orchestrator", () => ({
  orchestrator: { handleNewLead: handleNewLeadMock },
}));

vi.mock("@/lib/integrations/sheets/phone-country", () => ({
  resolveLeadCountry: vi.fn().mockReturnValue("España"),
}));

import { processZohoLeadEvent } from "@/lib/integrations/zoho-pull/event-processor";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import type { ZohoPullJob } from "@/lib/integrations/zoho-pull/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INTEGRATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ZOHO_LEAD_ID = "zoho-123456";
const MODIFIED_TIME = "2026-06-08T10:00:00+02:00";

const BASE_JOB: ZohoPullJob = {
  integration_id: INTEGRATION_ID,
  tenant_id: TENANT_ID,
  zoho_lead_ids: [ZOHO_LEAD_ID],
  trigger: "webhook",
  triggered_at: new Date().toISOString(),
};

const SAMPLE_CRM_LEAD = {
  id: ZOHO_LEAD_ID,
  fields: {
    nombre: "Carlos",
    apellido: "Pérez",
    email: "carlos@example.com",
    telefono: "+34611223344",
    pais: "España",
    source: "Web",
  },
  raw: {
    First_Name: "Carlos",
    Last_Name: "Pérez",
    Email: "carlos@example.com",
    Phone: "+34611223344",
    Lead_Status: "New",
    Modified_Time: MODIFIED_TIME,
  },
};

// ─── Helper buildSupabase ──────────────────────────────────────────────────────
//
// El event-processor hace las siguientes llamadas from() en orden:
//   1. zoho_sync_connections   → SELECT field_mapping  (maybeSingle)
//   2. zoho_lead_synced        → SELECT id/lead_id     (maybeSingle)
//   3. lead                    → INSERT + select id    (o nada si existe)
//   4. lead_cualificacion      → INSERT (si hay cualif)
//   5. zoho_lead_synced        → UPSERT idempotencia
//   6. zoho_sync_connections   → UPDATE last_synced_at
//
// Para la rama "existing/skip":
//   1. zoho_sync_connections   → SELECT field_mapping
//   2. zoho_lead_synced        → devuelve fila con lead_id + zoho_modified_time
//   3. (si mismo modified_time → skip; no más calls a lead)
//   4. zoho_sync_connections   → UPDATE last_synced_at

function buildSupabase(scenario: "new" | "existing-same-time" | "existing-changed-time") {
  const ops = { leadInsert: 0, leadSyncedUpsert: 0 };

  const from = vi.fn((table: string) => {
    if (table === "zoho_sync_connections") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "conn-1", field_mapping: [] },
          error: null,
        }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }
    if (table === "zoho_lead_synced") {
      if (scenario === "new") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn(() => {
            ops.leadSyncedUpsert++;
            return Promise.resolve({ data: null, error: null });
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      // existing scenarios: devuelve fila con lead_id
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "synced-row-1",
            lead_id: "existing-lead-uuid",
            zoho_modified_time:
              scenario === "existing-same-time"
                ? MODIFIED_TIME // mismo → skip
                : "2026-01-01T00:00:00Z", // distinto → update
          },
          error: null,
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }
    if (table === "lead") {
      return {
        insert: vi.fn(() => {
          ops.leadInsert++;
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "new-lead-uuid" },
              error: null,
            }),
          };
        }),
      };
    }
    if (table === "lead_cualificacion") {
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    // Catch-all para rpc y tablas no esperadas.
    return {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  // El processor también llama supabase.rpc() directamente para la rama update.
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { client: { from, rpc }, ops };
}

beforeEach(() => {
  vi.clearAllMocks();
  handleNewLeadMock.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("processZohoLeadEvent", () => {
  it("retorna vacío si el job no tiene ids", async () => {
    const jobEmpty: ZohoPullJob = {
      ...BASE_JOB,
      zoho_lead_ids: [],
    };
    const { client } = buildSupabase("new");
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await processZohoLeadEvent(jobEmpty);

    expect(result.processed).toBe(0);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    // No debería haberse llamado al supabase desde().
    expect(client.from).not.toHaveBeenCalled();
  });

  it("lead nuevo: crea lead con autorelleno y dispara orchestrator", async () => {
    getLeadMock.mockResolvedValue(SAMPLE_CRM_LEAD);
    const { client, ops } = buildSupabase("new");
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await processZohoLeadEvent(BASE_JOB);

    expect(result.created).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(ops.leadInsert).toBe(1);
    expect(handleNewLeadMock).toHaveBeenCalledOnce();
    expect(handleNewLeadMock).toHaveBeenCalledWith("new-lead-uuid", TENANT_ID);
  });

  it("lead nuevo: el payload tiene tipo_lead='zoho_import', fecha_ingreso_crm, id_lead_externo y tenant_id", async () => {
    // Capturar el payload del INSERT interceptando la llamada al mock.
    let capturedPayload: Record<string, unknown> | null = null;

    const { client } = buildSupabase("new");

    // Sustituir el from("lead") para capturar el argumento del INSERT.
    const originalFrom = client.from.getMockImplementation?.() ?? client.from;
    client.from.mockImplementation(((table: string) => {
      const result = (originalFrom as (t: string) => unknown)(table);
      if (table === "lead" && result && typeof result === "object") {
        const r = result as Record<string, unknown>;
        const origInsert = r.insert as (payload: unknown) => unknown;
        r.insert = vi.fn((payload: unknown) => {
          capturedPayload = payload as Record<string, unknown>;
          return origInsert(payload);
        });
      }
      return result;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    getLeadMock.mockResolvedValue(SAMPLE_CRM_LEAD);
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    await processZohoLeadEvent(BASE_JOB);

    expect(capturedPayload).not.toBeNull();
    // Copia local para que TS no estreche a `never` (la asignación ocurre en un
    // callback que el control-flow analysis no relaciona con este punto).
    const payload = capturedPayload as Record<string, unknown> | null;
    if (payload) {
      // tipo_lead y fecha_ingreso_crm son autorelleno fijo (no vienen del mapping).
      expect(payload.tipo_lead).toBe("zoho_import");
      expect(payload.fecha_ingreso_crm).toBeTruthy();
      expect(payload.tenant_id).toBe(TENANT_ID);
      expect(payload.id_lead_externo).toBe(ZOHO_LEAD_ID);
    }
  });

  it("lead existente con MISMO Modified_Time → skip (guard anti-bucle)", async () => {
    getLeadMock.mockResolvedValue(SAMPLE_CRM_LEAD);
    const { client, ops } = buildSupabase("existing-same-time");
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await processZohoLeadEvent(BASE_JOB);

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.created).toBe(0);
    expect(result.processed).toBe(1);
    expect(ops.leadInsert).toBe(0);
    expect(handleNewLeadMock).not.toHaveBeenCalled();
  });

  it("provider.getLead devuelve null (borrado en Zoho) → skip sin crash", async () => {
    getLeadMock.mockResolvedValue(null);
    const { client, ops } = buildSupabase("new");
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await processZohoLeadEvent(BASE_JOB);

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(result.processed).toBe(0);
    expect(ops.leadInsert).toBe(0);
    expect(handleNewLeadMock).not.toHaveBeenCalled();
  });

  it("error en el INSERT del lead → acumula en errors pero no tira excepción", async () => {
    getLeadMock.mockResolvedValue(SAMPLE_CRM_LEAD);

    // Supabase con INSERT que devuelve error.
    const errorFrom = vi.fn((table: string) => {
      if (table === "zoho_sync_connections") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "conn-1", field_mapping: [] },
            error: null,
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      if (table === "zoho_lead_synced") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "lead") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "unique violation" },
            }),
          })),
        };
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: errorFrom,
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await processZohoLeadEvent(BASE_JOB);

    expect(result.created).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain(ZOHO_LEAD_ID);
  });
});
