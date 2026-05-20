---
title: "5-02 — Salesforce Adapter (jsforce)"
sprint_task: 5-02
status: pending
priority: P2
effort: 60-100h
branch: feature/sp-5-02-salesforce-adapter
version_bump: v0.5.1
agents: [af-agents:code, af-agents:api, af-agents:adr]
---

# 5-02 — Salesforce Adapter

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- [researcher-salesforce-e-20260520.md](../reports/researcher-salesforce-e-20260520.md) — research técnico
- [ADR dependencias](../reports/adr-auditoria-dependencias-20260520.md) — sección Sprint 2/E jsforce
- [Sprint 2 plan](../260520-1342-sprint-2-adapter-hubspot-zoho/plan.md) — IntegrationAdapter base

## Overview

- **Prioridad**: P2 (audiencia enterprise — universidades y escuelas de negocio)
- **Estado**: Pendiente — bloqueado por Sprint 2 completado + ADR jsforce aprobado
- **Descripción**: Adapter Salesforce usando jsforce@3.x. OAuth2 con Connected Apps. Sync lead/contact/opportunity. Multi-tenant (una org SF por academia).

## Key Insights

- `jsforce@^3.10.15` NO instalado — requiere ADR antes de instalar (ejecutar `af-agents:adr` primero)
- Cada tenant tiene su propia Connected App en su Salesforce org (o compartimos una Connected App ISV)
- Sandbox vs producción: campo `sf_environment` en `crm_connections`
- Pull (SF → Esden) via Streaming API/Platform Events — complejidad alta, dejar para fase adicional
- `Company` es campo requerido en Salesforce Lead — mapear desde academia o dejar como configurable
- jsforce 3.x: `conn.on('refresh', ...)` para auto-persist del nuevo access token

## Requirements

**Funcionales:**
- Push: lead actualizado en Esden → Lead/Contact upsert en Salesforce (upsert por email)
- Soporte Lead y Contact (según configuración del tenant: convertir o no)
- Soporte Opportunity básico (matrícula = opportunity en SF)
- Sandbox mode para testing del tenant
- UI admin: OAuth consent, selección sandbox/prod, field mapping, test connection

**No funcionales:**
- Multi-tenant: jsforce.Connection por tenant con sus OAuth tokens
- Error handling: `REQUEST_LIMIT_EXCEEDED` → queue + backoff
- Auditable: cada sync en `crm_write_audit`
- No bloquear pull SF→Esden como P2 — dejar como feature adicional

## Architecture

### Data flows

**Push (Esden → Salesforce):**
```
lead.updated event
  → BullMQ job: salesforce-push
    → SalesforceAdapter.upsertLead(tenantId, lead)
      → Instanciar jsforce.Connection con tokens del tenant
      → conn.sobject('Lead').upsert({ Email }, 'Email')
      → Si opportunity: conn.sobject('Opportunity').upsert(...)
      → conn.on('refresh') → persist nuevo access token
      → Log en crm_write_audit
```

**OAuth2 flow:**
```
Admin clic "Conectar Salesforce"
  → Redirect a Salesforce consent screen (login.salesforce.com o test.salesforce.com)
  → Callback: exchange code → access_token + refresh_token + instanceUrl
  → Guardar en crm_connections (cifrado)
  → Test connection: conn.query('SELECT Id FROM User LIMIT 1')
```

### Componentes nuevos
- `src/lib/integrations/salesforce/salesforce-adapter.ts`
- `src/lib/integrations/salesforce/salesforce-oauth.ts`
- `src/lib/integrations/salesforce/salesforce-field-mapper.ts`
- `src/app/api/oauth/salesforce/callback/route.ts`
- `src/jobs/salesforce-push.job.ts`
- `src/components/integrations/salesforce-connection-form.tsx`

### Componentes reutilizados (Sprint 2)
- `IntegrationAdapter` base interface
- `crm_connections` tabla
- `crm_write_audit` tabla
- Write policy R-014
- UI admin connection modal patterns

## Related Code Files

**Crear:**
- `src/lib/integrations/salesforce/salesforce-adapter.ts`
- `src/lib/integrations/salesforce/salesforce-oauth.ts`
- `src/lib/integrations/salesforce/salesforce-field-mapper.ts`
- `src/app/api/oauth/salesforce/callback/route.ts`
- `src/jobs/salesforce-push.job.ts`
- `src/components/integrations/salesforce-connection-form.tsx`

**Modificar:**
- `src/lib/integrations/adapter-factory.ts` (registrar salesforce)
- `package.json` (instalar jsforce@^3.10.15 tras ADR)
- `src/db/migrations/` (columnas SF en crm_connections: `sf_instance_url`, `sf_environment`)

## Implementation Steps

1. **ADR**: ejecutar `af-agents:adr` para aprobar `jsforce@^3.10.15` — verificar compatibilidad Node 24, Next 16, no peer deps críticas
2. **Instalar jsforce**: `npm install jsforce@^3.10.15` (solo tras ADR aprobado)
3. **DB migration**: añadir columnas `sf_instance_url`, `sf_environment` a `crm_connections`
4. **OAuth2**: `salesforce-oauth.ts` — getAuthorizationUrl, authorize, auto-refresh on `refresh` event
5. **SalesforceAdapter**: `upsertLead()` + `upsertOpportunity()` + `testConnection()`
6. **FieldMapper**: defaults para Lead + Contact + Opportunity. Campo `Company` = academia nombre
7. **Push job**: `salesforce-push.job.ts` — BullMQ, escuchar `lead.updated`
8. **UI**: formulario conexión — sandbox toggle, OAuth consent, test connection button
9. **Tests**: contract test + integration test con Salesforce Developer Edition (sandbox free)
10. **Cierre**: typecheck + lint + build

## Todo

- [ ] ADR jsforce aprobado
- [ ] npm install jsforce@^3.10.15
- [ ] DB migration columnas SF en crm_connections
- [ ] OAuth2 flow completo (consent + callback + refresh)
- [ ] SalesforceAdapter.upsertLead() (Lead upsert por email)
- [ ] SalesforceAdapter.upsertOpportunity() (opcional, configurable)
- [ ] FieldMapper con defaults Lead/Contact/Opportunity
- [ ] BullMQ job salesforce-push
- [ ] UI admin: conexión Salesforce (sandbox/prod, OAuth, test)
- [ ] Tests: unit + integration con SF sandbox
- [ ] Docs: guía Connected App para admin de academia

## Success Criteria

- Lead en Esden → Lead/Contact en Salesforce org del tenant en < 5 min
- Upsert por email evita duplicados
- Sandbox mode funcional para testing del tenant
- Token expirado se renueva automáticamente
- `REQUEST_LIMIT_EXCEEDED` manejado con queue sin pérdida de datos
- All tests pass

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Connected App mal configurada por tenant | Alta | Alto | Guía step-by-step en UI + test connection visible |
| Sandbox vs prod confusión | Media | Alto | Toggle sandbox/prod explícito + warning en UI |
| API limits edición Essentials (15k/día) | Media | Medio | BullMQ throttle per-tenant, alerta en % de cuota |
| `Company` requerido en Lead SF | Alta | Bajo | Default = nombre de la academia del tenant |
| jsforce peer dep conflicto | Baja | Alto | Verificar en ADR antes de instalar |

## Security Considerations

- `sf_client_secret` y tokens OAuth cifrados en `crm_connections`
- `instanceUrl` almacenado por tenant — nunca cross-tenant
- RLS: cada tenant solo ve sus propias `crm_connections`
- Sandbox tokens != producción tokens — no mezclar

## Next Steps

- Bloqueado por: Sprint 2 completado + ADR jsforce aprobado
- Puede ejecutarse en paralelo con 5-01, 5-03, 5-04
- Desbloquea: 5-05 (generalización) cuando se completan 5-01..5-04
