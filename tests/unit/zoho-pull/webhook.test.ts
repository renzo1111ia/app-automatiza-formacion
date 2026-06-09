// Sprint 5 - Zoho webhook route: tests unitarios del handler POST.
//
// Testea src/app/api/webhooks/zoho/route.ts sin I/O real:
//   - Token válido + body con ids → 200, enqueue llamado N veces.
//   - Token inválido → 403, enqueue NO llamado.
//   - Token ausente → 403, enqueue NO llamado.
//   - Body con forma workflow webhook {id: "x"} → extrae 1 id y encola.
//   - Ping sin ids → 200 sin encolar.
//   - Connection inactiva → 200 ignorado.
//   - Error de BD al consultar → 500.
//
// Patrón: importa el handler POST directamente y lo llama con NextRequest
// construido manualmente (no requiere servidor Express/Next).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/integrations/zoho-pull/queue", () => ({
  enqueueZohoLeadEvent: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { POST } from "@/app/api/webhooks/zoho/route";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { enqueueZohoLeadEvent } from "@/lib/integrations/zoho-pull/queue";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = "test-token-abc123-xyz";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID = "22222222-2222-4222-8222-222222222222";
const CONNECTION_ID = "33333333-3333-4333-8333-333333333333";

/** Construye un NextRequest POST hacia el webhook con el token y body dados. */
function buildRequest(token: string | null, body: unknown): NextRequest {
  const url = token
    ? `http://localhost:8500/api/webhooks/zoho?token=${encodeURIComponent(token)}`
    : "http://localhost:8500/api/webhooks/zoho";
  return new NextRequest(new URL(url), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/**
 * Construye un NextRequest tipo "Workflow Webhook" de Zoho: el id viaja en un
 * HEADER (`Entity_id` por defecto) y los campos del lead, si el cliente los mapeó
 * en "Parámetros del módulo", llegan form-urlencoded en el body. Esto reproduce
 * BUG-5-01: sin leer el header, la Vía A entera quedaba rota silenciosamente.
 */
function buildWorkflowRequest(
  token: string,
  opts: { headerId?: string; headerName?: string; formFields?: Record<string, string> } = {}
): NextRequest {
  const url = `http://localhost:8500/api/webhooks/zoho?token=${encodeURIComponent(token)}`;
  const headers: Record<string, string> = {};
  if (opts.headerId) headers[opts.headerName ?? "Entity_id"] = opts.headerId;

  let body: string | undefined;
  if (opts.formFields) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.formFields).toString();
  }
  return new NextRequest(new URL(url), { method: "POST", body, headers });
}

/** Mock de supabase que devuelve una connection activa con el token conocido. */
function buildSupabaseWithConn(
  override?: Partial<{
    subscription_token: string;
    is_active: boolean;
    error: boolean;
  }>
) {
  const token = override?.subscription_token ?? VALID_TOKEN;
  const isActive = override?.is_active ?? true;
  const hasError = override?.error ?? false;

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      hasError
        ? { data: null, error: { message: "DB error" } }
        : {
            data: {
              id: CONNECTION_ID,
              tenant_id: TENANT_ID,
              integration_id: INTEGRATION_ID,
              subscription_token: token,
              is_active: isActive,
            },
            error: null,
          }
    ),
  };

  return { from: vi.fn(() => chain) };
}

/** Mock de supabase que no encuentra la connection (token desconocido). */
function buildSupabaseNoConn() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return { from: vi.fn(() => chain) };
}

beforeEach(() => {
  vi.clearAllMocks();
  (enqueueZohoLeadEvent as ReturnType<typeof vi.fn>).mockResolvedValue("job-id-1");
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/zoho", () => {
  it("token válido + body {ids:[...]} → 200 y encola un job por id", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(VALID_TOKEN, { ids: ["lead-1", "lead-2", "lead-3"] });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(enqueueZohoLeadEvent).toHaveBeenCalledTimes(3);
  });

  it("token válido + body ids vacío → 200 sin encolar (ping)", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(VALID_TOKEN, { ids: [] });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ignored).toBe("no_ids");
    expect(enqueueZohoLeadEvent).not.toHaveBeenCalled();
  });

  it("token inválido (no encontrado en BD) → 403, enqueue NO llamado", async () => {
    const supabase = buildSupabaseNoConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest("token-incorrecto-zzz", { ids: ["lead-1"] });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(enqueueZohoLeadEvent).not.toHaveBeenCalled();
  });

  it("token ausente → 403, enqueue NO llamado", async () => {
    const supabase = buildSupabaseNoConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(null, { ids: ["lead-1"] });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(enqueueZohoLeadEvent).not.toHaveBeenCalled();
  });

  it("body con forma workflow webhook {id: 'x'} → extrae 1 id y encola", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(VALID_TOKEN, { id: "zoho-lead-wf-001" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(enqueueZohoLeadEvent).toHaveBeenCalledTimes(1);
    // Verificar que el job lleva el lead_id correcto.
    const callArg = (enqueueZohoLeadEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.zoho_lead_ids).toEqual(["zoho-lead-wf-001"]);
  });

  it("body con forma Notifications API {data:[{id:...},...]} → encola los ids", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(VALID_TOKEN, {
      data: [{ id: "lead-n1" }, { id: "lead-n2" }],
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(enqueueZohoLeadEvent).toHaveBeenCalledTimes(2);
  });

  it("connection inactiva → 200 pero ignorado, sin encolar", async () => {
    const supabase = buildSupabaseWithConn({ is_active: false });
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(VALID_TOKEN, { ids: ["lead-1"] });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ignored).toBe("inactive");
    expect(enqueueZohoLeadEvent).not.toHaveBeenCalled();
  });

  it("error de BD al consultar connection → 500", async () => {
    const supabase = buildSupabaseWithConn({ error: true });
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(VALID_TOKEN, { ids: ["lead-1"] });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
  });

  it("el job encolado incluye integration_id, tenant_id y trigger=webhook", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildRequest(VALID_TOKEN, { ids: ["lead-777"] });
    await POST(req);

    const callArg = (enqueueZohoLeadEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.integration_id).toBe(INTEGRATION_ID);
    expect(callArg.tenant_id).toBe(TENANT_ID);
    expect(callArg.trigger).toBe("webhook");
    expect(callArg.zoho_lead_ids).toEqual(["lead-777"]);
  });

  // ─── BUG-5-01: id en header Entity_id (Workflow Webhook) ─────────────────────

  it("BUG-5-01: id en header Entity_id (body vacío) → extrae el id y encola", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildWorkflowRequest(VALID_TOKEN, { headerId: "zoho-wf-555" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(enqueueZohoLeadEvent).toHaveBeenCalledTimes(1);
    expect(body.enqueued).toBe(1);
    const callArg = (enqueueZohoLeadEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.zoho_lead_ids).toEqual(["zoho-wf-555"]);
  });

  it("BUG-5-01: header alternativo 'entityid' también funciona", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildWorkflowRequest(VALID_TOKEN, {
      headerId: "zoho-wf-666",
      headerName: "entityid",
    });
    await POST(req);

    const callArg = (enqueueZohoLeadEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.zoho_lead_ids).toEqual(["zoho-wf-666"]);
  });

  // ─── Vía A "gorda": campos inline en el body form-encoded ────────────────────

  it("id en header + campos form-encoded → pasa inline_leads (lead sin OAuth)", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildWorkflowRequest(VALID_TOKEN, {
      headerId: "zoho-wf-777",
      formFields: {
        First_Name: "Carlos",
        Last_Name: "Pérez",
        Email: "carlos@example.com",
        Phone: "+34600111222",
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const callArg = (enqueueZohoLeadEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.zoho_lead_ids).toEqual(["zoho-wf-777"]);
    expect(callArg.inline_leads).toBeDefined();
    expect(callArg.inline_leads["zoho-wf-777"]).toMatchObject({
      First_Name: "Carlos",
      Email: "carlos@example.com",
    });
  });

  it("campos de control (token, entity_id) NO se filtran como campos del lead", async () => {
    const supabase = buildSupabaseWithConn();
    (getAdminSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

    const req = buildWorkflowRequest(VALID_TOKEN, {
      headerId: "zoho-wf-888",
      formFields: { First_Name: "Ana", token: "ruido", entity_id: "ruido", module: "Leads" },
    });
    await POST(req);

    const inline = (enqueueZohoLeadEvent as ReturnType<typeof vi.fn>).mock.calls[0][0].inline_leads[
      "zoho-wf-888"
    ];
    expect(inline).toHaveProperty("First_Name", "Ana");
    expect(inline).not.toHaveProperty("token");
    expect(inline).not.toHaveProperty("entity_id");
    expect(inline).not.toHaveProperty("module");
  });
});
