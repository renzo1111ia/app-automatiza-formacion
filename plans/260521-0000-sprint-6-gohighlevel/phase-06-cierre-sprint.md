---
title: "SP-6-CLOSE — Cierre Sprint 6"
status: pending
priority: P2
estimation: 4-12h + bugs
phase_id: SP-6-CLOSE
sprint_id: SP-6
branch: feature/sp-6-ghl-adapter
created: 2026-05-21
---

# Phase 06 — Cierre Sprint 6 (SP-6-CLOSE)

## Context Links

- [plan.md](plan.md) — overview Sprint 6
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-07-cierre-sprint.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 6-01..6-05
- **Descripción:** Cierre del Sprint 6 con tests, E2E Playwright, test manual, bugs y PR a `developer` con bump `v0.5.2`.

## Tareas de cierre

### SP-6-CLOSE-1 — Auto test (1h)

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

### SP-6-CLOSE-2 — Test E2E Playwright (2-3h)

- [ ] OAuth → callback → locationId mostrado correctamente
- [ ] Mapping pipeline + stages configurado
- [ ] Lead Esden → Contact GHL < 5 min
- [ ] Matrícula → Opportunity en pipeline correcto
- [ ] Webhook simulado → lead actualizado (HMAC verified)
- [ ] Audit log entries completas
- [ ] Desconectar revoca token
- [ ] RLS multi-tenant

### SP-6-CLOSE-3 — Test manual dev (1-2h)

- [ ] Token expirado → refresh automático
- [ ] Rate limit 90 req/10s no genera 429
- [ ] HMAC tampered → webhook rechazado 401
- [ ] Custom fields mapping aplicado correctamente

### SP-6-CLOSE-4 — Corrección bugs

### SP-6-CLOSE-5 — PR + cierre (30min)

- [ ] PR `feature/sp-6-ghl-adapter` → `developer`
- [ ] Bump `v0.5.2`
- [ ] Update RoadMap + changelog
- [ ] Tag `v0.5.2`

## Todo List

- [ ] CLOSE-1 todos los autotests pass
- [ ] CLOSE-2 Playwright E2E completo
- [ ] CLOSE-3 test manual completo
- [ ] CLOSE-4 bugs cerrados
- [ ] CLOSE-5 PR mergeado
- [ ] CLOSE-5 v0.5.2 taggeada

## Estimación

| Tarea | Estimación |
|-------|-----------|
| CLOSE-1 | 1h |
| CLOSE-2 | 2-3h |
| CLOSE-3 | 1-2h |
| CLOSE-4 | variable |
| CLOSE-5 | 30min |
| **Total** | **4-7h + bugs** |

## Success Criteria

- `typecheck` + `lint` + `build` + `test` → 0 errores
- Playwright E2E completo verde
- Audit trail completo
- PR mergeado
- `v0.5.2` taggeada

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Sandbox GHL limits hit | Baja | Bajo | Account dedicada |
| Bug late discovery | Media | Medio | Buffer en estimación |

## Security Considerations

- No secrets en commits

## Next Steps

- Habilita Sprint 7 (ActiveCampaign)
- Sprint 8 bloqueado hasta tener 4 adapters
