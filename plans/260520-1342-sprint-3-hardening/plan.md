---
title: "Sprint 3 — Hardening (v0.4.0 MVP completo)"
description: "Tests E2E, coverage 80%, observabilidad, dashboard costes LLM, WCAG 2.2 AA, hardening CSP/rate-limits, release notes v0.4.0."
status: pending
priority: P1
effort: 116h base (+ 8h cierre = 124h total, bugs variables)
branch: feature/sp-4-hardening
sprint_id: SP-4
version_target: v0.4.0
tags: [testing, e2e, playwright, vitest, coverage, observabilidad, wcag, hardening, csp, rate-limits, llm-costs]
created: 2026-05-20
---

# Sprint 3 — Hardening

> Ref: [RoadMap.md — Fase 3](../RoadMap.md#fase-3--sprint-3-hardening) · [DEEP-FINDINGS-SUMMARY.md](../../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) · [DA-5-accessibility.md](../../docs/audit/deep/DA-5-accessibility.md)

**Prerequisito:** Sprint 2 completo (MVP HubSpot + Zoho funcional). Sprint 3 comienza desde `v0.3.0`.

## Fases

| # | Archivo | Tareas RoadMap | Est. | Estado |
|---|---------|---------------|------|--------|
| 1 | [phase-01-e2e-tests-playwright.md](phase-01-e2e-tests-playwright.md) | 4-01 + 4-02 (parcial) | 28-32h | Pendiente |
| 2 | [phase-02-observabilidad-logging-metricas.md](phase-02-observabilidad-logging-metricas.md) | 4-03 | 12-16h | Pendiente |
| 3 | [phase-03-dashboard-costes-llm.md](phase-03-dashboard-costes-llm.md) | 4-04 | 16-22h | Pendiente |
| 4 | [phase-04-wcag-22-aa.md](phase-04-wcag-22-aa.md) | 4-05 (24 findings DA-5) | 28-40h | Pendiente |
| 5 | [phase-05-hardening-headers-rate-limits.md](phase-05-hardening-headers-rate-limits.md) | 4-06 | 10-14h | Pendiente |
| 6 | [phase-06-documentacion-release-v1.md](phase-06-documentacion-release-v1.md) | 4-07 | 6-8h | Pendiente |
| 7 | [phase-07-cierre-sprint.md](phase-07-cierre-sprint.md) | SP-4-CLOSE-1..5 | 8h + bugs | Pendiente |

**Total desarrollo:** ~100-132h · **Total con cierre:** ~108-140h · **Objetivo:** 116h base

## Dependencias entre fases

```
PREREQUISITO GLOBAL:
  Sprint 2 COMPLETO (v0.3.0) → Todas las fases D

ORDEN ÓPTIMO (1 dev):
  Ph1 (E2E setup) → Ph2 (Observabilidad) → Ph3 (LLM dashboard) →
  Ph4 (WCAG — mayor) → Ph5 (Hardening) → Ph6 (Docs) → Ph7 (Cierre)

PARALELIZABLES (2+ devs):
  Ph1 (E2E) ‖ Ph4 (WCAG) — no comparten archivos
  Ph2 (Observabilidad) ‖ Ph3 (LLM dashboard) — Ph3 depende de tabla llm_usage_logs de Ph2
  Ph5 (Hardening) — independiente, puede hacerse en cualquier momento
  Ph6 (Docs) — solo después de Ph1-Ph5 completas

DEPENDENCIAS INTERNAS:
  Ph2 crea tabla llm_usage_logs → Ph3 lee esa tabla
  Ph1 tests E2E verifican fixes de Ph4 (WCAG modales/teclado)
  Ph5 CSP headers → debe probarse con Ph1 Playwright (sin romper tests)
```

## Solapes con sprints anteriores

| Sprint anterior | Componente reutilizado |
|----------------|----------------------|
| Sprint 0 (SP-1-CLOSE-2) | Playwright setup base (si se instaló en Sprint 0) |
| Sprint 1 (2-30, 2-31) | Componentes shadcn actualizados (WCAG aprovecha) |
| Sprint 1 (2-14..2-18) | Repository pattern (coverage targets aprovecha repos) |
| Sprint 2 | Multi-LLM pipeline existente (dashboard costes usa callbacks) |

## Criterios de éxito del Sprint 3

- [ ] `npx playwright test` → 0 failed (6+ golden path flows)
- [ ] Coverage report → `lines ≥ 80%`, `functions ≥ 80%`
- [ ] Lighthouse a11y score ≥ 90 en todas las rutas del dashboard
- [ ] 0 findings Critical de DA-5 sin resolver
- [ ] CSP headers presentes en todas las rutas (verificar con security headers checker)
- [ ] Rate limiting activo: `/api/auth/*` → 5 req/min; `/api/*` → 100 req/min
- [ ] Dashboard costes LLM visible para admin (tokens por proveedor por tenant)
- [ ] Pino logging activo en API Routes y Workers (logs en stdout con tenant_id)
- [ ] `npm run typecheck` + `lint` + `build` → 0 errores
- [ ] CHANGELOG.md entrada `## [v0.4.0]` completa
- [ ] PR a `developer` con bump v0.4.0

## Tracking de tiempos

Logs en `plans/logs/sprint-4/4-XX.log.md` (misma estructura Sprints 1/2/3).

## Riesgos top-5

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| DA-5-012 (responsive AIAgentInbox) desborda tiempo Ph4 | Alta | Medio | Marcar como P2 dentro de Ph4; cortar si sprint va a >130h |
| CSP `unsafe-inline` necesario para Tailwind rompe política strict | Media | Medio | Aceptar compromiso `unsafe-inline` styles para MVP; strict-dynamic en Sprint 4 |
| Tests E2E flaky por timing (BullMQ async) | Media | Medio | `waitForResponse` + timeouts generosos; retry 2 en CI |
| Coverage 80% inalcanzable sin tests de Workers BullMQ | Media | Alto | Integration tests con Redis local; Vitest + ioredis real |
| Playwright instala Chromium (~200MB) en CI | Baja | Bajo | Cache `~/.cache/ms-playwright` en GitHub Actions |

## Referencias

- RoadMap: `plans/RoadMap.md` líneas 309-347
- DA-5: `docs/audit/deep/DA-5-accessibility.md`
- Deep findings: `docs/audit/deep/DEEP-FINDINGS-SUMMARY.md`
- ADR deps: `plans/reports/adr-auditoria-dependencias-20260520.md`
- Researcher observabilidad: `plans/reports/researcher-observability-d-20260520.md`
- Researcher Playwright: `plans/reports/researcher-playwright-coverage-d-20260520.md`
- Researcher WCAG: `plans/reports/researcher-wcag-hardening-d-20260520.md`
- Sprint 0: `plans/260520-1342-sprint-0-hotfixes-seguridad/plan.md`
- Sprint 1: `plans/260520-1342-sprint-1-capa-datos/plan.md`
