# Fase 03 — Validación Sprint 2 (Adapter HubSpot + Zoho)

## Context Links

- [plan.md](plan.md) — overview Sprint Validación Pre-MVP
- [Sprint 2 plan](../260524-1330-sprint-2-adapter-hubspot-zoho/plan.md)
- [Sprint 2 execution log](../260524-1330-sprint-2-adapter-hubspot-zoho/execution-log.md)
- [RoadMap](../RoadMap.md)
- [Arquitectura CRM adapters](../../docs/architecture/crm-adapters.md)

## Overview

- **Sprint validado**: Sprint 2 — Adapter HubSpot + Zoho (SP-3, v0.2.0-rc).
- **Branch origen**: `feature/sprint-02-adapter-hubspot-zoho` (PR a `developer` abierto, sin merge automático).
- **Estado**: 🟡 **Pendiente de validación VPS** (auto-test + E2C local ya verdes).
- **Tester**: Renzo (cuando despliegue VPS pre-MVP).

## Resumen del Sprint 2 a validar

MVP CRM bidireccional implementado:

- `ICRMProvider` ampliado (capabilities + lifecycle + OAuth + createLead).
- `ZohoCRMProvider` refactorizado con multi-DC (9 DCs), v8, refresh+retry, paginación, módulo configurable.
- `HubSpotCRMProvider` nuevo con Public App OAuth, fetch puro, custom properties auto-provisionadas en init().
- `TokenManager` con dedup in-process + DB writeback de refresh_token rotados.
- `WriteGuard` standalone con append_only + overwrite_with_audit + audit DB-level inmutable.
- UI `IntegrationsManager` ampliada con sección CRM (HubSpot + Zoho cards + write_policy + audit viewer).
- Routes API OAuth start/callback con triple-check state (cookie + DB + HMAC).
- ADR-021 (HubSpot Public App), ADR-022 (write_policy semantics), ADR-023 (TokenManager dedup).
- 168 tests Vitest verdes.

## 1. Test automático (código)

```bash
npm install
npm run typecheck                 # exit 0
npm run lint                      # 101 errores legacy (pre-Sprint 2), 0 nuevos
npm run build                     # exit 0, 42 páginas generadas
npm run test                      # 168 passed + 4 skipped
npm run test -- --coverage        # coverage report
```

**Resultados esperados:**

- typecheck: 0 errores.
- build: `✓ Compiled successfully`.
- tests: 168 pass, 4 skipped (integration tests de repos que requieren DB real).

## 2. Test E2C local (Playwright contra `localhost:8500`)

```bash
npm run dev                       # arranca en :8500
# en otra consola:
npx playwright test tests/e2e/integrations-manager.spec.ts
```

**Specs a añadir en Sprint 3** (no creadas en Sprint 2 porque la UI se valida con tests Vitest API + smoke manual):

- `/dashboard/settings` → sección Integraciones CRM visible.
- Empty state "Sin CRM conectado" sin alerts.
- Click "Conectar HubSpot" → redirect a `app.hubspot.com/oauth/authorize?...` (validar URL, no completar flow).
- Callback con `?success=hubspot` → toast verde.
- Callback con `?error=csrf_mismatch` → toast rojo.
- axe-core scan → 0 violations críticas.

## 3. Specs listos para E2E VPS

Mismos specs anteriores con `BASE_URL=https://dev.automatizaformacion.com`. Requiere:

- Env vars en Easypanel: `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `OAUTH_STATE_SECRET`, `NEXT_PUBLIC_APP_URL=https://dev.automatizaformacion.com`.
- Migraciones aplicadas en VPS:
  - `20260524100000_integrations_oauth_and_audit.sql` (ya aplicada en Phase 01 via pg-meta REST).
  - `20260524110000_help_sections_integrations.sql` (NUEVA, aplicar al VPS).
- HubSpot Developer Portal: redirect_uri `https://dev.automatizaformacion.com/api/integrations/hubspot/auth/callback` añadido a la Public App.
- Cuenta sandbox HubSpot disponible para Renzo aprobar la app durante test E2E.

## 4. Checklist manual derivado de `docs/testeos-manual.md`

1. **Conectar HubSpot real**
   - Click "Conectar HubSpot" en `/dashboard/settings` → URL HubSpot auth abre.
   - Aprobar app con cuenta sandbox → callback redirige a `?success=hubspot`.
   - Card muestra "Conectado", portal_id visible, healthcheck disponible.
2. **Test connection HubSpot**
   - Click "Test" → estado actualizado, `last_healthcheck_at` actualizado.
3. **Write policy HubSpot**
   - Cambiar a `overwrite_with_audit` con `override_fields=['phone']`.
   - Guardar → persiste a DB.
   - Forzar updateLead con `phone` distinto (test script seed) → audit row aparece.
4. **Disconnect HubSpot**
   - Click "Desconectar" → confirma → card vuelve a estado "Sin conectar".
   - DB: `is_active=false`, `credentials_cipher=null`. Audit histórico se preserva.
5. **Conectar Zoho EU**
   - Idem 1-4 con sandbox Zoho EU.
   - Verificar `integrations.metadata` contiene `api_domain`, `accounts_server`, `location='eu'`.
   - Refresh: esperar 1h (o forzar refresh via test) → DB `credentials_cipher` actualizado.
6. **Exclusividad CRM**
   - Conectar HubSpot + intentar conectar Zoho → card Zoho disabled con tooltip "Desconecta el otro CRM primero".
7. **Audit viewer**
   - Abrir collapse "Audit log" → muestra rows recientes.
   - Filtrar por lead_id → solo rows de ese lead.

## 5. BUG-XXX detectados y corregidos durante el cierre Sprint 2

Ninguno bloqueante. Lint legacy (113 errores pre-Sprint 2) no cambia.

## 6. Env vars NUEVAS que necesita el VPS

| Var                     | Propósito                                           | Dónde obtener                                                                    |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `OAUTH_STATE_SECRET`    | HMAC del state OAuth (CSRF + replay protection)     | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `HUBSPOT_CLIENT_ID`     | Public App HubSpot multi-tenant                     | developers.hubspot.com → Manage Apps → Auth tab                                  |
| `HUBSPOT_CLIENT_SECRET` | idem                                                | idem                                                                             |
| `HUBSPOT_REDIRECT_URI`  | Callback OAuth (debe coincidir en Developer Portal) | `https://dev.automatizaformacion.com/api/integrations/hubspot/auth/callback`     |
| `ZOHO_CLIENT_ID`        | App Zoho (DC donde se creó la cuenta)               | api-console.zoho.com → Server-based app                                          |
| `ZOHO_CLIENT_SECRET`    | idem                                                | idem                                                                             |
| `ZOHO_REDIRECT_URI`     | Callback OAuth                                      | `https://dev.automatizaformacion.com/api/integrations/zoho/auth/callback`        |
| `NEXT_PUBLIC_APP_URL`   | Base pública usada para construir redirect_uri      | URL del VPS                                                                      |

## 7. Notas de despliegue

1. **Migraciones SQL pendientes para VPS:**
   - `20260524110000_help_sections_integrations.sql` (seed help_sections "integrations").
2. **Aplicar via pg-meta REST** (probado en Phase 01 del autoexec plan):
   ```bash
   curl -X POST https://dev.automatizaformacion.com/supabase/pg/query \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d @supabase/migrations/20260524110000_help_sections_integrations.sql
   ```
   O via Easypanel terminal de Supabase con `psql`.
3. **HubSpot Public App** debe registrarse en developers.hubspot.com ANTES del primer connect — sin esto la UI muestra error "server_misconfigured".
4. **Restart Next.js en Easypanel** tras añadir env vars (no hot-reload de env).

## 8. Status final SP-4B

- ⏳ Pendiente de Renzo: ejecutar checklist manual cuando VPS pre-MVP esté listo.
- 🟢 Auto-tests verdes: 168 pass + 4 skipped.
- 🟢 Build verde.
- 🟡 Tests Playwright E2C: se difieren a Sprint 3 (cobertura UI con axe-core).
