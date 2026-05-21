---
title: "4-07 — Tests (unit + integration con spreadsheet real)"
status: pending
priority: P2
estimation: 8-14h
phase_id: 4-07
sprint_id: SP-4
branch: feature/sp-4-google-sheets
created: 2026-05-21
---

# Phase 07 — Tests integration (4-07)

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md` (sección Tests)
- Sprint 2 tests pattern: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-07-tests-sandbox.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 4-01..4-06 implementadas
- **Descripción:** Suite completa de tests Sheets — unit con mocks de googleapis para componentes aislados, integration con spreadsheet real de test para flujos completos push/pull, contract test alineado con `IntegrationAdapter` interface.

## Key Insights

- Spreadsheet de test dedicado en Drive de Automatiza (cuenta `qa@`)
- Tests integration corren contra el spreadsheet real (no mocks) — más lentos pero realistas
- Aislamiento: cada test crea su propia copia del template y la borra al final
- Tests OAuth: difícil de automatizar consent — usar refresh_token pre-generado en `.env.test`
- Conflict resolver: ≥6 escenarios cubriendo todos los branches R-014

## Requirements

**Funcionales:**
- Unit tests: SheetsAdapter, FieldMapper, ConflictResolver, OAuth, Template (con mocks googleapis)
- Integration tests con spreadsheet real: push, pull, batch, idempotency, canal renew
- Contract test verificando que `SheetsAdapter implements IntegrationAdapter`
- Coverage mínimo 80% en `src/lib/integrations/sheets/`

**No funcionales:**
- Tests integration se saltan en CI si no hay `GOOGLE_TEST_REFRESH_TOKEN`
- Cleanup automático de spreadsheets de test (delete on teardown)
- No comprometer cuota de producción

## Architecture

```
src/lib/integrations/sheets/__tests__/
├── sheets-adapter.unit.test.ts        — mocks googleapis
├── sheets-field-mapper.unit.test.ts   — pura lógica
├── sheets-conflict-resolver.unit.test.ts — 6+ escenarios R-014
├── sheets-oauth.unit.test.ts          — flow happy + revoked
├── sheets-template.unit.test.ts       — copy + verify
└── sheets-adapter.integration.test.ts — spreadsheet real

src/lib/integrations/__tests__/
└── adapter-contract.test.ts (existente Sprint 2) — añadir SheetsAdapter
```

## Related Code Files

**Crear:**
- `src/lib/integrations/sheets/__tests__/sheets-adapter.unit.test.ts`
- `src/lib/integrations/sheets/__tests__/sheets-field-mapper.unit.test.ts`
- `src/lib/integrations/sheets/__tests__/sheets-conflict-resolver.unit.test.ts`
- `src/lib/integrations/sheets/__tests__/sheets-oauth.unit.test.ts`
- `src/lib/integrations/sheets/__tests__/sheets-template.unit.test.ts`
- `src/lib/integrations/sheets/__tests__/sheets-adapter.integration.test.ts`
- `src/lib/integrations/sheets/__tests__/fixtures/leads.fixture.ts`

**Modificar:**
- `src/lib/integrations/__tests__/adapter-contract.test.ts`
- `.env.test.example` (añadir `GOOGLE_TEST_REFRESH_TOKEN`, `GOOGLE_TEST_SPREADSHEET_TEMPLATE_ID`)

## Implementation Steps

1. Crear fixtures de leads de test
2. Unit tests SheetsAdapter con mocks `googleapis`
3. Unit tests FieldMapper (todas las direcciones lead↔row)
4. Unit tests ConflictResolver (6+ escenarios R-014)
5. Unit tests OAuth (happy path, expired, revoked)
6. Unit tests Template (copy OK, copy fail, verify headers)
7. Setup integration: refresh_token de test en `.env.test`
8. Integration test push: crear lead → ver fila en spreadsheet
9. Integration test pull: editar fila → ver lead actualizado
10. Integration test idempotency: push duplicado no crea fila duplicada
11. Integration test batch: 100 leads en una sola llamada
12. Cleanup hook teardown (delete spreadsheet test)
13. Añadir SheetsAdapter al `adapter-contract.test.ts`
14. Verificar coverage ≥80%

## Todo List

- [ ] Fixtures `leads.fixture.ts`
- [ ] `sheets-adapter.unit.test.ts`
- [ ] `sheets-field-mapper.unit.test.ts`
- [ ] `sheets-conflict-resolver.unit.test.ts` (6 escenarios)
- [ ] `sheets-oauth.unit.test.ts`
- [ ] `sheets-template.unit.test.ts`
- [ ] `.env.test.example` actualizado
- [ ] Integration test push
- [ ] Integration test pull
- [ ] Integration test idempotency
- [ ] Integration test batch
- [ ] Integration test canal renew
- [ ] Cleanup hook teardown
- [ ] Contract test extendido con Sheets
- [ ] Coverage ≥80% verificado
- [ ] CI marker para skip integration sin secret

## Success Criteria

- `npm run test` pasa con 0 fallos en unit
- `npm run test:integration` pasa con 0 fallos cuando hay refresh_token configurado
- Coverage Sheets >= 80%
- ConflictResolver tests cubren los 6 escenarios R-014 documentados
- 0 tests flaky (3 runs consecutivas verdes)

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Refresh token de test expira | Media | Medio | Doc en README cómo regenerar; alerta si test integration falla con 401 |
| Tests flaky por latencia Drive | Media | Medio | Polling con timeout 30s + retries 3 |
| Spreadsheets de test acumulándose | Alta | Bajo | Cleanup hook obligatorio + script `npm run cleanup:test-sheets` semanal |
| Cuota Drive del test account agotada | Baja | Medio | Throttle local tests + monitoring uso |

## Security Considerations

- `.env.test` NO commiteado a git
- Refresh token de test con scope mínimo
- Spreadsheets de test en carpeta Drive aislada `qa-sheets-tests/`

## Next Steps

- Habilita 4-08 (cierre sprint) — todos los tests verdes son prerequisito
