---
title: "Planner Report — Sprint 3 Hardening — Plan Operativo"
date: 2026-05-20
agent: planner (Sonnet)
sprint: D
---

# Planner Report — Sprint 3 Plan Operativo

## Resumen

Plan operativo completo del Sprint 3 (Hardening) creado. 7 archivos de fase + plan.md en `plans/260520-1342-sprint-3-hardening/`. 3 researcher reports generados. Total estimado: 100-132h desarrollo + 8h cierre = **108-140h total** (centro ~116h).

---

## Archivos creados

| Archivo | Tarea RoadMap | Est. | Agente |
|---------|--------------|------|--------|
| `plan.md` | Overview Sprint 3 | — | — |
| `phase-01-e2e-tests-playwright.md` | 3-01 + 3-02 | 28-32h | af-agents:testing |
| `phase-02-observabilidad-logging-metricas.md` | 3-03 | 12-16h | af-agents:code + deployment |
| `phase-03-dashboard-costes-llm.md` | 3-04 | 16-22h | af-agents:code + uxui |
| `phase-04-wcag-22-aa.md` | 3-05 (24 findings) | 28-40h | af-agents:uxui + code |
| `phase-05-hardening-headers-rate-limits.md` | 3-06 | 10-14h | af-agents:security + code |
| `phase-06-documentacion-release-v1.md` | 3-07 | 6-8h | af-agents:documentation |
| `phase-07-cierre-sprint.md` | SP-D-CLOSE-1..5 | 8h + bugs | af-agents:testing |

## Researcher reports consumidos

| Report | Contenido | Decisiones clave |
|--------|-----------|-----------------|
| `researcher-observability-d-20260520.md` | Pino vs Winston, OTel, BullMQ metrics, dashboard LLM | Pino v9 + bull-board + PostgreSQL custom (no LangSmith) |
| `researcher-playwright-coverage-d-20260520.md` | Playwright E2E, Vitest coverage, multi-tenant patterns | @playwright/test@^1.60.0 + Vitest + v8 coverage |
| `researcher-wcag-hardening-d-20260520.md` | WCAG 2.2 AA, CSP, CSRF, Rate limits | shadcn Dialog + sonner + ioredis rate limit (sin nuevas deps prod) |

---

## Total estimación

| Componente | Estimación |
|-----------|-----------|
| 3-01 E2E Playwright | 28-32h |
| 3-02 Coverage 80% | incluido en Ph1 (setup compartido) + ~8h tests adicionales |
| 3-03 Observabilidad | 12-16h |
| 3-04 Dashboard costes LLM | 16-22h |
| 3-05 WCAG 2.2 AA | 28-40h |
| 3-06 Hardening headers/RL | 10-14h |
| 3-07 Release docs | 6-8h |
| SP-D-CLOSE | 8h + bugs |
| **Total** | **108-140h + bugs** |

**Centro del rango:** 124h. Objetivo RoadMap era 80-120h. La diferencia (+4-24h) se explica por:
1. WCAG 2.2 AA tiene 24 findings reales (DA-5) — el RoadMap no los estimaba con detalle
2. DA-5-012 (AIAgentInbox responsive, esfuerzo L) puede cortarse: sin él, baja a 100-128h
3. 3-01 y 3-02 son parcialmente paralelizables — wall-clock < suma individual

**Con 2 devs en paralelo** (Ph1‖Ph4, Ph2‖Ph3): wall-clock estimado ~55-70h (2 semanas).

---

## Dependencias entre fases

```
Sprint 2 completado (v0.3.0) — PREREQUISITO GLOBAL
    │
    ├─── Ph1 (E2E setup) ──────────────────── Ph7 (cierre)
    │                                              │
    ├─── Ph2 (Observabilidad) ─┐                  │
    │                          ├─── Ph3 (LLM dashboard)
    │                          │
    ├─── Ph4 (WCAG) ──────────── Ph1 WCAG tests (último)
    │
    └─── Ph5 (Hardening) ─── independiente, cualquier momento
    
    Ph6 (Docs) ← requiere Ph1-Ph5 completas
```

**Dependencia crítica interna:** Ph2 crea `llm_usage_logs` → Ph3 la usa. Ph3 NO puede arrancar hasta que la migración SQL de Ph2 esté aplicada.

---

## Solapes con sprints anteriores

| Sprint | Componente que reutiliza Sprint 3 |
|--------|----------------------------------|
| Sprint 0 (A-26: next@16.2.6) | CSP headers en Ph5 requieren next parcheado primero |
| Sprint 0 (A-12..A-15: webhook signatures) | Tests de seguridad RLS en Ph1 verifican estos fixes |
| Sprint 1 (1-14..1-18: Repository pattern) | Coverage targets de Ph1 incluyen estos repositorios |
| Sprint 1 (1-31..1-34: shadcn updates) | WCAG Ph4 usa shadcn Dialog (instalado/actualizado en B) |
| Sprint 2 (LangChain multi-LLM) | Dashboard LLM Ph3 usa el pipeline existente |

---

## Nuevas dependencias a instalar (requieren ADR individual)

| Paquete | Tipo | Sprint/Phase | ADR status |
|---------|------|-------------|-----------|
| `@playwright/test@^1.60.0` | devDep | Ph1 | Pre-aprobado en ADR adr-auditoria-dependencias-20260520.md |
| `vitest@^2.x`, `@vitest/coverage-v8` | devDep | Ph1 | Requiere ADR |
| `@testing-library/react`, `happy-dom` | devDep | Ph1 | Requiere ADR |
| `@axe-core/playwright` | devDep | Ph1 | Requiere ADR |
| `pino@^9.x`, `pino-http` | prodDep | Ph2 | Requiere ADR |
| `@bull-board/api@^6.x`, `@bull-board/nextjs@^6.x` | prodDep | Ph2 | Requiere ADR |
| `@sentry/nextjs@^8.x` | prodDep | Ph2 | Requiere ADR |
| `sonner` (via shadcn) | prodDep | Ph4 | Probablemente ya en shadcn registry |
| `@radix-ui/react-dialog` (via shadcn Dialog) | prodDep | Ph4 | Probablemente ya instalado (radix-ui@^1.4.3 en prod) |

**NOTA:** `ioredis` (rate limits Ph5) ya está en el stack — sin nueva dep.
**NOTA:** `recharts` (dashboard LLM Ph3) ya está en el stack — sin nueva dep.
**NOTA:** `@opentelemetry/api` es peer dep de Next.js — sin nueva dep para logging básico.

---

## Preguntas abiertas

1. **DA-5-012 scope final:** ¿Se incluye el responsive de AIAgentInbox (esfuerzo L, 8-12h) en v1.0.0 o se pospone a Sprint 4? Recomendación: incluir pero marcarlo como último a implementar; cortar si sprint va a >130h.

2. **Vitest vs Jest:** El proyecto actualmente no tiene test runner declarado. ¿Hay preferencia por Jest (más familiar para React devs) sobre Vitest? El plan asume Vitest por compatibilidad ESM nativa con Next.js 16.

3. **Sentry plan:** ¿Se tiene una cuenta/DSN de Sentry para el proyecto? El plan asume plan free (5K errores/mes). Si hay cuenta existente, solo configurar; si no, el dev debe crear la cuenta.

4. **Supabase local para tests:** Los integration tests de BullMQ workers y repositories requieren Redis + Supabase real en CI. ¿El equipo tiene `supabase start` configurado localmente? ¿CI tiene acceso a instancia de test de Supabase?

5. **Widget embed CSP (DA-3-004):** El CSP de Ph5 necesita excepción para `/api/widget/*` (frame-ancestors *). Si el XSS de DA-3-004 NO fue corregido en Sprint 0, el CSP mitiga parcialmente pero no elimina el riesgo. ¿Estado de DA-3-004?

6. **bull-board en producción:** bull-board expone información sensible sobre las colas. ¿La ruta `/admin/queues` debe ser solo accesible desde la red interna (Easypanel) o desde el panel de admin en internet con auth? El plan asume auth de admin suficiente.

7. **Precio LLM Bedrock:** Los precios de AWS Bedrock para Claude varían según región y acuerdo. Los valores en `llm-pricing.ts` son estimaciones — ¿hay un contrato específico con AWS que defina precios diferentes?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Plan operativo Sprint 3 creado. 7 fases, 7 phase files, 3 researcher reports. Total ~116h centro. Dependencias entre fases documentadas. Prerequisito: Sprint 2 completo. Decisión arquitectónica principal: maximizar reutilización de deps existentes (ioredis para rate limits, Recharts para LLM dashboard, shadcn Dialog para modales WCAG) — solo ~8 nuevas devDeps y ~4 nuevas prodDeps.
**Concerns:** (1) WCAG DA-5-012 puede desbordarse (+8-12h) — marcar como P2 y cortar si necesario. (2) Total estimado (108-140h) supera el techo de 120h del RoadMap en el peor caso — con DA-5-012 cortado baja a 100-128h. (3) 7 preguntas abiertas documentadas arriba que pueden impactar implementación.
