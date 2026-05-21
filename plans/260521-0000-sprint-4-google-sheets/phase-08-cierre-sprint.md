---
title: "SP-4-CLOSE — Cierre Sprint 4"
status: pending
priority: P2
estimation: 6-12h + bugs
phase_id: SP-4-CLOSE
sprint_id: SP-4
branch: feature/sp-4-google-sheets
created: 2026-05-21
---

# Phase 08 — Cierre Sprint 4 (SP-4-CLOSE)

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-07-cierre-sprint.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 4-01..4-07 completos
- **Descripción:** Cierre completo Sprint 4 con auto tests, E2E Playwright, test manual del flujo Sheets, corrección de bugs detectados y PR a `developer` con bump `v0.5.0`.

## Tareas de cierre

### SP-4-CLOSE-1 — Auto test (1h 30min)

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

Todos los tests verdes antes de continuar. Incluye contract test, unit y skip de integration si no hay refresh_token.

### SP-4-CLOSE-2 — Test E2E Playwright (3-4h)

Recorrido completo en navegador:
- [ ] Activar integración Sheets en UI admin → OAuth consent → callback OK
- [ ] Crear spreadsheet desde plantilla → verificar headers
- [ ] Configurar mapping de columnas → guardar
- [ ] Crear lead en Esden → verificar fila en Sheet en <5 min
- [ ] Editar manualmente fila en Sheet → verificar lead actualizado en Esden en <5 min
- [ ] Verificar audit log en UI muestra entries correctas
- [ ] Desconectar integración → token revocado en Google
- [ ] RLS: tenant A no ve conexión de tenant B

### SP-4-CLOSE-3 — Test manual dev (2h)

- [ ] Token expirado → UI muestra "Reconectar"
- [ ] Cuota 429 simulada → retry sin pérdida
- [ ] Canal Drive renovado automáticamente día 6 (forzar reloj o ajustar TTL en test)
- [ ] Conflict resolution R-014 visible en audit
- [ ] Mobile responsive del wizard

### SP-4-CLOSE-4 — Corrección bugs detectados (variable)

Bugs detectados en CLOSE-2 o CLOSE-3 → corregir → re-ejecutar CLOSE-1.

### SP-4-CLOSE-5 — PR + cierre (30min)

- [ ] PR `feature/sp-4-google-sheets` → `developer`
- [ ] Bump versión `package.json` → `v0.5.0`
- [ ] Actualizar `RoadMap.md` (marcar 5-01 / Sprint 4 como completado)
- [ ] Update `docs/project-changelog.md`
- [ ] Tag `v0.5.0` tras merge

## Todo List

- [ ] CLOSE-1 typecheck pass
- [ ] CLOSE-1 lint pass
- [ ] CLOSE-1 build pass
- [ ] CLOSE-1 unit tests pass
- [ ] CLOSE-2 Playwright E2E completo
- [ ] CLOSE-3 test manual completo
- [ ] CLOSE-4 bugs resueltos (0 P1/P2 abiertos)
- [ ] CLOSE-5 PR creado y mergeado
- [ ] CLOSE-5 versión bumped a v0.5.0
- [ ] CLOSE-5 changelog actualizado
- [ ] CLOSE-5 RoadMap actualizado
- [ ] CLOSE-5 Tag v0.5.0

## Estimación

| Tarea | Estimación |
|-------|-----------|
| SP-4-CLOSE-1 Auto test | 1h 30min |
| SP-4-CLOSE-2 E2E Playwright | 3-4h |
| SP-4-CLOSE-3 Test manual | 2h |
| SP-4-CLOSE-4 Bugs | variable |
| SP-4-CLOSE-5 PR + cierre | 30min |
| **Total** | **7-8h + bugs** |

## Success Criteria

- `typecheck` + `lint` + `build` + `test` → 0 errores
- Playwright E2E completo verde
- Audit trail completo en `crm_write_audit` para todas las operaciones del recorrido
- PR mergeado en `developer`
- `v0.5.0` taggeada

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Bugs E2E descubren regresiones tarde | Media | Medio | Reservar buffer de bugs en estimación |
| OAuth refresh token de test expirado en CI | Media | Bajo | Doc para regenerar + alerta visible |

## Security Considerations

- Revisar antes del PR que no haya tokens/secrets en commits
- Verificar `.env*` no commiteado

## Next Steps

- Habilita Sprint 5 (Salesforce) — siguiente integración post-MVP
- Sprint 8 (generalización) sigue bloqueado hasta tener al menos 4 adapters CRM
