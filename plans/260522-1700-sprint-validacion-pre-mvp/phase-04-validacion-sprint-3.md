# Fase 04 — Validación Sprint 3 (Hardening — cierre MVP v0.4.0-rc.1)

## Context Links

- [plan.md](plan.md) — overview Sprint Validación Pre-MVP
- [Sprint 3 plan](../260520-1342-sprint-3-hardening/plan.md)
- [RoadMap Sprint 3](../RoadMap.md)

## Overview

- **Sprint validado**: Sprint 3 — Hardening (SP-4, **v0.4.0-rc.1**).
- **Branch origen**: `feature/sprint-03-hardening` (mergeado a `developer` al cierre Sprint 3).
- **Estado**: 🔘 **Plantilla vacía**. Se rellena automáticamente en `SP-4-CLOSE-5` (cierre Sprint 3).
- **Tester**: por asignar dentro del equipo Renzo.
- **Importancia especial**: esta fase cierra el camino al MVP GA (v0.4.0). El cierre de SP-4B (este sprint Validación) detona el bump v0.4.0-rc.1 → v0.4.0.

## Resumen del Sprint 3 a validar

> Pendiente — rellenar al cierre Sprint 3. Cubre: tests E2E Playwright complementarios, observabilidad (logging + métricas), hardening headers + rate limits global, cleanup técnico final. **Nota**: el dashboard de costes LLM fue MOVIDO al Sprint Costes-LLM post-MVP (SP-5B).

## 1. Test automático (código)

> ⏳ Pendiente — al cierre Sprint 3. Foco esperado:
>
> - Cobertura unit/integration ≥ threshold definido en Sprint 1.
> - `npm test` sin failures intermitentes.
> - Build con bundle size dentro de presupuesto definido.

## 2. Test E2C local (Playwright contra `localhost:8500`)

> ⏳ Pendiente — al cierre Sprint 3. Foco esperado:
>
> - Suite E2E completa MVP (no sólo gates security): widget chatbot, voice agents, calendar, conversaciones, campanas, knowledge base, orchestrator, costs (datos de Sprint 1).
> - Tests de regresión de los 4 sprints anteriores (smoke completo).

## 3. Test E2E VPS (Playwright contra VPS Renzo)

> ⏳ Pendiente — al cierre Sprint 3. Verificar:
>
> - Headers de seguridad globales aplicados (CSP, HSTS, X-Frame-Options, Referrer-Policy).
> - Rate limit global por IP en endpoints `/api/*` activo y observable en logs.
> - Logging estructurado fluye al backend de observabilidad elegido (Sprint 3 fase 02).
> - Métricas básicas expuestas (request count, error rate, p95 latency).

## 4. Test manual del tester (humano)

> ⏳ Pendiente — al cierre Sprint 3. Replicar checklist desde `docs/testeos-manual.md` sección Sprint 3.
>
> Foco UX: experiencia completa MVP desde landing → onboarding → uso real (crear lead, conversación, agendamiento, ver dashboard). Más extenso que sprints anteriores (2h vs 1h).

## 5. Hotfixes encontrados durante la validación

| BUG-ID  | Severidad | Descripción | Fix aplicado | Commit | Estado |
| ------- | --------- | ----------- | ------------ | ------ | ------ |
| BUG-XXX | —         | —           | —            | —      | 🔘     |

## 6. Subida a GH

- Convención: `fix(validacion-sp3): <descripcion>`.

## Estado de la fase

| Bloque             | Estado       |
| ------------------ | ------------ |
| 1. Test automático | 🔘 Plantilla |
| 2. Test E2C local  | 🔘 Plantilla |
| 3. Test E2E VPS    | 🔘 Plantilla |
| 4. Test manual     | 🔘 Plantilla |
| 5. Hotfixes        | 🔘 Plantilla |
| 6. Subida GH       | 🔘 Plantilla |
