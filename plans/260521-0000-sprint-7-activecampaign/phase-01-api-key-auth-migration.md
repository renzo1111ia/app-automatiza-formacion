---
title: "7-01 — API Key auth + DB migration"
status: pending
priority: P2
estimation: 3-6h
phase_id: 7-01
sprint_id: SP-7
branch: feature/sprint-07-activecampaign-adapter
created: 2026-05-21
---

# Phase 01 — API Key auth + migration (7-01)

## Context Links

- [plan.md](plan.md) — overview Sprint 7
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-04-activecampaign-adapter.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — primer entregable Sprint 7
- **Descripción:** Auth con API Key (sin OAuth), migration de `crm_connections` con columnas AC-específicas (`ac_account_url`, `ac_webhook_id`) y helper para validar credenciales via `GET /users/me`.

## Key Insights

- API Key en header `Api-Token: <key>`
- URL base por tenant variable: `https://{account}.api-us1.com/api/3` (us1, eu1, au1, etc.)
- Validación inicial: `GET /users/me` con la API Key
- API Key cifrada en `crm_connections.encrypted_credentials`

## Requirements

**Funcionales:**

- Migration: columnas `ac_account_url`, `ac_webhook_id` en `crm_connections`
- Helper `validateACCredentials(apiKey, accountUrl)`: `GET /users/me` con throw on 401
- Helper `getACAxiosClient(tenantId)`: axios instance con baseURL + Api-Token header

**No funcionales:**

- API Key cifrada AES-256-GCM
- RLS multi-tenant

## Architecture

```
Migration 2026XXXX:
  ALTER TABLE crm_connections
    ADD COLUMN ac_account_url text,
    ADD COLUMN ac_webhook_id text;

src/lib/integrations/activecampaign/
├── ac-api-client.ts
│   - getACAxiosClient(tenantId): AxiosInstance
└── ac-auth.ts
    - validateACCredentials(apiKey, accountUrl): { ok, error? }
```

## Related Code Files

**Crear:**

- `src/lib/integrations/activecampaign/ac-api-client.ts`
- `src/lib/integrations/activecampaign/ac-auth.ts`
- `src/db/migrations/2026XXXX_crm_connections_ac_columns.sql`

**Modificar:**

- `src/lib/schemas/integrations-schema.ts` (campos AC)

## Implementation Steps

1. Migration SQL con columnas AC
2. Ejecutar migration local + verify
3. `ac-api-client.ts`: axios instance factory que recibe tenantId
4. `ac-auth.ts`: validar API Key con `GET /users/me`
5. Manejo 401: throw `InvalidCredentialsError`
6. Manejo 5xx: throw `ServiceUnavailableError`
7. Tests unit con mocks axios
8. Smoke test contra AC trial account

## Todo List

- [ ] Migration columnas AC
- [ ] Ejecutar migration
- [ ] `ac-api-client.ts` factory
- [ ] `ac-auth.ts` validator
- [ ] Manejo 401 / 5xx
- [ ] Cifrado API Key
- [ ] Schemas Zod actualizados
- [ ] Tests unit
- [ ] Smoke test trial account

## Success Criteria

- Migration aplicable y revertible
- `getACAxiosClient(tenantId)` devuelve instancia con auth
- `validateACCredentials` retorna ok con key válida, error con inválida

## Risk Assessment

| Riesgo                                        | Prob  | Impacto | Mitigación                               |
| --------------------------------------------- | ----- | ------- | ---------------------------------------- |
| AC API URL diferente por región (us1/eu1/au1) | Alta  | Bajo    | Almacenar URL completa, no derivar       |
| API Key revocada externamente                 | Media | Medio   | Detectar 401 → marcar `status='revoked'` |

## Security Considerations

- API Key cifrada AES-256-GCM
- No log de API Key
- RLS en `crm_connections`

## Next Steps

- Habilita 7-02 (Contacts + Tags)
