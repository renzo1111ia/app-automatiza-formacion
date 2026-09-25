# Phase 07 — Tests de Integración Sandbox HubSpot + Zoho (3-07)

## Context Links

- Research HubSpot (sandbox info): `plans/reports/researcher-hubspot-integration-20260520.md` §7
- Research Zoho (sandbox info): `plans/reports/researcher-zoho-integration-20260520.md` §8
- Interface + adapters: `plans/260520-1342-sprint-2-adapter-hubspot-zoho/phase-01` a `phase-06`
- CLAUDE.md: "Test con BD real en integración — NO mocks de Supabase ni mocks de la cadena RLS"

## Overview

- **Prioridad:** P1 — sin tests contra sandbox los adapters no están validados para producción
- **Estado:** Pendiente — requiere 3-01..3-06 completos
- **Descripción:** Suite de tests de integración contra cuentas sandbox reales de HubSpot (Developer Test Account) y Zoho (Developer Edition). Los tests validan el flujo completo end-to-end: OAuth, push contact, webhook inbound, field mapping, audit log.

## Key Insights

- **NO mocks de HubSpot/Zoho en tests de integración.** Los tests deben llamar a las APIs sandbox reales para validar que los contratos de la API se respetan. Mocks solo en tests unitarios de lógica interna.
- **Fixtures para CI:** para evitar calls reales en CI pipeline, grabar respuestas de sandbox con `nock` o `axios-mock-adapter` una vez y reproducirlas. Los tests de integración reales solo se ejecutan manualmente o en staging.
- **HubSpot sandbox:** Developer Test Account. Rate limit Free tier (110/10s). Webhook testing: necesita endpoint público → ngrok en local.
- **Zoho sandbox:** Developer Edition account. Rate limit Free tier (5000 créditos/día, 5 concurrent). Canal webhook expira en 1h.
- **BD real:** los tests usan la BD de Supabase local (docker/local dev) con RLS activa — no in-memory.
- Estrategia: tests de integración en directorio `src/__tests__/integrations/` — NO en `src/__tests__/unit/`.

## Requirements

**Tests a implementar:**

### 3-07.1 HubSpot — Tests de integración
- `hubspot-oauth.integration.test.ts` — flujo completo OAuth (con código sandbox conocido)
- `hubspot-adapter.integration.test.ts`:
  - `pushContact` con `append_only`: verifica que no sobreescribe campo existente
  - `pushContact` con `overwrite_with_audit`: verifica que escribe + genera AuditEntry
  - `pullContacts`: trae lista de contacts de sandbox
  - `testConnection`: retorna `{ ok: true }` con credenciales sandbox
- `hubspot-webhook.integration.test.ts`:
  - Simular POST al endpoint `/api/webhooks/hubspot` con firma válida → procesa
  - Simular POST con firma inválida → rechaza 401
  - Simular POST con timestamp > 5min → rechaza
  - Anti-loop: si TTL activo → skip

### 3-07.2 Zoho — Tests de integración
- `zoho-oauth.integration.test.ts` — flujo OAuth Multi-DC (region EU + US)
- `zoho-adapter.integration.test.ts`:
  - `pushContact` (Lead) con `append_only`: no sobreescribe
  - `pushContact` con `overwrite_with_audit`: escribe + AuditEntry
  - `pullContacts`: search by criteria
  - `testConnection`: retorna `{ ok: true }`
- `zoho-webhook.integration.test.ts`:
  - Simular POST con token válido → procesa
  - Simular POST con token inválido → rechaza
- `zoho-channel-manager.integration.test.ts`:
  - `ensureChannel`: crea canal si no existe
  - Canal renovado cuando expira

### 3-07.3 Write Audit — Tests
- `write-audit.integration.test.ts`:
  - `overwrite_with_audit` → genera exactamente 1 entrada en `crm_write_audit`
  - `append_only` → no genera entrada en `crm_write_audit`
  - Fallo de insert audit no interrumpe operación principal

### 3-07.4 Field Mapping — Tests
- `field-mapping.integration.test.ts`:
  - Seed de defaults al conectar HubSpot/Zoho
  - Resolver retorna mappings correctos
  - Cache Redis funciona

## Architecture

```
src/__tests__/
├── integrations/
│   ├── hubspot/
│   │   ├── hubspot-oauth.integration.test.ts
│   │   ├── hubspot-adapter.integration.test.ts
│   │   └── hubspot-webhook.integration.test.ts
│   ├── zoho/
│   │   ├── zoho-oauth.integration.test.ts
│   │   ├── zoho-adapter.integration.test.ts
│   │   ├── zoho-webhook.integration.test.ts
│   │   └── zoho-channel-manager.integration.test.ts
│   ├── write-audit.integration.test.ts
│   └── field-mapping.integration.test.ts
└── fixtures/
    ├── hubspot/
    │   ├── contact-created-webhook.json
    │   ├── contact-property-change-webhook.json
    │   └── oauth-token-response.json
    └── zoho/
        ├── notification-leads-create.json
        ├── lead-detail-response.json
        └── oauth-token-response.json
```

**Variables de entorno para tests sandbox:**
```
# .env.test (NO commitear — solo local)
HUBSPOT_CLIENT_ID_SANDBOX=xxx
HUBSPOT_CLIENT_SECRET_SANDBOX=xxx
HUBSPOT_TEST_ACCESS_TOKEN=xxx    # token de test account ya conectado
HUBSPOT_TEST_HUB_ID=xxx

ZOHO_CLIENT_ID_SANDBOX=xxx
ZOHO_CLIENT_SECRET_SANDBOX=xxx
ZOHO_TEST_ACCESS_TOKEN=xxx
ZOHO_TEST_API_DOMAIN=https://www.zohoapis.eu   # o .com según sandbox
ZOHO_TEST_ACCOUNTS_DOMAIN=https://accounts.zoho.eu
```

## Related Code Files

**Crear:**
- `src/__tests__/integrations/hubspot/hubspot-adapter.integration.test.ts`
- `src/__tests__/integrations/hubspot/hubspot-webhook.integration.test.ts`
- `src/__tests__/integrations/zoho/zoho-adapter.integration.test.ts`
- `src/__tests__/integrations/zoho/zoho-webhook.integration.test.ts`
- `src/__tests__/integrations/zoho/zoho-channel-manager.integration.test.ts`
- `src/__tests__/integrations/write-audit.integration.test.ts`
- `src/__tests__/integrations/field-mapping.integration.test.ts`
- `src/__tests__/fixtures/hubspot/*.json`
- `src/__tests__/fixtures/zoho/*.json`
- `.env.test.example` — plantilla con placeholders

## Implementation Steps

1. Provisionar cuentas sandbox:
   - HubSpot: crear Developer Test Account en developers.hubspot.com
   - Zoho: crear Developer Edition en zoho.com/crm/developer
2. Configurar ngrok para tests de webhook locales
3. Crear fixtures JSON grabando respuestas reales de sandbox
4. Crear `hubspot-adapter.integration.test.ts`:
   - Setup: insertar tenant test en BD local con tokens sandbox
   - Test `pushContact append_only`: crear contact en HS sandbox → verificar que 2do push no sobreescribe
   - Test `pushContact overwrite_with_audit`: verificar que AuditEntry se crea en BD
   - Teardown: limpiar contact del sandbox + BD local
5. Crear `hubspot-webhook.integration.test.ts`:
   - Usar fixtures de webhook payload
   - Generar firma HMAC válida con client_secret sandbox
   - POST al endpoint → verificar procesamiento
   - POST con firma inválida → verificar 401
6. Repetir pasos 4-5 para Zoho
7. Crear `write-audit.integration.test.ts`
8. Crear `field-mapping.integration.test.ts`
9. Documentar en `.env.test.example` las variables necesarias para ejecutar tests

## Todo List

- [ ] Cuentas sandbox provisionadas (HubSpot + Zoho)
- [ ] ngrok configurado para webhook tests locales
- [ ] Fixtures JSON grabados
- [ ] `hubspot-adapter.integration.test.ts` — append_only + overwrite_with_audit
- [ ] `hubspot-webhook.integration.test.ts` — firma válida + inválida
- [ ] `zoho-adapter.integration.test.ts` — append_only + overwrite_with_audit
- [ ] `zoho-webhook.integration.test.ts` — token válido + inválido
- [ ] `zoho-channel-manager.integration.test.ts` — create + renew
- [ ] `write-audit.integration.test.ts`
- [ ] `field-mapping.integration.test.ts`
- [ ] `.env.test.example` documentado
- [ ] Todos los tests pasan en local
- [ ] Fixtures para CI (nock/axios-mock-adapter) preparados

## Success Criteria

- [ ] Todos los tests de integración pasan contra sandbox reales en local
- [ ] `pushContact append_only` NO sobreescribe campo existente (verificado en sandbox)
- [ ] `pushContact overwrite_with_audit` genera entrada en `crm_write_audit` (verificado en BD)
- [ ] Webhook HubSpot con firma inválida → rechazado (HTTP 401)
- [ ] Webhook Zoho con token inválido → rechazado
- [ ] Zoho canal creado y renovable antes de expirar
- [ ] Tests CI usan fixtures (no llamadas reales)

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Sandbox HubSpot con rate limit bloqueado durante tests | Baja | Medio | Tests con `sleep` entre operaciones. BullMQ queue en tests con concurrencia=1 |
| Zoho Developer Edition en DC US, pero tests EU necesarios | Media | Medio | Crear 2 cuentas: una .com y una .eu. Testear ambas regiones explícitamente |
| ngrok inestable para webhook tests | Media | Bajo | Usar fixtures pregrabados como fallback para tests de firma (no requieren callback) |
| Tokens sandbox expiran entre sesiones de dev | Alta | Bajo | Documentar proceso de refresh manual en `.env.test.example` |

## Security Considerations

- `.env.test` con credenciales sandbox en `.gitignore` — NUNCA commitear
- `.env.test.example` con placeholders — sí commiteable
- Datos de test: usar emails ficticios (`test-XXX-sandbox.test`) para no contaminar sandbox con datos reales

## Agentes Esden asignados

- `af-agents:testing` — toda la fase 3-07

## Estimación

**20h total:**
- Provisionar sandboxes + ngrok: 2h
- Fixtures HubSpot: 2h
- Tests adapter + webhook HubSpot: 6h
- Fixtures Zoho: 2h
- Tests adapter + webhook + channel Zoho: 6h
- Tests write-audit + field-mapping: 2h

## Next Steps

- Phase 08 — Cierre Sprint 2
- Sprint 3 hardening: añadir estos tests al CI pipeline como smoke tests de integración
