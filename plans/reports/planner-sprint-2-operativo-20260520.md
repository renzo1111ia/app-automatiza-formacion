# Planner Report — Sprint 2 Operativo

**Agente:** planner (Sonnet)  
**Fecha:** 20-05-2026  
**Scope:** Plan operativo completo Sprint 2 — Adapter Layer + HubSpot + Zoho MVP  

---

## Resumen

Plan Sprint 2 creado en `plans/260520-1342-sprint-2-adapter-hubspot-zoho/` con 8 archivos (plan.md + 7 phase files). Se han producido previamente 2 reports de research (HubSpot + Zoho) que fundamentan las estimaciones y la arquitectura.

---

## Archivos creados (8)

| Archivo | Descripción |
|---------|-------------|
| `plans/reports/researcher-hubspot-integration-20260520.md` | Research HubSpot: OAuth2 vs Private App, API v3 endpoints, webhook HMAC SHA-256, rate limits, @hubspot/api-client@13.5.0, anti-loop strategy |
| `plans/reports/researcher-zoho-integration-20260520.md` | Research Zoho: Multi-DC routing, OAuth2 multi-tenant, REST sin SDK, Notifications API (channel renewal cada 50min), rate limits credit-based |
| `plans/260520-1342-sprint-2-adapter-hubspot-zoho/plan.md` | Overview sprint: 8 fases, dependencias críticas Sprint 1, criterios de éxito globales |
| `phase-01-integration-adapter-interface.md` | 2-01: Interface TypeScript `IntegrationAdapter` + factory por tenant. Patrón R-016 replicado para CRM. 12h. |
| `phase-02-adapter-hubspot.md` | 2-02: OAuth2 Public App + @hubspot/api-client + webhooks HMAC + anti-loop + BullMQ queue. 44h. |
| `phase-03-adapter-zoho.md` | 2-03: OAuth2 Multi-DC + REST axios per-tenant + Notifications API + channel renewal cron. 28h. |
| `phase-04-field-mapping-write-policy.md` | 2-04: tabla crm_field_mapping + R-014 enforcement (append_only/overwrite_with_audit). 14h. |
| `phase-05-ui-admin-conexion-crm.md` | 2-05: Panel admin conexión CRM, OAuth buttons, field mapping editable, solo rol admin. 20h. |
| `phase-06-write-audit-y-visualizacion.md` | 2-06: tabla crm_write_audit append-only + vista historial en UI. 10h. |
| `phase-07-tests-sandbox.md` | 2-07: Tests integración contra sandbox real HubSpot + Zoho. NO mocks. Fixtures para CI. 20h. |
| `phase-08-cierre-sprint.md` | SP-C-CLOSE-1..5: auto tests + Playwright + test manual + PR + v0.3.0. ~10h. |

---

## Estimación total con desglose

| Tarea RoadMap | Phase | Estimación |
|---------------|-------|-----------|
| 2-01 Interface + factory | phase-01 | 12h |
| 2-02 HubSpot adapter completo | phase-02 | 44h |
| 2-03 Zoho adapter multi-DC | phase-03 | 28h |
| 2-04 field_mapping + write_policy | phase-04 | 14h |
| 2-05 UI admin CRM | phase-05 | 20h |
| 2-06 write_audit + viz | phase-06 | 10h |
| 2-07 Tests sandbox | phase-07 | 20h |
| SP-C-CLOSE (cierre) | phase-08 | ~10h |
| **Total Sprint 2** | | **~158h bruto / ~104h real** |

**Nota sobre diferencia bruto vs real:** Las fases 2-02 y 2-03 son paralelizables (2 devs o 2 sesiones paralelas). Con paralelismo 2-02‖2-03 el path crítico es ~114h. Adicionalmente 2-04 schema puede avanzar desde el día 1 en paralelo con 2-01. Resultado práctico:

| Con 1 dev | Con 2 devs (paralelismo 2-02‖2-03) |
|-----------|-------------------------------------|
| ~158h = 4 semanas | ~114h = ~3 semanas |

Esto cae dentro del rango RoadMap (80-120h estimación original era para 2 devs, sin cierre). Incluyendo cierre (10h), el rango es 90-130h para 2 devs, alineado.

**Discrepancia con estimación original (80-120h):** La estimación original no incluía el cierre del sprint (10h). Sin cierre: 94h desarrollo puro con 2 devs, dentro del rango. El research descubrió que HubSpot adapter es más complejo de lo esperado (anti-loop, OAuth Public App, webhook raw body en Next.js) — de ahí los 44h vs los ~24-40h del brief. Zoho resultó algo más simple que el máximo (28h vs 40h) porque no hay SDK que gestionar.

---

## Dependencias críticas con Sprint 1

| Dependencia | Qué bloquea | Riesgo si falta |
|-------------|-------------|-----------------|
| **1-18** `integrations-repository.ts` | Factory (2-01) + todos los adapters | Bloqueo total de Sprint 2 |
| **1-11** Zod schemas `integrations` | Types en adapters (2-02, 2-03) | Adapters no tipados |
| **1-26** Cifrado AES-256 tokens OAuth | 2-02 + 2-03 (tokens en BD) | Vulnerabilidad crítica — bloquea por seguridad |
| **1-23..1-25** RLS en tabla `integrations` | Aislamiento multi-tenant | Sin RLS: tenant A lee tokens tenant B |

**Excepción al bloqueo:** Phase-01 (interface + tipos) y phase-04 (solo schema BD) pueden iniciarse sin 1-18 usando tipos inline provisionales. Esto permite avanzar ~26h antes de que 1-18 esté disponible.

---

## Reports de researchers consumidos

- `plans/reports/researcher-hubspot-integration-20260520.md` — HubSpot OAuth2 multi-tenant, API v3, webhooks HMAC, rate limits 110/10s, @hubspot/api-client@13.5.0, sandbox Developer Test Account
- `plans/reports/researcher-zoho-integration-20260520.md` — Zoho Multi-DC routing (api_domain en OAuth response), Notifications API (channel token + 1h expiry), rate limits credit-based, REST pura con axios, sandbox Developer Edition
- `plans/reports/adr-auditoria-dependencias-20260520.md` — confirmación SDK HubSpot `@hubspot/api-client@^13.5.0`, Zoho REST sin SDK

---

## Decisiones de diseño tomadas en el plan

| Decisión | Justificación |
|----------|---------------|
| HubSpot: OAuth2 Public App (no Private App) | Multi-tenant require que cada academia conecte su propia cuenta — Private App no lo soporta |
| Zoho: REST pura con axios (no SDK) | ADR audit confirmado. Sin SDK oficial npm verificado. axios ya instalado. |
| Anti-loop HubSpot: property custom + TTL Redis | Property-based más robusto que header-based. Sin Redis: `node:crypto` timestamp en property. |
| Zoho channel renewal: BullMQ cron cada 50min | Canal expira en 60min máximo. 50min da 10min buffer. |
| write_policy UI: solo `append_only` + `overwrite_with_audit` (no `overwrite` puro) | Proteger datos de clientes. `overwrite` sin audit es demasiado permisivo en MVP. |
| Tests CI: fixtures pre-grabados | NO llamadas reales a sandbox en CI. Tests de integración reales solo en local/staging. |

---

## Preguntas abiertas para el usuario

1. **Región Zoho de los tenants esperados:** ¿Los centros de formación clientes estarán principalmente en `.eu` (España) o en `.com` (Latam)? ¿O mezcla? Esto afecta qué región mostrar por defecto en la UI de conexión.

2. **OAuth app HubSpot:** ¿Tenéis ya creada una app OAuth en developers.hubspot.com? Si no, hay que crearla antes de 2-02. Necesita: Client ID, Client Secret, Redirect URI, y configurar las subscriptions de webhooks.

3. **OAuth app Zoho:** Ídem para Zoho API Console (api-console.zoho.com). ¿Ya existe? ¿Multi-DC está habilitado?

4. **Developer Test Account HubSpot + Developer Edition Zoho:** ¿Están disponibles para el equipo de dev? Son necesarios para 2-07. Si no: el equipo necesita crearlos antes de iniciar 2-07 (~1-2 días de setup).

5. **Campo `qualified` en Zoho:** El research mapea `qualified → Calificado_IA` (campo custom en Zoho). ¿Existe este campo ya en los portales Zoho de los clientes, o hay que crearlo como parte del onboarding? Si no existe, hay que añadir una instrucción en el flujo de conexión.

6. **Bidireccionalidad Zoho en MVP:** El research recomienda inbound (Zoho → nuestro sistema via webhook) en 2-03. ¿Está en scope del MVP o se aplaza? HubSpot sí tiene bidireccionalidad completa en 2-02. Confirmar si 2-03 también la necesita o solo outbound.

7. **1-26 en calendario:** ¿En qué semana se estima completar 1-26 (cifrado tokens)? Es el prerequisito más crítico para poder iniciar 2-02 y 2-03 de manera segura.

---

**Status:** DONE  
**Summary:** Plan Sprint 2 creado con 8 phase files, 2 research reports producidos directamente, estimación ~104h (2 devs, ~3 semanas). Arquitectura adapter pattern implementando interfaz común, OAuth2 Public App para HubSpot y REST multi-DC para Zoho, R-014 append-only enforced, audit log completo. 7 preguntas abiertas identificadas para validación con el usuario.
