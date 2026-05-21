---
title: "9-02 — Bitrix24 Adapter (on-demand)"
status: backlog
priority: P3
estimation: 35-50h (con SP-8) / 60-80h (sin SP-8)
phase_id: 9-02
sprint_id: SP-9
branch: feature/sp-9-bitrix24-adapter (al activarse)
created: 2026-05-21
---

# Phase 02 — Bitrix24 Adapter (placeholder on-demand)

## Context Links

- [plan.md](plan.md) — overview Sprint 9
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md`

## Overview

- **Prioridad:** P3 — **placeholder on-demand**
- **Estado:** Backlog
- **Audiencia:** Latam (Argentina, México, Colombia). Plan free atrae academias pequeñas.
- **Complejidad:** Media. API verbosa pero amplia.

## Condiciones de activación

1. ≥2 tenants Latam solicitan Bitrix24
2. ROI positivo
3. Aprobación Renzo
4. Sprint 8 recomendado

## Spec API

- **Auth:** OAuth2 (preferido) o webhook-based token (más simple para self-hosted)
- **Base URL:** depende del subdomain del tenant (`https://<tenant>.bitrix24.com/rest/`)
- **Webhooks:** soportados (`crm.contact.update`, `crm.deal.update`)
- **Rate limit:** 2 req/s sustained (puede ser limitante en sync masivo)

## Template de mini-sprint

```
plans/YYMMDD-HHmm-sprint-9-02-bitrix24/
├── plan.md
├── phase-01-oauth2-o-webhook-token.md
├── phase-02-contacts-deals.md
├── phase-03-webhook-pull.md
├── phase-04-ui-admin.md
└── phase-05-tests-cierre.md
```

## Pasos mínimos

1. ADR auth method (OAuth2 vs webhook token)
2. `Bitrix24Adapter implements IntegrationAdapter`
3. Contact + Deal sync via REST
4. Webhook pull soportado
5. Tests + UI
6. PR + bump versión

## Estimación

- **Con Sprint 8:** 35-50h
- **Sin Sprint 8:** 60-80h

## Success Criteria

- Contact + Deal sync funcional
- Pasa contract test
- 0 deps nuevas

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Rate limit 2 req/s muy bajo | Alta | Medio | Throttle 1.5 req/s + queue |
| API muy verbosa, payloads complejos | Media | Medio | FieldMapper robusto con custom fields |
| Subdomain variable por tenant | Alta | Bajo | Almacenar URL completa en `crm_connections` |

## Next Steps

- Esperar pedido cliente + aprobación
- Al activarse: crear plan detallado
