# ADR-018 — Hardening de dependencias (2-31..2-34) diferido a post-MVP

- **Fecha:** 22-05-2026
- **Estado:** Aceptado
- **Sprint:** 1 (Bloque 2.8)
- **Tareas:** 2-31, 2-32, 2-33, 2-34
- **Autor:** Javi HP

## Contexto

El RoadMap del Sprint 1 incluye 4 tareas de hardening de dependencias:

| Tarea | Acción                                                                 | Estim |
| ----- | ---------------------------------------------------------------------- | ----- |
| 2-31  | `lucide-react@0.575 → 1.x` (major)                                     | 4h    |
| 2-32  | `shadcn@3.x → 4.x` (major)                                             | 6h    |
| 2-33  | Alinear `@types/node@^20` con Node 24                                  | 2h    |
| 2-34  | Investigar `eslint@9 → 10` (bloqueado por eslint-config-next peer dep) | 2h    |

Total: **14h**.

## Decisión

**Diferir 2-31, 2-32, 2-34 al sprint v0.5.x post-MVP. Cerrar 2-33 dentro del Sprint 1.**

## Razones

### 2-33 (cierra ya)

Alineación de tipos `@types/node` con runtime Node 24 es cambio menor y reduce noise en typecheck. Bajo riesgo. Se ejecuta en el Sprint 1 tras este ADR.

### 2-31 (defer)

`lucide-react` 1.x renombró iconos y cambió el sistema de imports tree-shakeable. Riesgo alto de regresión visual en dashboard que usa ~80 iconos. Requiere validación browser que estamos difiriendo a SP-4B. No aporta funcionalidad al MVP.

### 2-32 (defer)

`shadcn` 4.x rompe theming (paso a Tailwind 4 + nuevos tokens). El proyecto usa Tailwind 3.x. Saltar a shadcn 4 implica:

1. Migrar Tailwind 3 → 4.
2. Regenerar todos los design tokens.
3. Re-validar 30+ componentes.

Riesgo crítico de bloqueo del sprint. Tarea propia merece su sprint dedicado (estimación real: 12-16h, no 6h). Movida a sprint v0.6.x (UI refresh).

### 2-34 (defer/research only)

`eslint@9 → 10` está bloqueada por peer dep de `eslint-config-next@16.2.6`. Requiere esperar a release de `eslint-config-next@17` (no anunciado a 22-05-2026). Marcar como 🟢 Diferida con anota seguimiento de release.

## Plan v0.5.x

- Sprint v0.5.1 (Costes-LLM, ver memoria): NO incluye estas tareas.
- Sprint v0.5.3 (consolidación orquestador, ADR-015): NO incluye estas.
- Sprint v0.6.x candidato: "UI refresh" — engloba 2-31 + 2-32 + Tailwind 4 + design system refresh.
- Tarea 2-34: en backlog del subagente `af-agents:adr` para monitorizar release `eslint-config-next@17`.

## Impacto en Sprint 1

- 14h estim de hardening se reducen a ~2h (solo 2-33).
- 12h liberadas en el sprint → margen para Bloque 2.7 testing y SP-2-CLOSE.
- Total Sprint 1 ajustado: ~170h estim originales - 12h = ~158h.

## Riesgos del diferimiento

| Riesgo                                 | Severidad | Mitigación                                                                      |
| -------------------------------------- | --------- | ------------------------------------------------------------------------------- |
| Vulnerabilidad en lucide-react 0.x     | Baja      | Sin CVE público; iconos son código de presentación, sin vector de ejecución     |
| shadcn 3.x marcado deprecated upstream | Baja      | shadcn no es package npm gestionado — son componentes copiados a /components/ui |
| eslint 9 con vulnerabilidades          | Baja      | npm audit limpio a 22-05-2026; revisar mensualmente                             |

## Referencias

- `plans/reports/adr-auditoria-dependencias-20260520.md` — auditoría original
- `plans/RoadMap.md` Bloque 2.8 (tareas 2-31..2-34)
