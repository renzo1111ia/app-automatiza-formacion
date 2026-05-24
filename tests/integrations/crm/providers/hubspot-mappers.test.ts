import { describe, it, expect } from "vitest";
import {
  mapHubSpotContactToLead,
  mapLeadToHubSpotProperties,
} from "@/lib/integrations/crm/providers/hubspot-mappers";

describe("hubspot-mappers — mapHubSpotContactToLead", () => {
  it("mapea properties HubSpot → VARIABLES DEFINIDAS del proyecto", () => {
    const raw = {
      id: "1",
      properties: {
        firstname: "Ana",
        lastname: "Gómez",
        email: "ana@example.com",
        phone: "+34600000000",
        country: "ES",
        af_origen: "facebook",
        af_metadata_extra: JSON.stringify({ campaign: "summer-2026" }),
      },
    };
    const lead = mapHubSpotContactToLead(raw);
    expect(lead.id).toBe("1");
    expect(lead.fields.nombre).toBe("Ana");
    expect(lead.fields.apellido).toBe("Gómez");
    expect(lead.fields.email).toBe("ana@example.com");
    expect(lead.fields.telefono).toBe("+34600000000");
    expect(lead.fields.pais).toBe("ES");
    expect(lead.fields.origen).toBe("facebook");
    expect(lead.fields.metadata_extra).toEqual({ campaign: "summer-2026" });
  });

  it("omite properties undefined/null sin error", () => {
    const raw = { id: "2", properties: { firstname: "X", lastname: null } };
    const lead = mapHubSpotContactToLead(raw);
    expect(lead.fields.nombre).toBe("X");
    expect(lead.fields.apellido).toBeUndefined();
  });

  it("preserva af_metadata_extra como string si no es JSON válido", () => {
    const raw = { id: "3", properties: { af_metadata_extra: "not-json" } };
    const lead = mapHubSpotContactToLead(raw);
    expect(lead.fields.metadata_extra).toBe("not-json");
  });
});

describe("hubspot-mappers — mapLeadToHubSpotProperties", () => {
  it("mapea VARIABLES DEFINIDAS → properties HubSpot", () => {
    const out = mapLeadToHubSpotProperties({
      nombre: "Pepe",
      apellido: "García",
      email: "p@g.com",
      telefono: "+34600",
      pais: "ES",
      origen: "google",
    });
    expect(out.firstname).toBe("Pepe");
    expect(out.lastname).toBe("García");
    expect(out.email).toBe("p@g.com");
    expect(out.phone).toBe("+34600");
    expect(out.country).toBe("ES");
    expect(out.af_origen).toBe("google");
  });

  it("serializa metadata_extra como JSON string", () => {
    const out = mapLeadToHubSpotProperties({
      metadata_extra: { campaign: "x", utm: { source: "fb" } },
    });
    expect(out.af_metadata_extra).toBe(JSON.stringify({ campaign: "x", utm: { source: "fb" } }));
  });

  it("trunca af_metadata_extra a 60k chars si excede", () => {
    const huge = "x".repeat(65_000);
    const out = mapLeadToHubSpotProperties({ metadata_extra: huge });
    expect(out.af_metadata_extra.length).toBe(60_000);
  });

  it("preserva claves desconocidas con el mismo nombre (no breaking)", () => {
    const out = mapLeadToHubSpotProperties({ custom_property: "value" });
    expect(out.custom_property).toBe("value");
  });
});
