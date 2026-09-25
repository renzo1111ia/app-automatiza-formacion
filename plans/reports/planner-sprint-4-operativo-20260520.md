# Planner Report — Sprint 4 Operativo

**Agente:** planner (Sonnet)
**Fecha:** 20-05-2026
**Scope:** Plan operativo Sprint 4 (4-01..4-06 + cierre)

---

## Resumen

Plan Sprint 4 completado. 4 reports de research + 8 archivos de plan creados. Sprint 4 es incremental (modelo diferente a A-D): cada integración es un sub-sprint independiente con su propia rama y PR.

---

## Archivos creados

### Reports de research (4)
| Archivo | Contenido |
|---------|-----------|
| `plans/reports/researcher-google-sheets-e-20260520.md` | Sheets API v4 + Drive notifications + idempotencia + cuotas |
| `plans/reports/researcher-salesforce-e-20260520.md` | jsforce@3.x + Connected Apps + multi-tenant + endpoints Lead/Contact/Opportunity |
| `plans/reports/researcher-ghl-activecampaign-e-20260520.md` | GHL OAuth2 v2 + AC API Key + comparativa + rate limits |
| `plans/reports/researcher-adapter-pattern-generalization-e-20260520.md` | Interfaz IntegrationAdapter + FieldMapper + WritePolicy + contract tests |

### Plan Sprint 4 (8 archivos)
| Archivo | Tarea | Estimación |
|---------|-------|-----------|
| `plans/260520-1342-sprint-4-post-mvp-crms/plan.md` | Overview + modelo incremental | — |
| `phase-01-google-sheets-bidireccional.md` | 4-01: Sheets push/pull + Drive webhook | 60-100h |
| `phase-02-salesforce-adapter.md` | 4-02: jsforce + OAuth + Lead/Contact/Opportunity | 60-100h |
| `phase-03-gohighlevel-adapter.md` | 4-03: GHL OAuth2 v2 + Contact + Webhook | 40-80h |
| `phase-04-activecampaign-adapter.md` | 4-04: AC API Key + Contact/Deal/Automation | 20-50h |
| `phase-05-adapter-pattern-generalization.md` | 4-05: Refactor interfaz genérica + FieldMapper | 20-40h |
| `phase-06-tier2-on-demand.md` | 4-06: Clientify/Bitrix24/Pipedrive/Monday/Holded — backlog | on-demand |
| `phase-07-cierre-sprint.md` | SP-E-CLOSE-1..5 | 7-8h + bugs |

---

## Estimación total Sprint 4

| Fase | Estimación | Notas |
|------|-----------|-------|
| 4-01 Sheets bidireccional | 60-100h | Complejidad por Drive webhook + idempotencia |
| 4-02 Salesforce | 60-100h | Complejidad por Connected Apps enterprise |
| 4-03 GoHighLevel | 40-80h | Media — OAuth2 marketplace |
| 4-04 ActiveCampaign | 20-50h | Más simple — API Key |
| 4-05 Generalización | 20-40h | Solo tras 4-01..4-04 completos |
| SP-E-CLOSE | 7-8h + bugs | Por ciclo de cierre |
| **TOTAL** | **207-378h** | Excluyendo 4-06 Tier 2 |

4-06 Tier 2: ~30-50h por CRM adicional, no incluido en estimación del sprint.

---

## Dependencias críticas con Sprint 2

| Elemento Sprint 2 | Usado en Sprint 4 |
|------------------|------------------|
| `IntegrationAdapter` interface base (2-01) | 4-01..4-04 heredan e implementan |
| Field mapping + write policy R-014 (2-04) | 4-05 generaliza lo implementado en 2-04 |
| UI admin connection modal (2-05) | 4-01..4-04 reusan patrones visuales |
| Audit log `crm_write_audit` (2-06) | 4-01..4-04 loggean en misma tabla |

**Sprint 2 debe estar completado antes de iniciar cualquier fase E.**

---

## Reports de research consumidos

1. `researcher-google-sheets-e-20260520.md` — confirmó CERO deps nuevas, estrategia Drive webhook + idempotencia
2. `researcher-salesforce-e-20260520.md` — confirmó jsforce@3.x path, Connected Apps modelo, pull via Streaming API complejo (aplazado)
3. `researcher-ghl-activecampaign-e-20260520.md` — confirmó GHL REST puro (no SDK), AC rate limit 5 req/s como riesgo principal
4. `researcher-adapter-pattern-generalization-e-20260520.md` — definió interfaz de 7 métodos, FieldMapper universal, contract test suite

---

## Dependencias externas (bloqueantes no técnicos)

| Dependencia | Fase | Tiempo estimado |
|-------------|------|----------------|
| `jsforce@^3.10.15` — ADR aprobado | 4-02 | 1-2 días |
| Registro app GHL Marketplace | 4-03 | 2-5 días hábiles (proceso burocrático) |
| Google OAuth consent screen verificación | 4-01 | 1-3 días si la app supera 100 users |

---

## Preguntas abiertas

1. **Orden de ejecución 4-01..4-04**: ¿se implementan secuencialmente o en paralelo por distintos devs? El plan soporta ambos modelos (archivos distintos, ramas distintas).
2. **Prioridad entre 4-01..4-04**: ¿Sheets primero (valor diferencial) o AC primero (más simple, victoria rápida)?
3. **Salesforce ISV vs Connected App por tenant**: ¿registramos nuestra app en Salesforce AppExchange o cada academia registra la suya? Impacta en el flujo OAuth y en la capacidad de distribución.
4. **GHL Marketplace — app pública vs Private Integration**: Private Integration es más rápida de aprobar pero solo sirve para 1 location.
5. **4-01 Google OAuth Project**: ¿proyecto GCP centralizado (nuestra plataforma) o cada tenant con su GCP? Impacta en cuotas y en el alcance del consent screen.
6. **Pull SF→Esden (Streaming API)**: ¿entra en scope de 4-02 o queda fuera como feature adicional?
7. **Versión objetivo por integración**: ¿v1.1.0 por Sheets, v1.2.0 por Salesforce, etc. o esperamos las 4 para v1.1.0?
8. **Typescript 6.x**: ADR indica aplazar a Sprint 4 — ¿se incluye en 4-05 (junto con refactor) o se hace como tarea separada?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Plan operativo Sprint 4 completo con 4 research reports + 8 phase files. Estimación 207-378h en 4-5 sub-sprints independientes. Modelo incremental documentado explícitamente.
**Concerns:** (1) Registro GHL Marketplace es bloqueante burocrático para 4-03 — iniciar proceso antes de escribir código. (2) 4-04 (AC) es el más simple y puede darse como "victoria rápida" si se quiere probar el ciclo completo antes de abordar 4-02/4-03. (3) Preguntas 3 y 4 (Salesforce ISV + GHL app type) necesitan decisión de Renzo antes de iniciar esas fases — impactan arquitectura de OAuth.
