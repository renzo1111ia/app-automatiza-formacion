// Sprint 4 — pull-processor: cubre las 3 ramas de processSheetPullJob:
//   1. INSERT  → fila nueva (sin sheet_row_processed) crea lead.
//   2. SKIP    → fila ya importada con hash idéntico no toca nada.
//   3. UPDATE  → fila ya importada con hash distinto (edición manual en Sheet)
//      ACTUALIZA el lead existente, NO crea uno nuevo (BUG-4-08, validado E2E
//      contra BD+Sheet reales el 03-06-2026; este test protege contra regresión).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Adapter: devuelve 1 cabecera + 1 fila de datos. writeCells captura las
// escrituras (autorelleno Estado + semáforo AF) para asertar.
const readRowsMock = vi.fn();
const writeCellsMock = vi.fn(async () => {});
vi.mock("@/lib/integrations/sheets/adapter", () => ({
  GoogleSheetsAdapter: {
    forTenant: vi.fn(async () => ({ readRows: readRowsMock, writeCells: writeCellsMock })),
  },
}));

// Orchestrator: solo debe invocarse en INSERT (lead nuevo).
const handleNewLeadMock = vi.fn(async () => {});
vi.mock("@/lib/core/orchestrator", () => ({
  orchestrator: { handleNewLead: handleNewLeadMock },
}));

import { processSheetPullJob } from "@/lib/integrations/sheets/pull-processor";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CONN = "22222222-2222-4222-8222-222222222222";
const INTEGRATION = "33333333-3333-4333-8333-333333333333";
const EXISTING_LEAD = "44444444-4444-4444-8444-444444444444";

const CONN_ROW = {
  id: CONN,
  tenant_id: TENANT,
  integration_id: INTEGRATION,
  spreadsheet_id: "sheet-abc",
  sheet_tab_name: "Hoja 1",
  purpose: "leads_inbound",
  column_mapping: {
    header_row: 1,
    data_start_row: 2,
    columns: [
      { letter: "A", header: "Nombre", target: "lead.nombre", type: "string", writeback: false },
      { letter: "B", header: "Email", target: "lead.email", type: "email", writeback: false },
    ],
  },
  writeback_enabled: false,
  is_active: true,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

// Sheet: fila 0 cabecera, fila 1 datos (Ana).
const SHEET_ROWS = [
  ["Nombre", "Email"],
  ["Ana", "ana@example.com"],
];

const JOB = {
  sheet_connection_id: CONN,
  tenant_id: TENANT,
  trigger: "manual" as const,
  triggered_at: "2026-06-03T00:00:00Z",
};

/**
 * Mock de supabase enrutado por nombre de tabla. `existingRow` simula lo que
 * devuelve sheet_row_processed para la fila procesada (null = no importada).
 * Captura la operación realizada sobre `lead` (insert vs update) para asertar.
 */
function buildSupabase(existingRow: { id: string; row_hash: string; lead_id: string } | null) {
  const ops = { leadInsert: 0, leadUpdate: 0 };

  const from = vi.fn((table: string) => {
    if (table === "sheet_connections") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: CONN_ROW, error: null }),
        update: vi.fn().mockReturnThis(),
      };
    }
    if (table === "sheet_row_processed") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (table === "lead") {
      return {
        // Lectura previa del lead actual (rama UPDATE: select campos autogenerados;
        // rama SKIP+autofill: select current_stage). Devuelve fila vacía → el
        // processor completa los autogenerados que falten.
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
        })),
        insert: vi.fn(() => {
          ops.leadInsert++;
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: "new-lead-id" }, error: null }),
          };
        }),
        update: vi.fn(() => {
          ops.leadUpdate++;
          return { eq: vi.fn().mockReturnThis() };
        }),
      };
    }
    // lead_cualificacion u otras
    return {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return { client: { from }, ops };
}

beforeEach(() => {
  vi.clearAllMocks();
  readRowsMock.mockResolvedValue(SHEET_ROWS);
});

describe("processSheetPullJob", () => {
  it("INSERT: fila nueva (sin sheet_row_processed) crea lead y dispara orchestrator", async () => {
    const { client, ops } = buildSupabase(null);
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const r = await processSheetPullJob(JOB);

    expect(ops.leadInsert).toBe(1);
    expect(ops.leadUpdate).toBe(0);
    expect(r.leadsCreated).toBe(1);
    expect(handleNewLeadMock).toHaveBeenCalledOnce();
  });

  it("SKIP: fila con hash idéntico no crea ni actualiza lead", async () => {
    // Hash real de la fila ["Ana","ana@example.com"] — lo calculamos vía el
    // mismo hashRow re-leyendo el módulo (idempotencia).
    const { hashRow } = await import("@/lib/integrations/sheets/row-mapper");
    const sameHash = hashRow(["Ana", "ana@example.com"]);
    const { client, ops } = buildSupabase({
      id: "rp-1",
      row_hash: sameHash,
      lead_id: EXISTING_LEAD,
    });
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const r = await processSheetPullJob(JOB);

    expect(ops.leadInsert).toBe(0);
    expect(ops.leadUpdate).toBe(0);
    expect(r.rowsSkipped).toBe(1);
    expect(r.leadsCreated).toBe(0);
    expect(handleNewLeadMock).not.toHaveBeenCalled();
  });

  it("UPDATE: fila editada (hash distinto, ya importada) actualiza lead existente sin crear otro (BUG-4-08)", async () => {
    const { client, ops } = buildSupabase({
      id: "rp-1",
      row_hash: "hash-viejo-distinto",
      lead_id: EXISTING_LEAD,
    });
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const r = await processSheetPullJob(JOB);

    expect(ops.leadUpdate).toBe(1);
    expect(ops.leadInsert).toBe(0);
    expect(r.leadsCreated).toBe(0);
    // No re-dispara orchestrator en una edición (no es lead nuevo).
    expect(handleNewLeadMock).not.toHaveBeenCalled();
  });

  it("SEMÁFORO AF: con status_column configurado, escribe 🔴 al empezar y 🟢 al terminar (INSERT)", async () => {
    // CONN con columna semáforo AF en "D".
    const connWithAf = {
      ...CONN_ROW,
      column_mapping: { ...CONN_ROW.column_mapping, status_column: "D" },
    };
    const from = vi.fn((table: string) => {
      if (table === "sheet_connections") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: connWithAf, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === "sheet_row_processed") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "lead") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: "new-lead-id" }, error: null }),
          })),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
    (getAdminSupabaseClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ from });

    await processSheetPullJob(JOB);

    // Se escribió en la columna AF ("D"): al menos el 🔴 inicial y el 🟢 final.
    const afWrites = writeCellsMock.mock.calls.filter((c: unknown[]) => {
      const cells = c[2] as Array<{ letter: string; value: unknown }>;
      return cells?.some((cell) => cell.letter === "D");
    });
    const afValues = afWrites.flatMap((c: unknown[]) =>
      (c[2] as Array<{ letter: string; value: string }>)
        .filter((cell) => cell.letter === "D")
        .map((cell) => String(cell.value))
    );
    expect(afValues.some((v) => v.includes("🔴"))).toBe(true);
    expect(afValues.some((v) => v.includes("🟢"))).toBe(true);
  });
});
