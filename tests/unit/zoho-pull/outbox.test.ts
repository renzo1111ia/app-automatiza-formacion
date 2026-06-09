// Sprint 5 - zoho outbox-processor smoke test (lógica de claim + reintentos).
//
// Patrón calcado de tests/unit/sheets/outbox.test.ts, adaptado a Zoho:
//   - tabla: zoho_writeback_outbox
//   - función: runZohoWritebackOutbox
//   - writeback: writeBackLeadChangeToZoho
//   - audit R-014: crm_type='zoho', provider='zoho'
//
// Tests:
//   1. Sin filas pending → picked=0 processed=0 failed=0.
//   2. Marca done cuando writeback tiene éxito.
//   3. Inserta audit (R-014) con crm_type='zoho' por campo escrito exitosamente.
//   4. No rompe el job si el audit falla (best-effort R-014).
//   5. Re-encola con attempts+1 si writeBack devuelve errors/fieldsWritten=0.
//   6. Captura excepciones y marca failed al llegar MAX_ATTEMPTS.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/integrations/zoho-pull/writeback", () => ({
  writeBackLeadChangeToZoho: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Vitest 4: clases reales que delegan en mocks hoisted (mismo patrón que
// tests/unit/sheets/outbox.test.ts).
const { auditCreateMock, findByCrmTypeMock } = vi.hoisted(() => ({
  auditCreateMock: vi.fn().mockResolvedValue({ data: null, error: null }),
  findByCrmTypeMock: vi.fn().mockResolvedValue({ data: { id: "integration-zoho-1" }, error: null }),
}));

vi.mock("@/lib/repositories/integrations-repository", () => ({
  CrmWriteAuditRepository: class {
    create = auditCreateMock;
  },
  IntegrationsRepository: class {
    findByCrmType = findByCrmTypeMock;
  },
}));

import { runZohoWritebackOutbox } from "@/lib/integrations/zoho-pull/outbox-processor";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { writeBackLeadChangeToZoho } from "@/lib/integrations/zoho-pull/writeback";

// ─── Helper buildMockSupabase ─────────────────────────────────────────────────
//
// Refleja el claim en DOS pasos de runZohoWritebackOutbox (mismo diseño que
// Sheets): 1ª llamada from() → SELECT ids, 2ª → UPDATE claim, resto → updates
// de marcado done/failed.

function buildMockSupabase(claimedRows: Array<{ id: string; [k: string]: unknown }>) {
  // Paso 1: SELECT ids pending.
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: claimedRows.map((r) => ({ id: r.id })),
      error: null,
    }),
  };
  // Paso 2: UPDATE ... IN(ids) → devuelve filas claimed completas.
  const claimUpdateChain = {
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: claimedRows, error: null }),
  };
  // Updates posteriores (done/failed): no devuelven datos relevantes.
  const trailingUpdateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  let call = 0;
  const from = vi.fn(() => {
    call += 1;
    if (call === 1) return selectChain;
    if (call === 2) return claimUpdateChain;
    return trailingUpdateChain;
  });
  return { from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runZohoWritebackOutbox", () => {
  it("devuelve cero si no hay filas pending", async () => {
    const supabase = buildMockSupabase([]);
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const result = await runZohoWritebackOutbox();

    expect(result.picked).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("marca done cuando writeBackLeadChangeToZoho tiene éxito", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-z-1",
        lead_id: "lead-z-1",
        tenant_id: "tenant-z-1",
        changes: { "lead.current_stage": "SCHEDULING" },
        attempts: 0,
      },
    ]);
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChangeToZoho as ReturnType<typeof vi.fn>).mockResolvedValue({
      leadsUpdated: 1,
      fieldsWritten: 1,
      errors: [],
      writtenFields: [
        {
          integration_id: "integration-zoho-1",
          zoho_lead_id: "zoho-lead-001",
          field_name: "Lead_Status",
          new_value: "Contacted",
        },
      ],
    });

    const result = await runZohoWritebackOutbox();

    expect(result.picked).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(writeBackLeadChangeToZoho).toHaveBeenCalledWith("tenant-z-1", "lead-z-1", {
      changes: { "lead.current_stage": "SCHEDULING" },
    });
  });

  it("inserta audit R-014 con crm_type='zoho' por campo escrito exitosamente", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-z-audit",
        lead_id: "lead-z-audit",
        tenant_id: "tenant-z-audit",
        changes: { "lead.current_stage": "COMPLETED" },
        attempts: 0,
      },
    ]);
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChangeToZoho as ReturnType<typeof vi.fn>).mockResolvedValue({
      leadsUpdated: 1,
      fieldsWritten: 2,
      errors: [],
      writtenFields: [
        {
          integration_id: "integration-zoho-1",
          zoho_lead_id: "zoho-111",
          field_name: "Lead_Status",
          new_value: "Converted",
        },
        {
          integration_id: "integration-zoho-1",
          zoho_lead_id: "zoho-111",
          field_name: "Email",
          new_value: "nuevo@example.com",
        },
      ],
    });

    const result = await runZohoWritebackOutbox();

    expect(result.processed).toBe(1);
    expect(findByCrmTypeMock).toHaveBeenCalledWith("tenant-z-audit", "zoho");
    expect(auditCreateMock).toHaveBeenCalledTimes(2);
    expect(auditCreateMock).toHaveBeenCalledWith(
      "tenant-z-audit",
      expect.objectContaining({
        tenant_id: "tenant-z-audit",
        integration_id: "integration-zoho-1",
        crm_type: "zoho",
        operation: "update",
        local_entity: "lead",
        local_entity_id: "lead-z-audit",
        result: "success",
        write_policy: "overwrite_with_audit",
        provider: "zoho",
      })
    );
  });

  it("no rompe el job si el audit insert falla (best-effort R-014)", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-z-audfail",
        lead_id: "lead-z-audfail",
        tenant_id: "tenant-z-audfail",
        changes: { "lead.current_stage": "COMPLETED" },
        attempts: 0,
      },
    ]);
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChangeToZoho as ReturnType<typeof vi.fn>).mockResolvedValue({
      leadsUpdated: 1,
      fieldsWritten: 1,
      errors: [],
      writtenFields: [
        {
          integration_id: "integration-zoho-1",
          zoho_lead_id: "zoho-222",
          field_name: "Lead_Status",
          new_value: "Converted",
        },
      ],
    });
    auditCreateMock.mockResolvedValueOnce({ data: null, error: "DB temporarily unavailable" });

    const result = await runZohoWritebackOutbox();

    expect(result.processed).toBe(1); // writeback exitoso aunque audit falle
    expect(result.failed).toBe(0);
  });

  it("re-encola con attempts+1 si writeBackLeadChangeToZoho devuelve errors y fieldsWritten=0", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-z-2",
        lead_id: "lead-z-2",
        tenant_id: "tenant-z-2",
        changes: { "lead.current_stage": "DROPPED" },
        attempts: 1,
      },
    ]);
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChangeToZoho as ReturnType<typeof vi.fn>).mockResolvedValue({
      leadsUpdated: 0,
      fieldsWritten: 0,
      errors: ["zoho api error: INVALID_TOKEN"],
      writtenFields: [],
    });

    const result = await runZohoWritebackOutbox();

    expect(result.picked).toBe(1);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("captura excepciones y marca failed cuando llega MAX_ATTEMPTS", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-z-3",
        lead_id: "lead-z-3",
        tenant_id: "tenant-z-3",
        changes: { "lead.current_stage": "COMPLETED" },
        attempts: 4, // MAX_ATTEMPTS=5 → al fallar otra vez → failed
      },
    ]);
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChangeToZoho as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("oauth_token_invalid_zoho")
    );

    const result = await runZohoWritebackOutbox();

    expect(result.picked).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("oauth_token_invalid_zoho");
  });
});
