---
title: "8-04 — Docs (ADR) + contract test + verificar 0 regresiones"
status: pending
priority: P3
estimation: 3-6h
phase_id: 8-04
sprint_id: SP-8
branch: feature/sprint-08-adapter-generalization
created: 2026-05-21
---

# Phase 04 — Docs + contract test (8-04)

## Context Links

- [plan.md](plan.md) — overview Sprint 8
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-05-adapter-pattern-generalization.md`
- [phase-03](phase-03-factory-refactor-adapters.md) — adapters ya refactorizados

## Overview

- **Prioridad:** P3
- **Estado:** Pendiente — requiere 8-03
- **Descripción:** Escribir ADR documentando decisiones de la interfaz, crear `adapter.contract.test.ts` único que verifica todos los adapters, ejecutar test full suite y verificar 0 regresiones.

## Key Insights

- ADR debe documentar: por qué interfaz estrecha, qué es opcional y por qué, qué NO se generalizó
- Contract test: una sola suite que ejecuta los mismos asserts contra cada adapter
- Útil para añadir Tier 2 adapters (Sprint 9) con bajo esfuerzo

## Requirements

**Funcionales:**

- ADR `adr-adapter-pattern-generalization-{date}.md`
- `adapter.contract.test.ts` que verifica:
  - Cada adapter implementa todos los métodos core
  - `testConnection()` retorna shape correcto
  - `upsertContact()` aplica write policy correctamente
  - Errors thrown son `AdapterError` subclasses
  - FieldMapper se usa consistentemente
- Verificar 0 regresiones en suite completo

**No funcionales:**

- Doc en español + ejemplos de código
- Contract test usa mocks (no llama APIs reales)

## Architecture

```
plans/reports/
  └── adr-adapter-pattern-generalization-{YYYYMMDD}.md

src/lib/integrations/__tests__/
  └── adapter.contract.test.ts

  describe.each([
    ['hubspot', HubSpotAdapter, hubspotMocks],
    ['zoho', ZohoAdapter, zohoMocks],
    ['sheets', SheetsAdapter, sheetsMocks],
    ['salesforce', SalesforceAdapter, salesforceMocks],
    ['ghl', GHLAdapter, ghlMocks],
    ['activecampaign', ACAdapter, acMocks],
  ])('IntegrationAdapter contract — %s', (name, AdapterClass, mocks) => {
    test('implements all core methods', () => { ... });
    test('testConnection returns { ok, error? }', () => { ... });
    test('upsertContact applies append_only policy', () => { ... });
    test('upsertContact applies overwrite_with_audit policy', () => { ... });
    test('throws AuthError on 401', () => { ... });
    test('throws RateLimitError on 429', () => { ... });
    test('throws NotFoundError on 404', () => { ... });
  });
```

## Related Code Files

**Crear:**

- `plans/reports/adr-adapter-pattern-generalization-{YYYYMMDD}.md`
- `src/lib/integrations/__tests__/adapter.contract.test.ts`
- `src/lib/integrations/__tests__/mocks/*-mock.ts` (uno por CRM)

## Implementation Steps

1. Escribir ADR:
   - Contexto (4-6 adapters productivos)
   - Decisión (interfaz estrecha + métodos opcionales)
   - Alternativas consideradas (rechazadas)
   - Consequences (positivas + negativas)
2. Crear mocks reutilizables por CRM
3. Escribir `adapter.contract.test.ts` con `describe.each`
4. Tests de método core obligatorios
5. Tests de write policy
6. Tests de error handling
7. Run full suite: `npm run test`
8. Verificar 0 regresiones (tests existentes y nuevos verdes)
9. Coverage report
10. `npm run typecheck` + `lint` + `build` finales

## Todo List

- [ ] ADR escrito y mergeado
- [ ] Mocks por CRM
- [ ] `adapter.contract.test.ts` con describe.each
- [ ] Test implements core methods
- [ ] Test testConnection shape
- [ ] Test append_only policy
- [ ] Test overwrite_with_audit policy
- [ ] Test AuthError on 401
- [ ] Test RateLimitError on 429
- [ ] Test NotFoundError on 404
- [ ] Test FieldMapper integrado
- [ ] Run full test suite
- [ ] 0 regresiones verificadas
- [ ] Coverage report
- [ ] typecheck/lint/build pass

## Success Criteria

- ADR mergeado en `developer`
- Contract test verde para todos los adapters productivos
- 0 regresiones en tests previos
- Coverage no decrece >2pp
- Documentación clara para añadir nuevos adapters (Tier 2)

## Risk Assessment

| Riesgo                                              | Prob  | Impacto | Mitigación                           |
| --------------------------------------------------- | ----- | ------- | ------------------------------------ |
| Contract test descubre bug latente en algún adapter | Media | Medio   | Fix bug + nota en cierre             |
| Coverage decrece por refactor                       | Baja  | Bajo    | Tests existentes ya cubrían; revisar |
| ADR poco clara, dificulta futuros adapters          | Baja  | Medio   | Review con `af-agents:adr`           |

## Security Considerations

- ADR no expone configuración interna sensible
- Mocks no contienen credenciales reales

## Next Steps

- Habilita 8-05 (cierre sprint)
