# Planner Report — Sprint E Operativo

**Agente:** planner (Sonnet)
**Fecha:** 20-05-2026
**Scope:** Plan operativo Sprint E (E-01..E-06 + cierre)

---

## Resumen

Plan Sprint E completado. 4 reports de research + 8 archivos de plan creados. Sprint E es incremental (modelo diferente a A-D): cada integración es un sub-sprint independiente con su propia rama y PR.

---

## Archivos creados

### Reports de research (4)
| Archivo | Contenido |
|---------|-----------|
| `plans/reports/researcher-google-sheets-e-20260520.md` | Sheets API v4 + Drive notifications + idempotencia + cuotas |
| `plans/reports/researcher-salesforce-e-20260520.md` | jsforce@3.x + Connected Apps + multi-tenant + endpoints Lead/Contact/Opportunity |
| `plans/reports/researcher-ghl-activecampaign-e-20260520.md` | GHL OAuth2 v2 + AC API Key + comparativa + rate limits |
| `plans/reports/researcher-adapter-pattern-generalization-e-20260520.md` | Interfaz IntegrationAdapter + FieldMapper + WritePolicy + contract tests |

### Plan Sprint E (8 archivos)
| Archivo | Tarea | Estimación |
|---------|-------|-----------|
| `plans/260520-1342-sprint-e-post-mvp-crms/plan.md` | Overview + modelo incremental | — |
| `phase-01-google-sheets-bidireccional.md` | E-01: Sheets push/pull + Drive webhook | 60-100h |
| `phase-02-salesforce-adapter.md` | E-02: jsforce + OAuth + Lead/Contact/Opportunity | 60-100h |
| `phase-03-gohighlevel-adapter.md` | E-03: GHL OAuth2 v2 + Contact + Webhook | 40-80h |
| `phase-04-activecampaign-adapter.md` | E-04: AC API Key + Contact/Deal/Automation | 20-50h |
| `phase-05-adapter-pattern-generalization.md` | E-05: Refactor interfaz genérica + FieldMapper | 20-40h |
| `phase-06-tier2-on-demand.md` | E-06: Clientify/Bitrix24/Pipedrive/Monday/Holded — backlog | on-demand |
| `phase-07-cierre-sprint.md` | SP-E-CLOSE-1..5 | 7-8h + bugs |

---

## Estimación total Sprint E

| Fase | Estimación | Notas |
|------|-----------|-------|
| E-01 Sheets bidireccional | 60-100h | Complejidad por Drive webhook + idempotencia |
| E-02 Salesforce | 60-100h | Complejidad por Connected Apps enterprise |
| E-03 GoHighLevel | 40-80h | Media — OAuth2 marketplace |
| E-04 ActiveCampaign | 20-50h | Más simple — API Key |
| E-05 Generalización | 20-40h | Solo tras E-01..E-04 completos |
| SP-E-CLOSE | 7-8h + bugs | Por ciclo de cierre |
| **TOTAL** | **207-378h** | Excluyendo E-06 Tier 2 |

E-06 Tier 2: ~30-50h por CRM adicional, no incluido en estimación del sprint.

---

## Dependencias críticas con Sprint C

| Elemento Sprint C | Usado en Sprint E |
|------------------|------------------|
| `IntegrationAdapter` interface base (C-01) | E-01..E-04 heredan e implementan |
| Field mapping + write policy R-014 (C-04) | E-05 generaliza lo implementado en C-04 |
| UI admin connection modal (C-05) | E-01..E-04 reusan patrones visuales |
| Audit log `crm_write_audit` (C-06) | E-01..E-04 loggean en misma tabla |

**Sprint C debe estar completado antes de iniciar cualquier fase E.**

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
| `jsforce@^3.10.15` — ADR aprobado | E-02 | 1-2 días |
| Registro app GHL Marketplace | E-03 | 2-5 días hábiles (proceso burocrático) |
| Google OAuth consent screen verificación | E-01 | 1-3 días si la app supera 100 users |

---

## Preguntas abiertas

1. **Orden de ejecución E-01..E-04**: ¿se implementan secuencialmente o en paralelo por distintos devs? El plan soporta ambos modelos (archivos distintos, ramas distintas).
2. **Prioridad entre E-01..E-04**: ¿Sheets primero (valor diferencial) o AC primero (más simple, victoria rápida)?
3. **Salesforce ISV vs Connected App por tenant**: ¿registramos nuestra app en Salesforce AppExchange o cada academia registra la suya? Impacta en el flujo OAuth y en la capacidad de distribución.
4. **GHL Marketplace — app pública vs Private Integration**: Private Integration es más rápida de aprobar pero solo sirve para 1 location.
5. **E-01 Google OAuth Project**: ¿proyecto GCP centralizado (nuestra plataforma) o cada tenant con su GCP? Impacta en cuotas y en el alcance del consent screen.
6. **Pull SF→Esden (Streaming API)**: ¿entra en scope de E-02 o queda fuera como feature adicional?
7. **Versión objetivo por integración**: ¿v1.1.0 por Sheets, v1.2.0 por Salesforce, etc. o esperamos las 4 para v1.1.0?
8. **Typescript 6.x**: ADR indica aplazar a Sprint E — ¿se incluye en E-05 (junto con refactor) o se hace como tarea separada?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Plan operativo Sprint E completo con 4 research reports + 8 phase files. Estimación 207-378h en 4-5 sub-sprints independientes. Modelo incremental documentado explícitamente.
**Concerns:** (1) Registro GHL Marketplace es bloqueante burocrático para E-03 — iniciar proceso antes de escribir código. (2) E-04 (AC) es el más simple y puede darse como "victoria rápida" si se quiere probar el ciclo completo antes de abordar E-02/E-03. (3) Preguntas 3 y 4 (Salesforce ISV + GHL app type) necesitan decisión de Renzo antes de iniciar esas fases — impactan arquitectura de OAuth.
