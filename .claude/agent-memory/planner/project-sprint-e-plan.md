---
name: project-sprint-e-plan
description: Plan operativo Sprint E creado 20-05-2026. 4 integraciones post-MVP + generalización adapter pattern. Modelo incremental (sub-sprints independientes).
metadata:
  type: project
---

Plan Sprint E creado en `plans/260520-1342-sprint-e-post-mvp-crms/`.

**Why:** Sprint E es post-MVP — 4 integraciones CRM adicionales (Sheets, Salesforce, GHL, AC) + refactor Adapter Pattern. No es un bloque monolítico sino sub-sprints independientes.

**How to apply:** Cuando el usuario pregunte por Sprint E o integraciones post-MVP, referir a este plan. Cada fase puede ejecutarse en paralelo o secuencialmente.

## Fases
- E-01: Google Sheets bidireccional (60-100h) — googleapis ya instalado, CERO deps nuevas
- E-02: Salesforce adapter jsforce@3.x (60-100h) — requiere ADR antes de instalar
- E-03: GoHighLevel OAuth2 v2 (40-80h) — requiere registro GHL Marketplace (burocrático, 2-5 días)
- E-04: ActiveCampaign API Key (20-50h) — más simple, candidato victoria rápida
- E-05: Generalización IntegrationAdapter (20-40h) — SOLO tras E-01..E-04 completos
- E-06: Tier 2 on-demand — Clientify/Bitrix24/Pipedrive/Monday/Holded, ~30-50h cada uno

## Total: 207-378h (excluyendo Tier 2)

## Dependencias críticas
- Sprint C completado es prerequisito de TODAS las fases E
- jsforce ADR necesario para E-02
- GHL Marketplace app necesaria para E-03

## Preguntas abiertas clave (decisión de Renzo)
1. Orden de ejecución E-01..E-04 (¿Sheets primero o AC primero?)
2. Salesforce ISV vs Connected App por tenant
3. GHL app pública vs Private Integration
4. GCP project centralizado vs por tenant (E-01)
