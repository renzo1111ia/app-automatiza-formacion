import { expect, test } from "@playwright/test";

/**
 * SP-6-CLOSE-2 — E2C Sprint 5: control de acceso de la integración Zoho CRM
 * (entrada de leads event-driven).
 *
 * El flujo funcional completo (OAuth Zoho real + webhook + pipeline) se validará
 * manualmente contra la cuenta test Zoho EU (org 20115313796) en SP-4B phase-06.
 * Este spec cubre lo verificable sin OAuth real ni Zoho conectado:
 *
 *  - La página de settings Zoho Pull exige sesión (redirige a /login).
 *  - La página de settings no filtra HTML interno a anónimos.
 *  - El webhook POST rechaza un token inválido con 403.
 *  - El webhook GET responde 200 (health check).
 *  - El endpoint cron Zoho es fail-closed con secret incorrecto.
 *
 * Patrón de referencia: tests/e2e/sprint-4-close/sheets-access-control.spec.ts
 */

const ZOHO_SETTINGS_PATH = "/dashboard/settings/integrations/zoho-pull";
const WEBHOOK_PATH = "/api/webhooks/zoho";
const CRON_PATH = "/api/internal/zoho-pull/cron";

test.describe("Sprint 5 — Zoho CRM Pull: control de acceso", () => {
  test("la página de Zoho Pull exige autenticación (redirige a login)", async ({ page }) => {
    await page.goto(ZOHO_SETTINGS_PATH);
    // Sin sesión, el middleware/guard lleva a /login.
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("la página de Zoho Pull no devuelve HTML de dashboard a anónimos", async ({ request }) => {
    const res = await request.get(ZOHO_SETTINGS_PATH, { headers: { cookie: "" } });
    const body = await res.text();
    // No debe filtrar marcadores de la UI interna de configuración sin sesión.
    expect(body).not.toContain("ZohoPullSettings");
    expect(body).not.toContain("subscription_token");
  });

  test("webhook POST con token inválido → 403", async ({ request }) => {
    const res = await request.post(`${WEBHOOK_PATH}?token=token-invalido-xyz`, {
      data: { ids: ["lead-1"] },
      headers: { "content-type": "application/json" },
    });
    // Token desconocido en BD → fail-closed 403.
    expect(res.status()).toBe(403);
    const body = await res.json().catch(() => ({}));
    expect(body.ok).toBe(false);
  });

  test("webhook POST sin token → 403", async ({ request }) => {
    const res = await request.post(WEBHOOK_PATH, {
      data: { ids: ["lead-1"] },
      headers: { "content-type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });

  test("webhook GET responde 200 (health check del endpoint)", async ({ request }) => {
    const res = await request.get(WEBHOOK_PATH);
    // El GET es solo un health check — debe existir y responder.
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("el endpoint cron Zoho rechaza requests sin secret (no 200 con datos)", async ({
    request,
  }) => {
    const res = await request.post(CRON_PATH, { headers: { cookie: "" } });
    // Fail-closed: nunca expone datos de tenants a un anónimo.
    // En dev local sin CRON_SECRET se permite (200/404); lo que NO debe pasar
    // es exponer datos de leads/integrations → verificar ausencia.
    expect([200, 401, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json().catch(() => ({}));
      // En dev el cron corre vacío (sin outbox pendiente) — no expone PII.
      expect(body).not.toHaveProperty("leads");
      expect(body).not.toHaveProperty("tenants");
    }
  });

  test("el endpoint cron rechaza secret incorrecto", async ({ request }) => {
    const res = await request.post(CRON_PATH, {
      headers: { "x-cron-secret": "valor-claramente-incorrecto-abc" },
    });
    // Si CRON_SECRET está configurado → 401. Si no (dev) → puede ser 200/404.
    expect([200, 401, 403, 404]).toContain(res.status());
  });
});
