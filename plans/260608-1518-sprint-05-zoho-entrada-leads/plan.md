---
title: "Sprint 5 — Zoho CRM como entrada de leads (bidireccional)"
description: "Pull de leads desde Zoho al CRM interno + writeback bidireccional de cambios de stage. Clon funcional del Sprint 4 Google Sheets reutilizando el adapter Zoho de Sprint 2."
status: pending
priority: P1
effort: 10-15h
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

Hasta ahora Zoho era solo **destino de salida** (push de leads del CRM interno → Zoho, Sprint 2). Este sprint añade la dirección de **entrada**: leads originados en Zoho se sincronizan al CRM interno (pull), y los cambios de stage del lead interno se reflejan de vuelta en Zoho (writeback). Paridad funcional con el Sprint 4 Google Sheets.

## Decisión de arquitectura

- **PULL periódico por cron** (no webhook en MVP del sprint): el adapter Zoho ya tiene `searchLeads(criteria)` — se consulta `Modified_Time > last_synced_at` cada N minutos. Webhook Zoho entrante = mejora opcional (Fase 5 / backlog).
- **Idempotencia por `zoho_lead_id`** (Zoho ya da IDs únicos — más simple que el hash de fila de Sheets).
- **Writeback** vía `ZohoCRMProvider.updateLead()` + outbox + trigger SQL (patrón Sheets).
- **Audit R-014** reutiliza `CrmWriteAuditRepository` con `crm_type='zoho'`, `write_policy='overwrite_with_audit'`.

## Fases

| #   | Fase                                        | Archivo                                         | Estim. | Estado       |
| --- | ------------------------------------------- | ----------------------------------------------- | ------ | ------------ |
| 01  | Capa de datos (migraciones SQL + tipos Zod) | [phase-01](phase-01-capa-datos-migraciones.md)  | 2-3h   | 🔘 Pendiente |
| 02  | Pull processor + lead-mapper + cola         | [phase-02](phase-02-pull-processor-mapper.md)   | 3-4h   | 🔘 Pendiente |
| 03  | Writeback bidireccional + trigger + audit   | [phase-03](phase-03-writeback-trigger-audit.md) | 2-3h   | 🔘 Pendiente |
| 04  | UI configuración + Server Actions           | [phase-04](phase-04-ui-actions.md)              | 2-3h   | 🔘 Pendiente |
| 05  | Tests + cierre (CLOSE-1/1.5/2/4/5)          | [phase-05](phase-05-tests-cierre.md)            | 2-3h   | 🔘 Pendiente |

**Total:** 11-16h dev + cierre (dentro del rango 10-15h realista).

## Dependencias

- ✅ Adapter Zoho Sprint 2 (`crm/providers/zoho.ts`) — lectura + escritura + OAuth multi-DC ya operativos.
- ✅ `CrmWriteAuditRepository`, `write-guard.ts`, `token-manager.ts`, `factory.ts` — reutilizables directos.
- ✅ `phone-country.ts` (Sprint 4) — reutilizable directo para autorelleno de país.
- ✅ Tabla `integrations` con row Zoho del tenant (creada en Sprint 2 al conectar OAuth).
- ⚠️ Requiere tenant con conexión Zoho OAuth activa para E2E (entorno de pruebas Zoho).

## Criterios de éxito (cierre OK cuando)

- Tenant configura Zoho como fuente de entrada de leads desde UI admin.
- Pull leads Zoho → CRM interno funcional (sin duplicados, idempotencia por `zoho_lead_id`).
- Writeback bidireccional cambios de stage → Zoho (sin bucle push/pull infinito).
- `crm_write_audit` registra todo sync (R-014, `overwrite_with_audit`).
- Autorelleno: `origen='zoho_crm'`, `fecha_ingreso_crm`, `tipo_lead='zoho_import'`, país por prefijo.
- RLS tenant-only en tablas nuevas. typecheck + lint + build + tests verdes.

## No incluye (fuera de alcance)

- Webhook Zoho entrante en tiempo real (queda como mejora; el MVP del sprint usa pull por cron).
- Sincronización de entidades distintas a Leads (Contacts, Deals, etc.).
- Backfill histórico masivo (solo `Modified_Time` hacia adelante desde la conexión).
