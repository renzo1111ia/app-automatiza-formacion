---
title: "6-05 — Tests (unit + integration sandbox)"
status: pending
priority: P2
estimation: 4-10h
phase_id: 6-05
sprint_id: SP-6
branch: feature/sprint-06-ghl-adapter
created: 2026-05-21
---

# Phase 05 — Tests GHL (6-05)

## Context Links

- [plan.md](plan.md) — overview Sprint 6
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-03-gohighlevel-adapter.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 6-01..6-04
- **Descripción:** Unit tests con mocks de axios para componentes aislados + integration tests contra GHL sandbox account. Contract test extendido con GHLAdapter.

## Key Insights

- GHL ofrece sandbox accounts gratis para developers Marketplace
- Mockear axios con `vi.mock('axios')` o MSW
- Tests integration solo si hay `GHL_TEST_ACCESS_TOKEN` en `.env.test`
- Cleanup automático: borrar contacts creados en tests

## Requirements

**Funcionales:**

- Unit tests Adapter, FieldMapper, WebhookVerifier, API client
- Integration tests sandbox: push Contact, push Opp, webhook simulado
- Contract test extendido con GHLAdapter
- Coverage ≥80%

**No funcionales:**

- CI skips integration sin secret
- Cleanup hook
- 0 flakiness

## Architecture

```
src/lib/integrations/ghl/__tests__/
├── ghl-adapter.unit.test.ts
├── ghl-api-client.unit.test.ts
├── ghl-field-mapper.unit.test.ts
├── ghl-webhook-verifier.unit.test.ts
├── ghl-oauth.unit.test.ts
├── ghl-adapter.integration.test.ts
└── fixtures/
    ├── contacts.fixture.ts
    └── webhook-payloads.fixture.ts
```

## Related Code Files

**Crear:**

- `src/lib/integrations/ghl/__tests__/*.test.ts`
- `src/lib/integrations/ghl/__tests__/fixtures/*.ts`

**Modificar:**

- `src/lib/integrations/__tests__/adapter-contract.test.ts`
- `.env.test.example` (`GHL_TEST_*`)

## Implementation Steps

1. Setup sandbox GHL account
2. Generar access_token de test
3. Fixtures contacts + webhook payloads
4. Unit FieldMapper
5. Unit API client (mocks axios)
6. Unit WebhookVerifier (HMAC happy + tampered)
7. Unit OAuth
8. Unit Adapter
9. Integration push Contact
10. Integration push Opportunity
11. Integration webhook simulado (POST manual con HMAC válido)
12. Cleanup teardown
13. Contract test extendido
14. Coverage ≥80%

## Todo List

- [ ] Sandbox GHL account
- [ ] `.env.test.example` con `GHL_TEST_*`
- [ ] Fixtures contacts/webhooks
- [ ] Unit FieldMapper
- [ ] Unit API client
- [ ] Unit WebhookVerifier (HMAC)
- [ ] Unit OAuth
- [ ] Unit Adapter
- [ ] Integration push Contact
- [ ] Integration push Opp
- [ ] Integration webhook simulado
- [ ] Cleanup teardown
- [ ] Contract test extendido
- [ ] Coverage ≥80%

## Success Criteria

- Unit tests verdes
- Integration tests verdes con credenciales configuradas
- Coverage ≥80%
- Contract test pasa para GHLAdapter
- 0 flakiness (3 runs)

## Risk Assessment

| Riesgo                                  | Prob  | Impacto | Mitigación                                          |
| --------------------------------------- | ----- | ------- | --------------------------------------------------- |
| Sandbox limits hit en CI                | Baja  | Medio   | Throttle local tests                                |
| Webhook test simulado no representativo | Media | Bajo    | Test integration real con webhook GHL en E2E manual |

## Security Considerations

- `.env.test` no commiteado
- Datos test sin info personal real
- Sandbox account aislado

## Next Steps

- Habilita 6-06 (cierre)
