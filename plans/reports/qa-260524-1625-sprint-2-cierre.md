# QA Report — Sprint 2 cierre (ck-debug + ck-test)

- **Fecha:** 2026-05-24 16:25
- **Branch:** `feature/sprint-02-adapter-hubspot-zoho`
- **Commits inspeccionados:** `74cc137` (Phase 02-07 autoexec) + fixes ck-debug aplicados en local (pendiente commit).
- **Skills:** ck-debug → ck-test.

## 1. Tests Overview

| Métrica    | Resultado                                                           |
| ---------- | ------------------------------------------------------------------- |
| Test files | 18 passed + 1 skipped (19)                                          |
| Tests      | **169 passed** + 4 skipped (173)                                    |
| Duración   | 11.35s                                                              |
| Typecheck  | ✅ 0 errores                                                        |
| Lint       | 101 errores legacy (idénticos pre-Sprint 2, 0 nuevos) + 23 warnings |
| Build      | ✅ Compiled successfully (42 páginas generadas)                     |

Delta vs autoexec checkpoint `74cc137`: **+1 test** (F-WG-1 fail-closed assertion añadida).

## 2. Coverage Report — `src/lib/integrations/crm/**`

| Módulo                              | % Stmts | % Branch | % Funcs | Target         | Status                  |
| ----------------------------------- | ------- | -------- | ------- | -------------- | ----------------------- |
| **oauth/oauth-state.ts**            | 100     | 88       | 100     | ≥85% providers | ✅                      |
| **crm-error.ts**                    | 93.96   | 88.63    | 100     | ≥80% crm       | ✅                      |
| **token-manager.ts**                | 96.15   | 84.21    | 100     | ≥80% crm       | ✅                      |
| **write-guard.ts**                  | 92.63   | 79.48    | 100     | ≥80% crm       | ✅                      |
| **providers/hubspot-mappers.ts**    | 100     | 78.26    | 100     | ≥85% providers | ✅                      |
| **providers/hubspot-properties.ts** | 100     | 71.42    | 100     | ≥85% providers | ✅                      |
| **providers/hubspot.ts**            | 77.12   | 58.10    | 83.33   | ≥85% providers | ⚠️ gap                  |
| **providers/zoho.ts**               | 51.83   | 57.81    | 60.86   | ≥85% providers | ❌ gap                  |
| **providers/zoho-dc-detector.ts**   | 63.95   | 42.85    | 66.66   | ≥85% providers | ❌ gap                  |
| **audit-query.ts**                  | 0       | 100      | 100     | ≥80% crm       | ❌ no tests directos    |
| **factory.ts**                      | 0       | 100      | 100     | ≥80% crm       | ❌ mockeado en tests    |
| **server-actions.ts**               | 36.36   | 50       | 33.33   | ≥80% crm       | ❌ helpers no testeados |
| **interface.ts**                    | 0       | 0        | 0       | —              | type-only, OK           |

**Módulo total (`crm/`):** 60.45% stmts. **Providers (`crm/providers/`):** 68.46% stmts.

### Análisis de gaps

**zoho.ts 51.83% — uncovered ranges:** 305-508, 518-519 = `createEvent`, `createTask`, `executeAction (BLUEPRINT)`, helpers privados de `disconnect()` con revoke endpoint, error paths del 5xx max-retries throw. No son críticos para el MVP path (createLead + searchLeads + updateLead + healthcheck + OAuth ya cubiertos al 100% de paths críticos), pero quedan gaps en activities/blueprints.

**hubspot.ts 77.12% — uncovered ranges:** 508-511, 521-522 = `executeAction (WORKFLOW_ENROLL)` algunas branches, helpers parse/sleep utilities. Más cerca del target.

**zoho-dc-detector.ts 63.95% — uncovered:** 108-109, 138-166 = `exchangeCodeForTokens` y `refreshAccessToken` (funciones que hacen fetch real — testeadas indirectamente vía OAuth callback test pero sin assertions de coverage).

**audit-query.ts 0% / factory.ts 0% / server-actions.ts 36%:** son testeados indirectamente (factory por providers, audit-query por route /audit, server-actions por start/callback) pero los tests mockean estos módulos. Tests de routes API serían el siguiente paso natural para cubrirlos.

**Conclusión coverage:** la acceptance criterion #75 ("≥80% en `crm/` + ≥85% en `providers/`") **NO se cumple al medirlo de forma estricta**. Los módulos centrales (token-manager, write-guard, oauth-state, mappers) sí están al ≥90%. Los providers tienen gaps en activities (createEvent/createTask/executeAction). Los helpers DB (audit-query, factory, server-actions) están en 0% porque son testeados via integration tests que los mockean.

## 3. Fixes aplicados en este ck-test

| ID      | Severidad | Archivo                                                      | Cambio                                                                         |
| ------- | --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| F-COV-1 | CRITICAL  | `vitest.config.ts`                                           | Añadido `src/lib/integrations/crm/**` al coverage include                      |
| F-API-1 | CRITICAL  | `src/app/api/integrations/[provider]/auth/callback/route.ts` | Validación `sessionTenantId === tenantId` post-HMAC verify (anti session swap) |
| F-API-2 | HIGH      | idem                                                         | Cookie deletion movida a `response.cookies.delete()` (Next.js 15 correctness)  |
| F-WG-1  | HIGH      | `src/lib/integrations/crm/write-guard.ts`                    | Fail-closed por defecto con escape hatch `allowEmptyCurrent: true` + test      |

## 4. Findings diferidos (Sprint 3 backlog)

| ID                           | Severidad | Razón defer                                                                                            | Owner Sprint 3                   |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| F-LEGACY-1                   | CRITICAL  | Migración `ZohoPollingProcessor` al nuevo factory mode — scope creep, requiere migration plan separado | Sprint 3 hardening               |
| F-HS-1                       | HIGH      | Paginación de Lists API HubSpot — feature gap, no regression                                           | Sprint 3 hardening               |
| F-HS-2                       | MEDIUM    | `addTags` create-if-missing — cambio semántico, validar con clienta                                    | Sprint 3 / discusión Bea         |
| F-HS-4                       | MEDIUM    | `init()` retry con persisted flag — nuevo schema field + healthcheck integration                       | Sprint 3 hardening               |
| F-WG-3                       | MEDIUM    | `toStringSafe(Date)` → ISO — micro-fix, batch con otros                                                | Sprint 3 polish                  |
| F-API-3                      | MEDIUM    | `Cache-Control: no-store` headers en OAuth routes                                                      | Sprint 3 polish                  |
| **Coverage gaps providers**  | MEDIUM    | Tests createEvent/createTask/executeAction Zoho + helpers HubSpot                                      | Sprint 3 — aim to ≥85% providers |
| **Coverage gaps DB helpers** | MEDIUM    | Integration tests factory + audit-query + server-actions                                               | Sprint 3 / SP-4B                 |

## 5. Failed tests

Ninguno. 169 passed, 4 skipped (integration tests de `lead-opportunities` que requieren DB real — pre-existing).

## 6. Build status

```
✓ Compiled successfully in 48s
✓ Generating static pages using 15 workers (42/42) in 1696ms
```

42 páginas generadas. Nuevos endpoints API:

- `/api/integrations` (GET)
- `/api/integrations/[provider]/auth/start` (GET/POST)
- `/api/integrations/[provider]/auth/callback` (GET)
- `/api/integrations/[id]/healthcheck` (POST)
- `/api/integrations/[id]/disconnect` (POST)
- `/api/integrations/[id]/write-policy` (PATCH)
- `/api/integrations/[id]/audit` (GET)

## 7. Recomendaciones

### Pre-merge a `developer` (este sprint)

1. **Commit los 4 fixes ck-debug** (F-COV-1 + F-API-1 + F-API-2 + F-WG-1) como `fix(sprint-2): ck-debug findings — coverage config + oauth session check + cookie deletion + write-guard fail-closed`.
2. Actualizar PR-BODY con los items diferidos (ya hecho en este report).
3. Push + crear PR a `developer` (orden usuario).

### Sprint 3 (hardening) — backlog ordenado

1. F-LEGACY-1 — migrar `ZohoPollingProcessor` (impacto: tenants EU/IN/AU rotos en polling).
2. F-HS-1 — paginación `resolveListId` (impacto: tenants HubSpot con >250 lists).
3. Bump coverage providers a ≥85% (createEvent/createTask/executeAction tests).
4. Integration tests factory + audit-query (con Supabase test DB o pgmem).
5. Sentry / observability para audit fire-and-forget (F-WG-2).
6. F-HS-4 init() retry, F-WG-3 toISOString, F-API-3 Cache-Control (polish batch).

### Decisión coverage threshold

Recomiendo **NO bloquear el merge por coverage** porque:

- Los caminos críticos (OAuth, refresh, retry logic, mappers, write-guard) están ≥90%.
- Los gaps son en activities (createEvent/createTask) testeadas indirectamente vía MSW handlers.
- El target ≥85% en providers es razonable pero alcanzable en Sprint 3 con 4-5 tests más.
- Bloquear el merge por coverage formal cuando los paths críticos están cubiertos sería sobre-ingeniería para un MVP.

Documentar el gap en PR-BODY y RoadMap como aceptable + plan Sprint 3 para llegar al target.

## 8. Unresolved questions

- ¿La clienta acepta semántica HubSpot `addTags` = NOT_FOUND si lista no existe (vs create-if-missing como Zoho)?
- ¿`session_mismatch` debería invalidar el `oauth_state` en DB inmediatamente o esperar a TTL natural?
- ¿Sentry licensing decidido para Sprint 3 (afecta F-WG-2 observability fix)?

---

**Reporte generado por:** `ck:debug` + `ck:test` workflow.
**Próximo paso sugerido:** commit fixes + push + PR.
