import { describe, it, expect } from "vitest";
import {
  LeadSchema,
  CreateLeadSchema,
  UpdateLeadSchema,
  LeadWebhookSchema,
  LeadCualificacionSchema,
} from "@/lib/schemas/leads";

const validLead = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenant_id: "550e8400-e29b-41d4-a716-446655440001",
  nombre: "Juan",
  apellido: "Perez",
  telefono: "+34699123456",
  email: "juan@example.com",
};

describe("LeadSchema", () => {
  it("acepta lead minimo valido", () => {
    expect(LeadSchema.safeParse(validLead).success).toBe(true);
  });

  it("rechaza email invalido", () => {
    const bad = { ...validLead, email: "no-es-email" };
    expect(LeadSchema.safeParse(bad).success).toBe(false);
  });

  it("acepta nombre/telefono nullables (la BD los permite)", () => {
    const partial = {
      id: validLead.id,
      tenant_id: validLead.tenant_id,
      nombre: null,
      telefono: null,
    };
    expect(LeadSchema.safeParse(partial).success).toBe(true);
  });
});

describe("CreateLeadSchema", () => {
  it("requiere nombre y telefono", () => {
    expect(CreateLeadSchema.safeParse({ tenant_id: validLead.tenant_id }).success).toBe(false);
    expect(
      CreateLeadSchema.safeParse({
        tenant_id: validLead.tenant_id,
        nombre: "Juan",
        telefono: "+34699123456",
      }).success
    ).toBe(true);
  });

  it("rechaza telefono demasiado corto", () => {
    expect(
      CreateLeadSchema.safeParse({
        tenant_id: validLead.tenant_id,
        nombre: "Juan",
        telefono: "123",
      }).success
    ).toBe(false);
  });
});

describe("UpdateLeadSchema", () => {
  it("acepta update parcial sin id ni tenant_id", () => {
    expect(UpdateLeadSchema.safeParse({ nombre: "Pedro" }).success).toBe(true);
  });
});

describe("LeadWebhookSchema (compat con validations/lead.ts)", () => {
  it("acepta payload minimo", () => {
    expect(LeadWebhookSchema.safeParse({ nombre: "X", telefono: "+34699123456" }).success).toBe(
      true
    );
  });
  it("rechaza email malformado", () => {
    expect(
      LeadWebhookSchema.safeParse({
        nombre: "X",
        telefono: "+34699123456",
        email: "x",
      }).success
    ).toBe(false);
  });
});

describe("LeadCualificacionSchema", () => {
  it("acepta cualificacion minima", () => {
    const c = {
      id: validLead.id,
      tenant_id: validLead.tenant_id,
      id_lead: validLead.id,
    };
    expect(LeadCualificacionSchema.safeParse(c).success).toBe(true);
  });
});
