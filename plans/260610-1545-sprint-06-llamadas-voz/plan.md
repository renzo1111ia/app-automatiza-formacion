---
title: "Sprint 6 — Llamadas de Voz (v0.6.0)"
plan_id: 260610-1545-sprint-06-llamadas-voz
status: PLANNED
version_target: v0.6.0
branch: feature/sprint-06-llamadas-voz
owner: Javi HP
estimate_realistic: 8-14h
created: 2026-06-10
blockedBy: []
blocks: []
relates_to:
  - 260608-1518-sprint-05-zoho-entrada-leads # Sprint 5 (Zoho), precede a este
  - 260522-1830-sprint-refinamiento-herramientas-post-mvp # parte de voz (/calls) MOVIDA aquí desde Refinamiento
---

# Sprint 6 — Llamadas de Voz (v0.6.0)

> CRM comercial dashboard-af. Sprint dedicado a llevar el canal **voz** a paridad
> funcional con WhatsApp en la experiencia de inbox, métricas y lista de leads.
> Backend de voz (Retell + Ultravox + webhook + tabla `llamadas`) **ya existe y es real**.

## Objetivo

Que el equipo comercial pueda **operar y auditar el canal de voz** igual que opera WhatsApp:
una bandeja de "Conversaciones de Voz", configuración centralizada de agentes de voz,
y trazabilidad completa de cada llamada en el dashboard de Llamadas y en la Lista de Leads.

## Decisiones de arquitectura cerradas (Javi HP, 10-06-2026)

1. **Conversaciones de Voz = inbox reutilizado parametrizado por canal**, NO copia-pega.
   `AIAgentInbox` (2281 líneas) se refactoriza ligeramente para aceptar `channel: 'whatsapp' | 'voz'`.
   La nueva ruta monta el MISMO componente filtrado a voz. Evita duplicar deuda (DRY + regla <200 líneas).
2. **Fuente de datos del panel de voz = `chat_messages` (ya poblado por el webhook Retell) + `llamadas`**.
   El webhook ya escribe cada llamada como `chat_messages` (`message_type='SYSTEM_LOG'`, `metadata.call_id/recording_url`)
   y el detalle completo (transcripción, grabación, duración, resumen) en `llamadas`. No se crea backend nuevo.
3. La parte de **lanzador `/calls` real (Retell SDK)** que estaba en el viejo Sprint Refinamiento
   **se absorbe aquí** (endpoint `/api/calls/manual` hoy es STUB).
4. **Lista de Leads** gana 2 columnas booleanas: **"Whats"** y **"Voz"** (verde=usó el canal / rojo=no),
   derivadas por `EXISTS` sobre `chat_messages`(whatsapp) y `llamadas`(voz) por lead.

## Fases

| Fase | Nombre                                                                             | Estim.            | Status | Archivo                                                                                |
| ---- | ---------------------------------------------------------------------------------- | ----------------- | ------ | -------------------------------------------------------------------------------------- |
| 01   | Datos: tabla `conversaciones_voz` (opcional índice) + flags Whats/Voz + origen voz | 1h 30min–2h 30min | 🔘     | [phase-01-datos-flags-canal.md](phase-01-datos-flags-canal.md)                         |
| 02   | Inbox parametrizado por canal + ruta "Conversaciones de Voz" + sidebar             | 3h–5h             | 🔘     | [phase-02-conversaciones-voz-inbox.md](phase-02-conversaciones-voz-inbox.md)           |
| 03   | Config de voz centralizada en `/dashboard/voice-agents`                            | 1h–2h             | 🔘     | [phase-03-config-voz-centralizada.md](phase-03-config-voz-centralizada.md)             |
| 04   | Dashboard Llamadas + Lista de Leads (2 columnas Whats/Voz)                         | 2h–3h             | 🔘     | [phase-04-metricas-llamadas-lista-leads.md](phase-04-metricas-llamadas-lista-leads.md) |
| 05   | Lanzador `/calls` real (Retell SDK) + Cierre (CLOSE-1..5)                          | 2h–3h             | 🔘     | [phase-05-lanzador-real-y-cierre.md](phase-05-lanzador-real-y-cierre.md)               |

**Total estimado realista: 8–14h** (alineado con RoadMap.md Estimaciones V2).

## Dependencias clave

- **Precede**: Sprint 5 (Zoho entrada de leads) debe estar mergeado a `developer` (lo está, PR #25).
- **Backend voz existente** (NO se reimplementa, solo se consume):
  - `src/lib/integrations/retell.ts`, `src/lib/integrations/ultravox.ts`
  - `src/app/api/webhooks/retell/route.ts` (poblador de `chat_messages` + `llamadas`)
  - Tablas: `voice_agents`, `voice_agent_variants`, `llamadas`, `chat_messages`, `lead`
- **Template a reutilizar**: `src/components/agents/AIAgentInbox.tsx`, `src/lib/actions/inbox.ts`, `src/app/dashboard/conversaciones/page.tsx`

## Riesgos transversales

- `AIAgentInbox.tsx` es enorme (2281 líneas). El refactor por canal debe ser **mínimo y aditivo**
  (prop + filtros condicionales), sin reescribir el componente, para no desestabilizar WhatsApp.
- RLS multi-tenant: cualquier tabla/consulta nueva (conversaciones_voz, flags) filtra por `tenant_id`.
- Tests con BD real (no mocks Supabase) — política de proyecto.

## Definición de "hecho" del Sprint

- [ ] Sub-item "Conversaciones de Voz" en grupo Leads del sidebar, misma UX que WhatsApp.
- [ ] Panel central de voz muestra transcripción + grabación + duración por llamada.
- [ ] Toda config de agentes de voz accesible desde `/dashboard/voice-agents`.
- [ ] Toda llamada se refleja en Métricas > Llamadas (KPIs cuadran con `llamadas`).
- [ ] Leads de voz aparecen en Lista de Leads con `origen='llamada_voz'`.
- [ ] Lista de Leads muestra columnas "Whats" y "Voz" (verde/rojo) correctas.
- [ ] CLOSE-1..5 verdes (typecheck/lint/build/test + E2C local + push + PR a developer).
