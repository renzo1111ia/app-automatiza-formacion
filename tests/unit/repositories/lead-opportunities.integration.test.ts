// Integration test contra BD local Supabase. Se skip-ea si las env vars no estan.
// Verifica la logica de dedup 48h de NEW-06.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SKIP = !SUPABASE_URL || !SUPABASE_KEY;

// Skip the whole suite si no hay creds locales.
const describeIf = SKIP ? describe.skip : describe;

describeIf("LeadOpportunitiesRepository.createWithDedup (integration)", () => {
  const tenantIdEnv = process.env.TEST_TENANT_ID;
  let tenantId: string;
  let leadId: string;
  const programaId = "550e8400-e29b-41d4-a716-446655440099";
  const createdIds: string[] = [];
  const createdLeadIds: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;

  beforeAll(async () => {
    if (SKIP) return;
    supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Reutiliza un tenant existente o crea uno de test.
    if (tenantIdEnv) {
      tenantId = tenantIdEnv;
    } else {
      const { data, error } = await supabase
        .from("tenants")
        .insert({
          name: "test-tenant-dedup",
          supabase_url: "http://test",
          supabase_anon_key: "test-anon-key-1234567890abcdef",
          config: {},
        })
        .select()
        .single();
      if (error) throw new Error("No se pudo crear tenant de test: " + error.message);
      tenantId = (data as { id: string }).id;
    }

    // Crear un lead temporal.
    const { data: lead, error: leadErr } = await supabase
      .from("lead")
      .insert({ tenant_id: tenantId, nombre: "DedupTest", telefono: "+34000000000" })
      .select()
      .single();
    if (leadErr) throw new Error("No se pudo crear lead: " + leadErr.message);
    leadId = (lead as { id: string }).id;
    createdLeadIds.push(leadId);
  });

  afterAll(async () => {
    if (SKIP) return;
    // Cleanup oportunidades y lead.
    if (createdIds.length) {
      await supabase.from("lead_opportunities").delete().in("id", createdIds);
    }
    if (createdLeadIds.length) {
      await supabase.from("lead_opportunities").delete().in("lead_id", createdLeadIds);
      await supabase.from("lead").delete().in("id", createdLeadIds);
    }
  });

  it("primera oportunidad lead+programa NO es duplicada", async () => {
    const { leadOpportunitiesRepository } =
      await import("@/lib/repositories/lead-opportunities-repository");
    const r = await leadOpportunitiesRepository.createWithDedup(tenantId, {
      lead_id: leadId,
      programa_id: programaId,
      source: "test_integration",
    });
    expect(r.error).toBeNull();
    expect(r.data).not.toBeNull();
    expect(r.isDuplicate).toBe(false);
    expect(r.originalId).toBeNull();
    if (r.data) createdIds.push(r.data.id);
  });

  it("segunda oportunidad mismo lead+programa dentro de 48h SI es duplicada", async () => {
    const { leadOpportunitiesRepository } =
      await import("@/lib/repositories/lead-opportunities-repository");
    const r = await leadOpportunitiesRepository.createWithDedup(tenantId, {
      lead_id: leadId,
      programa_id: programaId,
      source: "test_integration_dup",
    });
    expect(r.error).toBeNull();
    expect(r.isDuplicate).toBe(true);
    expect(r.originalId).not.toBeNull();
    if (r.data) createdIds.push(r.data.id);
  });

  it("oportunidad lead+programa distinto NO es duplicada", async () => {
    const { leadOpportunitiesRepository } =
      await import("@/lib/repositories/lead-opportunities-repository");
    const otherProgramaId = "550e8400-e29b-41d4-a716-446655440100";
    const r = await leadOpportunitiesRepository.createWithDedup(tenantId, {
      lead_id: leadId,
      programa_id: otherProgramaId,
      source: "test_integration_other",
    });
    expect(r.error).toBeNull();
    expect(r.isDuplicate).toBe(false);
    if (r.data) createdIds.push(r.data.id);
  });

  it("findByLead retorna todas las oportunidades del lead", async () => {
    const { leadOpportunitiesRepository } =
      await import("@/lib/repositories/lead-opportunities-repository");
    const r = await leadOpportunitiesRepository.findByLead(leadId, tenantId);
    expect(r.error).toBeNull();
    expect(r.data.length).toBeGreaterThanOrEqual(3);
  });
});
