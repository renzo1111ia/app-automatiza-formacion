# Phase 05 — Type Safety, Limpieza ADR y Updates de Dependencias

## Context Links

- RoadMap: `plans/RoadMap.md` §Bloque 2.5 (tarea 2-22)
- ADR report: `plans/reports/adr-auditoria-dependencias-20260520.md` §Sprint 2 y §Findings High
  - HIGH-001: lucide-react major (2-31)
  - HIGH-002: shadcn major → aplazado a Sprint 4 (ver nota abajo)
  - HIGH-003: @types/node desalineado (2-33)
  - HIGH-004: eslint 10 — aplazado (2-34, solo investigación)
  - MED-001: @supabase/ssr upgrade (absorbido en Fase 1)
  - MED-002/005: langchain upgrade (2-35 nuevo)

## Overview

- **Prioridad:** P1 (2-22) / P2 (2-31..2-34)
- **Estado:** Pendiente — paralelizable con Fase 4 (tocan archivos distintos)
- **Descripción:** Eliminar los 426 `as any`/`as unknown` usando tipos derivados Zod. Ejecutar updates de dependencias identificados en ADR para Sprint 2. 2-22 es la tarea más larga del sprint — debe hacerse junto con el refactor de queries para aprovechar el contexto.

## Key Insights

- **2-22 (426 `as any`):** NO atacar de golpe. Estrategia: primero los archivos que ya tienen repository/schema (Fases 1-4), luego el resto. Objetivo: reducir >80% (de 426 → <85).
- **2-31 (lucide-react major):** API principal no cambió, pero algunos iconos fueron renombrados entre 0.x y 1.x. Requiere inventario visual.
- **2-32 (shadcn):** ADR recomienda APLAZAR a Sprint 4. Solo afecta CLI tool, no runtime. Los componentes instalados en `src/components/ui/` no se ven afectados. **Excluido de Sprint 2.**
- **2-33 (@types/node):** Es un cambio en devDependencies — bajo riesgo pero debe pasar ADR por ser major de tipos.
- **2-34 (eslint 10):** `eslint-config-next` declara peer dep `eslint ^9` — ESLint 10 no es instalable sin romper lint. Solo investigar si Next 16.2 liberó soporte.
- **2-35 (langchain en bloque — APROBADO):** Upgrade en bloque confirmado: `langchain@1.4.1` + `@langchain/anthropic@1.4.0` + `@langchain/openai` + `@langchain/google-genai` (todas las versiones compatibles). ADR findings MED-002 y MED-005 en `plans/reports/adr-auditoria-dependencias-20260520.md`. **Aprobado por agente ADR (auditoría 20-05-2026). NO requiere nueva ronda de validación ADR antes de ejecutar — la auditoría ya cubrió compatibilidad.**

## Requirements

**Funcionales (2-22):**
- `as any` reducido de 426 a < 85 ocurrencias
- Tipos reemplazantes deben ser `z.infer<typeof Schema>` — no declarar tipos TS manuales adicionales

**Funcionales (updates ADR):**
- `lucide-react` actualizado a 1.16.0 sin iconos rotos en UI
- `@types/node` actualizado a `^24` (alineado con runtime Node 24)
- `langchain` + providers actualizados en bloque: `langchain@1.4.1` + `@langchain/anthropic@1.4.0` + `@langchain/openai` + `@langchain/google-genai` (versiones compatibles per ADR MED-002/MED-005)
- 2-34: investigación documentada (proceder o aplazar con razón)

**No-funcionales:**
- 2-35 (langchain): aprobado por agente ADR en auditoría 20-05-2026 — NO requiere nueva ronda ADR. Ejecutar directamente.
- 2-31, 2-33: cada update pasa por `esden-agents:adr` antes de instalar (regla CLAUDE.md)
- `npm run typecheck` pass tras cada update

## Architecture

```
Estrategia 2-22 (eliminar `as any`):
  Prioridad 1: archivos tocados en Fases 1-4 (ya tienen contexto abierto)
  Prioridad 2: src/lib/schemas/, src/lib/repositories/ (ya tipados)
  Prioridad 3: src/app/api/ routes (post-refactor 2-19)
  Prioridad 4: src/components/ (UI — usar tipos de props de React)
  Deferido: src/lib/ai/ (LangChain types complejos — post upgrade langchain)
```

## Related Code Files

**Modificar (2-22):**
- Todos los archivos en `src/` con `as any` — inventario dinámico
- Priorizar los archivos tocados en Fases 01-04

**Modificar (updates):**
- `package.json` — 2-31: lucide-react, 2-33: @types/node, 2-35: langchain
- `src/components/` — 2-31: ajustar iconos renombrados

## Implementation Steps

1. **2-33 — @types/node upgrade (2h)**
   - ADR: registrar upgrade major de tipos
   - `npm install -D @types/node@^24`
   - `npm run typecheck` — si hay errores de tipos nuevos, corregirlos
   - Verificar APIs Node 22-24 ahora tipadas: `fetch` nativo, `webcrypto`, `node:test`

2. **2-35 — Langchain upgrade en bloque (3h)**
   - **Pre-aprobado por ADR** (auditoría 20-05-2026, findings MED-002 y MED-005 en `plans/reports/adr-auditoria-dependencias-20260520.md`). NO convocar nueva ronda de validación ADR.
   - Upgrade en bloque: `npm install langchain@1.4.1 @langchain/anthropic@1.4.0 @langchain/openai @langchain/google-genai`
   - Verificar peer dep `@langchain/core` — debe satisfacer `^1.1.47`
   - Test: ejecutar un LLM pipeline existente en dev
   - Si hay cambios de API (chains/agents): corregir en el momento

3. **2-31 — lucide-react upgrade (4h)**
   - ADR: registrar upgrade major (0.x → 1.x)
   - Inventario previo: `grep -r "from 'lucide-react'" src/ --include="*.tsx"` — listar iconos usados
   - Consultar changelog oficial de lucide-react 1.x: lista de iconos renombrados
   - `npm install lucide-react@1.16.0`
   - Fix iconos renombrados
   - Review visual de páginas principales en navegador local

4. **2-34 — Investigación eslint 10 (2h)**
   - Verificar si `eslint-config-next@16.2.6` ya soporta ESLint 10 en su peer dep
   - Si sí: documentar upgrade path y crear subtarea para ejecutarlo
   - Si no: documentar en este archivo `status: aplazado — esperando eslint-config-next`
   - NO instalar eslint 10 si el peer dep sigue siendo `eslint ^9`

5. **2-22 — Eliminar as any (16h — tarea continua)**
   - Fase 1 (4h): archivos de Fases 01-04 ya abiertos — sustituir `as any` por `z.infer<>`
   - Fase 2 (6h): `src/app/api/**` y `src/lib/actions/**` post-refactor
   - Fase 3 (6h): `src/components/**` — usar tipos de props React + tipos derivados Zod
   - Objetivo: < 85 ocurrencias al finalizar (métrica: `grep -c "as any" src/`)
   - NO atacar `src/lib/ai/` si los tipos langchain son inestables post-upgrade

## Todo List

- [ ] 2-33: ADR @types/node major → instalar @types/node@^24
- [ ] 2-33: npm run typecheck sin errores nuevos
- [ ] 2-35: Instalar en bloque (pre-aprobado ADR 20-05-2026, sin ronda adicional) — `langchain@1.4.1 @langchain/anthropic@1.4.0 @langchain/openai @langchain/google-genai`
- [ ] 2-35: Test pipeline LLM en dev
- [ ] 2-31: Inventario iconos lucide usados en src/
- [ ] 2-31: ADR lucide-react major → instalar 1.16.0
- [ ] 2-31: Fix iconos renombrados + review visual
- [ ] 2-34: Investigar soporte ESLint 10 en eslint-config-next@16.2.6
- [ ] 2-34: Documentar decisión (proceder / aplazar)
- [ ] 2-22 Fase 1: eliminar as any en archivos Fases 01-04
- [ ] 2-22 Fase 2: eliminar as any en src/app/api/ y src/lib/actions/
- [ ] 2-22 Fase 3: eliminar as any en src/components/
- [ ] Métrica final: `grep -c "as any" src/` < 85

## Success Criteria

- `grep -c "as any" src/` < 85 (reducción >80%)
- `npm run typecheck` sin errores
- `npm run build` sin errores
- UI visual sin iconos rotos (lucide-react)
- 2-34 con decisión documentada

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| lucide-react 1.x rompe iconos en prod | Baja | Medio | Inventario previo + review visual completo antes de merge |
| langchain 1.4.1 cambia API de chains | Media | Medio | Test pipeline en dev antes de merge; revisar changelog |
| 2-22 descubre tipos incompatibles con BD real | Media | Alto | Si hay mismatch tipo Zod vs BD → actualizar schema Zod (Fase 02) |
| eslint 10 instalado por error rompe lint | Baja | Alto | NO instalar si peer dep sigue siendo ^9; 2-34 es solo investigación |

## Security Considerations

- `@types/node@^24` expone APIs nuevas de Node — verificar que no se importan accidentalmente módulos inseguros ahora tipados
- Los tipos Zod inferidos reemplazan `as any` — evitan castings que silencian errores de validación

## Agente Esden

- **Responsable:** `esden-agents:code`
- **ADR pre-install:** `esden-agents:adr` (2-31, 2-33, 2-35)
- **Revisión:** `esden-agents:uxui` (review visual post lucide-react)

## Next Steps

- 2-22 puede iniciar en paralelo con Fase 4 — coordinación: no editar el mismo archivo al mismo tiempo
- Resultados de 2-34 determinan si eslint 10 entra en Sprint 4 o se aplaza a Sprint 5
- 2-32 (shadcn CLI) aplazado a Sprint 4 — no entra en Sprint 2
