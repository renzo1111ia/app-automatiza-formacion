---
title: "5-02 — jsforce setup + DB migration + auth persistence"
status: pending
priority: P2
estimation: 6-10h
phase_id: 5-02
sprint_id: SP-5
branch: feature/sprint-05-salesforce-adapter
created: 2026-05-21
---

# Phase 02 — jsforce setup + DB migration (5-02)

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md`
- [phase-01](phase-01-connected-app-oauth2.md) — ADR jsforce ya aprobado

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 5-01 (ADR aprobado)
- **Descripción:** Instalar `jsforce@^3.10.15`, migrar tabla `crm_connections` con columnas Salesforce-specific y construir el helper `getJsforceConnection(tenantId)` con auto-refresh via `on('refresh')` listener.

## Key Insights

- `jsforce@3.x` es ESM-first → verificar imports en Next 16 server actions
- `conn.on('refresh', cb)` se dispara cuando jsforce hace internal refresh → persistir nuevo access_token
- Sandbox vs prod requiere `loginUrl` diferente al instanciar `jsforce.Connection`
- `instance_url` viene del OAuth callback → no se puede derivar, siempre persistirlo

## Requirements

**Funcionales:**

- `npm install jsforce@^3.10.15` tras ADR aprobado
- Migration: columnas `sf_instance_url`, `sf_environment`, `sf_api_version` en `crm_connections`
- Helper `getJsforceConnection(tenantId)`:
  - Lee tokens + instance_url + env del tenant
  - Instancia `jsforce.Connection` correcto
  - Registra `on('refresh')` listener para autopersist
- `testConnection()`: `conn.query('SELECT Id FROM User LIMIT 1')`

**No funcionales:**

- Pool de conexiones NO necesario (jsforce stateless por instancia)
- Logging mínimo (no payload SOQL completo)

## Architecture

```
src/lib/integrations/salesforce/
├── salesforce-connection.ts
│   - getJsforceConnection(tenantId): Promise<jsforce.Connection>
│   - on('refresh') → persistRefreshedTokens
└── salesforce-oauth.ts (de 5-01)

DB migration 2026XXXX:
  ALTER TABLE crm_connections
    ADD COLUMN sf_instance_url text,
    ADD COLUMN sf_environment text CHECK (sf_environment IN ('sandbox','production')),
    ADD COLUMN sf_api_version text DEFAULT 'v62.0';
```

## Related Code Files

**Crear:**

- `src/lib/integrations/salesforce/salesforce-connection.ts`
- `src/db/migrations/2026XXXX_crm_connections_salesforce_columns.sql`

**Modificar:**

- `package.json` — añadir `jsforce@^3.10.15`
- `package-lock.json` actualizado
- `src/lib/schemas/integrations-schema.ts` (campos SF)

## Implementation Steps

1. `npm install jsforce@^3.10.15` post-ADR
2. Verificar import ESM en Next 16 (`import jsforce from 'jsforce'`)
3. Escribir migration SQL con columnas SF
4. Ejecutar migration en local + verify
5. Implementar `getJsforceConnection(tenantId)`:
   - Query `crm_connections` por tenant
   - Decrypt tokens
   - Instanciar `new jsforce.Connection({ loginUrl, instanceUrl, accessToken, refreshToken })`
6. Registrar `conn.on('refresh', token => persistRefreshedTokens(tenantId, token))`
7. Implementar `testConnection()` helper
8. Smoke test contra Developer Edition

## Todo List

- [ ] `npm install jsforce@^3.10.15`
- [ ] Verificar import ESM funciona en Next 16
- [ ] Migration SQL columnas SF
- [ ] Ejecutar migration local
- [ ] `salesforce-connection.ts` esqueleto
- [ ] `getJsforceConnection()` con auth tokens
- [ ] `on('refresh')` listener + persist
- [ ] `testConnection()` helper
- [ ] Schemas Zod actualizados
- [ ] Smoke test query simple

## Success Criteria

- `import jsforce` funciona en server actions Next 16
- Migration aplicable y revertible
- `getJsforceConnection(tenantId)` devuelve conexión válida
- Refresh automático persiste nuevo access_token en BD
- `testConnection()` retorna ok=true contra sandbox

## Risk Assessment

| Riesgo                                      | Prob  | Impacto | Mitigación                                                                   |
| ------------------------------------------- | ----- | ------- | ---------------------------------------------------------------------------- |
| jsforce ESM incompatible con Next server    | Baja  | Alto    | Si falla, usar `import * as jsforce from 'jsforce/lib/...'` o dynamic import |
| `on('refresh')` no se dispara como esperado | Media | Medio   | Test integration que fuerza expiración                                       |
| Migration no idempotente                    | Baja  | Bajo    | `ADD COLUMN IF NOT EXISTS`                                                   |

## Security Considerations

- Tokens cifrados en BD
- `instance_url` por tenant — nunca cross-tenant
- No logging de SOQL queries con datos

## Next Steps

- Habilita 5-03 (Leads/Contacts/Opportunities)
