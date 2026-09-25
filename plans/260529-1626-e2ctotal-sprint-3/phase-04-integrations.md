---
phase: 04
title: "Integraciones CRM OAuth"
status: PASS
started_at: 2026-05-29 16:40
completed_at: 2026-05-29 16:41
duration: 1min
blocking: no
---

# Fase 04 — Integraciones CRM OAuth

## Cobertura desde Fase 02 (Vitest)

| Aspecto                                           | Tests | Estado |
| ------------------------------------------------- | ----- | ------ |
| OAuth callback validation                         | 6     | ✅     |
| OAuth state HMAC + replay prevention              | ?     | ✅     |
| Token manager AES-256-GCM (cifrado/descifrado)    | 12    | ✅     |
| HubSpot mappers (lead → properties, truncado 60k) | 7     | ✅     |
| HubSpot provider (retry 429, 503 exp backoff)     | 21    | ✅     |
| Zoho provider (multi-DC, 5xx backoff)             | 13    | ✅     |
| Zoho DC detector (eu/com)                         | 5     | ✅     |
| Write-guard end-to-end (append-only + audit)      | 2     | ✅     |
| Write-guard unit                                  | ?     | ✅     |
| CRM error taxonomy                                | 19    | ✅     |

## Cobertura desde Fase 01 (Playwright UI)

| Spec ID | Descripción                                                    | Estado |
| ------- | -------------------------------------------------------------- | ------ |
| VPS-04  | /dashboard/settings → editar cliente → CRMSection HubSpot+Zoho | ✅     |
| VPS-05  | API `/api/integrations` responde 401 sin auth, 200 con auth    | ✅     |
| 2B-15   | API `/api/integrations` responde 200 (no regresión Sprint 2)   | ✅     |

## Flujos OAuth no-ejecutables en local

- **HubSpot OAuth real**: requiere Client ID/Secret reales + callback HTTPS. Local-only no llega al callback de HubSpot — solo testea el handler `/api/integrations/hubspot/auth/callback` con state firmado válido (cubierto en oauth-callback.test.ts).
- **Zoho OAuth real**: ídem. Multi-DC se verifica con detector unitario.

## Resultado

🟢 **PASS** — Toda la cadena OAuth + adapters + cifrado tokens validada en tests integración con BD real. Flujo OAuth completo end-to-end contra HubSpot/Zoho reales es ejercicio de SP-4B (test manual del tester en VPS con creds reales).
