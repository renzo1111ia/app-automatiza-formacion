---
title: "4-01 — OAuth2 Google + Drive API setup"
status: pending
priority: P2
estimation: 6-10h
phase_id: 4-01
sprint_id: SP-4
branch: feature/sp-4-google-sheets
created: 2026-05-21
---

# Phase 01 — OAuth2 Google + Drive API setup (4-01)

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md`
- Research: `../260520-1342-sprint-4-post-mvp-crms/reports/researcher-google-sheets-e-20260520.md`
- Sprint 2 OAuth patterns: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-02-adapter-hubspot.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — primer entregable del Sprint 4
- **Descripción:** Flow OAuth2 Google completo (consent + callback + refresh) y verificación de scopes mínimos para Sheets+Drive. Establece la base de credenciales por tenant que reutilizan las fases siguientes.

## Key Insights

- `googleapis@171.4.0` ya instalado — no se añaden deps
- Scopes mínimos obligatorios: `spreadsheets` + `drive.file`
- Refresh tokens deben persistirse cifrados (reuso de columna `encrypted_credentials`)
- Google revoca refresh tokens si no se usan en 6 meses → registrar `last_refresh_at`
- Consent screen ya debe estar en estado "in production" en GCP Console (prerequisito externo)

## Requirements

**Funcionales:**
- Endpoint `GET /api/oauth/google-sheets/start` → redirige a consent screen Google
- Endpoint `GET /api/oauth/google-sheets/callback` → intercambia code → tokens y persiste
- Función `getAuthenticatedClient(tenantId)` reutilizable por SheetsAdapter
- Refresh automático cuando access_token expira (manejado por `googleapis` OAuth2Client)
- Persistencia de `access_token`, `refresh_token`, `expiry_date` cifrados

**No funcionales:**
- Scope mínimo: `drive.file` (NO `drive` completo)
- Tokens en `crm_connections.encrypted_credentials` (AES-256 ya implementado en Sprint 1)
- RLS multi-tenant: cada tenant solo accede a sus tokens

## Architecture

```
src/lib/integrations/sheets/
└── sheets-oauth.ts
    - getAuthorizationUrl(tenantId, state): string
    - exchangeCodeForTokens(code): { access, refresh, expiry }
    - getAuthenticatedClient(tenantId): Promise<OAuth2Client>
    - persistTokens(tenantId, tokens): void
    - on token refresh → autoupdate DB

src/app/api/oauth/google-sheets/
├── start/route.ts          → redirect a consent
└── callback/route.ts       → exchange + persist + redirect a UI admin
```

## Related Code Files

**Crear:**
- `src/lib/integrations/sheets/sheets-oauth.ts`
- `src/app/api/oauth/google-sheets/start/route.ts`
- `src/app/api/oauth/google-sheets/callback/route.ts`

**Depende de (Sprint 1, lectura):**
- `src/lib/repositories/integrations-repository.ts`
- `src/lib/crypto/encrypt.ts` (cifrado AES-256 tokens)

## Implementation Steps

1. Crear cliente GCP (prerequisito manual) y guardar `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` en `.env.example`
2. Implementar `sheets-oauth.ts` con `OAuth2Client` de `googleapis`
3. Implementar `getAuthorizationUrl()` con scopes y state CSRF token
4. Implementar `exchangeCodeForTokens()` + persistencia cifrada
5. Implementar route handler `/start` → genera state, almacena en sesión, redirige
6. Implementar route handler `/callback` → valida state, intercambia code, persiste, redirige
7. Implementar `getAuthenticatedClient(tenantId)` con auto-refresh listener
8. `npm run typecheck` + smoke test manual del flow OAuth

## Todo List

- [ ] Crear `.env.example` con `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` placeholders
- [ ] `sheets-oauth.ts` esqueleto + tipos
- [ ] `getAuthorizationUrl()` con state CSRF
- [ ] `exchangeCodeForTokens()` implementado
- [ ] `persistTokens()` con cifrado AES-256
- [ ] Route `/api/oauth/google-sheets/start`
- [ ] Route `/api/oauth/google-sheets/callback`
- [ ] `getAuthenticatedClient(tenantId)` con auto-refresh
- [ ] Listener `on('tokens')` para repersistir tras refresh
- [ ] Manejo de 403 (revoked) → marcar `status='revoked'`
- [ ] Smoke test manual end-to-end del flow

## Success Criteria

- Tenant nuevo completa OAuth y `crm_connections` queda con `crm_type='sheets'` + tokens cifrados
- Token expirado se renueva automáticamente
- Revocación detectada y reflejada en BD
- `npm run typecheck` pass

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Consent screen no aprobado en GCP | Media | Alto | Iniciar verificación GCP antes del sprint |
| Scope `drive` solicitado por error | Baja | Alto | Lint check en CI sobre scopes |
| Refresh token no devuelto (Google solo lo da en primer consent) | Media | Alto | `access_type=offline` + `prompt=consent` forzado |

## Security Considerations

- Tokens cifrados con AES-256-GCM (Sprint 1 2-26)
- State CSRF obligatorio en `/start` y validado en `/callback`
- No loggear `access_token` ni `refresh_token`
- RLS en `crm_connections`

## Next Steps

- Habilita 4-02 (template + migration)
- Bloqueante para 4-03 (push) y 4-04 (pull)
