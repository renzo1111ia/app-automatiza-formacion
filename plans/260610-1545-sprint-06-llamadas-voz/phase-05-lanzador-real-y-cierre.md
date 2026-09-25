# Fase 05 — Lanzador `/calls` real (Retell SDK) + Cierre del Sprint

## Context Links

- Plan: [plan.md](plan.md)
- Endpoint STUB: `src/app/api/calls/manual/route.ts`
- Página calls: `src/app/dashboard/calls/page.tsx`
- Bridge: `src/lib/integrations/retell.ts` (`RetellBridge.createCall`), `src/lib/integrations/ultravox.ts`
- Webhook (cierra el ciclo): `src/app/api/webhooks/retell/route.ts`
- Origen del traspaso: viejo Sprint Refinamiento (`plans/260522-1830-sprint-refinamiento-herramientas-post-mvp/`),
  Fase 02 "Lanzador `/calls` real" — MOVIDA aquí por decisión Javi HP 10-06-2026.

## Overview

- **Prioridad**: Media-Alta.
- **Status**: 🔘 Pendiente.
- **Descripción**: Reemplazar el lanzador de llamadas mock (`setTimeout`) por una llamada real
  vía Retell SDK, cerrando el ciclo lanzar → webhook → `llamadas`/`chat_messages` → inbox de voz.
  Luego ejecutar el protocolo de cierre CLOSE-1..5.

## Key Insights

- El backend (`RetellBridge.createCall`) ya existe; el endpoint `/api/calls/manual` es STUB.
  Conectar el lanzador real es de bajo riesgo si se pasa `metadata.tenant_id` + `metadata.lead_id`
  (el webhook ya los espera para asociar la llamada al inbox).
- Esto valida el sprint completo de punta a punta: una llamada lanzada manualmente debe aparecer
  en Conversaciones de Voz, en el dashboard de Llamadas y marcar el flag "Voz" del lead.

## Requirements

**Funcionales**

- `POST /api/calls/manual` lanza una llamada real con Retell (`createCall`) pasando `tenant_id`+`lead_id` en metadata.
  ⚠️ **Crítico (review PHASE-05-CRIT-002)**: el endpoint HOY **no acepta `lead_id`** en el Zod schema y solo pasa
  `{source, tenant_id}` a `createCall`. Sin `lead_id` el webhook no asocia la llamada → no aparece en el inbox.
- La página `calls/` refleja el estado real (no mock). ⚠️ **Crítico (review PHASE-05-CRIT-001)**: `calls/page.tsx`
  HOY es mock puro (`setTimeout`) que ni llama al endpoint, y `useTenantStore` no extrae `tenantId`.
- Ciclo completo verificable: lanzar → (webhook) → aparece en Conversaciones de Voz + dashboard + flag Voz.
- **DESCOPEADO (review)**: Ultravox en el dialer (solo Retell hoy) y transcripción "en vivo" (LiveMonitor es mockup).

**No funcionales**

- Validación Zod del payload del endpoint.
- Errores manejados (provider caído, número inválido) sin romper la UI.
- Archivos nuevos <200 líneas.

## Architecture

```
calls/page.tsx ──POST──▶ /api/calls/manual (real)
                              │ Zod validate {leadId, agentId, ...}
                              ▼
                       RetellBridge.createCall({ metadata: { tenant_id, lead_id } })
                              │
                   (Retell ejecuta la llamada)
                              ▼
                  /api/webhooks/retell (call_ended/analyzed)
                              ▼
                   llamadas + chat_messages + conversaciones_voz
                              ▼
        Conversaciones de Voz · Dashboard Llamadas · flag "Voz" en Lista de Leads
```

## Related Code Files

**Modificar**

- `src/app/api/calls/manual/route.ts` — reemplazar STUB por `RetellBridge.createCall` real + Zod + manejo de errores.
- `src/app/dashboard/calls/page.tsx` — conectar al endpoint real; reflejar estado/errores reales.

**Crear (si aplica)**

- `src/lib/validations/manual-call.ts` — schema Zod del payload, <60 líneas.

## Implementation Steps

1. **Zod schema** del payload: añadir `leadId` (obligatorio) además de `phoneNumber`, `agentId`, `tenantId`.
2. **`/api/calls/manual` real**: validar que `leadId` existe (query a `lead` por tenant), llamar
   `RetellBridge.createCall` con `metadata: { source:'manual_dialer', tenant_id, lead_id }`. Devolver `callId`.
3. **Conectar `calls/page.tsx`**: extraer `tenantId` de `useTenantStore` (hoy solo saca `tenantName`); `handleCall`
   → `fetch('POST /api/calls/manual', {phoneNumber, agentId, tenantId, leadId})` con loading/error reales;
   quitar el `setTimeout` mock; mostrar `callId` devuelto. (LiveMonitor: dejar claro que es preview, no stream en vivo.)
4. **Prueba E2E manual** del ciclo: lanzar → webhook → verificar en Conversaciones de Voz + dashboard + flag Voz.

### Cierre (Protocolo CLOSE-1..5)

5. **CLOSE-1** Auto test: `npm run typecheck` + `npm run lint` + `npm run build` + `npm test`. Verde obligatorio.
6. **CLOSE-1.5** Security delta (`af-agents:security` modo delta sobre el diff) — OWASP 2021. Críticos bloquean.
7. **CLOSE-2** E2C local (Playwright contra `localhost:8500`): Conversaciones de Voz, dashboard Llamadas,
   Lista de Leads con columnas Whats/Voz, lanzador. + WCAG 2.2 AA en rutas clave. Capturas en `docs/screenshots/`.
8. **CLOSE-4** Corrección de bugs detectados; re-run del paso afectado hasta verde.
9. **CLOSE-5** Push `feature/sprint-06-llamadas-voz` + PR a `developer` (NO mergear sin orden del usuario).
   Hand-off SP-4B N/A (post-MVP). Paso 7 E2E VPS condicional (omitido si no hay deploy VPS).
10. Informe final al usuario + actualizar RoadMap.md (⏱ Push/Cierre) vía `roadmap-keeper` + memoria.

## Todo List

- [ ] Zod schema payload lanzador.
- [ ] `/api/calls/manual` real con `createCall` + metadata.
- [ ] `calls/page.tsx` conectado a endpoint real.
- [ ] Ciclo E2E manual verificado (lanzar→inbox→dashboard→flag).
- [ ] CLOSE-1 auto test verde.
- [ ] CLOSE-1.5 security delta sin críticos.
- [ ] CLOSE-2 E2C local + capturas.
- [ ] CLOSE-4 bugs corregidos.
- [ ] CLOSE-5 push + PR a developer.
- [ ] RoadMap + memoria actualizados.

## Success Criteria

- Una llamada lanzada manualmente recorre todo el ciclo y queda visible en las 3 superficies (inbox voz, dashboard, lista).
- CLOSE-1..5 verdes; PR a developer abierto (sin merge).

## Risk Assessment

- **Coste real de llamada**: lanzar Retell real consume saldo/credenciales. Mitigación: probar con número de test
  y credenciales sandbox; documentar en el informe.
- **Credenciales Retell**: requieren API key configurada (fase 03 / RetellConfigModal). Si no hay, el E2E real se
  difiere y se valida con mock controlado, anotándolo.

## Security Considerations

- Endpoint con Zod + tenant scoping; no aceptar `tenant_id` del cliente (resolver server-side).
- No loguear API keys ni números completos en claro.

## Next Steps

- Tras merge a developer: candidato a promoción `staging` en ventana de deploy (orden explícita del usuario).
