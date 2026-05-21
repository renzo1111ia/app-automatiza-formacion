---
title: "9-01 — Clientify Adapter (on-demand)"
status: backlog
priority: P3
estimation: 30-50h (con SP-8) / 60-80h (sin SP-8)
phase_id: 9-01
sprint_id: SP-9
branch: feature/sp-9-clientify-adapter (al activarse)
created: 2026-05-21
---

# Phase 01 — Clientify Adapter (placeholder on-demand)

## Context Links

- [plan.md](plan.md) — overview Sprint 9
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md`
- Sprint 8 (generalización): `../260521-0000-sprint-8-generalization/plan.md`

## Overview

- **Prioridad:** P3 — **placeholder on-demand**
- **Estado:** Backlog — NO se ejecuta sin pedido cliente + aprobación
- **Audiencia:** PYME española. CRM + WhatsApp + IA en español. Casos en academias ES.
- **Complejidad:** Media-baja. Docs pobres (riesgo principal).

## Condiciones de activación

Esta fase se activa SOLO si se cumplen TODAS:

1. ≥2 tenants españoles solicitan Clientify explícitamente
2. ROI evaluado positivo (esfuerzo vs adopción)
3. Renzo aprueba el mini-sprint
4. Sprint 8 está completo (recomendado, no obligatorio)

## Spec API

- **Auth:** API Key
- **Base URL:** `https://api.clientify.net/v1/`
- **Headers:** `Authorization: Token <api_key>`
- **Webhooks:** limitados (no documentados públicamente — confirmar en spike)
- **Rate limit:** no documentado claramente — asumir conservador (5 req/s)

## Spike obligatorio antes de comprometer estimación

- 4h de exploración de docs API + endpoints de contacts/deals
- Probar API Key real con cuenta trial
- Confirmar capacidad de webhooks (críticos para pull)
- Output: documento `spike-clientify-{date}.md` con findings

## Template de mini-sprint a generar al activarse

Cuando se aprueba, crear:

```
plans/YYMMDD-HHmm-sprint-9-01-clientify/
├── plan.md
├── phase-01-spike-y-auth.md
├── phase-02-contacts-deals.md
├── phase-03-webhook-pull (si soportado).md
├── phase-04-ui-admin.md
└── phase-05-tests-cierre.md
```

## Pasos mínimos (cuando se active)

1. Spike 4h de exploración
2. ADR si hay nueva dep (preferir REST puro)
3. `ClientifyAdapter implements IntegrationAdapter` (interfaz Sprint 8)
4. Contact + Deal sync via API Key
5. Webhook pull si soportado, o polling fallback
6. Tests: contract test (Sprint 8) + integration test básico
7. UI: reusar formulario genérico
8. PR + bump versión

## Estimación

- **Con Sprint 8 completo:** 30-50h
- **Sin Sprint 8:** 60-80h
- **Incluye spike:** 4h fixed antes de comprometer

## Success Criteria (al activarse)

- Contact sync lead Esden → contact Clientify funcional
- Pasa `adapter.contract.test.ts`
- 0 nuevas deps de producción
- Doc tenant para setup API Key

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Docs pobres bloquean implementación | Alta | Medio | Spike obligatorio antes de comprometer |
| Sin webhooks → solo push (pull con polling) | Alta | Bajo | Implementar polling job como fallback |
| API Key Clientify revocable sin warning | Media | Bajo | Detectar 401 → marcar `status='revoked'` |

## Next Steps

- Esperar pedido cliente + aprobación Renzo
- Al activarse: crear plan detallado siguiendo template
