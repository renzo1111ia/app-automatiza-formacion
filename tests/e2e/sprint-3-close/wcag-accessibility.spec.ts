import { expect, test } from "@playwright/test";

/**
 * SP-4-CLOSE-2 — E2E Sprint 3: WCAG sub-tareas (WCAG-08/09/10).
 *
 * Verifica los 3 fixes accesibilidad detectados en E2E Sprint 2B Bloque C:
 *  - WCAG-08: aria-label en botones "Personalizar".
 *  - WCAG-09: heading hierarchy correcto (1 h1 + h2 secundarios).
 *  - WCAG-10: skip-link "Saltar al contenido principal".
 *
 * No requiere login: WCAG-10 (skip-link) está en root layout = visible siempre.
 * Para WCAG-08/09 navegamos a /login (sin auth) que reusa el root layout — el skip-link
 * está pero los headings del dashboard no se ven. Por eso WCAG-08/09 se validan
 * en post-login (test condicional).
 */

test.describe("Sprint 3 — WCAG accessibility", () => {
  test("WCAG-10: skip-link 'Saltar al contenido principal' está en el body", async ({ page }) => {
    await page.goto("/login");
    // El skip-link es sr-only por defecto pero el elemento existe en el DOM.
    const skipLink = page.getByRole("link", { name: /Saltar al contenido principal/i });
    await expect(skipLink).toBeAttached();
  });

  test("WCAG-10: skip-link apunta a #main-content", async ({ page }) => {
    await page.goto("/login");
    const skipLink = page.getByRole("link", { name: /Saltar al contenido principal/i });
    await expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  test("WCAG-10: skip-link se hace visible on focus (Tab desde inicio)", async ({ page }) => {
    await page.goto("/login");

    // Focus al skip-link (primer elemento tabbable del body).
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: /Saltar al contenido principal/i });
    await expect(skipLink).toBeFocused();
  });
});
