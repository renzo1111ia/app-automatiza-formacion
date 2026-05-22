import { describe, it, expect } from "vitest";
import {
  IntegrationSchema,
  CrmTypeEnum,
  CrmFieldMappingSchema,
  CrmWriteAuditSchema,
  CrmWritePolicyEnum,
} from "@/lib/schemas/integrations";

const tenantId = "550e8400-e29b-41d4-a716-446655440001";
const id = "550e8400-e29b-41d4-a716-446655440000";

describe("CrmTypeEnum", () => {
  it("incluye los 6 CRMs roadmap", () => {
    for (const t of [
      "hubspot",
      "zoho",
      "google_sheets",
      "salesforce",
      "gohighlevel",
      "activecampaign",
    ]) {
      expect(CrmTypeEnum.options).toContain(t);
    }
  });
});

describe("IntegrationSchema", () => {
  it("acepta integration valida", () => {
    const i = {
      id,
      tenant_id: tenantId,
      crm_type: "hubspot",
      display_name: "HubSpot Cliente A",
      is_active: true,
      credentials_cipher: "iv:ct:tag",
      credentials_iv: null,
    };
    expect(IntegrationSchema.safeParse(i).success).toBe(true);
  });

  it("rechaza crm_type fuera del enum", () => {
    const i = {
      id,
      tenant_id: tenantId,
      crm_type: "invented_crm",
      display_name: "X",
      credentials_cipher: null,
      credentials_iv: null,
    };
    expect(IntegrationSchema.safeParse(i).success).toBe(false);
  });
});

describe("CrmFieldMappingSchema", () => {
  it("acepta mapping con transform opcional", () => {
    const m = {
      id,
      tenant_id: tenantId,
      integration_id: id,
      crm_type: "zoho",
      crm_field: "Phone",
      local_field: "telefono",
      local_entity: "lead",
      transform: "to_e164",
    };
    expect(CrmFieldMappingSchema.safeParse(m).success).toBe(true);
  });

  it("rechaza local_entity fuera del enum", () => {
    const m = {
      id,
      tenant_id: tenantId,
      integration_id: id,
      crm_type: "zoho",
      crm_field: "Phone",
      local_field: "telefono",
      local_entity: "campana",
    };
    expect(CrmFieldMappingSchema.safeParse(m).success).toBe(false);
  });
});

describe("CrmWriteAuditSchema (R-014 append-only)", () => {
  it("default write_policy = append_only", () => {
    const a = {
      id,
      tenant_id: tenantId,
      integration_id: id,
      crm_type: "hubspot",
      operation: "create",
      local_entity: "lead",
      local_entity_id: id,
      crm_entity_id: "contact_123",
      payload_hash: "sha256:abc",
      result: "success",
      created_at: new Date().toISOString(),
    };
    const parsed = CrmWriteAuditSchema.safeParse(a);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.write_policy).toBe("append_only");
    }
  });

  it("CrmWritePolicyEnum incluye overwrite_with_audit", () => {
    expect(CrmWritePolicyEnum.options).toContain("overwrite_with_audit");
  });
});
