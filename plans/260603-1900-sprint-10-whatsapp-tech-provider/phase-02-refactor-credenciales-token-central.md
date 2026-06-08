# Fase 02 — Refactor de gestión de credenciales (System User token central)

## Context Links

- Plan: [plan.md](plan.md)
- Código actual: [`src/lib/integrations/whatsapp.ts`](../../src/lib/integrations/whatsapp.ts)
- ADR cifrado tokens: [`docs/adr/ADR-017-cifrado-tokens-oauth-aes-256-gcm.md`](../../docs/adr/ADR-017-cifrado-tokens-oauth-aes-256-gcm.md)

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente
- **Descripción:** Cambiar el origen del token de WhatsApp: de un `accessToken` por tenant a un **System User token central** de la app. Por tenant se persiste solo `waba_id` + `phone_number_id`. Introducir `connection_mode` para soportar dual-mode (manual vs tech_provider) sin romper a los tenants vivos.

## Key Insights

- El `WhatsAppBridge` actual recibe `WhatsAppConfig { accessToken, phoneNumberId, wabaId }` en CADA llamada. El refactor mínimo: resolver el token según `connection_mode` antes de construir el `config`.
- **El cuerpo de los métodos `sendTemplateMessage`/`sendTextMessage`/`getAvailableTemplates` NO cambia** — siguen recibiendo `WhatsAppConfig`. Lo que cambia es QUIÉN rellena `accessToken`: un resolver central.
- Tech Provider usa un **Business Integration System User token** largo (no caduca como el del tenant). Esto elimina el dolor actual de tokens expirados.

## Requirements

**Funcionales**

- Resolver de credenciales: dado un tenant, devuelve `{ accessToken, phoneNumberId, wabaId }`.
  - `connection_mode = manual` → token del tenant (comportamiento actual).
  - `connection_mode = tech_provider` → `META_SYSTEM_USER_TOKEN` + `phone_number_id`/`waba_id` del tenant.

**No funcionales**

- Cero regresión para tenants en modo `manual`.
- Token central nunca expuesto al cliente ni logueado.

## Architecture

```
callers (orchestrator, RescueWorker, cron reminders)
   │  tenantId
   ▼
resolveWhatsAppConfig(tenantId)  ← NUEVO (src/lib/integrations/whatsapp-credentials.ts)
   │  lee config.whatsapp.connection_mode
   ├─ manual        → { accessToken: tenant.accessToken, phoneNumberId, wabaId }
   └─ tech_provider → { accessToken: META_SYSTEM_USER_TOKEN, phoneNumberId, wabaId }
   ▼
WhatsAppConfig → WhatsAppBridge.send*(...)   (sin cambios internos)
```

## Related Code Files

- **Crear:** `src/lib/integrations/whatsapp-credentials.ts` (resolver + tipos `connection_mode`)
- **Modificar:** [`src/lib/core/orchestrator.ts`](../../src/lib/core/orchestrator.ts) (~línea 671: usar el resolver en vez de leer `conf.whatsapp.accessToken` directo)
- **Modificar:** [`src/lib/core/workers/RescueWorker.ts`](../../src/lib/core/workers/RescueWorker.ts) (~línea 97)
- **Modificar:** [`src/app/api/cron/appointments/reminders/route.ts`](../../src/app/api/cron/appointments/reminders/route.ts) (~línea 110)
- **Modificar:** schema de config WhatsApp del tenant para admitir `connection_mode`, `waba_id`, `phone_number_id` sin `accessToken` obligatorio
- **Posible migración SQL:** si `config` es columna estructurada, añadir/normalizar campo `connection_mode` (default `manual`)

## Implementation Steps

1. Crear `whatsapp-credentials.ts` con `resolveWhatsAppConfig(tenantId)` y el enum `connection_mode`.
2. Default `connection_mode = manual` para todos los tenants existentes (retrocompatibilidad).
3. Sustituir en orchestrator/RescueWorker/cron la lectura directa de `accessToken` por el resolver.
4. Validar con Zod el shape nuevo de `config.whatsapp`.
5. Asegurar fail-closed: si el modo es `tech_provider` y falta `META_SYSTEM_USER_TOKEN`, NO enviar (igual que el patrón pause-check actual).
6. `npm run typecheck` + tests de regresión del flujo manual.

## Todo List

- [ ] `whatsapp-credentials.ts` con resolver + enum
- [ ] Default `manual` retrocompatible
- [ ] orchestrator/RescueWorker/cron usan el resolver
- [ ] Validación Zod del nuevo shape
- [ ] Fail-closed si falta token central
- [ ] Typecheck + tests verdes

## Success Criteria

- Tenant `manual` envía igual que hoy.
- Tenant `tech_provider` envía usando el token central.
- Token central nunca aparece en logs.

## Risk Assessment

| Riesgo                           | Mitigación                                                   |
| -------------------------------- | ------------------------------------------------------------ |
| Romper el envío de tenants vivos | Default `manual` + tests de regresión antes de tocar callers |
| Token central logueado por error | Reusar helpers de masking (`src/lib/security/pii-mask.ts`)   |

## Security Considerations

- `META_SYSTEM_USER_TOKEN` desde env, lazy (fuera de imagen Docker como `getAuthServiceRoleKey`), nunca en cliente.
- RLS: el resolver corre server-side con service role; valida que el `phone_number_id`/`waba_id` pertenece al tenant.

## Next Steps

- Desbloquea fase 3 (Embedded Signup, que rellena `waba_id`/`phone_number_id` en modo `tech_provider`).
