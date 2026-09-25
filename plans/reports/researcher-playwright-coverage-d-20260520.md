---
title: "Researcher Report — Playwright E2E + Coverage — Sprint 3"
date: 2026-05-20
agent: researcher-playwright-coverage (Sonnet)
sprint: 4
---

# Researcher: Playwright E2E + Coverage

## 1. Playwright con Next.js 16 App Router

### Versión y compatibilidad

`@playwright/test@^1.60.0` (ADR: `adr-auditoria-dependencias-20260520.md`, línea 404).

| Requisito | Estado |
|-----------|--------|
| Node.js 24 | ✅ Compatible |
| Next.js 16 App Router | ✅ Compatible |
| Server Actions | ✅ Testeable vía fetch directo o form submit |
| Multi-tenant (cookies) | ✅ Via `context.addCookies()` |

### Instalación como devDependency

```bash
npm install -D @playwright/test@^1.60.0
npx playwright install --with-deps chromium  # Solo Chromium para MVP
```

### Configuración playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Solo mobile si Sprint 3 incluye responsive (DA-5-012)
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 2. Estructura E2E para sistema multi-tenant

### Árbol de tests recomendado

```
e2e/
├── auth/
│   ├── login.spec.ts              # Login válido + inválido
│   ├── logout.spec.ts             # Logout limpia cookies
│   └── tenant-isolation.spec.ts  # Cookie tampering no accede datos ajenos (RLS fix de Sprint 0)
├── leads/
│   ├── create-lead.spec.ts       # Golden path: crear lead desde UI
│   ├── historial-table.spec.ts   # Listado, búsqueda, paginación
│   └── lead-profile.spec.ts      # Modal detalle, teclado accesible
├── agents/
│   ├── agent-inbox.spec.ts       # Selección agente, inbox conversación
│   └── ai-agent-selector.spec.ts # Teclado (DA-5-006 fix verification)
├── calendar/
│   └── appointments.spec.ts      # Ver citas, confirmar/cancelar
├── settings/
│   ├── integrations.spec.ts      # Panel integraciones CRM (Sprint 2)
│   └── crm-connection.spec.ts    # OAuth HubSpot + Zoho flow
├── accessibility/
│   ├── wcag-keyboard.spec.ts     # Tab navigation, focus traps
│   └── wcag-modals.spec.ts       # Modales dialog ARIA
├── security/
│   └── rls-cross-tenant.spec.ts  # Verificar aislamiento multi-tenant post Sprint 0
└── fixtures/
    ├── auth.ts                    # Login fixture reutilizable
    ├── tenants.ts                 # Tenant setup/teardown
    └── leads.ts                   # Lead factory para tests
```

### Golden Path Flows (3-01 must-have)

1. **Login → Dashboard → Crear Lead → Ver en Historial** (happy path completo)
2. **Login → Inbox → Seleccionar Agente → Ver Conversación**
3. **Login → Calendario → Ver Citas del día**
4. **Login Tenant A → Intentar acceder datos Tenant B → Blocked** (RLS verification)
5. **Login Admin → Settings → Conectar HubSpot** (Sprint 2 integration)
6. **Login → Dashboard → WCAG keyboard nav (Tab order)** (Sprint 3 a11y)

---

## 3. Tests multi-tenant: patrón de aislamiento

### Cookie tampering test (post Sprint 0 fix)

```typescript
// e2e/security/rls-cross-tenant.spec.ts
test('tenant isolation: cookie tampering no accede datos ajenos', async ({ page, context }) => {
  // Login como Tenant A
  await loginAs(page, TENANT_A_USER);
  
  // Intentar inyectar cookie de Tenant B
  await context.addCookies([{
    name: 'af-tenant-id',
    value: TENANT_B_UUID,
    domain: 'localhost',
    path: '/',
  }]);
  
  // Navegar al historial
  await page.goto('/dashboard/historial');
  
  // Los datos de Tenant B NO deben ser visibles
  const leadsVisible = await page.locator('[data-testid="lead-row"]').count();
  expect(leadsVisible).toBe(0); // RLS debe bloquear
  
  // O bien, redirigir a error/login
  await expect(page).toHaveURL(/login|unauthorized/);
});
```

### Login fixture reutilizable

```typescript
// e2e/fixtures/auth.ts
export async function loginAs(page: Page, credentials: TestUser) {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', credentials.email);
  await page.fill('[data-testid="password"]', credentials.password);
  await page.click('[data-testid="login-btn"]');
  await page.waitForURL('/dashboard');
}
```

---

## 4. Coverage: c8/nyc vs vitest coverage

### Stack actual

El proyecto usa Next.js 16 — sin test runner explícito en `package.json` actual. Opciones:

| Opción | Pros | Cons |
|--------|------|------|
| **Vitest** (recomendado) | Nativo ESM, compatible React 19, coverage con c8/v8, rápido | Instalar como devDep |
| Jest | Maduro, ecosistema amplio | Config más compleja con Next.js App Router ESM |
| Next.js `node:test` | Built-in Node 24, sin deps | Muy básico, sin React Testing Library |

**DECISIÓN: Vitest** para unit/integration tests + coverage. Playwright solo para E2E.

### Setup Vitest + coverage v8

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event happy-dom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.*', 'src/**/*.test.*', 'src/app/layout.tsx'],
    },
  },
});
```

### Target coverage 80% — qué cubrir

| Área | Priority | Tipo test |
|------|----------|-----------|
| Repository pattern (Sprint 1) | Alta | Integration (BD real) |
| Zod schemas validation | Alta | Unit |
| Server Actions críticas | Alta | Integration |
| LLM callbacks / cost tracker | Alta | Unit (mock LLM) |
| UI components con lógica | Media | Unit (React Testing Library) |
| API Routes | Media | Integration |
| Utilities / helpers | Baja | Unit |

---

## 5. Testing BullMQ workers en E2E

### Patrón recomendado

BullMQ workers NO deben testarse en E2E de browser (Playwright). En su lugar:

1. **Unit test** del processor function (mock Redis con `ioredis-mock` o instancia real Redis de test)
2. **Integration test** con Redis real (local en CI): enqueue → process → assert BD updated
3. **E2E smoke test**: verificar que UI muestra "procesando" y eventualmente "completado" (polling o SSE)

```typescript
// tests/integration/worker-lead-sequence.test.ts
import { Queue, Worker } from 'bullmq';
import { createClient } from 'redis';

describe('LeadSequenceWorker', () => {
  it('ejecuta step 1 correctamente tras fix F-02-001', async () => {
    const queue = new Queue('lead-sequence', { connection: redisTest });
    await queue.add('step', { leadId: testLeadId, step: 1, tenantId: testTenantId });
    
    // Worker procesa
    await waitForJobCompletion(queue);
    
    // Verificar en BD que el step se ejecutó
    const lead = await db.leads.findById(testLeadId);
    expect(lead.currentStep).toBe(1);
    expect(lead.stepExecutedAt).toBeDefined();
  });
});
```

---

## 6. Test data isolation: factories vs fixtures

### Recomendación: Factories + cleanup

```typescript
// e2e/factories/lead-factory.ts
export async function createTestLead(tenantId: string): Promise<Lead> {
  const { data } = await supabaseAdmin
    .from('leads')
    .insert({ tenant_id: tenantId, nombre: `Test_${Date.now()}`, telefono: '+34600000000' })
    .select()
    .single();
  return data;
}

// En cada test file:
test.afterEach(async () => {
  await cleanupTestData(testTenantId); // Elimina datos creados en el test
});
```

**Importante:** Usar tenants de test dedicados (UUID fijos en `.env.test`) aislados de datos de producción. CI debe usar BD de test separada (Supabase local con `supabase start`).

---

## 7. Estimaciones de implementación

| Componente | Estimación |
|-----------|-----------|
| Setup Playwright + config + playwright.config.ts | 2h |
| Fixtures auth + tenants + leads factories | 4h |
| Golden path E2E (6 flujos principales) | 12-16h |
| Tests RLS/security cross-tenant | 4h |
| Tests accesibilidad keyboard (WCAG verifications) | 4h |
| Setup Vitest + coverage v8 | 3h |
| Unit tests Zod schemas + utils | 6-8h |
| Integration tests Repository pattern | 8-12h |
| Integration tests BullMQ workers | 4-6h |
| CI configuration (GitHub Actions) | 2-3h |
| **Total 3-01 E2E** | **26-30h** |
| **Total 3-02 Coverage** | **23-29h** |

**Nota paralelización:** 3-01 y 3-02 son paralelizables — Playwright E2E y Vitest unit/integration no comparten archivos. Un dev puede hacer E2E mientras otro hace unit/integration. Estimación wall-clock: 26-30h (no 50+).

---

**Status:** DONE
**Summary:** Stack recomendado para Sprint 3 testing: @playwright/test@^1.60.0 para E2E (solo Chromium MVP), Vitest + v8 coverage para unit/integration. Estructura de tests centrada en 6 golden path flows + security RLS verification + WCAG keyboard tests. Factories sobre fixtures para isolation. BullMQ tests en integration layer (no E2E). Target 80% coverage alcanzable en 23-29h con priorización de repositorios, Zod schemas, y Server Actions.
