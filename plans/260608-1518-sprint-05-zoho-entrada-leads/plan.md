---
title: "Sprint 5 — Zoho CRM como entrada de leads (bidireccional)"
description: "Ingesta EVENT-DRIVEN de leads desde Zoho (webhook instantáneo, sin polling) + writeback bidireccional de cambios de stage. Reutiliza el adapter Zoho de Sprint 2. Patrón de referencia: Sprint 4 Sheets."
status: pending
priority: P1
effort: 13-18h
version_target: v0.5.0
branch: feature/sprint-05-zoho-entrada-leads
sprint_id: SP-5Z
tags: [zoho, crm, pull, writeback, bidireccional, integrations, post-mvp]
created: 2026-06-08
last_updated: 2026-06-08
blockedBy: []
blocks: []
---

# Plan — Sprint 5: Zoho CRM como entrada de leads

> **Fuente de verdad de la planificación:** `plans/RoadMap.md` § "Fase 5 — Sprint 5".
> **Reporte de exploración:** [`reports/codebase-zoho-sheets-map.md`](reports/codebase-zoho-sheets-map.md).
> **Patrón de referencia:** `src/lib/integrations/sheets/*` (Sprint 4). **Reutiliza:** adapter Zoho `src/lib/integrations/crm/providers/zoho.ts` (Sprint 2).

## Objetivo

Hasta ahora Zoho era solo **destino de salida** (push de leads del CRM interno → Zoho, Sprint 2). Este sprint añade la dirección de **entrada EVENT-DRIVEN**: en cuanto un lead entra (o se modifica) en Zoho, **Zoho avisa a nuestro sistema al instante** vía webhook y el lead entra automáticamente — sin polling, sin esperar a un cron. Además, los cambios de stage del lead interno se reflejan de vuelta en Zoho (writeback bidireccional).

## Decisión de arquitectura (EVENT-DRIVEN — decisión Javi HP 08-06-2026)

- **Entrada instantánea por webhook, NO polling.** En cuanto un lead entra/cambia en Zoho → Zoho hace POST a nuestro endpoint → el lead entra en el sistema en segundos.
- **Dos vías de suscripción al evento (ambas soportadas):**
  - **Principal — Notifications API (Zoho v8):** nuestra app se suscribe programáticamente a eventos del módulo Leads con 1 clic en la UI (patrón idéntico a Sheets `setupWatch`). La suscripción caduca → cron de **renovación** (NO de polling de leads).
  - **Fallback — Workflow Webhook manual:** el tenant configura en su panel Zoho una regla "al crear/editar Lead → POST a nuestra URL" siguiendo una guía. No caduca. Para tenants que lo prefieran o no puedan dar permisos de Notifications API.
- **Red de seguridad — reconciliación diaria:** 1 pull idempotente al día (`searchLeads` por `Modified_Time`) que recupera cualquier lead que el webhook se haya perdido (Zoho caído, server reiniciando). NO es el mecanismo principal — es solo backstop. Idempotente, no duplica.
- **Idempotencia por `zoho_lead_id`** (Zoho da IDs únicos — más simple que el hash de fila de Sheets). El webhook trae el/los `id`; hacemos `getLead(id)` para traer el lead completo.
- **Writeback** vía `ZohoCRMProvider.updateLead()` + outbox + trigger SQL (patrón Sheets).
- **Audit R-014** reutiliza `CrmWriteAuditRepository` con `crm_type='zoho'`, `write_policy='overwrite_with_audit'`.

## Fases

| #   | Fase                                                                             | Archivo                                             | Estim. | Estado       |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ------ | ------------ |
| 00  | **Setup Zoho de test** (acciones del usuario — webhook + OAuth)                  | [phase-00](phase-00-setup-zoho-test.md)             | (user) | 🔘 Pendiente |
| 01  | Capa de datos (migraciones SQL + tipos Zod)                                      | [phase-01](phase-01-capa-datos-migraciones.md)      | 2-3h   | 🔘 Pendiente |
| 02  | **Webhook entrante Zoho** + suscripción Notifications API + procesador de evento | [phase-02](phase-02-pull-processor-mapper.md)       | 4-5h   | 🔘 Pendiente |
| 03  | Writeback bidireccional + trigger + audit                                        | [phase-03](phase-03-writeback-trigger-audit.md)     | 2-3h   | 🔘 Pendiente |
| 04  | UI configuración (auto-suscripción + guía manual) + Server Actions               | [phase-04](phase-04-ui-actions.md)                  | 2-3h   | 🔘 Pendiente |
| 05  | Cron renovación suscripción + reconciliación diaria (red de seguridad)           | [phase-05b](phase-05b-renovacion-reconciliacion.md) | 1-2h   | 🔘 Pendiente |
| 06  | Tests + cierre (CLOSE-1/1.5/2/4/5)                                               | [phase-05](phase-05-tests-cierre.md)                | 2-3h   | 🔘 Pendiente |

**Total:** 13-19h dev + cierre.

## Dependencias

- ✅ Adapter Zoho Sprint 2 (`crm/providers/zoho.ts`) — lectura + escritura + OAuth multi-DC ya operativos.
- ✅ `CrmWriteAuditRepository`, `write-guard.ts`, `token-manager.ts`, `factory.ts` — reutilizables directos.
- ✅ `phone-country.ts` (Sprint 4) — reutilizable directo para autorelleno de país.
- ✅ Tabla `integrations` con row Zoho del tenant (creada en Sprint 2 al conectar OAuth).
- ⚠️ Requiere tenant con conexión Zoho OAuth activa para E2E (entorno de pruebas Zoho).

## Criterios de éxito (cierre OK cuando)

- Tenant activa la recepción de leads de Zoho desde la UI admin (auto 1 clic o guía manual).
- **Crear un lead en Zoho → en segundos aparece en el sistema** (vía webhook, sin esperar a un cron).
- Re-entrega del mismo evento NO duplica (dedup + idempotencia por `zoho_lead_id`).
- Un lead perdido por fallo puntual del webhook se recupera en la reconciliación diaria.
- Writeback bidireccional cambios de stage → Zoho (sin bucle push/pull infinito).
- `crm_write_audit` registra todo sync (R-014, `overwrite_with_audit`).
- Autorelleno: `origen='zoho_crm'`, `fecha_ingreso_crm`, `tipo_lead='zoho_import'`, país por prefijo.
- Webhook valida token por tenant (403 si inválido). Cron fail-closed en prod.
- RLS tenant-only en tablas nuevas. typecheck + lint + build + tests verdes.

## No incluye (fuera de alcance)

- Sincronización de entidades distintas a Leads (Contacts, Deals, etc.).
- Backfill histórico masivo (solo desde la conexión hacia adelante; la reconciliación es incremental, no full).
- Mapeo avanzado de campos custom de Zoho más allá del editor básico (suficiente para el MVP del sprint).
