---
title: "7-06 — Tests + Cierre Sprint 7"
status: pending
priority: P2
estimation: 4-10h + bugs
phase_id: 7-06
sprint_id: SP-7
branch: feature/sp-7-activecampaign-adapter
created: 2026-05-21
---

# Phase 06 — Tests + Cierre Sprint 7 (SP-7-CLOSE)

## Context Links

- [plan.md](plan.md) — overview Sprint 7
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-04-activecampaign-adapter.md`
- Sprint 2 cierre pattern: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-08-cierre-sprint.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 7-01..7-05
- **Descripción:** Fase combinada de tests (unit + integration con AC trial) y cierre del Sprint 7 con E2E Playwright, bugs y PR a `developer` con bump `v0.5.3`.

## Tests

### Tests unit (1-2h)

- ACAdapter mocks axios
- FieldMapper
- WebhookRegistrar (token HMAC)
- API client
- Auth validator

### Tests integration (1-2h)

Contra AC trial account (skip si no hay `AC_TEST_*`):
- Push contact via `contact/sync`
- Apply tags
- Upsert deal
- Trigger automation
- Webhook pull simulado (POST manual con token válido)

### Contract test (30min)

- Extender `adapter-contract.test.ts` con ACAdapter

### Coverage objetivo

- ≥80% en `src/lib/integrations/activecampaign/`

## Cierre

### SP-7-CLOSE-1 — Auto test (1h)

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

### SP-7-CLOSE-2 — E2E Playwright (1-2h)

- [ ] Form API Key + Account URL → test connection OK
- [ ] Pipeline + mapping configurado
- [ ] Lead Esden → Contact AC < 2 min
- [ ] Matrícula → Deal en pipeline AC
- [ ] Tags aplicados
- [ ] Webhook simulado → lead actualizado
- [ ] Audit log entries
- [ ] Desconectar elimina webhook en AC

### SP-7-CLOSE-3 — Test manual dev (30min-1h)

- [ ] Rate limit 5 req/s no se excede (sync masivo)
- [ ] API Key inválida → error UI claro
- [ ] Webhook token tampered → rechazado

### SP-7-CLOSE-4 — Corrección bugs (variable)

### SP-7-CLOSE-5 — PR + cierre (30min)

- [ ] PR `feature/sp-7-activecampaign-adapter` → `developer`
- [ ] Bump `v0.5.3`
- [ ] Update RoadMap + changelog
- [ ] Tag `v0.5.3`

## Related Code Files

**Crear:**
- `src/lib/integrations/activecampaign/__tests__/*.test.ts`
- `src/lib/integrations/activecampaign/__tests__/fixtures/*.ts`

**Modificar:**
- `src/lib/integrations/__tests__/adapter-contract.test.ts`
- `.env.test.example` (`AC_TEST_*`)
- `package.json` (bump version)

## Todo List

- [ ] Unit ACAdapter
- [ ] Unit FieldMapper
- [ ] Unit WebhookRegistrar
- [ ] Unit API client
- [ ] Unit Auth validator
- [ ] Integration push contact
- [ ] Integration tags
- [ ] Integration deal
- [ ] Integration automation
- [ ] Integration webhook simulado
- [ ] Contract test extendido
- [ ] Coverage ≥80%
- [ ] CLOSE-1 typecheck/lint/build/test
- [ ] CLOSE-2 Playwright E2E
- [ ] CLOSE-3 test manual
- [ ] CLOSE-4 bugs
- [ ] CLOSE-5 PR mergeado
- [ ] CLOSE-5 v0.5.3 taggeada

## Success Criteria

- Tests verdes 100%
- Coverage ≥80%
- Playwright E2E completo verde
- PR mergeado en `developer`
- `v0.5.3` taggeada

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| AC trial limits hit | Media | Bajo | Account dedicada |
| Bug late discovery | Baja | Medio | Buffer estimación |
| Webhook test simulado no representativo | Media | Bajo | Test E2E manual real |

## Security Considerations

- No secrets en commits
- `.env.test` ignored

## Next Steps

- Sprint 8 (generalización) ya tiene 4 adapters listos (HubSpot/Zoho de Sprint 2 + GHL Sprint 6 + AC Sprint 7) — desbloqueado parcialmente
- Sprint 5 (Salesforce) + Sprint 4 (Sheets) son CRMs adicionales si quieres alcanzar 6 adapters antes de generalizar
