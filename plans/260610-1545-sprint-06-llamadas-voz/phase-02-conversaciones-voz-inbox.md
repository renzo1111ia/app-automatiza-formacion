# Fase 02 — Inbox parametrizado por canal + ruta "Conversaciones de Voz"

## Context Links

- Plan: [plan.md](plan.md) · Depende de [phase-01-datos-flags-canal.md](phase-01-datos-flags-canal.md)
- Template a reutilizar: `src/components/agents/AIAgentInbox.tsx` (2281 líneas)
- Página WhatsApp: `src/app/dashboard/conversaciones/page.tsx`
- Server actions: `src/lib/actions/inbox.ts` (653 líneas — `getInboxLeads`, `getChatHistory`, etc.)
- Sidebar: `src/components/layout/Sidebar.tsx:84-100` (grupo "Leads")

## Overview

- **Prioridad**: Crítica (entregable principal del sprint).
- **Status**: 🔘 Pendiente.
- **Descripción**: Crear la bandeja "Conversaciones de Voz" con **mismo diseño y funcionamiento**
  que "Conversaciones WhatsApp", reutilizando `AIAgentInbox` parametrizado por canal.

## Key Insights

- "Duplicar exactamente" se resuelve por **reutilización** (decisión Javi HP): mismo componente,
  prop `channel`. Misma UX garantizada porque es literalmente el mismo render.
- El panel central, en modo voz, muestra **transcripción + grabación (audio player) + duración**.
  ⚠️ **CORRECCIÓN tras review (F-003)**: el detalle (transcripción/grabación/duración/resumen) está en la tabla
  **`llamadas`**, NO en `chat_messages`. Hoy `getChatHistory` mapea las llamadas a `SYSTEM_LOG` y **descarta**
  `url_grabacion`/`transcripcion`. Hay que crear un **tipo de item de voz nuevo** (`VoiceCallMessage` o union),
  NO forzar la estructura `ChatMessage` (solo soporta TEXT/TEMPLATE/SYSTEM_LOG/IMAGE/DOC).
- ⚠️ **CORRECCIÓN tras review (F-001)**: el refactor NO es "aditivo y mínimo". `AIAgentInbox` (2281 LOC) está
  cableado a WhatsApp en ~12 puntos (`getWhatsAppTemplates`, botón "Plantilla Meta", "WhatsApp Activo", placeholders,
  timeline "Cualificación WhatsApp"...). Parametrizar por canal exige **condicionales transversales**. Por eso la fase
  se divide en **02a** (read-only: lista + ver llamadas) y **02b** (audio player + transcripción + resumen). Riesgo
  de regresión WhatsApp ALTO → E2C de WhatsApp obligatorio al cerrar 02a, antes de 02b.

## Requirements

**Funcionales**

- Nueva ruta `/dashboard/conversaciones-voz` con la misma estructura de 3 paneles (lista · conversación · detalle lead).
- Lista muestra solo leads que tienen actividad de voz (al menos una `llamada`).
- Panel central renderiza cada llamada con: estado, duración, reproductor de la grabación (`url_grabacion`),
  transcripción y resumen AI.
- Nuevo sub-item "Conversaciones de Voz" en el grupo **Leads** del sidebar, junto a "Conversaciones whatsapp".

**No funcionales**

- Sin regresión en WhatsApp (default `channel='whatsapp'`). **E2C de WhatsApp obligatorio al cerrar 02a** (no esperar a fase 05).
- Cualquier archivo nuevo <200 líneas. El componente `AIAgentInbox` SÍ recibe condicionales por canal (no es trocear,
  pero tampoco es "solo aditivo" — revisar diffs línea a línea para no romper WhatsApp).

**División de la fase (review F-008/PLAN-HIGH-006, estim 6-9h)**

- **02a (read-only, ~3-4h)**: prop `channel`, ruta + sidebar, `getInboxLeads`/`getChatHistory` por canal,
  lista de leads con voz + ver llamadas como items (estado/duración/fecha). Cierra con E2C WhatsApp verde.
- **02b (rich, ~3-5h)**: tipo `VoiceCallMessage` + `VoiceCallCard` (audio player + transcripción colapsable + resumen),
  manejo de grabación NULL/expirada (onError → "grabación no disponible").

## Architecture

```
/dashboard/conversaciones        → <AIAgentInbox channel="whatsapp" />  (existente, default)
/dashboard/conversaciones-voz    → <AIAgentInbox channel="voz" />        (NUEVO)

AIAgentInbox(channel)
  ├─ getInboxLeads({ channel })        → filtra lista por canal (voz: leads con EXISTS en llamadas)
  ├─ getChatHistory(leadId,{channel})  → voz: ordena/renderiza llamadas; whatsapp: mensajes
  └─ MessageItem                       → si voz + metadata.call_id → VoiceCallCard (audio+transcript+duración)
```

## Related Code Files

**Crear**

- `src/app/dashboard/conversaciones-voz/page.tsx` — monta `<AIAgentInbox channel="voz" />` (clon de la página WhatsApp).
- `src/components/agents/voice/voice-call-card.tsx` — tarjeta de llamada (audio player + transcripción + duración + resumen), <200 líneas.

**Modificar**

- `src/components/agents/AIAgentInbox.tsx` — añadir prop `channel?: 'whatsapp' | 'voz'` (default 'whatsapp');
  bifurcar filtro de lista, fetch de historial y render de item por canal. Cambios mínimos y aditivos.
- `src/lib/actions/inbox.ts` — `getInboxLeads`/`getChatHistory` aceptan `{ channel }`:
  - voz → filtra leads con `EXISTS(llamadas)`; historial = registros de `llamadas` del lead (mapeados a items).
  - whatsapp → comportamiento actual intacto.
- `src/components/layout/Sidebar.tsx` — añadir sub-item "Conversaciones de Voz" → `/dashboard/conversaciones-voz`
  con icono (p.ej. `Mic`/`PhoneCall`).

## Implementation Steps

1. Añadir prop `channel` a `AIAgentInbox` con default `'whatsapp'`; pasarlo a las llamadas de server actions.
2. Extender `getInboxLeads` para aceptar `channel`; en modo voz filtrar por leads con llamadas (usar índice fase 01).
3. Extender `getChatHistory` para modo voz: devolver las `llamadas` del lead como items con
   `{ tipo: 'voz', duracion, url_grabacion, transcripcion, resumen, estado, fecha }`.
4. Crear `voice-call-card.tsx`: cabecera (estado+duración+fecha), `<audio controls src={url_grabacion}>`,
   bloque transcripción colapsable, resumen AI. Respetar tema/estilos existentes del inbox.
5. En `AIAgentInbox`, cuando `channel==='voz'` y el item es llamada, renderizar `VoiceCallCard` en el panel central.
6. Crear `conversaciones-voz/page.tsx` (clon de `conversaciones/page.tsx` con `channel="voz"`).
7. Añadir el sub-item al sidebar en el grupo Leads.
8. Verificar paridad visual con la captura de WhatsApp (3 paneles, búsqueda, detalle lead).

## Todo List

- [ ] Prop `channel` en `AIAgentInbox` (default whatsapp, sin regresión).
- [ ] `getInboxLeads({channel})` filtra voz.
- [ ] `getChatHistory({channel})` modo voz desde `llamadas`.
- [ ] `voice-call-card.tsx` (audio + transcripción + duración + resumen).
- [ ] `conversaciones-voz/page.tsx`.
- [ ] Sub-item sidebar "Conversaciones de Voz".
- [ ] Verificación visual paridad WhatsApp.

## Success Criteria

- `/dashboard/conversaciones-voz` muestra la misma UX que WhatsApp, filtrada a voz.
- Cada llamada se reproduce (grabación), muestra transcripción, duración y resumen.
- Panel de detalle del lead idéntico al de WhatsApp.
- WhatsApp sigue funcionando sin cambios (regresión 0).

## Risk Assessment

- **Tamaño de `AIAgentInbox`**: alto riesgo de regresión si se toca de más. Mitigación: cambios aditivos,
  default whatsapp, revisar diffs línea a línea; cubrir con E2C en fase 05.
- **Grabaciones**: `url_grabacion` puede requerir auth/expirar (Retell). Validar reproducción real; si expira,
  documentar y degradar elegante (mostrar "grabación no disponible").

## Security Considerations

- `getInboxLeads`/`getChatHistory` ya filtran por tenant activo — mantener en modo voz.
- No exponer `url_grabacion` de otros tenants (la query filtra por `tenant_id`).

## Next Steps

- Fase 03 consolida la config de agentes de voz (acceso desde voice-agents).
- Fase 05 cubre E2C de esta bandeja.
