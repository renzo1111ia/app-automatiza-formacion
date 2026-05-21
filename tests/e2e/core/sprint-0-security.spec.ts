import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Sprint 0 SP-1-CLOSE-2 — Tests E2C de seguridad (anti-regresión).
 *
 * Verifican que los gates añadidos en el Sprint 0 (1-07..1-25) responden con
 * los códigos esperados ante requests anónimos / malformados. NO requieren
 * API keys reales de Retell/WhatsApp — solo verifican que el endpoint REGENA
 * antes de procesar firma/payload.
 *
 * Si una verificación queda en estado degradado (p. ej. CRON_SECRET no
 * configurado en `.env.local`), se acepta tanto 401 como 503 — ambos son
 * respuestas seguras (no procesar).
 */

const acceptableUnauthStatuses = [401, 403, 503];

test.describe("sprint-0 security gates @core", () => {
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("1-07: GET /api/orchestration/workflows sin auth → 401", async () => {
    const res = await api.get(
      "/api/orchestration/workflows?tenantId=00000000-0000-0000-0000-000000000000"
    );
    expect(res.status(), "Debe ser 401 sin sesión").toBe(401);
  });

  test("1-07: POST /api/orchestration/deploy sin auth → 401", async () => {
    const res = await api.post("/api/orchestration/deploy", {
      data: { tenantId: "x", workflowId: "y", status: "ACTIVE" },
    });
    expect(res.status()).toBe(401);
  });

  test("1-07: POST /api/orchestration/publish sin auth → 401", async () => {
    const res = await api.post("/api/orchestration/publish", {
      data: {
        tenantId: "00000000-0000-0000-0000-000000000000",
        workflowId: "00000000-0000-0000-0000-000000000000",
        graphData: { nodes: [], edges: [] },
      },
    });
    expect(res.status()).toBe(401);
  });

  test("1-08: GET /api/orchestration/sweep sin cron secret → 401/503", async () => {
    const res = await api.get("/api/orchestration/sweep");
    expect(acceptableUnauthStatuses).toContain(res.status());
  });

  test("1-08: GET /api/orchestration/sweep con header inválido → 401", async () => {
    const res = await api.get("/api/orchestration/sweep", {
      headers: { "x-cron-secret": "wrong" },
    });
    // 401 si CRON_SECRET está configurado; 503 si la env var falta
    expect(acceptableUnauthStatuses).toContain(res.status());
  });

  test("1-08: GET /api/cron/appointments/reminders sin cron secret → 401/503", async () => {
    const res = await api.get("/api/cron/appointments/reminders");
    expect(acceptableUnauthStatuses).toContain(res.status());
  });

  test("1-10: GET /api/admin/tenants/[id]/client-sql sin auth → 401", async () => {
    const res = await api.get("/api/admin/tenants/00000000-0000-0000-0000-000000000000/client-sql");
    expect(res.status()).toBe(401);
  });

  test("1-11: GET /api/tenant/migrate sin auth → 401", async () => {
    const res = await api.get("/api/tenant/migrate");
    expect(res.status()).toBe(401);
  });

  test("1-12: POST /api/webhooks/retell sin firma → 401/503", async () => {
    const res = await api.post("/api/webhooks/retell", {
      data: { event: "call_ended", call: { call_id: "x" } },
    });
    expect(acceptableUnauthStatuses).toContain(res.status());
  });

  test("1-13: POST /api/webhooks/retell/tools sin firma → 401/503", async () => {
    const res = await api.post("/api/webhooks/retell/tools", {
      data: { name: "book_appointment", args: { date: "2026-01-01" }, call: { metadata: {} } },
    });
    expect(acceptableUnauthStatuses).toContain(res.status());
  });

  test("1-14: POST /api/webhooks/whatsapp sin x-hub-signature-256 → 401/503", async () => {
    const res = await api.post("/api/webhooks/whatsapp", {
      data: { object: "whatsapp_business_account", entry: [] },
    });
    expect(acceptableUnauthStatuses).toContain(res.status());
  });

  test("1-15: POST /api/webhooks/crm sin x-tenant-id → 400", async () => {
    const res = await api.post("/api/webhooks/crm", { data: { telefono: "+34600000000" } });
    expect(res.status()).toBe(400);
  });

  test("1-15: POST /api/webhooks/crm con x-tenant-id pero sin firma → 401/403/503", async () => {
    const res = await api.post("/api/webhooks/crm", {
      headers: { "x-tenant-id": "00000000-0000-0000-0000-000000000000" },
      data: { telefono: "+34600000000" },
    });
    // 401 = firma faltante, 403 = tenant inexistente o sin secret cfg, 503 = secret no configurado
    expect(acceptableUnauthStatuses).toContain(res.status());
  });

  test("1-23: GET /api/widget/embed.js sin id → 400", async () => {
    const res = await api.get("/api/widget/embed.js");
    expect(res.status()).toBe(400);
  });

  test("1-23: GET /api/widget/embed.js con id NO-UUID → 400 (XSS guard)", async () => {
    const res = await api.get(
      `/api/widget/embed.js?id=${encodeURIComponent("hacker';alert(1);//")}`
    );
    expect(res.status(), "id debe ser UUID estricto").toBe(400);
  });

  test("1-23: GET /api/widget/embed.js con UUID válido → 200 + JS sanitizado", async () => {
    const res = await api.get("/api/widget/embed.js?id=11111111-1111-1111-1111-111111111111");
    expect(res.status()).toBe(200);
    const body = await res.text();
    // El JS debe usar JSON.stringify en lugar de interpolación raw
    expect(body).toContain('"11111111-1111-1111-1111-111111111111"');
    // No debe contener payloads inyectados
    expect(body).not.toMatch(/alert\s*\(/);
  });
});
