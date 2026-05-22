# ADR-016 — Upgrade `@supabase/ssr` 0.8.0 → 0.10.3 + `@supabase/supabase-js` 2.97.0 → 2.106.1

| Campo   | Valor                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Fecha   | 22-05-2026                                                                                                                 |
| Autor   | Javi HP                                                                                                                    |
| Sprint  | Sprint 1 — Bloque 2.1 (tarea 2-02.a)                                                                                       |
| Estado  | ✅ Aceptado                                                                                                                |
| Origen  | RoadMap §Bloque 2.1 + `plans/reports/adr-auditoria-dependencias-20260520.md` + audit Renzo V1 (estabilidad cookie session) |
| Bloquea | 2-02.b (refactor DI services) y 2-03 (cleanup service_role residuales)                                                     |

## Contexto

El proyecto usa `@supabase/ssr@^0.8.0` + `@supabase/supabase-js@^2.97.0`. Ambas tienen versiones más recientes (0.10.3 y 2.106.1) que incluyen:

### Cambios `@supabase/ssr` 0.8 → 0.10

- **0.9.0**: Soporte `cookies()` Next.js 15+ async (alineación con App Router moderno).
- **0.10.0**: Renombrado de `CookieOptions` interface; refactor de `createServerClient` y `createBrowserClient` para mejor inferencia de tipos.
- **0.10.3**: Bug fixes en cookie storage adapter, especialmente cuando hay multiples instancias en el mismo request (middleware + server action concurrente).

### Cambios `@supabase/supabase-js` 2.97 → 2.106

- 9 minor releases con bug fixes acumulados en realtime, auth refresh tokens, storage upload retries.
- Peer dep alineada con `@supabase/ssr` 0.10.x (no se puede subir uno sin el otro).
- Sin breaking changes en la API pública para nuestro uso (queries básicas, RLS, auth).

### Por qué hacerlo ahora (Sprint 1)

- Sprint 1 Bloque 2.1 lo prevé como pre-requisito de 2-02.b (refactor DI services).
- Renzo V1 menciona que el flujo de sesión es estable, pero el upgrade trae fixes en cookie storage que cierran corner-cases en middleware concurrente (relevante con las nuevas Server Actions del widget chatbot 1-27).
- Movimiento ligero (semver minor, no major) — bajo riesgo si tests pasan.

## Decisión

Upgrade conjunto:

```json
"@supabase/ssr": "^0.10.3",
"@supabase/supabase-js": "^2.106.1"
```

### Justificación del semver "^"

`^0.10.3` permite `0.10.x` y `0.11.x` futuros sin breaking (Supabase respeta semver para minor releases en SSR a partir de 0.10). `^2.106.1` permite `2.x.y` futuros. Lockfile fija la versión exacta usada en local + CI.

## Implementación

### Paso 1 — Inventario de uso

`@supabase/ssr` se usa en (verificado con grep):

- `src/lib/supabase/server.ts` — `createServerClient` con cookie adapter Next.js.
- `src/lib/supabase/client.ts` — `createBrowserClient` para el cliente browser.
- `src/middleware.ts` — `createServerClient` para session refresh en middleware.

`@supabase/supabase-js` (createClient con SERVICE_ROLE) se usa en 8 puntos identificados en el audit 2-01 (cron, webhooks, workers).

### Paso 2 — Upgrade (1 comando)

```bash
npm install @supabase/ssr@0.10.3 @supabase/supabase-js@2.106.1
```

### Paso 3 — Verificación typecheck + build

```bash
npm run typecheck
npm run build
```

### Paso 4 — Test auth flow manual

- `npm run dev` + login admin → debe redirigir a `/dashboard`.
- Refresh página → la sesión persiste.
- Logout → redirige a `/login` (verificado por test E2E `smoke-flows.spec.ts SF-05`).

### Paso 5 — Cookie API check

Si la API de `CookieOptions` cambia, ajustar el adapter en `src/lib/supabase/server.ts`. Verificación: typecheck post-upgrade debe pasar sin errores.

## Consecuencias

### Positivas

- ✅ Estabilidad cookie storage en escenarios concurrentes (middleware + server action).
- ✅ Alineación con la versión que requiere Next.js 16 App Router (no rompe pero deja la puerta abierta a usar `cookies()` async cuando convenga).
- ✅ 9 minor releases acumulados de bug fixes en realtime, auth, storage.

### Negativas / aceptadas

- ⚠️ Si el adapter de cookie de SSR 0.10 cambió la API → ajuste menor en `src/lib/supabase/server.ts`. Plan B: mantener 0.9.x si 0.10 introduce regresión inesperada (downgrade reversible vía git).
- ⚠️ Test exhaustivo del auth flow es manual (cubierto parcialmente por E2E Playwright `smoke-flows.spec.ts`).

## Test plan

- ✅ `npm run typecheck` post-install — 0 errores.
- ✅ `npm run build` post-install — 41 rutas compilan.
- ✅ `npm run test:e2e` — 24/24 tests pasan (16 security gates + smoke flows + smoke baseline).
- 🟡 Smoke manual en local: login admin/viewer, refresh sesión, logout.

## Referencias

- ADR auditoría dependencias: `plans/reports/adr-auditoria-dependencias-20260520.md` §Sprint 1
- Audit clientes Supabase: `plans/reports/sp-2-01-audit-clients-supabase-20260522.md`
- Phase Sprint 1: `plans/260520-1342-sprint-1-capa-datos/phase-01-unificacion-cliente-supabase.md`
- Changelog Supabase SSR: https://github.com/supabase/ssr/releases
- Changelog Supabase JS: https://github.com/supabase/supabase-js/releases
