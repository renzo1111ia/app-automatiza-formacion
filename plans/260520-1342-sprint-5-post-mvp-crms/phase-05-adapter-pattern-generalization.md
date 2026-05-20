---
title: "5-05 — Generalización del Adapter Pattern"
sprint_task: 5-05
status: pending
priority: P3
effort: 20-40h
branch: feature/sp-5-05-adapter-generalization
version_bump: patch (refactor, no nueva funcionalidad)
agents: [esden-agents:code, esden-agents:adr]
---

# 5-05 — Generalización del Adapter Pattern

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- [researcher-adapter-pattern-generalization-e-20260520.md](../reports/researcher-adapter-pattern-generalization-e-20260520.md) — research técnico
- [Sprint 3 plan](../260520-1342-sprint-3-adapter-hubspot-zoho/plan.md) — IntegrationAdapter base original

## Overview

- **Prioridad**: P3 (calidad interna — no visible para usuario final)
- **Estado**: Pendiente — **BLOQUEADO por 5-01 + 5-02 + 5-03 + 5-04 todos completados**
- **Descripción**: Refactor de los 6 adapters (HubSpot, Zoho, Salesforce, GHL, AC, Sheets) para extraer la interfaz genérica `IntegrationAdapter`, FieldMapper universal, WritePolicy R-014 generalizada y 1 test suite de contrato para N adapters.

## Key Insights

- YAGNI: NO ejecutar hasta que 4+ adapters reales estén implementados. El refactor extrae lo común **observado**, no lo asumido
- Señales de "es el momento": código duplicado visible, FieldMapper implementado diferente en cada adapter, tests copiados
- Inspiración: Stripe PaymentMethod pattern, Shopify FulfillmentService, Twilio MessageChannel
- La interfaz debe ser **estrecha** (5-7 métodos core) — no sobreabstraer
- `contract.test.ts` único que todos los adapters deben pasar — facilita añadir adapters Tier 2

## Requirements

**Funcionales:**
- Interfaz `IntegrationAdapter` con métodos: `connect`, `disconnect`, `testConnection`, `upsertContact`, `getContact`, `syncLead` + opcionales `registerWebhook?`, `validateWebhookSignature?`, `parseWebhookPayload?`
- `FieldMapper` configurable por tenant con `toExternal()` + `fromExternal()`
- Default mappings declarados por adapter en su propio archivo
- `WritePolicy` R-014 generalizada en función `applyWritePolicy()`
- `AdapterFactory` con `getAdapter(crmType)` simple
- 1 `adapter.contract.test.ts` que todos los adapters deben pasar

**No funcionales:**
- Zero breaking changes en comportamiento — refactor puro
- Todos los tests existentes siguen pasando
- No nuevas dependencias

## Architecture

### Estructura de archivos objetivo
```
src/lib/integrations/
├── base/
│   ├── integration-adapter.interface.ts    <- interfaz genérica
│   ├── write-policy.ts                     <- R-014 generalizada
│   └── adapter-error.ts                    <- tipos de error comunes
├── field-mapper.ts                         <- FieldMapper universal
├── adapter-factory.ts                      <- factory
├── hubspot/ zoho/ salesforce/ ghl/ activecampaign/ sheets/
│   ├── {crm}-adapter.ts                    <- implementa IntegrationAdapter
│   └── {crm}-field-mapping.ts              <- DEFAULT_FIELD_MAPPINGS[crm]
└── __tests__/
    └── adapter.contract.test.ts            <- 1 suite x N adapters
```

### Checklist de extracción
Para cada adapter, verificar y homogeneizar:
1. Implementa `IntegrationAdapter` interface (TypeScript `implements`)
2. Usa `FieldMapper` en vez de transformaciones inline
3. Usa `applyWritePolicy()` de `write-policy.ts`
4. Lanza errores tipados de `adapter-error.ts` (no `throw new Error(string)`)
5. Pasa `adapter.contract.test.ts`

## Related Code Files

**Crear:**
- `src/lib/integrations/base/integration-adapter.interface.ts`
- `src/lib/integrations/base/write-policy.ts`
- `src/lib/integrations/base/adapter-error.ts`
- `src/lib/integrations/field-mapper.ts`
- `src/lib/integrations/__tests__/adapter.contract.test.ts`

**Modificar (refactor):**
- `src/lib/integrations/hubspot/hubspot-adapter.ts`
- `src/lib/integrations/zoho/zoho-adapter.ts`
- `src/lib/integrations/salesforce/salesforce-adapter.ts`
- `src/lib/integrations/ghl/ghl-adapter.ts`
- `src/lib/integrations/activecampaign/ac-adapter.ts`
- `src/lib/integrations/sheets/sheets-adapter.ts`
- `src/lib/integrations/adapter-factory.ts`

## Implementation Steps

1. **Análisis previo**: leer los 6 adapters implementados — identificar duplicaciones reales (no asumidas)
2. **Definir interfaz**: `integration-adapter.interface.ts` con 7 métodos máximo
3. **FieldMapper**: extraer de los 6 adapters — unificar en `field-mapper.ts`
4. **WritePolicy**: extraer lógica R-014 de cada adapter → `write-policy.ts`
5. **AdapterError**: tipificar errores comunes (AuthError, RateLimitError, NotFoundError, etc.)
6. **Refactor adapters**: uno por uno, hacer `implements IntegrationAdapter` + usar FieldMapper + WritePolicy
7. **Contract test**: escribir `adapter.contract.test.ts` — verificar interfaz + mapping + error handling
8. **Verificar**: todos los tests existentes pasan, 0 regresiones
9. **ADR**: documentar decisiones de la interfaz (qué métodos opcionales, por qué interfaz estrecha)
10. **Cierre**: typecheck + lint + build

## Todo

- [ ] Análisis de duplicaciones reales en 6 adapters
- [ ] Definir `IntegrationAdapter` interface final
- [ ] Implementar `FieldMapper` universal
- [ ] Implementar `applyWritePolicy()` generalizada
- [ ] Tipificar `AdapterError` comunes
- [ ] Refactor HubSpot adapter
- [ ] Refactor Zoho adapter
- [ ] Refactor Salesforce adapter
- [ ] Refactor GHL adapter
- [ ] Refactor AC adapter
- [ ] Refactor Sheets adapter
- [ ] Escribir adapter.contract.test.ts
- [ ] Verificar 0 regresiones en todos los tests
- [ ] ADR: decisiones de la interfaz genérica
- [ ] Actualizar adapter-factory.ts

## Success Criteria

- Interfaz `IntegrationAdapter` implementada por los 6 adapters con TypeScript `implements`
- `adapter.contract.test.ts` ejecuta y pasa para todos los adapters
- 0 tests existentes rotos
- `applyWritePolicy()` única implementación de R-014 usada por todos
- `FieldMapper` único, configurable por tenant, sin transformaciones inline

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Sobreabstracción — interfaz que no encaja con todos | Media | Alto | Interfaz estrecha (7 métodos max), opcionales para edge cases |
| Regresión en producción por refactor | Baja | Alto | 0 cambios de comportamiento, solo estructura. Tests antes y después |
| 5-05 bloqueado porque algún 5-01..5-04 no se completa | Media | Bajo | 5-05 es P3 — se puede diferir sin impacto funcional |

## Security Considerations

- Refactor puro — no cambia lógica de auth ni de cifrado de tokens
- Verificar que `adapter-error.ts` no expone información sensible en mensajes de error

## Next Steps

- Bloqueado por: 5-01 + 5-02 + 5-03 + 5-04 completados
- Si algún 5-01..5-04 se retrasa, 5-05 puede ejecutarse con los adapters disponibles (mínimo 4)
- Desbloquea: adición futura de Tier 2 adapters (5-06) con menor esfuerzo
