---
title: "SP-8-CLOSE — Cierre Sprint 8"
status: pending
priority: P3
estimation: 2-4h + bugs
phase_id: SP-8-CLOSE
sprint_id: SP-8
branch: feature/sp-8-adapter-generalization
created: 2026-05-21
---

# Phase 05 — Cierre Sprint 8 (SP-8-CLOSE)

## Context Links

- [plan.md](plan.md) — overview Sprint 8
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-07-cierre-sprint.md`

## Overview

- **Prioridad:** P3
- **Estado:** Pendiente — requiere 8-01..8-04
- **Descripción:** Cierre del refactor con tests, verificación de 0 regresiones, smoke test E2E rápido y PR a `developer` con bump `v0.5.4` (patch).

## Tareas de cierre

### SP-8-CLOSE-1 — Auto test (1h)

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run test:contract  # adapter.contract.test.ts
```

### SP-8-CLOSE-2 — Smoke E2E (1-2h)

Como Sprint 8 es refactor puro, el smoke test E2E es ligero:
- [ ] HubSpot: push 1 lead → verificar Contact en HubSpot
- [ ] Zoho: push 1 lead → verificar Lead en Zoho
- [ ] Sheets (si productivo): push 1 lead → verificar fila
- [ ] Salesforce (si productivo): push 1 lead → verificar Lead
- [ ] GHL (si productivo): push 1 lead → verificar Contact
- [ ] AC (si productivo): push 1 lead → verificar Contact

### SP-8-CLOSE-3 — Verificación 0 regresiones (30min-1h)

- [ ] Comparar resultados de tests antes y después del refactor
- [ ] Verificar audit log entries se siguen escribiendo igual
- [ ] Verificar `crm_write_audit` schema sin cambios

### SP-8-CLOSE-4 — Corrección bugs detectados (variable)

### SP-8-CLOSE-5 — PR + cierre (30min)

- [ ] PR `feature/sp-8-adapter-generalization` → `developer`
- [ ] Bump `package.json` → `v0.5.4` (patch refactor)
- [ ] Update `RoadMap.md` (Sprint 8 done)
- [ ] Update `docs/project-changelog.md` con sección "Refactor"
- [ ] Tag `v0.5.4`

## Todo List

- [ ] CLOSE-1 typecheck/lint/build/test pass
- [ ] CLOSE-1 contract test pass para N adapters
- [ ] CLOSE-2 smoke push test por adapter productivo
- [ ] CLOSE-3 0 regresiones verificadas
- [ ] CLOSE-4 bugs resueltos
- [ ] CLOSE-5 PR creado y mergeado
- [ ] CLOSE-5 v0.5.4 taggeada
- [ ] CLOSE-5 changelog "Refactor" actualizado
- [ ] CLOSE-5 RoadMap actualizado

## Estimación

| Tarea | Estimación |
|-------|-----------|
| CLOSE-1 Auto test | 1h |
| CLOSE-2 Smoke E2E | 1-2h |
| CLOSE-3 Verif regresiones | 30min-1h |
| CLOSE-4 Bugs | variable |
| CLOSE-5 PR + cierre | 30min |
| **Total** | **3-5h + bugs** |

## Success Criteria

- `typecheck` + `lint` + `build` + `test` + `test:contract` → 0 errores
- Smoke E2E verde por adapter
- 0 regresiones funcionales
- PR mergeado en `developer`
- `v0.5.4` taggeada como patch refactor

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Smoke E2E descubre regresión sutil | Baja | Alto | Tests granulares en 8-03 deberían haber pillado antes |
| Algún adapter productivo perdió tests | Baja | Medio | Verificar coverage no decrece >2pp |

## Security Considerations

- No secrets en commits
- Verificar AdapterError no expone tokens en logs

## Next Steps

- Habilita Sprint 9 (Tier 2 backlog) — añadir nuevos CRMs ahora cuesta ~40% menos
- Hito: 6 adapters productivos + base genérica = MVP integraciones completo
