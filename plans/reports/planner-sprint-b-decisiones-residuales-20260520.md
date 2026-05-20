# Planner — Sprint B: Decisiones residuales aplicadas

**Fecha:** 20-05-2026
**Scope:** Solo ediciones a archivos .md del plan Sprint B. Sin cambios en código ni RoadMap.md.

---

## Archivos modificados

| Archivo | Decisión aplicada |
|---------|------------------|
| `plans/260520-1342-sprint-b-capa-datos/phase-07-testing-documentacion.md` | B-28: BD tests = Supabase CLI + Docker local |
| `plans/260520-1342-sprint-b-capa-datos/phase-05-type-safety-y-limpieza.md` | B-35: Langchain upgrade en bloque pre-aprobado ADR |
| `plans/260520-1342-sprint-b-capa-datos/phase-08-hook-automation.md` | B-30: Reestructurado en B-30.1 (spike 1h) + B-30.2 (impl. condicional) |
| `plans/260520-1342-sprint-b-capa-datos/plan.md` | Totales actualizados: 173h max / 169h min; tabla fase 8 actualizada |

---

## Cambios por decisión

### 1. B-28 — BD de tests: Supabase CLI + Docker local

**Archivo:** `phase-07-testing-documentacion.md`

Cambios aplicados:
- Key Insights: añadido stack definitivo (Supabase CLI `supabase start` + Docker) + aislamiento por dev + mandato de documentar en B-29
- Requirements no-funcionales: especificado "instancia Supabase local (Docker)" en lugar de genérico
- Step 1 setup: renombrado "kickoff B-28", añadidos pasos de instalación Supabase CLI + Docker Desktop, URL local, nota de aislamiento
- Step 3 tests anti-fuga: nota explícita "contra instancia local, NO contra producción ni staging"
- Step 6 B-29 docs: añadida sección "Entorno de tests local" como entregable obligatorio
- Risk Assessment: reemplazado riesgo "Easypanel no disponible" por riesgos Docker/Supabase CLI reales
- Estimación B-28: sin cambios (12h cubren setup + tests)

### 2. B-35 — Langchain upgrade en bloque (pre-aprobado)

**Archivo:** `phase-05-type-safety-y-limpieza.md`

Cambios aplicados:
- Key Insights: paquetes confirmados en bloque (`langchain@1.4.1` + `@langchain/anthropic@1.4.0` + `@langchain/openai` + `@langchain/google-genai`); referencia a ADR MED-002/MED-005; nota "NO requiere nueva ronda ADR"
- Requirements: paquetes listados explícitamente con versiones; B-35 excluido del flujo ADR estándar
- Step 2: añadido "Pre-aprobado por ADR (auditoría 20-05-2026)"; comando `npm install` ampliado con los 4 paquetes
- Todo list: ítem B-35 ADR eliminado, sustituido por nota de pre-aprobación
- Estimación B-35: confirmada en 3h (sin cambios)

### 3. B-30 — Spike primero, implementación condicional

**Archivo:** `phase-08-hook-automation.md` (reescrito completo)

Estructura nueva:

| Subtarea | Estimación | Condición |
|----------|-----------|-----------|
| B-30.1 Spike SDK PostToolUse | 1h | Siempre |
| B-30.2 Path A (hook nativo) | 6h | Si spike = SI |
| B-30.2 Path B (script manual) | 2h | Si spike = NO |
| **Total** | **7h max / 3h min** | — |

Output obligatorio del spike: `plans/reports/spike-hook-postooluse-feasibility-20260520.md`

Regla de límite: si spike no concluye en 1h → asumir NO y ejecutar plan B.

---

## Estimaciones actualizadas

| Fase | Antes | Después |
|------|-------|---------|
| Phase 07 Testing (B-28) | 12h tests + 4h docs = 16h total | 16h (sin cambio) |
| Phase 05 B-35 Langchain | 3h | 3h (sin cambio) |
| Phase 08 Hook B-30 | 6h | 7h max / 3h min |
| **Total Sprint B** | **172h** | **173h max / 169h min** |

---

**Status:** DONE
**Summary:** 3 decisiones aplicadas a 4 archivos .md del plan Sprint B. Sin cambios en código ni en RoadMap.md. Estimación Sprint B actualizada a 173h/169h condicional.
