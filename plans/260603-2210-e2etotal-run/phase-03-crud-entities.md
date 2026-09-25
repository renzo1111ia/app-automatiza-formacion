# Fase 03 — CRUD por entidad

- **Env**: vps
- **Estado**: 🟡 PARTIAL (por diseño del protocolo del proyecto — ver nota)
- **Método**: navegación UI autenticada (no destructiva) + suite Vitest backend completa.

## Nota de alcance (regla CLAUDE.md)

CRUD UI exhaustivo (Create/Update/Delete reales en VPS) está **diferido a SP-4B** por protocolo del proyecto, y NO se ejecuta destructivo contra VPS producción compartida (regla append-only + spirit `--vps-readonly`). El cierre real de Fase 03 es la cobertura **backend por tests** + **navegación/read UI**. Mismo criterio que el run 29-05.

## Navegación UI autenticada (Playwright overview 2B — 18/18 verde, 1.7min)

Recorrido del dashboard autenticado contra VPS:

| Check                                                          | Resultado |
| -------------------------------------------------------------- | --------- |
| 2B-01 /dashboard sin sesión → /login                           | 🟢        |
| 2B-02 Login admin → /dashboard carga                           | 🟢        |
| 2B-03 OverviewSection 'Resumen general'                        | 🟢        |
| 2B-04 4 KPI cards hero                                         | 🟢        |
| 2B-05..07 botones personalizar + donut canal + WCAG chart aria | 🟢        |
| 2B-08 **0 console errors críticos** /dashboard completo        | 🟢        |
| 2B-09 FilterBar 'Hoy' recarga KPIs                             | 🟢        |
| 2B-10/11 Summary + Funnel sin regresión                        | 🟢        |
| 2B-12/13 donut datos + edit mode DnD                           | 🟢        |
| 2B-14 navegación /dashboard ↔ /settings sin romper             | 🟢        |
| 2B-15 GET /api/integrations (no regresión Sprint 2)            | 🟢        |
| 2B-16/17/18 h1 únicos + labels distintos + 3 charts con datos  | 🟢        |

## Backend CRUD (suite Vitest — 306/310 pass, 4 skipped, 0 fail)

Cobertura de las 12 entidades vía 33 test files: HubSpot/Zoho mappers, token-crypto AES-256, repository pattern, write-guard append-only, validaciones Zod, rate-limiter, RLS helpers.

**Bug detectado + fixeado in-session**: `E2E-260603-001-LOW` — test flaky `token-crypto authTag tamper` (no-op cuando authTag empezaba por `0`, ~1/16). Fix determinista (XOR nibble). 10/10 runs verde post-fix. **NO era bug de seguridad** — el código GCM valida authTag correctamente.

## Resultado

🟡 **PARTIAL** (por diseño): UI read 18/18 + backend 306/310 (100% de los no-skipped). CRUD UI mutante diferido a SP-4B. 1 bug LOW cerrado. Sin fallos reales pendientes.
