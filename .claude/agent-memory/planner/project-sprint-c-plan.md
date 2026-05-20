---
name: project-sprint-c-plan
description: Plan Sprint C creado 20-05-2026. Adapter Layer + HubSpot + Zoho MVP. 8 phases, ~104h, depende Sprint B.
metadata:
  type: project
---

Plan Sprint C operativo creado en `plans/260520-1342-sprint-c-adapter-hubspot-zoho/`.

**Why:** Sprint C es la Fase C del roadmap (MVP integraciones CRM HubSpot + Zoho). Plan creado tras research de ambas APIs.

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

**Dependencias críticas Sprint B:** B-18 (integrations-repository), B-11 (Zod schemas integrations), B-26 (cifrado tokens OAuth), B-23..25 (RLS integrations).

**SDKs:** HubSpot: @hubspot/api-client@^13.5.0. Zoho: REST pura con axios (sin SDK).

**Reports de research:** `plans/reports/researcher-hubspot-integration-20260520.md` + `plans/reports/researcher-zoho-integration-20260520.md`

**How to apply:** Cuando se inicie Sprint C, verificar primero estado de B-18, B-26 antes de empezar phase-02/03.

**7 preguntas abiertas** en `plans/reports/planner-sprint-c-operativo-20260520.md` (región Zoho tenants, apps OAuth HubSpot/Zoho provisionadas, sandboxes disponibles, etc.)
