---
name: project-sprint-2-plan
description: Plan Sprint 2 creado 20-05-2026. Adapter Layer + HubSpot + Zoho MVP. 8 phases, ~104h, depende Sprint 1.
metadata:
  type: project
---

Plan Sprint 2 operativo creado en `plans/260520-1342-sprint-2-adapter-hubspot-zoho/`.

**Why:** Sprint 2 es la Fase 2 del roadmap (MVP integraciones CRM HubSpot + Zoho). Plan creado tras research de ambas APIs.

**Estimación:** ~104h real (2 devs, ~3 semanas). 158h bruto si 1 dev sin paralelismo.

**Fases:**
- phase-01: IntegrationAdapter interface + factory (12h)
- phase-02: HubSpot adapter OAuth2 + webhooks HMAC + anti-loop (44h)
- phase-03: Zoho adapter REST multi-DC + channel renewal (28h)
- phase-04: crm_field_mapping + write_policy R-014 (14h)
- phase-05: UI admin conexión CRM (20h)
- phase-06: crm_write_audit log + viz (10h)
- phase-07: Tests sandbox HubSpot + Zoho (20h)
- phase-08: Cierre + PR + v0.3.0 (~10h)

**Dependencias críticas Sprint 1:** 1-18 (integrations-repository), 1-11 (Zod schemas integrations), 1-26 (cifrado tokens OAuth), 1-23..25 (RLS integrations).

**SDKs:** HubSpot: @hubspot/api-client@^13.5.0. Zoho: REST pura con axios (sin SDK).

**Reports de research:** `plans/reports/researcher-hubspot-integration-20260520.md` + `plans/reports/researcher-zoho-integration-20260520.md`

**How to apply:** Cuando se inicie Sprint 2, verificar primero estado de 1-18, 1-26 antes de empezar phase-02/03.

**7 preguntas abiertas** en `plans/reports/planner-sprint-2-operativo-20260520.md` (región Zoho tenants, apps OAuth HubSpot/Zoho provisionadas, sandboxes disponibles, etc.)
