---
title: "SP-5-CLOSE — Cierre Sprint 5"
status: pending
priority: P2
estimation: 4-10h + bugs
phase_id: SP-5-CLOSE
sprint_id: SP-5
branch: feature/sp-5-salesforce-adapter
created: 2026-05-21
---

# Phase 08 — Cierre Sprint 5 (SP-5-CLOSE)

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-07-cierre-sprint.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 5-01..5-07
- **Descripción:** Cierre del Sprint 5 con auto tests, E2E Playwright contra sandbox, test manual, corrección de bugs y PR a `developer` con bump `v0.5.1`.

## Tareas de cierre

### SP-5-CLOSE-1 — Auto test (1h)

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

### SP-5-CLOSE-2 — Test E2E Playwright (2-3h)

- [ ] Toggle sandbox → OAuth → callback → instance_url confirmado
- [ ] Configurar mode Lead → mapping → guardar
- [ ] Crear lead Esden → ver Lead en sandbox SF < 5 min
- [ ] Crear matrícula → ver Opportunity en SF
- [ ] Simular Outbound Message (POST manual) → ver lead actualizado en Esden
- [ ] Audit log muestra entries con `sf_environment='sandbox'`
- [ ] Desconectar → token revocado en SF
- [ ] RLS: tenant A no ve conexión tenant B

### SP-5-CLOSE-3 — Test manual dev (1-2h)

- [ ] Token expirado → refresh automático funciona
- [ ] `REQUEST_LIMIT_EXCEEDED` simulado → queue pausado + alerta
- [ ] Workflow Rule docs siguibles para admin SF
- [ ] Switch sandbox → prod requiere reconectar (no mezclar)

### SP-5-CLOSE-4 — Corrección bugs (variable)

### SP-5-CLOSE-5 — PR + cierre (30min)

- [ ] PR `feature/sp-5-salesforce-adapter` → `developer`
- [ ] Bump `package.json` → `v0.5.1`
- [ ] Update `RoadMap.md` (5-02 / Sprint 5 done)
- [ ] Update `docs/project-changelog.md`
- [ ] Tag `v0.5.1`

## Todo List

- [ ] CLOSE-1 typecheck/lint/build/test pass
- [ ] CLOSE-2 Playwright E2E completo
- [ ] CLOSE-3 test manual completo
- [ ] CLOSE-4 bugs cerrados (0 P1/P2)
- [ ] CLOSE-5 PR creado y mergeado
- [ ] CLOSE-5 v0.5.1 taggeada
- [ ] CLOSE-5 changelog actualizado
- [ ] CLOSE-5 RoadMap actualizado

## Estimación

| Tarea | Estimación |
|-------|-----------|
| SP-5-CLOSE-1 | 1h |
| SP-5-CLOSE-2 | 2-3h |
| SP-5-CLOSE-3 | 1-2h |
| SP-5-CLOSE-4 | variable |
| SP-5-CLOSE-5 | 30min |
| **Total** | **4-7h + bugs** |

## Success Criteria

- `typecheck` + `lint` + `build` + `test` → 0 errores
- Playwright E2E completo verde con sandbox
- Audit trail completo en `crm_write_audit`
- PR mergeado en `developer`
- `v0.5.1` taggeada

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Bugs E2E descubren regresiones tarde | Media | Medio | Reservar buffer en estimación |
| Dev Edition limit hit en E2E | Baja | Medio | Usar account dedicada con cuota fresca |

## Security Considerations

- Verificar no secrets en commits
- `.env.test` no commiteado

## Next Steps

- Habilita Sprint 6 (GHL)
- Sprint 8 sigue bloqueado (espera 4 adapters)
