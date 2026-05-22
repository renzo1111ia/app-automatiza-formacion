---
title: "5-07 — Tests sandbox (Developer Edition free)"
status: pending
priority: P2
estimation: 6-12h
phase_id: 5-07
sprint_id: SP-5
branch: feature/sprint-05-salesforce-adapter
created: 2026-05-21
---

# Phase 07 — Tests sandbox (5-07)

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md`
- Sprint 2 tests pattern: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-07-tests-sandbox.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 5-01..5-06
- **Descripción:** Suite de tests unit con mocks de jsforce + tests integration contra Salesforce Developer Edition (cuenta free). Cobertura ≥80% en `src/lib/integrations/salesforce/`.

## Key Insights

- Developer Edition free es permanente (no expira como trial) → ideal para CI
- jsforce expone helpers de mock vía `jsforce-mock` (verificar versión compatible) o usar `vi.mock`
- Tests integration: skip si no hay credenciales en `.env.test`
- Cleanup: borrar Leads/Contacts/Opps creados por tests al teardown

## Requirements

**Funcionales:**

- Unit tests Adapter, FieldMapper, ConflictResolver, Connection helper
- Integration tests contra Dev Edition: push Lead, push Contact, push Opp, pull via Outbound Message (simulada), rate limit
- Contract test extendido con SalesforceAdapter
- Coverage ≥80%

**No funcionales:**

- CI skips integration sin secret
- Cleanup automático en teardown
- Idempotent: tests re-ejecutables sin conflicto

## Architecture

```
src/lib/integrations/salesforce/__tests__/
├── salesforce-adapter.unit.test.ts
├── salesforce-field-mapper.unit.test.ts
├── salesforce-connection.unit.test.ts
├── salesforce-oauth.unit.test.ts
├── salesforce-xml-parser.unit.test.ts
├── salesforce-adapter.integration.test.ts
└── fixtures/
    ├── leads.fixture.ts
    └── outbound-messages.fixture.ts
```

## Related Code Files

**Crear:**

- `src/lib/integrations/salesforce/__tests__/salesforce-adapter.unit.test.ts`
- `src/lib/integrations/salesforce/__tests__/salesforce-field-mapper.unit.test.ts`
- `src/lib/integrations/salesforce/__tests__/salesforce-connection.unit.test.ts`
- `src/lib/integrations/salesforce/__tests__/salesforce-oauth.unit.test.ts`
- `src/lib/integrations/salesforce/__tests__/salesforce-xml-parser.unit.test.ts`
- `src/lib/integrations/salesforce/__tests__/salesforce-adapter.integration.test.ts`
- `src/lib/integrations/salesforce/__tests__/fixtures/*.ts`

**Modificar:**

- `src/lib/integrations/__tests__/adapter-contract.test.ts`
- `.env.test.example` (`SF_TEST_*`)

## Implementation Steps

1. Setup Dev Edition account + Connected App for testing
2. Generar refresh_token de test + guardar en `.env.test` local
3. Fixtures: leads, contacts, outbound messages XML
4. Unit tests FieldMapper (todos los defaults)
5. Unit tests Adapter con `vi.mock('jsforce')`
6. Unit tests Connection helper (refresh listener)
7. Unit tests OAuth (happy + revoked)
8. Unit tests XML parser (Outbound Message format)
9. Integration test push Lead
10. Integration test push Contact + Opp
11. Integration test webhook pull simulado
12. Integration test rate limit (simular `REQUEST_LIMIT_EXCEEDED`)
13. Cleanup hook teardown
14. Coverage ≥80% verificado
15. Contract test extendido

## Todo List

- [ ] Dev Edition account creada
- [ ] Connected App configurada para tests
- [ ] `.env.test.example` con `SF_TEST_*`
- [ ] Fixtures leads/contacts/XML
- [ ] Unit FieldMapper
- [ ] Unit Adapter con mocks
- [ ] Unit Connection helper
- [ ] Unit OAuth
- [ ] Unit XML parser
- [ ] Integration push Lead
- [ ] Integration push Contact + Opp
- [ ] Integration webhook pull simulado
- [ ] Integration rate limit
- [ ] Cleanup teardown
- [ ] Coverage ≥80%
- [ ] Contract test extendido

## Success Criteria

- Unit tests verdes con 0 fallos
- Integration tests verdes con credenciales configuradas
- Coverage ≥80% en `src/lib/integrations/salesforce/`
- Contract test pasa para SalesforceAdapter
- 0 flakiness (3 runs verdes)

## Risk Assessment

| Riesgo                         | Prob  | Impacto | Mitigación                                |
| ------------------------------ | ----- | ------- | ----------------------------------------- |
| Dev Edition account suspendida | Baja  | Alto    | Doc setup + backup account                |
| Tests crean datos huérfanos    | Alta  | Bajo    | Cleanup hook obligatorio + script semanal |
| jsforce mock library outdated  | Media | Bajo    | Usar `vi.mock` nativo Vitest              |

## Security Considerations

- `.env.test` NO commiteado
- Refresh token de test con scope mínimo
- Datos de test sin info personal real

## Next Steps

- Habilita 5-08 (cierre sprint)
