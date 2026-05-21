---
title: "Phase 01 — E2E Tests Playwright + Coverage Setup (4-01 + 4-02)"
sprint: 4
phase: 1
tasks: [4-01, 4-02]
effort: 28-32h
status: pending
agent: af-agents:testing
---

# Phase 01 — E2E Tests Playwright + Coverage

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) líneas 328-329 (4-01, 4-02)
- Researcher report: [researcher-playwright-coverage-d-20260520.md](../reports/researcher-playwright-coverage-d-20260520.md)
- ADR deps: [adr-auditoria-dependencias-20260520.md](../reports/adr-auditoria-dependencias-20260520.md) — línea 404 (`@playwright/test@^1.60.0`)
- Sprint 0 Ph7: CLOSE-2 incluye test E2E local básico — este plan lo extiende a suite completa

## Overview

- **Priority:** P1
- **Status:** Pendiente
- **Descripción:** Instalar Playwright y Vitest, crear suite E2E completa cubriendo los 6 golden path flows del MVP, tests de seguridad RLS cross-tenant, tests WCAG keyboard, e integration tests para cobertura ≥80%.

## Key Insights

- El proyecto NO tiene test runner ni coverage configurado actualmente
- `@playwright/test@^1.60.0` confirmado por ADR como devDep para Sprint 3
- BullMQ workers deben testearse en integration layer (no E2E Playwright) — Redis real en CI
- Vitest es la elección correcta para unit/integration (ESM nativo, compatible React 19)
- Tests E2E de WCAG (modales, teclado) deben ejecutarse DESPUÉS de que Ph4 aplique los fixes — no antes
- 4-01 y 4-02 son parcialmente paralelizables: setup e infra de testing es compartido; E2E y unit/integration son independientes

## Requirements

### Funcionales

- Suite E2E Playwright con 6+ golden path flows cubriendo el MVP completo
- Test de aislamiento multi-tenant (RLS post Sprint 0): cookie tampering no accede datos ajenos
- Tests keyboard accessibility (post Ph4 WCAG fixes)
- Coverage report automático: `lines ≥ 80%`, `functions ≥ 80%`, `branches ≥ 70%`
- CI integration: GitHub Actions ejecuta tests en cada PR

### No funcionales

- Tests deben ser deterministas (no flaky): usar `waitForResponse` y timeouts explícitos
- Tiempo ejecución CI: E2E < 5min, unit/integration < 3min
- Test data isolation: factories + cleanup post-test, tenants de test separados

## Architecture

```
Capa de tests:
  Playwright E2E ──── Browser tests (golden paths, a11y, security)
       │
       └─ e2e/
            ├── auth/
            ├── leads/
            ├── agents/
            ├── calendar/
            ├── settings/        (Sprint 2: HubSpot/Zoho connection)
            ├── accessibility/   (post Ph4 fixes)
            ├── security/        (RLS cross-tenant)
            └── fixtures/

  Vitest unit/integration ──── Unit + integration tests
       │
       └─ src/**/__tests__/ o tests/
            ├── unit/            (Zod schemas, utils, cost calculator)
            ├── integration/     (Repositories BD real, BullMQ workers, Server Actions)
            └── fixtures/

Data flow tests:
  .env.test → Supabase local / BD test → Test factories → Tests → Cleanup
```

## Related Code Files

### Crear

- `e2e/` — directorio raíz E2E
- `e2e/auth/login.spec.ts`
- `e2e/auth/logout.spec.ts`
- `e2e/auth/tenant-isolation.spec.ts`
- `e2e/leads/create-lead.spec.ts`
- `e2e/leads/historial-table.spec.ts`
- `e2e/leads/lead-profile.spec.ts`
- `e2e/agents/agent-inbox.spec.ts`
- `e2e/calendar/appointments.spec.ts`
- `e2e/settings/crm-connection.spec.ts`
- `e2e/accessibility/wcag-keyboard.spec.ts`
- `e2e/accessibility/wcag-modals.spec.ts`
- `e2e/security/rls-cross-tenant.spec.ts`
- `e2e/fixtures/auth.ts`
- `e2e/fixtures/tenants.ts`
- `e2e/fixtures/leads.ts`
- `playwright.config.ts`
- `vitest.config.ts`
- `tests/integration/worker-lead-sequence.test.ts`
- `tests/unit/zod-schemas.test.ts`
- `tests/unit/llm-cost-calculator.test.ts`

### Modificar

- `package.json` — añadir scripts `test`, `test:e2e`, `test:coverage`, `test:integration`
- `.github/workflows/ci.yml` — añadir jobs E2E + coverage

## Implementation Steps

### Paso 1: Instalar dependencias (pasar por ADR primero)

```bash
# ADR: @playwright/test ya aprobado en adr-auditoria-dependencias-20260520.md
npm install -D @playwright/test@^1.60.0
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event happy-dom
npm install -D @axe-core/playwright  # WCAG tests
npx playwright install --with-deps chromium
```

### Paso 2: Configurar playwright.config.ts

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8500",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8500",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Paso 3: Configurar vitest.config.ts

Ver configuración completa en researcher-playwright-coverage-d-20260520.md.
Threshold: lines 80%, functions 80%, branches 70%.

### Paso 4: Scripts package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:integration": "vitest run tests/integration"
  }
}
```

### Paso 5: Fixtures de auth y tenants

Crear `e2e/fixtures/auth.ts` con `loginAs()` function.
Crear `e2e/fixtures/tenants.ts` con constantes TENANT_A_UUID, TENANT_B_UUID (de .env.test).
Crear `e2e/fixtures/leads.ts` con `createTestLead()` + `cleanupTestData()`.

### Paso 6: Golden path flows E2E (4-01)

Implementar en orden de prioridad:

1. `auth/login.spec.ts` — login válido → dashboard, login inválido → error
2. `leads/create-lead.spec.ts` — crear lead desde historial → aparece en tabla
3. `leads/historial-table.spec.ts` — listado, búsqueda, paginación
4. `agents/agent-inbox.spec.ts` — seleccionar agente, ver conversación
5. `calendar/appointments.spec.ts` — ver citas del día
6. `security/rls-cross-tenant.spec.ts` — cookie tampering bloqueado por RLS

### Paso 7: Tests accesibilidad E2E (post Ph4 fixes)

- `accessibility/wcag-keyboard.spec.ts` — Tab order completo, skip link funcional
- `accessibility/wcag-modals.spec.ts` — focus trap modales, Escape cierra
- Usar `@axe-core/playwright` para `checkA11y()` en páginas principales

### Paso 8: Integration tests (4-02 coverage)

- `tests/integration/worker-lead-sequence.test.ts` — BullMQ worker con Redis real
- `tests/unit/zod-schemas.test.ts` — validación de schemas de Sprint 1
- `tests/unit/llm-cost-calculator.test.ts` — cálculo costes por proveedor/modelo
- Repositories: test unit de cada repository de Sprint 1 contra BD real

### Paso 9: GitHub Actions CI

```yaml
# .github/workflows/ci.yml — añadir jobs
jobs:
  unit-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm ci
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        with: { name: coverage-report, path: coverage/ }

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env: { E2E_BASE_URL: http://localhost:8500 }
```

## Todo List

- [ ] ADR aprobado para @playwright/test + vitest + @vitest/coverage-v8 + @axe-core/playwright
- [ ] Instalar devDeps
- [ ] playwright.config.ts
- [ ] vitest.config.ts con coverage thresholds
- [ ] Scripts package.json
- [ ] .env.test con tenants/users de test
- [ ] Fixtures: auth.ts + tenants.ts + leads.ts
- [ ] Golden path flow 1: login/logout
- [ ] Golden path flow 2: crear lead → historial
- [ ] Golden path flow 3: historial table CRUD
- [ ] Golden path flow 4: agent inbox
- [ ] Golden path flow 5: calendar
- [ ] Golden path flow 6: RLS cross-tenant security
- [ ] Tests WCAG keyboard (depende Ph4)
- [ ] Tests WCAG modales (depende Ph4)
- [ ] Integration tests Workers BullMQ
- [ ] Unit tests Zod schemas
- [ ] Unit tests LLM cost calculator
- [ ] Coverage report ≥ 80%
- [ ] GitHub Actions CI jobs
- [ ] Lighthouse score ≥ 90 en rutas principales

## Success Criteria

- `npx playwright test` → 0 failed, ≥6 specs passing
- `npm run test:coverage` → `lines ≥ 80%`, `functions ≥ 80%`
- Lighthouse a11y score ≥ 90 en `/dashboard`, `/dashboard/historial`, `/dashboard/agents`
- CI pipeline verde en PR de Sprint 3
- Test de cookie tampering: intentar acceso cross-tenant → blocked (RLS)

## Risk Assessment

| Riesgo                                           | Prob  | Impacto | Mitigación                                                                       |
| ------------------------------------------------ | ----- | ------- | -------------------------------------------------------------------------------- |
| Tests E2E flaky por timing async (BullMQ, LLM)   | Alta  | Medio   | `waitForResponse` explícito; retry 2 en CI; mock LLM en E2E                      |
| Coverage 80% difícil por código legacy sin tests | Media | Alto    | Priorizar repositorios nuevos de Sprint 1; excluir archivos legacy del threshold |
| `@axe-core/playwright` genera falsos positivos   | Baja  | Bajo    | Whitelistear issues conocidos pre-Ph4; solo fallar por Critical                  |
| Setup Supabase local para BD de test             | Media | Alto    | Usar `supabase start` en CI; docs onboarding actualizados                        |

## Security Considerations

- Tests no deben leer ni escribir datos de producción
- `.env.test` con variables de test debe añadirse a `.gitignore`
- Tenants de test (TENANT_A_UUID, TENANT_B_UUID) son UUIDs ficticios, no exponen PII
- Test de RLS cross-tenant verifica activamente que la vulnerabilidad esté CERRADA (post Sprint 0)

## Next Steps

- Ph4 (WCAG fixes) debe completarse para que los tests de accesibilidad E2E sean meaningful
- Ph5 (CSP headers) debe verificarse que no rompe los tests E2E (headers CORS, etc.)
- Este phase establece el pipeline de CI que bloquea PRs futuros si los tests fallan
