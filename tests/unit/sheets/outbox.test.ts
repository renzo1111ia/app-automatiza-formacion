// Sprint 4 - outbox-processor smoke test (logica de claim + reintentos).
//
// Test mockea los modulos de supabase + writeback para verificar:
//   - runWritebackOutbox reclama batch correctamente.
//   - Marca done si writeBackLeadChange tiene exito.
//   - Re-encola (status=pending, attempts+1) si writeBack falla.
//   - Marca failed cuando attempts alcanza MAX_ATTEMPTS.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/integrations/sheets/writeback", () => ({
  writeBackLeadChange: vi.fn(),
}));
vi.mock("@/lib/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const { auditCreateMock, findByCrmTypeMock } = vi.hoisted(() => ({
  auditCreateMock: vi.fn().mockResolvedValue({ data: null, error: null }),
  findByCrmTypeMock: vi
    .fn()
    .mockResolvedValue({ data: { id: "integration-google-1" }, error: null }),
}));

vi.mock("@/lib/repositories/integrations-repository", () => ({
  CrmWriteAuditRepository: vi.fn().mockImplementation(() => ({
    create: auditCreateMock,
  })),
  IntegrationsRepository: vi.fn().mockImplementation(() => ({
    findByCrmType: findByCrmTypeMock,
  })),
}));

import { runWritebackOutbox } from "@/lib/integrations/sheets/outbox-processor";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { writeBackLeadChange } from "@/lib/integrations/sheets/writeback";

/**
 * Helper que construye un mock chainable de supabase reflejando el claim en
 * DOS pasos del outbox-processor (PostgREST no soporta order()+limit() sobre
 * UPDATE, así que: 1) SELECT ids pendientes, 2) UPDATE ... IN(ids)):
 *   1ª llamada from() → SELECT chain: select().eq().lt().order().limit() → ids
 *   2ª llamada from() → UPDATE claim chain: update().in().eq().select() → filas
 *   resto             → trailing update chains (marcado done/failed)
 */
function buildMockSupabase(claimedRows: Array<{ id: string; [k: string]: unknown }>) {
  // Paso 1: SELECT de ids pendientes ordenados.
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
  // Paso 2: UPDATE ... IN (ids) marcando processing, devuelve las filas claimed.
  const claimUpdateChain = {
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: claimedRows, error: null }),
  };
  // Updates posteriores (marcado done/failed) no devuelven nada relevante.
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

describe("runWritebackOutbox", () => {
  it("devuelve cero si no hay filas pending", async () => {
    const supabase = buildMockSupabase([]);
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const result = await runWritebackOutbox();
    expect(result.picked).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("marca done cuando writeBack tiene exito", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-1",
        lead_id: "lead-1",
        tenant_id: "tenant-1",
        changes: { "lead.current_stage": "SCHEDULING" },
        attempts: 0,
      },
    ]);
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChange as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sheetsUpdated: 1,
      cellsWritten: 1,
      errors: [],
      writtenCells: [],
    });

    const result = await runWritebackOutbox();
    expect(result.picked).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(writeBackLeadChange).toHaveBeenCalledWith("tenant-1", "lead-1", {
      changes: { "lead.current_stage": "SCHEDULING" },
    });
  });

  it("inserta fila audit (R-014) por cada celda escrita exitosamente", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-audit",
        lead_id: "lead-audit",
        tenant_id: "tenant-audit",
        changes: { "lead.current_stage": "COMPLETED" },
        attempts: 0,
      },
    ]);
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChange as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sheetsUpdated: 1,
      cellsWritten: 2,
      errors: [],
      writtenCells: [
        {
          sheet_connection_id: "sc-1",
          spreadsheet_id: "spreadsheet-xyz",
          row_index: 4,
          field_name: "lead.current_stage",
          new_value: "COMPLETED",
        },
        {
          sheet_connection_id: "sc-2",
          spreadsheet_id: "spreadsheet-abc",
          row_index: 9,
          field_name: "lead.current_stage",
          new_value: "COMPLETED",
        },
      ],
    });

    const result = await runWritebackOutbox();
    expect(result.processed).toBe(1);
    expect(findByCrmTypeMock).toHaveBeenCalledWith("tenant-audit", "google_sheets");
    expect(auditCreateMock).toHaveBeenCalledTimes(2);
    expect(auditCreateMock).toHaveBeenCalledWith(
      "tenant-audit",
      expect.objectContaining({
        tenant_id: "tenant-audit",
        integration_id: "integration-google-1",
        crm_type: "google_sheets",
        operation: "update",
        local_entity: "lead",
        local_entity_id: "lead-audit",
        result: "success",
        write_policy: "overwrite_with_audit",
        provider: "google_sheets",
        field_name: "lead.current_stage",
        new_value: "COMPLETED",
      })
    );
  });

  it("no rompe el job si el audit insert falla (best-effort R-014)", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-aud-fail",
        lead_id: "lead-aud-fail",
        tenant_id: "tenant-aud-fail",
        changes: { "lead.current_stage": "COMPLETED" },
        attempts: 0,
      },
    ]);
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChange as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sheetsUpdated: 1,
      cellsWritten: 1,
      errors: [],
      writtenCells: [
        {
          sheet_connection_id: "sc-x",
          spreadsheet_id: "spreadsheet-x",
          row_index: 2,
          field_name: "lead.current_stage",
          new_value: "COMPLETED",
        },
      ],
    });
    auditCreateMock.mockResolvedValueOnce({ data: null, error: "DB temporarily unavailable" });

    const result = await runWritebackOutbox();
    expect(result.processed).toBe(1); // writeback exitoso aunque audit falle
    expect(result.failed).toBe(0);
  });

  it("re-encola con attempts+1 si writeBack falla totalmente", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-2",
        lead_id: "lead-2",
        tenant_id: "tenant-2",
        changes: { "lead.current_stage": "DROPPED" },
        attempts: 1,
      },
    ]);
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChange as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sheetsUpdated: 0,
      cellsWritten: 0,
      errors: ["sheet xyz: quota exceeded"],
      writtenCells: [],
    });

    const result = await runWritebackOutbox();
    expect(result.picked).toBe(1);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("captura excepciones y marca failed cuando llega MAX_ATTEMPTS", async () => {
    const supabase = buildMockSupabase([
      {
        id: "outbox-3",
        lead_id: "lead-3",
        tenant_id: "tenant-3",
        changes: { "lead.current_stage": "COMPLETED" },
        attempts: 4, // MAX_ATTEMPTS=5 → al fallar otra vez, pasa a failed
      },
    ]);
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);
    (writeBackLeadChange as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("oauth_token_invalid")
    );

    const result = await runWritebackOutbox();
    expect(result.picked).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("oauth_token_invalid");
  });
});
