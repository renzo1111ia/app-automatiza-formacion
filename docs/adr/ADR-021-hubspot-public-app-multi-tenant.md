# ADR-021 — HubSpot Public App + OAuth 2.0 multi-tenant

- **Status:** Accepted
- **Date:** 2026-05-24
- **Sprint:** SP-3 (Sprint 2 — Adapter HubSpot + Zoho)
- **Deciders:** Bea (clienta) + Javi HP (arquitecto)

## Contexto

Necesitamos conectar cada tenant (academia formativa) a su propio portal HubSpot. Cada portal tiene su `hub_id`, sus contacts/deals, su lifecyclestage configurado, etc. Una sola app Private (Private App o API key) no funciona: vive en un solo portal.

## Decisión

Registrar UNA Public App en `developers.hubspot.com` que se distribuye a múltiples portales vía OAuth 2.0 authorization code flow.

Cada tenant que conecta inicia el flow OAuth y obtiene su par `access_token + refresh_token` por separado, persistido en `integrations` (cifrado AES-256-GCM, Sprint 1 ADR-017). El `hub_id` (portal_id) se extrae del response del token exchange (o del `/oauth/v1/access-tokens/{token}` introspect como fallback) y se persiste en `integrations.portal_id`.

Las env vars del proyecto (`HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`) son las credenciales de la app única; los tokens de cada tenant son secretos por separado.

## Alternativas rechazadas

| Alternativa                                   | Razón rechazo                                       |
| --------------------------------------------- | --------------------------------------------------- |
| Private App por cada tenant                   | Operativamente inviable: setup manual por academia. |
| API Key (legacy HubSpot)                      | Deprecated en HubSpot. No soporta multi-portal.     |
| Multi-instance del dashboard (uno por tenant) | Rompe la arquitectura multi-tenant del proyecto.    |

## Consecuencias

**Positivas:**

- Onboarding self-service: el cliente aprueba la app desde su portal, sin intervención del equipo dev.
- Tokens revocables individualmente (el usuario desinstala la app en HubSpot UI).
- 1 sola app a mantener en `developers.hubspot.com`.

**Negativas / costes operacionales:**

- Gestionar rotación de `refresh_token` (HubSpot rota a veces — TokenManager Sprint 2 cubre).
- HubSpot no expone endpoint público de revoke OAuth → `disconnect()` solo limpia local. Documentado en `hubspot-app-setup.md`.
- App debe pasar review de HubSpot si se quiere listar en Marketplace público (no necesario para clientes privados).

## Implementación

- `src/lib/integrations/crm/providers/hubspot.ts` (provider class).
- `src/app/api/integrations/hubspot/auth/start|callback/route.ts` (OAuth routes).
- `docs/integrations/hubspot-app-setup.md` (guía de registro manual).
- Env vars en `.env.example` + Easypanel.

## Referencias

- HubSpot OAuth docs: https://developers.hubspot.com/docs/api/working-with-oauth
- Research: `plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-01-hubspot.md` §1.
