# Fase 07 — Tests (unit + integración) + docs guía tenant

## Context Links

- Plan: [plan.md](plan.md)
- Tests WhatsApp existentes: `tests/` (patrón Vitest del proyecto)

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente
- **Descripción:** Cobertura de tests del nuevo flujo (resolver dual-mode, callback Embedded Signup, suscripción WABA) y documentación de cara al tenant sobre cómo conectar WhatsApp con el nuevo botón.

## Key Insights

- El proyecto usa BD real en integración (regla: NO mocks de Supabase ni de la cadena RLS). Para Meta sí se mockea la Graph API (igual que se mockea HubSpot con MSW en `tests/mocks/hubspot-handlers.ts`).
- El test crítico es el **resolver dual-mode**: garantizar que `manual` no regresiona y `tech_provider` usa el token central.

## Requirements

**Funcionales**

- Unit: `resolveWhatsAppConfig` para ambos modos + caso fail-closed (falta token central).
- Unit: extracción de `waba_id`/`phone_number_id` del callback.
- Integración: callback Embedded Signup con Graph API mockeada (MSW).
- Integración: `subscribeWabaToApp` (respuesta OK + error).

**No funcionales**

- Coverage razonable del nuevo código.
- Sin datos reales en fixtures.

## Architecture

```
tests/integrations/whatsapp/
  ├─ credentials-resolver.test.ts   (dual-mode + fail-closed)
  ├─ embedded-signup-callback.test.ts (MSW Graph API)
  └─ subscribe-waba.test.ts
tests/mocks/
  └─ meta-graph-handlers.ts  (MSW handlers Graph API, análogo a hubspot-handlers.ts)
```

## Related Code Files

- **Crear:** `tests/integrations/whatsapp/credentials-resolver.test.ts`
- **Crear:** `tests/integrations/whatsapp/embedded-signup-callback.test.ts`
- **Crear:** `tests/integrations/whatsapp/subscribe-waba.test.ts`
- **Crear:** `tests/mocks/meta-graph-handlers.ts`
- **Crear:** `docs/integrations/whatsapp-tenant-connect-guide.md` (guía de cara al tenant: "Cómo conectar WhatsApp")

## Implementation Steps

1. Crear handlers MSW para la Graph API de Meta (token exchange, subscribed_apps, message_templates).
2. Tests unit del resolver dual-mode + fail-closed.
3. Tests de integración del callback Embedded Signup.
4. Tests de `subscribeWabaToApp` (éxito + error).
5. Redactar `whatsapp-tenant-connect-guide.md` (con capturas en `docs/screenshots/`).
6. `npm run typecheck` + `lint` + `test` verdes.

## Todo List

- [ ] MSW handlers Graph API
- [ ] Tests resolver dual-mode + fail-closed
- [ ] Tests callback Embedded Signup
- [ ] Tests subscribeWabaToApp
- [ ] Guía tenant + capturas
- [ ] Typecheck + lint + test verdes

## Success Criteria

- Todos los tests nuevos pasan.
- No hay regresión en la suite existente.
- Guía de tenant publicada.

## Risk Assessment

| Riesgo                             | Mitigación                                                      |
| ---------------------------------- | --------------------------------------------------------------- |
| Mock de Graph API diverge del real | Basar handlers en respuestas reales capturadas durante fase 3-4 |

## Security Considerations

- Fixtures sin tokens ni datos personales reales.

## Next Steps

- Desbloquea fase 8 (cierre con protocolo CLOSE-1..5).
