import { expect, test } from "@playwright/test";

/**
 * Smoke tests — verifican que la app responde y la auth no tiene leaks básicos.
 * No requieren login; se ejecutan en cualquier estado del entorno.
 *
 * Para Sprint 0 SP-1-CLOSE-2 estos tests se ampliarán con escenarios de
 * endpoints protegidos (orchestration, webhooks) y RLS multi-tenant.
 */

test.describe("smoke @core", () => {
  test("login page renders", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status(), "GET /login should be 2xx").toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated /dashboard does not leak content", async ({ page, context }) => {
    await context.clearCookies();
    const response = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Debe redirigir a login o devolver 401/403 — nunca renderizar el dashboard.
    const finalUrl = page.url();
    const status = response?.status() ?? 0;

    const redirectedToLogin = finalUrl.includes("/login") || finalUrl.includes("/auth");
    const blocked = status === 401 || status === 403;

    expect(
      redirectedToLogin || blocked,
      `Unauth /dashboard debe redirigir o bloquear. URL final: ${finalUrl}, status: ${status}`
    ).toBeTruthy();
  });
});
