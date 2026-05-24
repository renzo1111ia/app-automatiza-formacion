/**
 * HubSpotCRMProvider tests — OAuth + CRUD + tasks + meetings + tags + init + retries.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { server } from "@/../tests/mocks/server";
import { hubspotHandlers } from "@/../tests/mocks/hubspot-handlers";

const { getValidTokensMock, invalidateTokenMock, registerRefresherMock } = vi.hoisted(() => ({
  getValidTokensMock: vi.fn(),
  invalidateTokenMock: vi.fn(),
  registerRefresherMock: vi.fn(),
}));

vi.mock("@/lib/integrations/crm/token-manager", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/crm/token-manager")>(
    "@/lib/integrations/crm/token-manager"
  );
  return {
    ...actual,
    getValidTokens: getValidTokensMock,
    invalidateToken: invalidateTokenMock,
    registerRefresher: registerRefresherMock,
  };
});

import { HubSpotCRMProvider } from "@/lib/integrations/crm/providers/hubspot";
import { CRMError } from "@/lib/integrations/crm/crm-error";

const API = "https://api.hubapi.com";

describe("HubSpotCRMProvider — getCapabilities", () => {
  it("retorna caps con hasBlueprints=false, hasTags=false (Lists), oauthFlow=auth_code", () => {
    const p = new HubSpotCRMProvider({});
    const c = p.getCapabilities();
    expect(c.hasBlueprints).toBe(false);
    expect(c.hasTags).toBe(false);
    expect(c.hasDataCenters).toBe(false);
    expect(c.oauthFlow).toBe("authorization_code");
  });
});

describe("HubSpotCRMProvider — OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(...hubspotHandlers({ hubId: 9999 }));
  });

  it("getAuthorizationUrl produce URL con state + scopes encoded", () => {
    const p = new HubSpotCRMProvider({ clientId: "C", clientSecret: "S" });
    const url = p.getAuthorizationUrl("STATE", "http://app/cb");
    expect(url).toMatch(/^https:\/\/app\.hubspot\.com\/oauth\/authorize/);
    expect(url).toContain("state=STATE");
    expect(decodeURIComponent(url)).toContain("crm.objects.contacts.read");
    expect(decodeURIComponent(url)).toContain("http://app/cb");
  });

  it("completeOAuth POST a /oauth/v1/token y devuelve tokens + portalId", async () => {
    const p = new HubSpotCRMProvider({ clientId: "C", clientSecret: "S" });
    const tokens = await p.completeOAuth("CODE", "http://app/cb");
    expect(tokens.accessToken).toBe("hs_at_initial");
    expect(tokens.refreshToken).toBe("hs_rt_initial");
    expect(tokens.portalId).toBe("9999");
  });

  it("completeOAuth lanza CRMError AUTH_FAILED si el server responde 400", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.post(`${API}/oauth/v1/token`, () =>
        HttpResponse.json({ message: "invalid grant" }, { status: 400 })
      )
    );
    const p = new HubSpotCRMProvider({ clientId: "C", clientSecret: "S" });
    await expect(p.completeOAuth("BAD", "http://app/cb")).rejects.toMatchObject({
      code: "AUTH_FAILED",
    });
  });
});

describe("HubSpotCRMProvider — request retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidTokensMock.mockResolvedValue({
      accessToken: "hs_at",
      refreshToken: "hs_rt",
      expiresAt: Date.now() + 1800_000,
      apiBase: API,
    });
  });

  it("401 → invalidate + retry → 200", async () => {
    server.use(...hubspotHandlers({ authFailures: 1 }));
    const p = new HubSpotCRMProvider({ integrationId: "int-h1" });
    const ok = await p.healthcheck();
    expect(ok).toBe(true);
    expect(invalidateTokenMock).toHaveBeenCalledWith("int-h1");
  });

  it("429 con Retry-After respetado y reintento exitoso", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(...hubspotHandlers({ rateLimitedOnce: true, retryAfterSeconds: 1 }));
    const p = new HubSpotCRMProvider({ integrationId: "int-h2" });
    const ok = await p.healthcheck();
    expect(ok).toBe(true);
    vi.useRealTimers();
  });

  it("503 → exp backoff retry → 200", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(...hubspotHandlers({ serverErrorsBefore200: 2 }));
    const p = new HubSpotCRMProvider({ integrationId: "int-h3" });
    const ok = await p.healthcheck();
    expect(ok).toBe(true);
    vi.useRealTimers();
  });
});

describe("HubSpotCRMProvider — Lead CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(...hubspotHandlers());
    getValidTokensMock.mockResolvedValue({
      accessToken: "hs_at",
      refreshToken: "hs_rt",
      expiresAt: Date.now() + 1800_000,
      apiBase: API,
    });
  });

  it("createLead mapea properties y devuelve CRMLead", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-create" });
    const lead = await p.createLead({
      nombre: "Pepe",
      apellido: "García",
      email: "p@g.com",
      origen: "google",
    });
    expect(lead.id).toBe("1001");
    expect(lead.fields.nombre).toBe("Pepe");
  });

  it("getLead devuelve null en NOT_FOUND y propaga otros errores", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.get(`${API}/crm/v3/objects/contacts/:id`, () =>
        HttpResponse.json({ message: "not found" }, { status: 404 })
      )
    );
    const p = new HubSpotCRMProvider({ integrationId: "int-gl" });
    const lead = await p.getLead("missing");
    expect(lead).toBeNull();
  });

  it("findLeadByEmail con email no existente devuelve null", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-find" });
    const lead = await p.findLeadByEmail("notfound@example.com");
    expect(lead).toBeNull();
  });

  it("findLeadByEmail exact match devuelve lead mapeado", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-find2" });
    const lead = await p.findLeadByEmail("exists@example.com");
    expect(lead).not.toBeNull();
    expect(lead?.fields.email).toBe("exists@example.com");
  });

  it("updateLead PATCHes properties", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-upd" });
    const res = await p.updateLead("1001", { telefono: "+34999" });
    expect(res).toBeTruthy();
  });
});

describe("HubSpotCRMProvider — addTags via Lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(...hubspotHandlers());
    getValidTokensMock.mockResolvedValue({
      accessToken: "hs_at",
      refreshToken: "hs_rt",
      expiresAt: Date.now() + 1800_000,
      apiBase: API,
    });
  });

  it("resuelve list ID por nombre y agrega al contacto", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-tags" });
    const res = (await p.addTags("1001", ["vip"])) as unknown[];
    expect(res).toHaveLength(1);
  });

  it("tag inexistente → CRMError NOT_FOUND", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-tags2" });
    await expect(p.addTags("1001", ["unknown-list"])).rejects.toBeInstanceOf(CRMError);
  });
});

describe("HubSpotCRMProvider — tasks + meetings con association IDs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(...hubspotHandlers());
    getValidTokensMock.mockResolvedValue({
      accessToken: "hs_at",
      refreshToken: "hs_rt",
      expiresAt: Date.now() + 1800_000,
      apiBase: API,
    });
  });

  it("createTask incluye association type 204", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-task" });
    let bodySnap: Record<string, unknown> | null = null;
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.post(`${API}/crm/v3/objects/tasks`, async ({ request }) => {
        bodySnap = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "t1" });
      })
    );
    await p.createTask("1001", { subject: "Llamar lead" });
    expect(bodySnap).not.toBeNull();
    const associations = (
      bodySnap! as { associations: Array<{ types: Array<{ associationTypeId: number }> }> }
    ).associations;
    expect(associations[0].types[0].associationTypeId).toBe(204);
  });

  it("createEvent convierte startTime ISO a epoch ms y usa association 212", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-meeting" });
    let bodySnap: Record<string, unknown> | null = null;
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.post(`${API}/crm/v3/objects/meetings`, async ({ request }) => {
        bodySnap = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "m1" });
      })
    );
    await p.createEvent("1001", {
      subject: "Demo",
      startTime: "2026-06-01T10:00:00Z",
      durationMinutes: 30,
    });
    const properties = (bodySnap! as { properties: Record<string, string> }).properties;
    expect(properties.hs_meeting_start_time).toBe(String(Date.UTC(2026, 5, 1, 10, 0, 0)));
    const associations = (
      bodySnap! as { associations: Array<{ types: Array<{ associationTypeId: number }> }> }
    ).associations;
    expect(associations[0].types[0].associationTypeId).toBe(212);
  });
});

describe("HubSpotCRMProvider — executeAction WORKFLOW_ENROLL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(...hubspotHandlers());
    getValidTokensMock.mockResolvedValue({
      accessToken: "hs_at",
      refreshToken: "hs_rt",
      expiresAt: Date.now() + 1800_000,
      apiBase: API,
    });
  });

  it("PATCHea property trigger del contact", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-wf" });
    const res = await p.executeAction("1001", "WORKFLOW_ENROLL", {
      propertyName: "af_workflow_trigger",
      value: "on",
    });
    expect(res).toBeTruthy();
  });

  it("actionId desconocido devuelve null sin error", async () => {
    const p = new HubSpotCRMProvider({ integrationId: "int-wf2" });
    const res = await p.executeAction("1001", "UNKNOWN");
    expect(res).toBeNull();
  });
});

describe("HubSpotCRMProvider — init() ensureCustomProperties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidTokensMock.mockResolvedValue({
      accessToken: "hs_at",
      refreshToken: "hs_rt",
      expiresAt: Date.now() + 1800_000,
      apiBase: API,
    });
  });

  it("0 props existen → crea 2 (af_origen + af_metadata_extra)", async () => {
    server.use(...hubspotHandlers({ existingProperties: [] }));
    const p = new HubSpotCRMProvider({ integrationId: "int-init1" });
    const result = await p.init();
    expect(result.created).toEqual(["af_origen", "af_metadata_extra"]);
    expect(result.existing).toEqual([]);
  });

  it("af_origen ya existe → crea sólo af_metadata_extra", async () => {
    server.use(...hubspotHandlers({ existingProperties: ["af_origen"] }));
    const p = new HubSpotCRMProvider({ integrationId: "int-init2" });
    const result = await p.init();
    expect(result.created).toEqual(["af_metadata_extra"]);
    expect(result.existing).toEqual(["af_origen"]);
  });

  it("ambas existen → idempotente (0 POSTs)", async () => {
    server.use(...hubspotHandlers({ existingProperties: ["af_origen", "af_metadata_extra"] }));
    const p = new HubSpotCRMProvider({ integrationId: "int-init3" });
    const result = await p.init();
    expect(result.created).toEqual([]);
    expect(result.existing).toEqual(["af_origen", "af_metadata_extra"]);
  });
});
