# Fase 06 — Tests + cierre del sprint (CLOSE-1/1.5/2/4/5)

**Contexto:** [plan.md](plan.md) · protocolo `CLAUDE.md § "Phase/Sprint Completion Protocol"` + `plans/RoadMap.md § "Protocolo estándar de cierre"`

## Overview

- **Prioridad:** P1
- **Estado:** 🔘 Pendiente · depende de Fases 01-05b
- **Estimación:** 2-3h
- Tests unitarios del webhook/event-processor/mapper/writeback + protocolo de cierre estándar + bump SemVer a `v0.5.0`. **Foco event-driven:** tests del webhook entrante (validación token, encolado, dedup) + idempotencia.

## Key Insights

- Reutilizar el aprendizaje del cierre Sprint 4: mock de repositorios con **clases reales** (Vitest 4 no acepta `vi.fn().mockImplementation()` con `new`).
- El flujo E2E real con Zoho requiere un tenant con OAuth Zoho activo (entorno de pruebas). Si no está disponible, los tests unitarios + E2C de control de acceso cubren CLOSE-1/2; el E2E real se difiere igual que se hizo en Sheets.
- Security delta CLOSE-1.5 debe verificar específicamente: RLS de las 3 tablas nuevas, cron fail-closed, anti-bucle, PII en logs.

## Requirements

**Funcionales:** tests de `lead-mapper` (mapeo Zoho→AF + normalización stages), `pull-processor` (idempotencia, autorelleno, orchestrator), `outbox-processor` Zoho (claim, audit, retry).

**No funcionales:** typecheck 0, lint 0, build OK, suite verde. E2C Playwright de control de acceso (página exige auth, cron fail-closed).

## Related Code Files

**Crear:**

- `tests/unit/zoho-pull/lead-mapper.test.ts` (mapeo Zoho→AF + normalización stages)
- `tests/unit/zoho-pull/event-processor.test.ts` (getLead → upsert idempotente + autorelleno)
- `tests/unit/zoho-pull/outbox.test.ts` (writeback, mock con clases reales — Vitest 4)
- `tests/unit/zoho-pull/webhook.test.ts` (valida token, encola, dedup, 403 si token inválido)
- `tests/e2e/sprint-5-close/zoho-access-control.spec.ts` (página exige auth + **webhook rechaza token inválido** + cron fail-closed)

**Actualizar:**

- `package.json` → bump `0.4.0` → `0.5.0`
- `CHANGELOG.md` → entrada `[0.5.0]`
- `plans/RoadMap.md` → Sprint 5 🟢 + cuadro de mando + frontmatter (vía sistema generate-readmes)

## Implementation Steps — Protocolo de cierre

1. **CLOSE-1 (Auto test)**: `npm run typecheck && npm run lint && npm run build && npm test`. Verde obligatorio.
2. **CLOSE-1.5 (Security delta OWASP 2021)**: delta sobre `src/lib/integrations/zoho-pull/*` + migraciones + cron + UI. Verificar: RLS multi-tenant de las 3 tablas, cron fail-closed, anti-bucle, PII enmascarada, IDOR cross-tenant. Report en `plans/reports/security-delta-sprint-5-<fecha>.md`. Críticos bloquean.
3. **CLOSE-2 (E2C Playwright local)**: servidor `localhost:8500`, specs `sprint-5-close/` (control de acceso). Si hay tenant Zoho de pruebas → recorrer flujo pull/writeback.
4. **CLOSE-4 (fix bugs)**: corregir lo detectado en CLOSE-1/1.5/2, re-run.
5. **CLOSE-5**: bump `v0.5.0` + CHANGELOG + RoadMap (Sprint 5 🟢, regenerar READMEs) + push `feature/sprint-05-zoho-entrada-leads` + PR a `developer` (sin merge sin orden) + tag `v0.5.0` tras OK usuario.

## Todo List

- [ ] Tests unitarios lead-mapper + pull-processor + outbox (clases reales Vitest 4)
- [ ] Spec E2C control de acceso `sprint-5-close/`
- [ ] CLOSE-1 verde (typecheck/lint/build/test)
- [ ] CLOSE-1.5 security delta (0 críticos)
- [ ] CLOSE-2 E2C verde
- [ ] CLOSE-4 bugs corregidos
- [ ] CLOSE-5 bump v0.5.0 + CHANGELOG + RoadMap + READMEs + push + PR

## Success Criteria

- Suite completa verde (typecheck 0, lint 0, build OK, tests passing).
- Security delta sin críticos.
- E2C control de acceso verde.
- `v0.5.0` en package.json + CHANGELOG + RoadMap Sprint 5 🟢.
- PR a developer abierto (merge solo con orden del usuario).

## Risk Assessment

- **E2E real Zoho no disponible**: si no hay tenant Zoho de pruebas, documentar el flujo manual y diferir el E2E real (igual que Sprint 4 difirió a OAuth real). No bloquea CLOSE-1/2.

## Security Considerations

- Security delta es **obligatorio y proactivo** (CLOSE-1.5) — foco en RLS multi-tenant y anti-bucle.

## Next Steps

- Tras merge a developer: actualizar memoria persistente + considerar webhook Zoho entrante como mejora (backlog).
