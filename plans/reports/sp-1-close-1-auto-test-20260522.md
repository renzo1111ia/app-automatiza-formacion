---
title: "SP-1-CLOSE-1 — Auto test Sprint 0 (typecheck + lint + build)"
date: 2026-05-22
author: af-agents:testing
branch: feature/sp-0-sprint-0-hotfixes
task: SP-1-CLOSE-1
status: DONE_WITH_CONCERNS
---

# SP-1-CLOSE-1 — Reporte auto-test Sprint 0

## Resumen ejecutivo

El pipeline de calidad del Sprint 0 cierra con resultado **2/3 pasos en verde**. Typecheck pasa limpio (0 errores TypeScript) y build completa sin errores (exit 0, 41 páginas generadas). Lint falla con exit code 1: 128 errores y 23 warnings distribuidos en 19 archivos. Esta deuda de lint es **mayoritariamente pre-existente** (baseline Sprint 0 = 164 errores, hoy = 128 errores — mejora neta de 36 errores), no es regresión introducida por Sprint 0. No existen tests unitarios/integración definidos en package.json. **No hay bloqueante duro para SP-1-CLOSE-2 (E2C Playwright)** — el build pasa y el dev server corre en localhost:8500.

---

## Tabla resumen por paso

| # | Comando | Exit code | Tiempo aprox. | Resultado |
|---|---------|-----------|---------------|-----------|
| 1 | `npm run typecheck` | **0 ✅** | ~5s | 0 errores TypeScript |
| 2 | `npm run lint` | **1 ❌** | ~8s | 128 errors, 23 warnings |
| 3 | `npm run build` | **0 ✅** | ~90s | 41 páginas generadas OK |
| 4 | Unit/integration tests | **N/A** | — | No definidos en package.json |

---

## Detalle de errores y warnings de lint

### Resumen comparativo vs baseline

| Métrica | Baseline Sprint 0 (21-05-26) | Hoy (22-05-26) | Delta |
|---------|------------------------------|-----------------|-------|
| Total problems | 190 | 151 | -39 |
| Errores | 164 | 128 | **-36** |
| Warnings | 26 | 23 | -3 |

Sprint 0 cerró con mejora neta de 36 errores de lint.

### Distribución de errores por regla

| Regla | Errores | Notas |
|-------|---------|-------|
| `@typescript-eslint/no-explicit-any` | 126 | Deuda pre-existente; 99% del total |
| `react-hooks/set-state-in-effect` | 1 | ThemeToggle.tsx:25 — nuevo o re-emergente |
| `prefer-const` | 1 | compliance.ts:104 |

### Distribución de warnings por regla

| Regla | Warnings |
|-------|---------|
| `@typescript-eslint/no-unused-vars` | 18 |
| Unused `eslint-disable` directives | 4 |
| `@typescript-eslint/no-unused-vars` (caught errors) | 1 |

### Errores detallados por archivo

#### `src/app/api/webhooks/workflow/[workflowId]/[path]/[nodeId]/route.ts` — 19 errores
- Líneas 18, 29, 30, 44, 53, 54, 55, 68, 74, 86, 93, 97: `@typescript-eslint/no-explicit-any`

#### `src/app/dashboard/playground/page.tsx` — 4 errores + 4 warnings
- L22:93, L62:37, L63:38, L450:67: `@typescript-eslint/no-explicit-any`
- L6:5 `Check`, L6:12 `AlertCircle`, L7:43 `Activity`, L8:5 `ShieldCheck`: `no-unused-vars`

#### `src/app/dashboard/settings/IntegrationsManager.tsx` — 4 errores
- L445:45, L453:55, L463:55, L471:37: `@typescript-eslint/no-explicit-any`

#### `src/app/widget/[id]/page.tsx` — 1 error
- L22:46: `@typescript-eslint/no-explicit-any`

#### `src/components/agents/AIAgentInbox.tsx` — 1 error + 1 warning
- L1237:65: `@typescript-eslint/no-explicit-any`
- L14:10: `useRouter` unused

#### `src/components/dashboard/CampanasCharts.tsx` — 3 errores
- L18:50, L28:49, L259:56: `@typescript-eslint/no-explicit-any`

#### `src/components/dashboard/MinutosCharts.tsx` — 4 errores
- L23:50, L28:30, L37:49, L47:42: `@typescript-eslint/no-explicit-any`

#### `src/components/dashboard/WhatsappCharts.tsx` — 3 errores
- L21:50, L31:49, L41:42: `@typescript-eslint/no-explicit-any`

#### `src/components/layout/ThemeToggle.tsx` — 1 error (`react-hooks/set-state-in-effect`)
- L25:9: `setMounted(true)` dentro de `useEffect` body — setState síncrono en efecto.
- **Nota**: Esta regla puede ser nueva (o re-activada) durante Sprint 0. Única ocurrencia de esta regla en el codebase.

#### `src/lib/actions/widget.ts` — 5 errores
- L57:38, L61:57, L75:67, L94:54, L119:54: `@typescript-eslint/no-explicit-any`

#### `src/lib/core/compliance.ts` — 1 error + 1 warning
- L104:9: `prefer-const` (`startH` never reassigned)
- L1:10: `addMinutes` unused import

#### `src/lib/core/feature-flags.ts` — 3 errores
- L11:34, L11:42, L32:13: `@typescript-eslint/no-explicit-any`

#### `src/lib/core/multi-agent.ts` — 1 error
- L66:47: `@typescript-eslint/no-explicit-any`

#### `src/lib/core/processors/AppointmentWatchdog.ts` — 4 errores
- L21:37, L21:45, L43:45, L43:53: `@typescript-eslint/no-explicit-any`

#### `src/lib/core/processors/QualificationProcessor.ts` — 17 errores
- Múltiples líneas (46-153): `@typescript-eslint/no-explicit-any`

#### `src/lib/core/processors/ZohoPollingProcessor.ts` — 3 errores
- L36:57, L50:100, L106:49: `@typescript-eslint/no-explicit-any`

#### `src/lib/core/scheduler.ts` — 19 errores
- Múltiples líneas (48-228): `@typescript-eslint/no-explicit-any`

#### `src/lib/core/sweep-queue.ts` — 2 errores + 3 warnings
- L44:25, L75:25: `@typescript-eslint/no-explicit-any`
- L65:29/37/47: variables `leadId`, `tenantId`, `actionType` asignadas pero no usadas

#### `src/lib/core/test-ab.ts` — 1 error + 2 warnings
- L59:32: `@typescript-eslint/no-explicit-any`
- L2:23: `getAgentVariants` unused; L53:11: `stats` unused

#### `src/lib/integrations/crm/factory.ts` — 1 error
- L15:50: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/crm/interface.ts` — 9 errores
- L8:28, L9:11, L32:53/68, L38:54, L44:60/74, L56:140, L62:131: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/crm/providers/zoho.ts` — 4 errores
- L72:28, L92:46, L98:59, L117:80: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/retell.ts` — 4 errores
- L20:34, L21:42, L39:25, L56:25: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/telephony/factory.ts` — 1 error
- L9:54: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/telephony/providers/twilio.ts` — 2 errores
- L52:25, L58:65: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/telephony/types.ts` — 2 errores
- L23:31, L35:52: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/ultravox.ts` — 2 errores
- L33:17, L67:25: `@typescript-eslint/no-explicit-any`

#### `src/lib/integrations/zoho.ts` — 3 errores
- L16:20, L98:59, L119:90: `@typescript-eslint/no-explicit-any`

#### `src/lib/utils/date-filters.ts` — 1 error
- L2:38: `@typescript-eslint/no-explicit-any`

#### `src/types/database.ts` — 3 errores
- L550:108, L550:223, L550:332: `@typescript-eslint/no-explicit-any`

### Warnings detallados por archivo

| Archivo | Línea | Mensaje |
|---------|-------|---------|
| `src/app/dashboard/knowledge/page.tsx` | 107:11 | `handleDelete` asignado pero no usado |
| `src/app/dashboard/web-chatbot/page.tsx` | 6:5, 6:20, 12:11 | `MessageCircle`, `Zap`, `ExternalLink` no usados |
| `src/components/charts/DashboardCharts.tsx` | 295:29 | Unused `eslint-disable` directive |
| `src/components/onboarding/nodes/BaseNode.tsx` | 2:10, 2:18 | `Handle`, `Position` no usados |
| `src/lib/core/intelligence/qualifier.ts` | 31:7 | `EXP_RANGES` asignado pero no usado |
| `src/lib/core/logger.ts` | 45:21 | Unused `eslint-disable` directive |
| `src/lib/integrations/whatsapp.ts` | 183:18 | `error` caught pero no usado (debe renombrarse a `_error`) |
| `src/lib/services/chat-memory.ts` | 51:5, 61:5 | Unused `eslint-disable` directives |

---

## Tests unitarios / integración

**No existen scripts `test` ni `test:unit` en package.json.** Solo están definidos `test:e2e:*` (Playwright). Esos son competencia de SP-1-CLOSE-2.

---

## Observaciones del build

El build (Next.js 16.2.6 Turbopack) completó correctamente con las siguientes observaciones no bloqueantes:

1. **Deprecation warning**: `"middleware" file convention is deprecated. Please use "proxy" instead.` — afecta al middleware actual. Tarea de migración prevista en Sprint 0 o a documentar para Sprint 1.
2. **Redis ECONNRESET / Protocol error en build**: El build lanza workers que intentan conectar a Redis (localhost). Redis no está activo durante el build, lo que genera mensajes `[REDIS_QUEUE] Connection Issue`. Estos son warnings de runtime, NO errores de build. El patrón `[REDIS] ✅ READY` confirma que reconecta tras fallar.

---

## Coverage

Sin tests unitarios definidos — no aplica.

---

## Recomendación

**Se puede avanzar a SP-1-CLOSE-2 (E2C Playwright).** El bloqueo real sería un build roto o typecheck fallido — ambos pasan. Los errores de lint son deuda pre-existente (126 de 128 son `no-explicit-any`, clasificados como Sprint 1 tarea de tipado en el baseline del 21-05-26). 

Para SP-1-CLOSE-4 (fixes post-E2C), los candidatos prioritarios son:
1. **`ThemeToggle.tsx:25`** — `react-hooks/set-state-in-effect` — único error de nueva regla, fácil de arreglar (mover setState a callback o useLayoutEffect).
2. **`compliance.ts:104`** — `prefer-const` — trivial, un `let` → `const`.
3. **`compliance.ts:1`** — `addMinutes` unused import — eliminar.
4. Warnings de `no-unused-vars` (18 casos) — renombrar variables no usadas con prefijo `_`.
5. Deuda `no-explicit-any` (126 errores) — planificada para Sprint 1, no urgente para Sprint 0.

El deprecation warning del middleware (`"middleware" → "proxy"`) debería registrarse como tarea en Sprint 1 si no está ya en el plan.

---

## Deuda diferida — absorción en Sprint 1

**Decisión 22-05-2026 (Javi HP)**: los 128 errores de lint del Sprint 0 **NO se abordan en SP-1-CLOSE-4**. Quedan diferidos a Sprint 1 — donde caen como subproducto natural del refactor.

### Mapping concreto

| Categoría de error | Cantidad | Dónde se resuelve en Sprint 1 |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | 126 | **Tarea 2-22** ([phase-05-type-safety-y-limpieza.md](../260520-1342-sprint-1-capa-datos/phase-05-type-safety-y-limpieza.md)). Objetivo del sprint: `426 → 0` ocurrencias de `as any`/`: any` mediante tipos `z.infer<typeof Schema>` derivados de los Zod schemas de fase-02 y los Repository pattern de fase-03. |
| `react-hooks/set-state-in-effect` (ThemeToggle.tsx:25) | 1 | **SP-1-CLOSE-4** — sí se arregla en este sprint (es correctness, no estilo). Fix trivial: mover `setMounted(true)` a callback ref o usar `useSyncExternalStore`. |
| `prefer-const` (compliance.ts:104) | 1 | **SP-1-CLOSE-4** — fix trivial (`let` → `const`). |
| `no-unused-vars` warnings | 18 | Sprint 1 (los archivos se tocan en fases 02-06 y se limpian al pasar). |
| Unused `eslint-disable` warnings | 5 | Sprint 1 (se limpian junto con el refactor). |

### Por qué Sprint 1 absorbe la deuda

- El DoD del Sprint 1 (`v0.2.0`) en [RoadMap.md](../RoadMap.md) ya exige *"`as any` reducidos >80% (426 → <85)"*.
- El criterio de cierre `SP-2-CLOSE-1` (Sprint 1) ya exige `npm run lint` con **0 errores**.
- La fase-05 de Sprint 1 ya tiene compromiso explícito: *"cualquier fase del Sprint 1 que toque un archivo de la lista del baseline DEBE dejarlo en 0 errores antes de cerrar"*.
- Resolver los `any` en Sprint 0 sin Zod + Repository sería trabajo perdido (habría que retipar otra vez al envolverlos en fase-02/03 de Sprint 1).

### Acción para Sprint 1

- Actualizar baseline en [plans/260520-1342-sprint-1-capa-datos/phase-05-type-safety-y-limpieza.md](../260520-1342-sprint-1-capa-datos/phase-05-type-safety-y-limpieza.md) de `164 → 128` (Sprint 0 redujo 36 errores como subproducto del hardening).
- Tracking incremental en `plans/logs/sprint-2/lint-debt.log.md` (ya planificado en fase-05).

---

## Status final

**Status:** DONE_WITH_CONCERNS  
**Summary:** Typecheck y build pasan (exit 0). Lint falla con 128 errores pre-existentes (mejora de 36 vs baseline Sprint 0). No hay regresiones de Sprint 0 en lint, solo una nueva regla (`react-hooks/set-state-in-effect`) que afecta a `ThemeToggle.tsx`. No hay unit tests definidos. Build produce 41 páginas sin errores.  
**Concerns:** Lint con exit 1 — no es un bloqueante para E2C ni para merge, pero SP-1-CLOSE-4 debe abordar al menos ThemeToggle y los triviales (prefer-const, unused-vars) antes del merge a developer.
