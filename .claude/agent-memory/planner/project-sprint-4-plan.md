---
name: project-sprint-4-plan
description: Plan operativo Sprint 4 creado 20-05-2026. 4 integraciones post-MVP + generalización adapter pattern. Modelo incremental (sub-sprints independientes).
metadata:
  type: project
---

Plan Sprint 4 creado en `plans/260520-1342-sprint-4-post-mvp-crms/`.

**Why:** Sprint 4 es post-MVP — 4 integraciones CRM adicionales (Sheets, Salesforce, GHL, AC) + refactor Adapter Pattern. No es un bloque monolítico sino sub-sprints independientes.

**How to apply:** Cuando el usuario pregunte por Sprint 4 o integraciones post-MVP, referir a este plan. Cada fase puede ejecutarse en paralelo o secuencialmente.

## Fases
- 4-01: Google Sheets bidireccional (60-100h) — googleapis ya instalado, CERO deps nuevas
- 4-02: Salesforce adapter jsforce@3.x (60-100h) — requiere ADR antes de instalar
- 4-03: GoHighLevel OAuth2 v2 (40-80h) — requiere registro GHL Marketplace (burocrático, 2-5 días)
- 4-04: ActiveCampaign API Key (20-50h) — más simple, candidato victoria rápida
- 4-05: Generalización IntegrationAdapter (20-40h) — SOLO tras 4-01..4-04 completos
- 4-06: Tier 2 on-demand — Clientify/Bitrix24/Pipedrive/Monday/Holded, ~30-50h cada uno

## Total: 207-378h (excluyendo Tier 2)

## Dependencias críticas
- Sprint 2 completado es prerequisito de TODAS las fases E
- jsforce ADR necesario para 4-02
- GHL Marketplace app necesaria para 4-03

## Preguntas abiertas clave (decisión de Renzo)
1. Orden de ejecución 4-01..4-04 (¿Sheets primero o AC primero?)
2. Salesforce ISV vs Connected App por tenant
3. GHL app pública vs Private Integration
4. GCP project centralizado vs por tenant (4-01)
