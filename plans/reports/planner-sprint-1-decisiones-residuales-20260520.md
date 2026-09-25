# Planner — Sprint 1: Decisiones residuales aplicadas

**Fecha:** 20-05-2026
**Scope:** Solo ediciones a archivos .md del plan Sprint 1. Sin cambios en código ni RoadMap.md.

---

## Archivos modificados

| Archivo | Decisión aplicada |
|---------|------------------|
| `plans/260520-1342-sprint-1-capa-datos/phase-07-testing-documentacion.md` | 1-28: BD tests = Supabase CLI + Docker local |
| `plans/260520-1342-sprint-1-capa-datos/phase-05-type-safety-y-limpieza.md` | 1-35: Langchain upgrade en bloque pre-aprobado ADR |
| `plans/260520-1342-sprint-1-capa-datos/phase-08-hook-automation.md` | 1-30: Reestructurado en 1-30.1 (spike 1h) + 1-30.2 (impl. condicional) |
| `plans/260520-1342-sprint-1-capa-datos/plan.md` | Totales actualizados: 173h max / 169h min; tabla fase 8 actualizada |

---

## Cambios por decisión

### 1. 1-28 — BD de tests: Supabase CLI + Docker local

**Archivo:** `phase-07-testing-documentacion.md`

Cambios aplicados:
- Key Insights: añadido stack definitivo (Supabase CLI `supabase start` + Docker) + aislamiento por dev + mandato de documentar en 1-29
- Requirements no-funcionales: especificado "instancia Supabase local (Docker)" en lugar de genérico
- Step 1 setup: renombrado "kickoff 1-28", añadidos pasos de instalación Supabase CLI + Docker Desktop, URL local, nota de aislamiento
- Step 3 tests anti-fuga: nota explícita "contra instancia local, NO contra producción ni staging"
- Step 6 1-29 docs: añadida sección "Entorno de tests local" como entregable obligatorio
- Risk Assessment: reemplazado riesgo "Easypanel no disponible" por riesgos Docker/Supabase CLI reales
- Estimación 1-28: sin cambios (12h cubren setup + tests)

### 2. 1-35 — Langchain upgrade en bloque (pre-aprobado)

**Archivo:** `phase-05-type-safety-y-limpieza.md`

Cambios aplicados:
- Key Insights: paquetes confirmados en bloque (`langchain@1.4.1` + `@langchain/anthropic@1.4.0` + `@langchain/openai` + `@langchain/google-genai`); referencia a ADR MED-002/MED-005; nota "NO requiere nueva ronda ADR"
- Requirements: paquetes listados explícitamente con versiones; 1-35 excluido del flujo ADR estándar
- Step 2: añadido "Pre-aprobado por ADR (auditoría 20-05-2026)"; comando `npm install` ampliado con los 4 paquetes
- Todo list: ítem 1-35 ADR eliminado, sustituido por nota de pre-aprobación
- Estimación 1-35: confirmada en 3h (sin cambios)

### 3. 1-30 — Spike primero, implementación condicional

**Archivo:** `phase-08-hook-automation.md` (reescrito completo)

Estructura nueva:

| Subtarea | Estimación | Condición |
|----------|-----------|-----------|
| 1-30.1 Spike SDK PostToolUse | 1h | Siempre |
| 1-30.2 Path A (hook nativo) | 6h | Si spike = SI |
| 1-30.2 Path B (script manual) | 2h | Si spike = NO |
| **Total** | **7h max / 3h min** | — |

Output obligatorio del spike: `plans/reports/spike-hook-postooluse-feasibility-20260520.md`

Regla de límite: si spike no concluye en 1h → asumir NO y ejecutar plan B.

---

## Estimaciones actualizadas

| Fase | Antes | Después |
|------|-------|---------|
| Phase 07 Testing (1-28) | 12h tests + 4h docs = 16h total | 16h (sin cambio) |
| Phase 05 1-35 Langchain | 3h | 3h (sin cambio) |
| Phase 08 Hook 1-30 | 6h | 7h max / 3h min |
| **Total Sprint 1** | **172h** | **173h max / 169h min** |

---

**Status:** DONE
**Summary:** 3 decisiones aplicadas a 4 archivos .md del plan Sprint 1. Sin cambios en código ni en RoadMap.md. Estimación Sprint 1 actualizada a 173h/169h condicional.
