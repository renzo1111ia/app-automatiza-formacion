# Phase 04 — Webhooks y firmas

## Context Links
- [plan.md](plan.md) — overview Sprint 1
- [RoadMap Bloque 1.4](../RoadMap.md) — tareas 1-12, 1-13, 1-14, 1-15
- [DEEP-FINDINGS-SUMMARY.md](../../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) — DA-4-001, DA-2-007, DA-2-006, DA-2-009
- [docs/audit/deep/DA-2-auth-rls-deep.md](../../docs/audit/deep/DA-2-auth-rls-deep.md)
- [docs/audit/deep/DA-4-llm-voice-deep.md](../../docs/audit/deep/DA-4-llm-voice-deep.md)

## Overview

**Prioridad:** P1 — Crítico. 0/6 webhooks con validación de firma completa. El endpoint más peligroso (Retell tools) cancela citas reales sin autenticación alguna.
**Estado:** 🔘 Pendiente
**Estimación:** 18h (1-12: 4h + 1-13: 6h + 1-14: 2h + 1-15: 6h)
**Agentes:** `esden-agents:code` (implementación) + `esden-agents:security` (verificación HMAC)

La ausencia total de validación de firmas significa que cualquier actor externo puede:
- Falsificar eventos de llamadas Retell y manipular el estado del lead / CRM (1-12).
- Cancelar o agendar citas reales usando el endpoint de tools de Retell sin ninguna credencial (1-13).
- Inyectar mensajes WhatsApp falsos si la env var `WHATSAPP_APP_SECRET` no está configurada (1-14).
- Inyectar leads falsos a cualquier tenant via webhook CRM usando solo el UUID del tenant (1-15).

## Key Insights

- **DA-4-001**: `api/webhooks/retell/route.ts` — Retell firma sus webhooks con HMAC-SHA256 usando `Authorization` header. El endpoint no lo verifica en absoluto.
- **DA-2-007 / DA-3-005**: `api/webhooks/retell/tools/route.ts` — endpoint separado para tool calls de Retell (cancelar/agendar citas). Sin firma, cualquiera puede POST → citas reales canceladas. Es el finding más peligroso operacionalmente.
- **DA-2-006**: `api/webhooks/whatsapp/route.ts:37-45` — la validación HMAC existe pero está dentro de un `if (process.env.WHATSAPP_APP_SECRET)`. Si la env var no está configurada, la validación se omite completamente. Fix: hacer la validación obligatoria y lanzar error de startup si la env var falta.
- **DA-2-009**: `api/webhooks/crm/route.ts:13` — el webhook CRM solo verifica que el `tenant_id` recibido en el body exista en la base de datos. No hay firma — cualquiera que conozca un UUID de tenant puede inyectar leads. **Decisión: secret POR TENANT**. Columna `integrations.webhook_secret_hash` generada al dar de alta la integración del tenant. La validación cruza `tenant_id` del payload con su secret almacenado.

## Requirements

### Funcionales
- 1-12: Implementar verificación HMAC-SHA256 del header `Authorization` de Retell en `webhooks/retell/route.ts`. Rechazar con 401 si falla.
- 1-13: Implementar la misma verificación HMAC en `webhooks/retell/tools/route.ts`. Este endpoint es más crítico porque tiene efectos destructivos (cancelar citas).
- 1-14: Hacer la validación HMAC de WhatsApp obligatoria (no condicional). Si `WHATSAPP_APP_SECRET` no está en env → error explícito al arrancar la app, no bypass silencioso.
- 1-15: Implementar secret **por tenant** en el webhook CRM. Nueva columna `integrations.webhook_secret_hash` (hash bcrypt/SHA-256 del secret). El secret se genera al dar de alta la integración del tenant. La validación en `api/webhooks/crm/route.ts` cruza el `tenant_id` del payload con el `webhook_secret_hash` de su fila en `integrations`. Compatible con HubSpot y Zoho (el secret se configura en cada CRM al registrar el webhook endpoint).

### No funcionales
- La verificación HMAC debe ser timing-safe (`crypto.timingSafeEqual`) para prevenir timing attacks.
- Los rechazos deben loguear el intento fallido (IP, User-Agent, tenant_id si aplica) sin exponer la razón exacta del fallo al caller.
- Las env vars de secrets de firma deben añadirse a `.env.example`.

## Architecture

```
ANTES (vulnerable):
  POST /api/webhooks/retell       → handler() sin verificación de firma
  POST /api/webhooks/retell/tools → handler() sin verificación de firma  ← más peligroso
  POST /api/webhooks/whatsapp     → if (env.WHATSAPP_SECRET) { verify } else { skip }
  POST /api/webhooks/crm          → handler() con solo verificación de tenant_id

DESPUÉS (Ph4 aplicada):
  POST /api/webhooks/retell       → verifyRetellSignature() → 401 si falla → handler()
  POST /api/webhooks/retell/tools → verifyRetellSignature() → 401 si falla → handler()
  POST /api/webhooks/whatsapp     → verifyWhatsAppHMAC() obligatorio → 401 si falla → handler()
  POST /api/webhooks/crm          → leer tenant_id del payload
                                 → buscar integrations.webhook_secret_hash por tenant_id
                                 → verifyHMAC(payload, header_secret, tenant_secret_hash)
                                 → 401 si falla → handler()
```

**Helper de verificación HMAC (reutilizable):**
```ts
// src/lib/webhooks/verify-hmac.ts
export function verifyHMAC(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  const expected = createHmac(algorithm, secret).update(payload).digest('hex');
  const actual = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
}
```

## Related Code Files

**Modificar:**
- `src/app/api/webhooks/retell/route.ts` (1-12)
- `src/app/api/webhooks/retell/tools/route.ts` (1-13)
- `src/app/api/webhooks/whatsapp/route.ts:37-45` (1-14)
- `src/app/api/webhooks/crm/route.ts:13` (1-15)

**Crear:**
- `src/lib/webhooks/verify-hmac.ts` — helper reutilizable timing-safe

## Implementation Steps

### 1-12 — Validación firma webhook Retell (4h)

1. Leer la documentación de firma de Retell (header `Authorization`, formato `sha256=<hex>`).
2. Crear `src/lib/webhooks/verify-hmac.ts` con `verifyHMAC()` timing-safe.
3. En `api/webhooks/retell/route.ts`:
   - Leer el cuerpo raw como `text()` antes de parsear JSON (necesario para HMAC sobre payload original).
   - Extraer header `Authorization` o `x-retell-signature` (verificar nombre exacto en docs Retell).
   - Llamar a `verifyHMAC(rawBody, signature, process.env.RETELL_WEBHOOK_SECRET)`.
   - Si falla: log del intento + `return Response.json({ error: 'Unauthorized' }, { status: 401 })`.
4. Añadir `RETELL_WEBHOOK_SECRET` a `.env.example`.
5. Obtener el secret real desde el dashboard de Retell y añadirlo a Easypanel.
6. Test: POST con payload válido pero firma incorrecta → 401. POST con firma correcta → 200.

### 1-13 — Validación firma Retell tools (6h)

> Este endpoint es el más crítico — cancela/agenda citas reales. Tratarlo con mayor cuidado.

1. Reutilizar `verify-hmac.ts` creado en 1-12.
2. En `api/webhooks/retell/tools/route.ts`:
   - Mismo patrón que 1-12: raw body, extraer firma, verificar HMAC.
   - Añadir una capa adicional: verificar que el `tool_name` recibido es uno de los permitidos (`cancel_appointment`, `schedule_appointment` — la lista permitida debe estar en código, no provenir del payload).
   - Si la herramienta no está en la lista allowlist → 400 (no 401 — es payload inválido, no auth).
3. Test: POST sin firma → 401. POST con firma pero tool_name no permitido → 400. POST válido → 200 + efecto esperado (mock del servicio de citas).
4. Tiempo extra (2h) dedicado a verificar la lógica de cancelación/agendamiento una vez que el auth está resuelto — no cambiarla, solo entenderla y documentar edge cases.

### 1-14 — Validación HMAC WhatsApp obligatoria (2h)

1. En `api/webhooks/whatsapp/route.ts:37-45`, eliminar el `if (process.env.WHATSAPP_APP_SECRET)` que hace la validación opcional.
2. Reemplazar por: si `WHATSAPP_APP_SECRET` no está definido → lanzar error de configuración al arrancar (o devolver 500 con mensaje claro de "misconfiguration").
3. La validación HMAC debe ejecutarse SIEMPRE — no puede ser bypasseada por env var ausente.
4. Añadir `WHATSAPP_APP_SECRET` como required en el startup check de la app (si existe tal mecanismo) o como guard al inicio del handler.
5. Test: llamada sin secret configurado en env → 500 con mensaje de configuración. Llamada con secret incorrecto → 401. Llamada válida → 200.

### 1-15 — Validación firma webhook CRM — secret por tenant (6h)

> **Decisión**: secret POR TENANT (no global). El secret se genera al dar de alta la integración. +2h sobre estimación original por la capa multi-tenant.

1. Crear migración SQL: añadir columna `webhook_secret_hash text` a tabla `integrations`.
   - `supabase/migrations/YYYYMMDD_add_webhook_secret_hash_to_integrations.sql`
   - El campo almacena el hash del secret (no el secret en claro). Usar `SHA-256` o bcrypt según convención del proyecto.
   - Al crear una nueva integración de tenant, generar un secret aleatorio (32+ bytes), hashear y guardar en `webhook_secret_hash`. Devolver el secret en claro una sola vez al admin del tenant para que lo configure en el CRM.

2. En `api/webhooks/crm/route.ts`:
   - Leer `tenant_id` del payload recibido.
   - Buscar `integrations` WHERE `tenant_id = <payload.tenant_id>` → obtener `webhook_secret_hash`.
   - Si no existe fila para ese tenant → 401 (tenant no configurado o spoofing).
   - Extraer el secret del header `X-Webhook-Secret` (o `X-HubSpot-Signature` si es HubSpot).
   - Verificar con `verifyHMAC(rawBody, receivedSecret, storedHash)` — timing-safe.
   - Si falla → log del intento (tenant_id, IP, timestamp) + 401.

3. Compatibilidad con HubSpot y Zoho (MVP):
   - **HubSpot**: firma con `X-HubSpot-Signature-v3` (HMAC-SHA256). Usar `webhook_secret_hash` del tenant como app secret al configurar el webhook en HubSpot.
   - **Zoho**: no firma por defecto. Usar header custom `X-Webhook-Secret` con el secret del tenant. Documentar la configuración en Zoho.

4. Añadir al log: `source` (hubspot/zoho/unknown), `tenant_id`, `timestamp`, resultado de verificación.

5. Eliminar `CRM_WEBHOOK_SECRET` global de `.env.example` — ya no aplica. Documentar en `.env.example` que el secret es por tenant en DB.

6. Test:
   - POST sin header de secret → 401.
   - POST con tenant_id inexistente → 401.
   - POST con tenant_id válido pero secret incorrecto → 401.
   - POST con tenant_id válido y secret correcto → 200 + lead creado en tenant correcto.
   - POST con secret de tenant A para tenant B → 401 (cross-tenant bloqueado).

## Todo List

- [ ] 1-12: Revisar docs Retell para nombre exacto del header de firma
- [ ] 1-12: Crear `src/lib/webhooks/verify-hmac.ts`
- [ ] 1-12: Añadir verificación en `webhooks/retell/route.ts`
- [ ] 1-12: Añadir `RETELL_WEBHOOK_SECRET` a `.env.example`
- [ ] 1-12: Configurar secret en Easypanel
- [ ] 1-12: Tests 401 con firma incorrecta / 200 con firma correcta
- [ ] 1-13: Añadir verificación en `webhooks/retell/tools/route.ts`
- [ ] 1-13: Implementar allowlist de tool_names permitidos
- [ ] 1-13: Tests 401 sin firma / 400 tool desconocido / 200 válido
- [ ] 1-14: Eliminar condicional opcional en `webhooks/whatsapp/route.ts:37-45`
- [ ] 1-14: Añadir guard de startup si WHATSAPP_APP_SECRET falta
- [ ] 1-14: Tests de las 3 condiciones (sin secret, secret incorrecto, válido)
- [ ] 1-15: Crear migración SQL `integrations.webhook_secret_hash text`
- [ ] 1-15: Implementar generación de secret al crear integración (secret en claro → hash → guardar hash)
- [ ] 1-15: Actualizar `webhooks/crm/route.ts` — lookup por tenant_id → verificar HMAC contra hash
- [ ] 1-15: Documentar configuración en HubSpot (X-HubSpot-Signature-v3) y Zoho (X-Webhook-Secret custom)
- [ ] 1-15: Actualizar `.env.example` — eliminar CRM_WEBHOOK_SECRET global, añadir nota sobre secret por tenant en DB
- [ ] 1-15: Tests — 401 sin header / 401 tenant inexistente / 401 secret incorrecto / 401 cross-tenant / 200 válido
- [ ] Typecheck: `npm run typecheck` → 0 errores nuevos

## Success Criteria

- `POST /api/webhooks/retell` con firma incorrecta → 401 (1-12).
- `POST /api/webhooks/retell/tools` con firma incorrecta → 401 (1-13).
- `POST /api/webhooks/retell/tools` con tool_name no permitido → 400 (1-13).
- `POST /api/webhooks/whatsapp` sin `WHATSAPP_APP_SECRET` en env → 500 con mensaje de configuración (1-14).
- `POST /api/webhooks/crm` sin header → 401 (1-15).
- `POST /api/webhooks/crm` con tenant_id inexistente → 401 (1-15).
- `POST /api/webhooks/crm` con secret de tenant A para tenant B → 401 — cross-tenant bloqueado (1-15).
- `POST /api/webhooks/crm` con secret correcto para su tenant → 200 (1-15).
- `timingSafeEqual` confirmado en código de `verify-hmac.ts` (no comparación con `===`).

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|------------|
| Retell cambia su mecanismo de firma y los webhooks dejan de funcionar | Baja | Alto | Documentar versión de API Retell consultada + test de integración con payload real |
| WHATSAPP_APP_SECRET no configurado en Easypanel → app rechaza todos los mensajes | Media | Alto | Asegurar configuración en Easypanel ANTES de hacer la validación obligatoria |
| Webhook CRM de HubSpot usa método de firma distinto al esperado | Media | Medio | Consultar docs oficiales HubSpot antes de implementar; tener fallback a token estático |
| Tenant sin integración configurada → todos sus webhooks fallan con 401 | Alta | Medio | Documentar en onboarding del tenant: configurar integración antes de activar webhooks CRM |
| Secret en claro entregado una sola vez al admin — si se pierde debe regenerarse | Media | Bajo | Implementar endpoint de regeneración de secret en UI admin del tenant |

## Security Considerations

- `timingSafeEqual` es obligatorio para todas las comparaciones de HMAC — la comparación con `===` introduce timing attacks que permiten descubrir el secret por fuerza bruta estadística.
- Los secrets de webhook (`RETELL_WEBHOOK_SECRET`, `WHATSAPP_APP_SECRET`, `CRM_WEBHOOK_SECRET`) nunca van en código ni en git. Solo en Easypanel env vars.
- Los logs de intentos fallidos NO deben incluir el valor del signature recibido (podría usarse para replay attacks si el log es comprometido).

## Next Steps

→ [Phase 05 — Privilege escalation y RLS](phase-05-privilege-escalation-rls.md)
