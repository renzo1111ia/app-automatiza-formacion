/**
 * WriteGuard tests — append_only + overwrite_with_audit + fire-and-forget.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { insertMock, fromMock } = vi.hoisted(() => {
  const im = vi.fn().mockResolvedValue({ error: null });
  return {
    insertMock: im,
    fromMock: vi.fn(() => ({ insert: im })),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(async () => ({ from: fromMock })),
}));

import { applyWritePolicy } from "@/lib/integrations/crm/write-guard";

const baseOpts = {
  tenantId: "t-1",
  integrationId: "int-1",
  provider: "zoho",
  leadId: "lead-1",
  actorId: "user-1",
};

describe("WriteGuard — append_only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: skip campos llenos, escribe vacíos", async () => {
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "append_only",
      fields: { email: "new@x.com", telefono: "+34999", pais: "ES" },
      currentCRMFields: { email: "old@x.com", telefono: null, pais: "" },
    });
    expect(out).toEqual({ telefono: "+34999", pais: "ES" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("todos los campos del CRM ya tienen valor → output {}", async () => {
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "append_only",
      fields: { email: "new@x.com", telefono: "+34999" },
      currentCRMFields: { email: "old@x.com", telefono: "+34000" },
    });
    expect(out).toEqual({});
  });

  it("trata string vacío como writable (igual que null)", async () => {
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "append_only",
      fields: { telefono: "+34999" },
      currentCRMFields: { telefono: "" },
    });
    expect(out).toEqual({ telefono: "+34999" });
  });

  it("currentCRMFields undefined → asume todo vacío + warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "append_only",
      fields: { email: "new@x.com" },
    });
    expect(out).toEqual({ email: "new@x.com" });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignora objetos anidados en append_only (primitives only)", async () => {
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "append_only",
      fields: { telefono: "+34999", nested: { foo: "bar" } },
      currentCRMFields: {},
    });
    expect(out).toEqual({ telefono: "+34999" });
  });
});

describe("WriteGuard — overwrite_with_audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra por whitelist y escribe audit por cada cambio real", async () => {
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "overwrite_with_audit",
      fields: { email: "new@x.com", telefono: "+34999", pais: "FR" },
      currentCRMFields: { email: "old@x.com", telefono: "+34000", pais: "ES" },
      allowedOverrideFields: ["telefono", "pais"],
    });
    expect(out).toEqual({ telefono: "+34999", pais: "FR" });
    // espera al ciclo de evento para que el fire-and-forget ejecute insert.
    await new Promise((r) => setTimeout(r, 5));
    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertedRows = insertMock.mock.calls[0][0];
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]).toMatchObject({
      tenant_id: "t-1",
      lead_id: "lead-1",
      field_name: "telefono",
      old_value: "+34000",
      new_value: "+34999",
      write_policy: "overwrite_with_audit",
    });
  });

  it("sin whitelist → output {} y NO audit", async () => {
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "overwrite_with_audit",
      fields: { email: "new@x.com" },
      currentCRMFields: { email: "old@x.com" },
      allowedOverrideFields: [],
    });
    expect(out).toEqual({});
    await new Promise((r) => setTimeout(r, 5));
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("audit insert falla → loguea error pero devuelve safeFields igualmente", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "DB down" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "overwrite_with_audit",
      fields: { telefono: "+34999" },
      currentCRMFields: { telefono: "+34000" },
      allowedOverrideFields: ["telefono"],
    });
    expect(out).toEqual({ telefono: "+34999" });
    await new Promise((r) => setTimeout(r, 10));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("si el valor es igual al CRM → escribe pero no audit", async () => {
    const out = await applyWritePolicy({
      ...baseOpts,
      policy: "overwrite_with_audit",
      fields: { telefono: "+34999" },
      currentCRMFields: { telefono: "+34999" },
      allowedOverrideFields: ["telefono"],
    });
    expect(out).toEqual({ telefono: "+34999" });
    await new Promise((r) => setTimeout(r, 5));
    expect(insertMock).not.toHaveBeenCalled();
  });
});
