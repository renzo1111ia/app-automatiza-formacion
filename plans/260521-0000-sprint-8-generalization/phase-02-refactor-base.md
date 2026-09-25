---
title: "8-02 — Refactor IntegrationAdapter base + FieldMapper + WritePolicy + AdapterError"
status: pending
priority: P3
estimation: 8-14h
phase_id: 8-02
sprint_id: SP-8
branch: feature/sprint-08-adapter-generalization
created: 2026-05-21
---

# Phase 02 — Refactor base (8-02)

## Context Links

- [plan.md](plan.md) — overview Sprint 8
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-05-adapter-pattern-generalization.md`
- [phase-01](phase-01-analisis-duplicaciones.md) — análisis validado

## Overview

- **Prioridad:** P3
- **Estado:** Pendiente — requiere 8-01
- **Descripción:** Crear los building blocks genéricos: `IntegrationAdapter` definitiva, `FieldMapper` universal, `applyWritePolicy()` R-014 única y `adapter-error.ts` con tipos comunes. Sin tocar adapters existentes todavía.

## Key Insights

- Interfaz estrecha: 5-7 métodos core, opcionales para webhooks
- `FieldMapper` parametrizable con direction (`local→remote` y `remote→local`)
- `applyWritePolicy()` no debería conocer HubSpot/Zoho/etc → recibe lambdas
- `AdapterError` clases tipadas: `AuthError`, `RateLimitError`, `NotFoundError`, `ValidationError`, `NetworkError`

## Requirements

**Funcionales:**

- `IntegrationAdapter` interface en `base/integration-adapter.interface.ts`
- Métodos core: `connect`, `disconnect`, `testConnection`, `upsertContact`, `getContact`, `syncLead`
- Opcionales: `registerWebhook?`, `validateWebhookSignature?`, `parseWebhookPayload?`
- `FieldMapper` class en `field-mapper.ts` con `toExternal()` + `fromExternal()`
- `applyWritePolicy()` function en `base/write-policy.ts`
- `AdapterError` jerarquía en `base/adapter-error.ts`

**No funcionales:**

- Tests unit para FieldMapper, WritePolicy, AdapterError
- Zero deps nuevas
- Files <200 líneas cada uno

## Architecture

```
src/lib/integrations/
├── base/
│   ├── integration-adapter.interface.ts   (~80 líneas)
│   ├── write-policy.ts                    (~100 líneas)
│   └── adapter-error.ts                   (~60 líneas)
└── field-mapper.ts                        (~120 líneas)

Interfaz propuesta (puede ajustarse en 8-01):

interface IntegrationAdapter {
  getProvider(): CrmProvider;
  connect(credentials): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  testConnection(): Promise<{ ok, error? }>;
  upsertContact(contact, mappings, policy): Promise<PushResult>;
  getContact(externalId): Promise<CrmContact | null>;
  syncLead(lead, mappings, policy): Promise<PushResult>;
  // Opcionales
  registerWebhook?(callbackUrl, events): Promise<{ webhookId }>;
  validateWebhookSignature?(headers, body, secret): boolean;
  parseWebhookPayload?(raw): WebhookEvent;
}

class FieldMapper {
  constructor(mappings: FieldMappingEntry[]);
  toExternal(local: Record<string, unknown>): Record<string, unknown>;
  fromExternal(external: Record<string, unknown>): Record<string, unknown>;
}

function applyWritePolicy(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
  mappings: FieldMappingEntry[]
): { result, written: string[], skipped: string[], audit: AuditEntry[] }

class AdapterError extends Error { ... }
class AuthError extends AdapterError {}
class RateLimitError extends AdapterError {}
class NotFoundError extends AdapterError {}
class ValidationError extends AdapterError {}
class NetworkError extends AdapterError {}
```

## Related Code Files

**Crear:**

- `src/lib/integrations/base/integration-adapter.interface.ts`
- `src/lib/integrations/base/write-policy.ts`
- `src/lib/integrations/base/adapter-error.ts`
- `src/lib/integrations/field-mapper.ts`
- `src/lib/integrations/base/__tests__/write-policy.unit.test.ts`
- `src/lib/integrations/__tests__/field-mapper.unit.test.ts`
- `src/lib/integrations/base/__tests__/adapter-error.unit.test.ts`

**NO modificar (todavía):**

- Los adapters existentes — fase 8-03 los refactoriza

## Implementation Steps

1. Crear `integration-adapter.interface.ts` con tipos finalizados de 8-01
2. Crear `field-mapper.ts` con `FieldMapper` class
3. Crear `write-policy.ts` con `applyWritePolicy()` function
4. Crear `adapter-error.ts` con jerarquía de clases
5. Unit tests `FieldMapper`: ida y vuelta, edge cases (null, undefined, nested)
6. Unit tests `applyWritePolicy()`: todos los branches R-014 (≥6 escenarios)
7. Unit tests `AdapterError`: serialización + discriminación
8. `npm run typecheck` pass
9. Lint pass
10. Verificar 0 imports rotos en adapters existentes (todavía no refactorizados)

## Todo List

- [ ] `integration-adapter.interface.ts`
- [ ] Tipos `CrmContact`, `PushResult`, `AuditEntry`, etc.
- [ ] `field-mapper.ts` con class
- [ ] `toExternal()` + `fromExternal()`
- [ ] `write-policy.ts` con `applyWritePolicy()`
- [ ] Branches append_only, overwrite, overwrite_with_audit
- [ ] `adapter-error.ts` con jerarquía
- [ ] Unit tests FieldMapper (≥4 escenarios)
- [ ] Unit tests WritePolicy (≥6 escenarios R-014)
- [ ] Unit tests AdapterError
- [ ] `npm run typecheck` pass
- [ ] Verificar adapters existentes no se rompen

## Success Criteria

- 4 archivos nuevos compilables con typecheck
- Tests unit verdes 100%
- 0 cambios en adapters existentes (compilan igual)
- Interfaz cubre semánticamente los casos de los 6 adapters

## Risk Assessment

| Riesgo                                           | Prob  | Impacto | Mitigación                                           |
| ------------------------------------------------ | ----- | ------- | ---------------------------------------------------- |
| Interfaz no cubre algún edge case CRM-específico | Media | Alto    | Métodos opcionales + `unknown` en customFields       |
| FieldMapper limitado con nested fields           | Media | Medio   | Soporte path-based via dot notation (`address.city`) |
| AdapterError pierde stack original               | Baja  | Bajo    | Preservar `cause` field                              |

## Security Considerations

- AdapterError no expone tokens en `message`
- FieldMapper no permite mappings que sobrescriban campos sensibles del lead

## Next Steps

- Habilita 8-03 (refactor adapters existentes)
