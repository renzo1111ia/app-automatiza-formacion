import { expect, test, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * SP-3B-CLOSE-2 — Smoke E2C Sprint 2B Dashboard KPIs Overview.
 *
 * Flujo crítico del Sprint 2B (OverviewSection cross-canal):
 *   1. /dashboard sin sesión → /login (regression baseline)
 *   2. Login admin → /dashboard renderiza
 *   3. OverviewSection visible ENCIMA de SummarySection con título "Resumen general"
 *   4. 4 KPI cards hero (Total Leads, Contactados, Cualificados, Tiempo Ahorrado)
 *   5. Botón "Personalizar Overview" (BUG-2B-01 fix: distinto de "Personalizar Tablero")
 *   6. Chart "Distribución por canal" renderiza (donut o empty state según datos)
 *   7. WCAG: role="img" + aria-label en charts del overview
 *
 * Credenciales: VPS_ADMIN_EMAIL / VPS_ADMIN_PASS (mismas creds local+VPS).
 */

const ADMIN_EMAIL = process.env.VPS_ADMIN_EMAIL ?? "automatizaformacion@gmail.com";
const ADMIN_PASS = process.env.VPS_ADMIN_PASS ?? "BeaOli#AF*2026!";
const SCREENSHOT_DIR = "docs/screenshots/sprint-2b-close";

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function fillReactInput(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  await el.click();
  await el.fill(value);
  await el.dispatchEvent("input");
  await el.dispatchEvent("change");
}

async function loginAsAdmin(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await fillReactInput(page, "#email", ADMIN_EMAIL);
  await fillReactInput(page, "#password", ADMIN_PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/dashboard/, { timeout: 25_000 });
}

test.beforeAll(() => {
  ensureScreenshotDir();
});

test.describe.configure({ mode: "serial" });

test.describe("sprint-2b-close smoke Overview @smoke", () => {
  test("2B-01: GET /dashboard sin sesión → /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const finalUrl = page.url();
    const redirectedToLogin = finalUrl.includes("/login") || finalUrl.includes("/auth");
    expect(redirectedToLogin, `URL final: ${finalUrl}`).toBe(true);
  });

  test("2B-02: Login admin → /dashboard carga", async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(3000); // dejar que Suspense resuelva

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "2b-02-dashboard-loaded.png"),
      fullPage: true,
    });

    expect(page.url()).toContain("/dashboard");
    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(bodyText.length, "Body debe tener contenido").toBeGreaterThan(200);
  });

  test("2B-03: OverviewSection visible con título 'Resumen general'", async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(3000);

    // Header "Resumen general" debe aparecer
    const overviewHeading = page.locator("h2#overview-heading");
    await expect(overviewHeading, "h2#overview-heading debe existir").toBeVisible({
      timeout: 10_000,
    });
    const headingText = await overviewHeading.textContent();
    expect(headingText).toContain("Resumen");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "2b-03-overview-heading.png"),
      fullPage: false,
    });
  });

  test("2B-04: 4 KPI cards hero del overview presentes", async ({ page }) => {
    await loginAsAdmin(page);

    // Esperar a que el OverviewSection resuelva su Suspense (5 queries paralelas).
    // Total Leads es el primer KPI hero - usar waitFor con polling.
    await page
      .getByText("Total Leads", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForTimeout(2000); // dar tiempo al resto de KPIs

    const bodyText = (await page.locator("body").textContent()) ?? "";

    // Los 4 labels de DEFAULT_OVERVIEW_KPIS deben aparecer en el body
    const labels = ["Total Leads", "Leads Contactados", "Leads Cualificados", "Tiempo Ahorrado"];
    for (const label of labels) {
      expect(bodyText.includes(label), `KPI hero "${label}" debe estar visible en /dashboard`).toBe(
        true
      );
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "2b-04-kpi-hero-4.png"),
      fullPage: true,
    });
  });

  test("2B-05: BUG-2B-01 fix — botones 'Personalizar Overview' distinto de 'Personalizar Tablero'", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    // Esperar a que el SummaryManager renderice botones admin
    await page
      .getByText("Personalizar Overview", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });

    const bodyText = (await page.locator("body").textContent()) ?? "";

    // BUG-2B-01: ambos labels deben coexistir, no duplicarse
    const hasOverviewBtn = bodyText.includes("Personalizar Overview");
    const hasTableroBtn = bodyText.includes("Personalizar Tablero");

    expect(hasOverviewBtn, "Botón 'Personalizar Overview' debe estar visible (admin)").toBe(true);
    expect(hasTableroBtn, "Botón 'Personalizar Tablero' debe coexistir (otro section)").toBe(true);
  });

  test("2B-06: Distribución por canal — donut o empty state visible", async ({ page }) => {
    await loginAsAdmin(page);
    // Esperar al título del chart canal (renderiza con datos o empty state)
    await page
      .getByText("Distribución por canal", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });

    const bodyText = (await page.locator("body").textContent()) ?? "";

    const hasDistribTitle = bodyText.includes("Distribución por canal");
    const hasWebTrackingNote = bodyText.includes("Web tracking en desarrollo");

    expect(hasDistribTitle, "Título 'Distribución por canal' debe estar visible").toBe(true);
    expect(
      hasWebTrackingNote,
      "Nota 'Web tracking en desarrollo' (decisión 24-05) debe estar visible"
    ).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "2b-06-canal-distribution.png"),
      fullPage: true,
    });
  });

  test("2B-07: WCAG phase-06 — al menos 1 chart con role='img' + aria-label", async ({ page }) => {
    await loginAsAdmin(page);
    // Esperar a que el chart canal renderice (es el primero con role=img garantizado)
    await page
      .getByText("Distribución por canal", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForTimeout(2000); // dar tiempo a los charts dynamic del ChartManager

    const imgRoleElements = page.locator('[role="img"]');
    const count = await imgRoleElements.count();
    expect(count, "Debe haber al menos 1 elemento con role='img' (WCAG phase-06)").toBeGreaterThan(
      0
    );

    const firstAriaLabel = await imgRoleElements.first().getAttribute("aria-label");
    expect(firstAriaLabel, "role='img' debe tener aria-label").toBeTruthy();
    expect(
      (firstAriaLabel ?? "").length,
      "aria-label debe ser descriptivo (>10 chars)"
    ).toBeGreaterThan(10);
  });
});
