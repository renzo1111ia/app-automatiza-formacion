# Fase 03 — Embedded Signup (SDK JS + config_id + callback + intercambio de token)

## Context Links

- Plan: [plan.md](plan.md)
- Fase previa (resolver): [phase-02](phase-02-refactor-credenciales-token-central.md)
- Callback OAuth análogo: [`src/app/api/integrations/[provider]/auth/callback/route.ts`](../../src/app/api/integrations/[provider]/auth/callback/route.ts)

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente
- **Descripción:** Implementar el flujo Embedded Signup de Meta: el SDK JS de Facebook abre un popup donde el tenant inicia sesión y autoriza; recibimos un `code` que intercambiamos server-side por el acceso a su WABA. Persistimos `waba_id` + `phone_number_id` y marcamos `connection_mode = tech_provider`.

## Key Insights

- Embedded Signup = Facebook JS SDK (`FB.login`) con `config_id` (el de la app dedicada) + `response_type=code` + `override_default_response_type=true`.
- El `code` se intercambia por un Business Integration System User token, pero como Tech Provider el patrón habitual es: obtener el `waba_id` y `phone_number_id` del shared WABA y operar con el token de sistema central (fase 2). El intercambio confirma el grant.
- El callback server-side es muy parecido al de CRMs ya existente ([provider]/auth/callback) — reutilizar el patrón de intercambio + persistencia cifrada.

## Requirements

**Funcionales**

- Botón que lanza `FB.login` con el `config_id`.
- Endpoint callback que recibe el `code`, lo intercambia y extrae `waba_id` + `phone_number_id`.
- Persistir por tenant: `waba_id`, `phone_number_id`, `connection_mode = tech_provider`.

**No funcionales**

- CSP: permitir el dominio del SDK de Facebook (`connect.facebook.net`) — revisar [`next.config.ts`](../../next.config.ts).
- Manejo de cancelación/cierre del popup sin dejar estado a medias.

## Architecture

```
UI: <ConnectWhatsAppButton>  → FB.login({config_id, response_type:'code'})
        │ code (sessionInfoListener / response.authResponse.code)
        ▼
POST /api/integrations/whatsapp/embedded-signup/callback   ← NUEVO
        │ intercambia code → confirma grant + lee assets (waba_id, phone_number_id)
        ▼
persistir en config.whatsapp { waba_id, phone_number_id, connection_mode: 'tech_provider' }
        ▼
(fase 4) suscribir la WABA al webhook de la app
```

## Related Code Files

- **Crear:** `src/app/dashboard/settings/integrations/whatsapp/ConnectWhatsAppButton.tsx` (SDK JS + FB.login)
- **Crear:** `src/app/api/integrations/whatsapp/embedded-signup/callback/route.ts` (intercambio code → assets)
- **Crear:** `src/lib/integrations/whatsapp-onboarding.ts` (lógica de intercambio + extracción de assets)
- **Modificar:** [`next.config.ts`](../../next.config.ts) (CSP `script-src`/`connect-src` para `connect.facebook.net` / `graph.facebook.com`)
- **Modificar:** schema config WhatsApp (campos del modo tech_provider)

## Implementation Steps

1. Cargar el SDK JS de Facebook de forma diferida (solo en la página de integraciones).
2. Implementar `ConnectWhatsAppButton` con `FB.login` + `config_id` desde `META_CONFIG_ID`.
3. Capturar el `code` (message listener del Embedded Signup) y POST al callback.
4. Callback: intercambio del `code`, leer `waba_id` + `phone_number_id` de los assets compartidos.
5. Persistir con `connection_mode = tech_provider` (no se guarda token por tenant).
6. Ajustar CSP en `next.config.ts` y verificar que no rompe el dashboard.
7. Manejar errores/cancelación con mensaje claro al usuario.

## Todo List

- [ ] SDK JS Facebook cargado diferido
- [ ] `ConnectWhatsAppButton` con `FB.login` + `config_id`
- [ ] Callback intercambio `code` → assets
- [ ] Persistencia `waba_id`/`phone_number_id`/`connection_mode`
- [ ] CSP actualizada y verificada
- [ ] Errores/cancelación gestionados

## Success Criteria

- Un tenant de prueba conecta su WABA con 1 clic, sin pegar tokens.
- `config.whatsapp` queda con los 3 campos del modo tech_provider.

## Risk Assessment

| Riesgo                                                              | Mitigación                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| CSP bloquea el SDK (incidente conocido E2E-260527-003 con Supabase) | Probar CSP en local antes de cerrar; añadir solo los dominios necesarios |
| Popup bloqueado por navegador                                       | Lanzar `FB.login` desde gesto de usuario directo (onClick)               |

## Security Considerations

- El `code` se intercambia SOLO server-side; nunca exponer `META_APP_SECRET` al cliente.
- Validar que el tenant autenticado es el dueño de la sesión antes de persistir.

## Next Steps

- Desbloquea fase 4 (UI completa + suscripción de la WABA al webhook).
