# Fase 03 — Validación Sprint 2 (Adapter HubSpot + Zoho)

## Context Links

- [plan.md](plan.md) — overview Sprint Validación Pre-MVP
- [Sprint 2 plan](../260520-1342-sprint-2-adapters-mvp/plan.md) (si existe; si no, definir en Sprint 2 kickoff)
- [RoadMap Sprint 2](../RoadMap.md)

## Overview

- **Sprint validado**: Sprint 2 — Adapter HubSpot + Zoho (SP-3, v0.3.0).
- **Branch origen**: `feature/sprint-02-adapter-hubspot-zoho` (mergeado a `developer` al cierre Sprint 2).
- **Estado**: 🔘 **Plantilla vacía**. Se rellena automáticamente en `SP-3-CLOSE-5` (cierre Sprint 2).
- **Tester**: por asignar dentro del equipo Renzo.

## Resumen del Sprint 2 a validar

> Pendiente — rellenar al cierre Sprint 2. MVP CRM bidireccional: HubSpot adapter + Zoho adapter (multi-DC) + UI admin de conexión OAuth + sincronización append-only por defecto (R-014) con overwrite opcional auditado.

## 1. Test automático (código)

> ⏳ Pendiente — al cierre Sprint 2.

## 2. Test E2C local (Playwright contra `localhost:8500`)

> ⏳ Pendiente — al cierre Sprint 2. Foco esperado:
>
> - Flujo OAuth completo HubSpot (sandbox / dev portal).
> - Flujo OAuth completo Zoho multi-DC (US, EU).
> - Sincronización lead local → HubSpot + Zoho (append-only).
> - Sincronización CRM → local (consumir webhooks HubSpot + Zoho).
> - Overwrite con audit log (`crm_write_audit`).

## 3. Test E2E VPS (Playwright contra VPS Renzo)

> ⏳ Pendiente — al cierre Sprint 2. Verificar:
>
> - OAuth redirect URIs registrados en HubSpot/Zoho developer consoles para el VPS (URL distinta a localhost).
> - Tokens OAuth cifrados AES-256 en BD (Sprint 1 task 2-26).
> - Webhooks HubSpot/Zoho llegando al VPS y procesándose.

## 4. Test manual del tester (humano)

> ⏳ Pendiente — al cierre Sprint 2. Replicar checklist desde `docs/testeos-manual.md` sección Sprint 2.

## 5. Hotfixes encontrados durante la validación

| BUG-ID  | Severidad | Descripción | Fix aplicado | Commit | Estado |
| ------- | --------- | ----------- | ------------ | ------ | ------ |
| BUG-XXX | —         | —           | —            | —      | 🔘     |

## 6. Subida a GH

- Convención: `fix(validacion-sp2): <descripcion>`.

## Estado de la fase

| Bloque             | Estado       |
| ------------------ | ------------ |
| 1. Test automático | 🔘 Plantilla |
| 2. Test E2C local  | 🔘 Plantilla |
| 3. Test E2E VPS    | 🔘 Plantilla |
| 4. Test manual     | 🔘 Plantilla |
| 5. Hotfixes        | 🔘 Plantilla |
| 6. Subida GH       | 🔘 Plantilla |
