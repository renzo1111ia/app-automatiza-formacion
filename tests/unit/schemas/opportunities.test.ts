import { describe, it, expect } from "vitest";
import {
  LeadOpportunitySchema,
  CreateLeadOpportunitySchema,
  OpportunityStatusEnum,
} from "@/lib/schemas/opportunities";

const tenantId = "550e8400-e29b-41d4-a716-446655440001";
const leadId = "550e8400-e29b-41d4-a716-446655440002";
const programaId = "550e8400-e29b-41d4-a716-446655440003";

describe("OpportunityStatusEnum", () => {
  it("incluye los 6 estados del funnel", () => {
    for (const s of ["NUEVA", "EN_PROCESO", "CUALIFICADA", "AGENDADA", "CERRADA", "DESCARTADA"]) {
      expect(OpportunityStatusEnum.options).toContain(s);
    }
  });
});

describe("LeadOpportunitySchema", () => {
  it("acepta oportunidad valida", () => {
    const o = {
      id: "550e8400-e29b-41d4-a716-446655440004",
      tenant_id: tenantId,
      lead_id: leadId,
      programa_id: programaId,
      fecha_solicitud: new Date().toISOString(),
      estado_oportunidad: "NUEVA",
      is_duplicate_of: null,
      source: "ingest_form",
    };
    expect(LeadOpportunitySchema.safeParse(o).success).toBe(true);
  });
});

describe("CreateLeadOpportunitySchema", () => {
  it("acepta payload sin id/tenant_id/is_duplicate_of (los pone el repo)", () => {
    const c = { lead_id: leadId, programa_id: programaId, source: "ingest_form" };
    expect(CreateLeadOpportunitySchema.safeParse(c).success).toBe(true);
  });

  it("requiere lead_id", () => {
    expect(CreateLeadOpportunitySchema.safeParse({}).success).toBe(false);
  });
});
