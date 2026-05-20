---
title: "5-06 — Tier 2 On-Demand (Clientify, Bitrix24, Pipedrive, Monday, Holded)"
sprint_task: 5-06
status: backlog
priority: P3
effort: 30-50h cada CRM (NO en estimación total del sprint)
branch: feature/sp-5-06-{crm}-adapter (por CRM, cuando se pida)
version_bump: v0.5.x (por CRM)
agents: [af-agents:code, af-agents:api]
---

# 5-06 — Tier 2 On-Demand

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- [Research CRM sector](../../docs/audit/RESEARCH-CRM-SECTOR-FORMACION-ES-LATAM.md) — análisis Tier 2
- [phase-05-adapter-pattern-generalization.md](phase-05-adapter-pattern-generalization.md) — interfaz base (hacer ANTES de Tier 2)

## Overview

- **Prioridad**: P3 — **solo bajo pedido cliente**
- **Estado**: Backlog — NO se planifica proactivamente
- **Descripción**: Adapters adicionales para CRMs de menor penetración. Cada CRM = un sub-sprint independiente que solo arranca cuando un cliente lo pide explícitamente.

## Modelo de ejecución

**NO se implementan en batch.** Cada CRM se planifica de forma individual cuando:
1. Un cliente (academia) pide el conector específico
2. Se estima el ROI (¿cuántos tenants lo usarán?)
3. Se aprueba el mini-sprint con el usuario (Renzo)

Con 5-05 completado (interfaz genérica), cada Tier 2 debería tardar ~30-50h en vez de ~60-100h.

---

## CRMs Tier 2

### Clientify
- **Audiencia**: PYME española. CRM + WhatsApp + IA en español. Casos en academias ES.
- **API**: REST + API Key. Webhooks limitados (no documentados públicamente).
- **Complejidad**: Media-baja. Docs pobres (riesgo principal).
- **Cuándo implementar**: Si 2+ tenants españoles lo piden.

### Bitrix24
- **Audiencia**: Latam (Argentina, México, Colombia) — plan free atrae academias pequeñas.
- **API**: REST (OAuth2 o webhook-based token). Webhooks soportados.
- **Complejidad**: Media. La API de Bitrix24 es amplia pero verbosa.
- **Cuándo implementar**: Si 2+ tenants Latam lo piden.

### Pipedrive
- **Audiencia**: genérica. Penetración baja en formación pero base instalada legacy.
- **API**: REST + OAuth2. Docs excelentes. Webhooks bien documentados.
- **Complejidad**: Baja-media. API limpia, similar a HubSpot.
- **Cuándo implementar**: Si tenants con Pipedrive legacy lo piden.

### Monday CRM
- **Audiencia**: equipos de gestión de proyectos. Fit bajo con formación. Solo si academia tiene Monday como CRM corporativo.
- **API**: GraphQL (diferente al resto — no REST). Requiere adaptación del FieldMapper.
- **Complejidad**: Media-alta (GraphQL).
- **Cuándo implementar**: Solo si cliente específico lo pide y hay ROI claro.

### Holded
- **Audiencia**: PYME española. ERP + CRM. Integración diferente — no es solo CRM.
- **API**: REST + API Key. Docs razonables.
- **Complejidad**: Media. Modelo de datos mezcla ERP (facturas, productos) con CRM.
- **Cuándo implementar**: Si academia ya usa Holded como ERP y quiere sync de leads.

---

## Template de mini-sprint por CRM Tier 2

Cuando se aprueba un CRM Tier 2, crear:

```
plans/YYMMDD-HHmm-sprint-5-{crm}-adapter/
├── plan.md
├── phase-01-{crm}-adapter.md
└── phase-02-tests-cierre.md
```

Pasos mínimos de cada mini-sprint:
1. Research rápido (2-4h): leer docs API, auth method, endpoints clave, rate limits
2. ADR si hay nueva dep (ej. si se decide instalar SDK)
3. Implementar adapter siguiendo `IntegrationAdapter` interface (5-05 ya hecho)
4. Tests: contract test (ya existe en 5-05) + integration test básico
5. UI: reusar formulario genérico de conexión, mínimas customizaciones
6. PR + bump versión

---

## Estimaciones Tier 2 (con 5-05 completo)

| CRM | Auth | Docs | Est. con 5-05 | Sin 5-05 |
|-----|------|------|----------------|---------|
| Pipedrive | OAuth2 | Excelentes | 25-35h | 50-70h |
| Clientify | API Key | Pobres | 30-50h | 60-80h |
| Bitrix24 | OAuth2/webhook | Medias | 35-50h | 60-80h |
| Monday | OAuth2 + GraphQL | Buenas | 40-60h | 70-100h |
| Holded | API Key | Razonables | 30-40h | 50-70h |

---

## Success Criteria (por CRM)

- Contact sync funcional (lead → contact en CRM)
- Pasa `adapter.contract.test.ts`
- 0 nuevas dependencias de producción si es posible (REST puro)
- Documentación para el tenant (guía de configuración)

## Risk Assessment

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Docs Clientify pobres | Medio | Spike de 4h de exploración antes de comprometerse |
| Monday GraphQL no encaja con interfaz REST | Medio | `parseWebhookPayload?` y métodos opcionales de la interfaz |
| Bitrix24 API verbose y cambiante | Bajo | Test integration con Bitrix24 trial antes de implementar |

## Next Steps

- Fase 6 NO arranca proactivamente
- Prerequisito recomendado: 5-05 completado (interfaz genérica reduce esfuerzo ~40%)
- Disparador: pedido explícito de cliente + aprobación de Renzo
