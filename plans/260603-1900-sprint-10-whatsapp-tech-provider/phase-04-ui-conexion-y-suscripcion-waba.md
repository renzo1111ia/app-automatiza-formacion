# Fase 04 — UI de conexión "Conectar WhatsApp" + suscripción de WABA al webhook

## Context Links

- Plan: [plan.md](plan.md)
- UI actual de integraciones: [`src/app/dashboard/settings/IntegrationsManager.tsx`](../../src/app/dashboard/settings/IntegrationsManager.tsx)
- Webhook actual: [`src/app/api/webhooks/whatsapp/route.ts`](../../src/app/api/webhooks/whatsapp/route.ts)

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente
- **Descripción:** Sustituir el formulario manual de 3 campos por una UI de estado de conexión (conectado / no conectado + botón Embedded Signup), y suscribir cada WABA recién conectada al webhook de la app vía Graph API.

## Key Insights

- El form actual ([IntegrationsManager.tsx:447-485](../../src/app/dashboard/settings/IntegrationsManager.tsx)) tiene 3 inputs. En modo tech_provider se ocultan y se muestra el botón + estado.
- En modo dual, los tenants `manual` siguen viendo el form (no romper su UX). Se decide por `connection_mode`.
- Tras conectar, hay que **suscribir la WABA a la app** (`POST /{waba_id}/subscribed_apps`) para que los mensajes entrantes lleguen a NUESTRO webhook. El webhook ya rutea por `phone_number_id` ([route.ts:88](../../src/app/api/webhooks/whatsapp/route.ts)).

## Requirements

**Funcionales**

- UI: estado "Conectado a Meta (Tech Provider)" con número/WABA, o botón "Conectar WhatsApp".
- Acción server: suscribir la WABA al webhook de la app.
- Acción server: desconectar (limpiar `config.whatsapp` del tenant).

**No funcionales**

- Tenants `manual` conservan su formulario sin cambios.

## Architecture

```
IntegrationsManager
  ├─ connection_mode == 'manual'        → form 3 campos (actual, sin cambios)
  └─ connection_mode == 'tech_provider' → <ConnectWhatsAppButton> + estado conexión
                                                │ tras conectar
                                                ▼
                          subscribeWabaToApp(waba_id)  ← POST /{waba_id}/subscribed_apps
                                                ▼
                          webhook /api/webhooks/whatsapp recibe (ya rutea por phone_number_id)
```

## Related Code Files

- **Modificar:** [`src/app/dashboard/settings/IntegrationsManager.tsx`](../../src/app/dashboard/settings/IntegrationsManager.tsx) (render condicional por `connection_mode`)
- **Crear:** server action `subscribeWabaToApp` en `src/lib/integrations/whatsapp-onboarding.ts`
- **Crear:** server action `disconnectWhatsApp` (limpia config)
- **Reusar:** [`ConnectWhatsAppButton.tsx`](#) de la fase 3

## Implementation Steps

1. Render condicional en `IntegrationsManager` según `connection_mode`.
2. Integrar `ConnectWhatsAppButton` en la rama tech_provider.
3. Implementar `subscribeWabaToApp` (Graph API `POST /{waba_id}/subscribed_apps` con token central).
4. Llamar a la suscripción tras el callback exitoso de Embedded Signup.
5. Implementar `disconnectWhatsApp` + botón de desconexión.
6. Mostrar estado (número conectado, fecha) leyendo `config.whatsapp`.

## Todo List

- [ ] Render condicional por `connection_mode`
- [ ] Botón Embedded Signup integrado
- [ ] `subscribeWabaToApp` operativo
- [ ] Suscripción automática tras conexión
- [ ] `disconnectWhatsApp` + botón
- [ ] Estado de conexión visible

## Success Criteria

- Tenant tech_provider ve estado de conexión, no inputs de token.
- Mensaje entrante a la WABA conectada llega al webhook y se procesa.
- Tenant manual no ve cambios.

## Risk Assessment

| Riesgo                                | Mitigación                                                    |
| ------------------------------------- | ------------------------------------------------------------- |
| WABA no suscrita → no llegan mensajes | Verificar suscripción tras conectar; reintento + estado en UI |
| Confusión visual entre modos          | Copy claro + badge de modo                                    |

## Security Considerations

- La suscripción usa el token central server-side; validar pertenencia del `waba_id` al tenant.
- RLS en lectura/escritura de `config.whatsapp`.

## Next Steps

- Desbloquea fase 5 (migración de tenants vivos al nuevo modo).
