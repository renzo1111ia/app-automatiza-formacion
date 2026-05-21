---
title: "8-03 — CRM factory dinámico + refactor adapters existentes"
status: pending
priority: P3
estimation: 4-10h
phase_id: 8-03
sprint_id: SP-8
branch: feature/sp-8-adapter-generalization
created: 2026-05-21
---

# Phase 03 — Factory + refactor adapters (8-03)

## Context Links

- [plan.md](plan.md) — overview Sprint 8
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-05-adapter-pattern-generalization.md`
- [phase-02](phase-02-refactor-base.md) — base ya creada

## Overview

- **Prioridad:** P3
- **Estado:** Pendiente — requiere 8-02
- **Descripción:** Refactor de cada adapter productivo para que `implements IntegrationAdapter`, use `FieldMapper`, `applyWritePolicy()` y throws `AdapterError` tipados. Factory dinámico con registry.

## Key Insights

- Refactor adapter por adapter en commits independientes — facilita revisión
- Cero cambio de comportamiento — solo estructura
- Tests existentes deben seguir verdes tras CADA refactor de adapter
- Factory pasa de `if/else` a registry map: `{ hubspot: HubSpotAdapter, ... }`

## Requirements

**Funcionales:**
- Cada adapter productivo:
  - `class XxxAdapter implements IntegrationAdapter`
  - Usa `FieldMapper` en vez de transformaciones inline
  - Usa `applyWritePolicy()` en vez de lógica R-014 propia
  - Throws `AdapterError` subclasses (no `throw new Error(string)`)
- Factory en `adapter-factory.ts`:
  - Registry map
  - `getAdapter(crmType)` simple lookup
  - `getIntegrationAdapters(tenantId)` retorna array

**No funcionales:**
- 0 tests rotos después de cada refactor
- Commits granulares (uno por adapter)
- File size <200 líneas cada uno (split si necesario)

## Architecture

```
src/lib/integrations/
├── adapter-factory.ts                    (refactor — registry map)
├── hubspot/hubspot-adapter.ts            (refactor)
├── zoho/zoho-adapter.ts                  (refactor)
├── sheets/sheets-adapter.ts              (refactor)
├── salesforce/salesforce-adapter.ts      (refactor)
├── ghl/ghl-adapter.ts                    (refactor)
└── activecampaign/ac-adapter.ts          (refactor)

Cada *-adapter.ts:
  - implements IntegrationAdapter
  - private fieldMapper: FieldMapper
  - try/catch convierte errores nativos → AdapterError subclass
  - usa applyWritePolicy() en upsertContact/syncLead
```

## Related Code Files

**Modificar:**
- `src/lib/integrations/adapter-factory.ts`
- `src/lib/integrations/hubspot/hubspot-adapter.ts`
- `src/lib/integrations/zoho/zoho-adapter.ts`
- `src/lib/integrations/sheets/sheets-adapter.ts`
- `src/lib/integrations/salesforce/salesforce-adapter.ts`
- `src/lib/integrations/ghl/ghl-adapter.ts`
- `src/lib/integrations/activecampaign/ac-adapter.ts`

**Crear:**
- `src/lib/integrations/_default-mappings/hubspot-mapping.ts` (si no estaba aislado)
- (idem para cada CRM si las defaults estaban inline)

## Implementation Steps

1. Refactor `adapter-factory.ts` con registry map
2. Refactor HubSpotAdapter: implements + FieldMapper + applyWritePolicy + AdapterError
3. Tests Sprint 2 HubSpot deben pasar tras refactor — verificar
4. Commit HubSpot refactor
5. Refactor ZohoAdapter — verificar tests
6. Commit Zoho
7. Refactor SheetsAdapter — verificar tests
8. Commit Sheets
9. Refactor SalesforceAdapter — verificar tests
10. Commit Salesforce
11. Refactor GHLAdapter — verificar tests
12. Commit GHL
13. Refactor ACAdapter — verificar tests
14. Commit AC
15. Final: `npm run typecheck` + `lint` + `build` + `test` todos verdes

## Todo List

- [ ] Refactor `adapter-factory.ts` con registry
- [ ] Refactor HubSpotAdapter
- [ ] Tests HubSpot pass
- [ ] Refactor ZohoAdapter
- [ ] Tests Zoho pass
- [ ] Refactor SheetsAdapter
- [ ] Tests Sheets pass
- [ ] Refactor SalesforceAdapter
- [ ] Tests Salesforce pass
- [ ] Refactor GHLAdapter
- [ ] Tests GHL pass
- [ ] Refactor ACAdapter
- [ ] Tests AC pass
- [ ] Default mappings extraídos a archivos propios si estaban inline
- [ ] `npm run typecheck` pass
- [ ] `npm run test` 100% verdes

## Success Criteria

- N adapters productivos `implements IntegrationAdapter`
- Todos usan `FieldMapper`, `applyWritePolicy()`, `AdapterError`
- Factory con registry map
- 0 tests rotos
- 0 cambios de comportamiento observable

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Refactor introduce regresión sutil | Media | Alto | Tests granulares por adapter + run completo en cada commit |
| FieldMapper no encaja con custom fields nested de un CRM | Media | Medio | Extender FieldMapper con path-based access o métodos opcionales |
| AdapterError pierde info original | Baja | Bajo | Preservar `cause` con error original |

## Security Considerations

- Errores no exponen tokens
- Catch genérico no oculta errores críticos (re-throw si no es CRM-conocido)

## Next Steps

- Habilita 8-04 (docs + contract test)
