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

import { runWritebackOutbox } from "@/lib/integrations/sheets/outbox-processor";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { writeBackLeadChange } from "@/lib/integrations/sheets/writeback";

/** Helper para construir un mock chainable de supabase.from(...).update().eq()... */
function buildMockSupabase(claimedRows: unknown[]) {
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: claimedRows, error: null }),
  };
  // El update de marcado-done/failed no devuelve nada relevante; cualquier
  // siguiente call al .from() retorna otro chain compatible.
  const trailingUpdateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  let firstCall = true;
  const from = vi.fn(() => {
    if (firstCall) {
      firstCall = false;
      return updateChain;
    }
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
    });

    const result = await runWritebackOutbox();
    expect(result.picked).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(writeBackLeadChange).toHaveBeenCalledWith("tenant-1", "lead-1", {
      changes: { "lead.current_stage": "SCHEDULING" },
    });
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
