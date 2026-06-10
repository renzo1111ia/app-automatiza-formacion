# Plan Review — Sprint 6 Llamadas de Voz (review adversarial 10-06-2026)

> Revisión adversarial del plan contra el código real (4 revisores hostiles por dimensión +
> verificador escéptico por hallazgo). **37 hallazgos, 32 confirmados, 5 refutados.**
> Generado por workflow `plan-review-sprint-6`. Este informe respalda las correcciones aplicadas al plan.

## Resumen ejecutivo

El plan es sólido en estructura pero era **optimista en estimación** (8-14h → realista **14-20h**) y daba por
funcional infraestructura que está **a medias o rota**. Además destapó **deuda de seguridad PRE-EXISTENTE**
(RLS permisivo) ajena al Sprint 6.

## 🔴 Bugs PRE-EXISTENTES del proyecto (NO del Sprint 6)

| ID          | Sev           | Hallazgo                                                                                                                                                                                                               | Evidencia                          |
| ----------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| RLS-001     | CRÍTICO\*     | `base_schema.sql:449-450` crea `authenticated_read_*` con `FOR SELECT TO authenticated USING (true)` en chat_messages/lead/llamadas/conversaciones_whatsapp. Lectura cross-tenant SI hay queries client-side directas. | base_schema.sql:430-452            |
| SCHEMA-001  | HIGH          | `chat_messages.tenant_id` es TEXT; resto de tablas UUID. RLS endurecido futuro fallaría por type mismatch.                                                                                                             | base_schema.sql:191 vs 102/132/175 |
| WEBHOOK-001 | HIGH          | Webhook Retell hace INSERT en `llamadas` sin ON CONFLICT ni UNIQUE(id_llamada_retell, tenant_id). Retry → duplicados → infla dashboard.                                                                                | retell/route.ts:81-98              |
| PHASE04-002 | CRÍTICO datos | `getKpiMinutos` cuenta TODAS las llamadas sin discriminar canal/origen (incluye demo `tipo_agente=NULL`). KPI inflable.                                                                                                | analytics.ts:334-359               |

\*RLS-001: severidad real depende de verificación en VPS (`pg_policies`) — pendiente confirmar antes de actuar.
La app usa service_role + filtro tenant_id en código, lo que mitiga si no hay queries client-side directas.

## 🟠 Supuestos del plan que el código contradice

| ID                                   | Sev          | Hallazgo                                                                                                                                | Corrección aplicada al plan                                                    |
| ------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| F-001                                | CRÍTICO      | `AIAgentInbox` (2281 LOC) cableado a WhatsApp en ~12 puntos. "Refactor aditivo" falso.                                                  | Fase 02 dividida 02a+02b; estim 3-5h → 6-9h                                    |
| F-003                                | CRÍTICO      | `getChatHistory` mapea llamadas a SYSTEM_LOG y descarta url_grabacion/transcripcion. No hay tipo VOICE_CALL ni audio player.            | Plan: crear tipo `VoiceCallMessage` + `VoiceCallCard`, no forzar `ChatMessage` |
| PHASE-05-CRIT-001                    | CRÍTICO      | `calls/page.tsx` es mock `setTimeout`, ni llama al endpoint.                                                                            | Fase 05: conectar handleCall→fetch real                                        |
| PHASE-05-CRIT-002                    | CRÍTICO      | `/api/calls/manual` no acepta `lead_id`; webhook no puede asociar la llamada.                                                           | Fase 05: añadir leadId a Zod + metadata                                        |
| SCHEMA-004 / PHASE04-008             | HIGH         | Webhook no escribe `lead.origen='llamada_voz'`.                                                                                         | Fase 01: UPDATE lead.origen en webhook                                         |
| SCHEMA-002/MISSING-001/MIGRATION-001 | CRÍTICO/HIGH | `conversaciones_voz` no existe (tabla, tipo, backfill, upsert).                                                                         | Fase 01 ya lo cubre (confirmado pendiente)                                     |
| PLAN-HIGH-004                        | HIGH         | Lanzador solo Retell; Ultravox no integrado en `/api/calls/manual`.                                                                     | Plan: Ultravox DESCOPEADO a post-Sprint 6                                      |
| PHASE04-004                          | HIGH         | `HistorialTable` es client; `fetchCalls` no trae flags ni conversaciones_whatsapp.                                                      | Fase 04: flags en server action fetchCalls                                     |
| F-008/PLAN-HIGH-006                  | HIGH         | Estim fase 02 irreal (2281 LOC).                                                                                                        | Estim total → 14-20h                                                           |
| PHASE-05-HIGH-005                    | MEDIUM       | LiveMonitor transcripción "en vivo" es mockup.                                                                                          | Plan: transcripción en vivo DESCOPEADA                                         |
| SCHEMA-003/PHASE04-003               | HIGH/MED     | Discriminación voz/whatsapp por `call_id` sin índice ni constraint; no validada con datos reales.                                       | Fase 01: índice + query de auditoría                                           |
| SCHEMA-005                           | MEDIUM       | `photo_url` (SQL) vs `foto_url` (TS) inconsistente.                                                                                     | Anotado (deuda menor, fuera scope)                                             |
| PHASE04-010                          | MEDIUM       | `getKpiMinutos` retorna arrays vacíos para minutos_por_campana/estado/duración (componente MinutosCharts huérfano).                     | Anotado (deuda, no bloquea)                                                    |
| PHASE-03-CRIT-003                    | HIGH→OPER    | Fase 03 alcance vago sin entregable medible. Config dispersa REAL: `settings/IntegrationsManager.tsx` duplica API keys Retell/Ultravox. | Fase 03: audit report + lista de rutas + consolidar IntegrationsManager        |
| PLAN-MED-008                         | LOW          | Dependencias intra-sprint no centralizadas.                                                                                             | Plan: añadido DAG                                                              |

## ❌ Hallazgos REFUTADOS por el verificador (no son problemas reales)

- **F-004** sendManualMessage acoplado: el plan NO toca esa función.
- **F-005** getWhatsAppTemplates incondicional: crítica a feature no implementada aún (es TODO futuro, no bug).
- **PHASE04-005/006/007** N+1 / índices faltantes: `fetchCalls` hace 2 queries con joins, no N+1. Falsos positivos.

## Verificación RLS-001 en VPS (10-06-2026) — BLOQUEADA: Supabase VPS caído

Intento de consultar `pg_policies` en el VPS vía pg-meta/REST → **fallido por Supabase abajo**, NO por credenciales:

- App Next.js OK: `/api/health` 200, `/api/version` 200 (v0.4.0, Node 22).
- Supabase CAÍDO: `/supabase/auth/v1/health` **500**, `/supabase/rest/v1/lead` **500**, `/supabase/pg/query` **500**.
  El JWT service_role es válido (`eyJhbGci...`, 180 chars) y el path enruta bien (REST root → 308). Es el
  contenedor de BD el que no responde — mismo patrón que el crash documentado 09-06 (`supabase-db` Exited,
  memoria `project-deploy-vps-dokploy-090626`).
- **Verificación RLS-001 queda PENDIENTE** hasta que Supabase VPS vuelva. Query a ejecutar cuando esté arriba:
  `SELECT tablename, policyname, cmd, roles::text, qual FROM pg_policies WHERE tablename IN
('chat_messages','lead','llamadas','conversaciones_whatsapp') ORDER BY 1,2;`
  Buscar si las políticas `authenticated_read_*` tienen `qual = true` (vulnerable) o filtran por `tenant_id`.

## Acciones derivadas

1. **RLS-001**: verificar `pg_policies` en VPS antes de actuar (⏸ BLOQUEADO: Supabase VPS caído 10-06). Si confirma → BUG-SEC fuera del Sprint 6.
2. **Plan actualizado**: estim 14-20h, fase 02 troceada, lanzador con lead_id, tipo VOICE_CALL, Ultravox/live descopeados.
3. **Fase 01 migración `conversaciones_voz`**: debe nacer con RLS correcto (filtrado tenant_id), NO patrón permisivo.
