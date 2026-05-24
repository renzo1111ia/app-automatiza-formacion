/**
 * Integration test cross-component: WriteGuard + Provider mock.
 *
 * Caso 1: append_only con Zoho — getLead retorna campos llenos parciales,
 *         applyWritePolicy filtra, updateLead recibe solo los campos seguros.
 * Caso 2: overwrite_with_audit con HubSpot — applyWritePolicy permite whitelist
 *         + dispara audit insert (mock supabase).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { insertMock } = vi.hoisted(() => ({
  insertMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(async () => ({
    from: () => ({ insert: insertMock }),
  })),
}));

import { applyWritePolicy } from "@/lib/integrations/crm/write-guard";

describe("write-guard + provider — append_only flow Zoho", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filtra payload y solo se pasa lo que NO está lleno en CRM", async () => {
    // Simulamos provider.getLead resultado:
    const currentCRMFields = {
      nombre: "Ana",
      apellido: "Gómez",
      email: "ana@x.com",
      telefono: null,
      pais: "",
    };
    const incomingPayload = {
      nombre: "Ana Maria", // SKIP (llena)
      telefono: "+34600000000", // ACEPTA (null)
      pais: "ES", // ACEPTA (empty)
    };
    const safe = await applyWritePolicy({
      tenantId: "t-1",
      integrationId: "int-zoho",
      provider: "zoho",
      leadId: "lead-1",
      fields: incomingPayload,
      currentCRMFields,
      actorId: "actor-1",
      policy: "append_only",
    });
    expect(safe).toEqual({ telefono: "+34600000000", pais: "ES" });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("write-guard + provider — overwrite_with_audit flow HubSpot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite override sólo de whitelist + escribe audit row con old/new", async () => {
    const currentCRMFields = { firstname: "Pepe", phone: "+34000" };
    const incomingPayload = {
      firstname: "Juan",
      phone: "+34999",
      email: "j@x.com",
    };
    const safe = await applyWritePolicy({
      tenantId: "t-1",
      integrationId: "int-hs",
      provider: "hubspot",
      leadId: "555",
      fields: incomingPayload,
      currentCRMFields,
      actorId: "actor-2",
      policy: "overwrite_with_audit",
      allowedOverrideFields: ["firstname"],
    });
    expect(safe).toEqual({ firstname: "Juan" });
    await new Promise((r) => setTimeout(r, 10));
    expect(insertMock).toHaveBeenCalledTimes(1);
    const rows = insertMock.mock.calls[0][0];
    expect(rows[0]).toMatchObject({
      provider: "hubspot",
      lead_id: "555",
      field_name: "firstname",
      old_value: "Pepe",
      new_value: "Juan",
    });
  });
});
