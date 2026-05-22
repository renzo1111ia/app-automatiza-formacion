# ADR-019 — Refactor queries y limpieza `as any` con migración incremental

- **Fecha:** 22-05-2026
- **Estado:** Aceptado
- **Sprint:** 1 (Bloque 2.4 + 2.5)
- **Tareas afectadas:** 2-19, 2-20, 2-21, 2-22
- **Autor:** Javi HP

## Contexto

El plan original del Sprint 1 (`phase-04-refactor-queries.md` + `phase-05-type-safety-y-limpieza.md`) contempla:

| Tarea     | Acción                                                                    | Estim   |
| --------- | ------------------------------------------------------------------------- | ------- |
| 2-19      | Mover queries inline `supabase.from()` en `src/app/api/**` a repositorios | 8h      |
| 2-20      | Lo mismo en `src/lib/actions/**` + eliminar 9 fallbacks `service_role`    | 6h      |
| 2-21      | Lo mismo en `worker.js` + processors                                      | 4h      |
| 2-22      | Limpiar 426 ocurrencias de `as any` / `as unknown` → `z.infer`            | 16h     |
| **Total** |                                                                           | **34h** |

Estado real del codebase a 22-05-2026:

- `supabase.from(` inline: **57 ocurrencias en `src/lib/actions/`** + **10 en `src/app/api/`** = **67 queries**.
- `as any`: **~426 ocurrencias** según audit original.

## Problema

Hacer las 34h de refactor en Sprint 1 implicaría:

1. Tocar ~80 archivos en una sola tanda → diff masivo, riesgo alto de regresión.
2. Bloquear el cierre del sprint (queda Bloque 2.7 testing).
3. Mucho del refactor es mecánico (mismo patrón query → repo) — apropiado para migración incremental.
4. La capa Zod + Repository ya está lista (Bloques 2.2 + 2.3) → cualquier código nuevo o tocado puede migrar directo.

## Decisión

**Migración incremental** documentada como política de proyecto.

### Política

1. **TODO código nuevo** (a partir de este commit) debe usar repositorios de `src/lib/repositories/` para queries y schemas Zod de `src/lib/schemas/` para validación. NO escribir `supabase.from()` ni `as any` en código nuevo.
2. **Código existente** se migra cuando se toca por bug fix, feature, o refactor adyacente. Estimación promedio: 5-10 min por query.
3. **Code review enforcement**: PRs que introduzcan `supabase.from()` o `as any` nuevos NO se aprueban salvo justificación inline (`eslint-disable-next-line` con razón).
4. **Sprint dedicado** post-MVP (`v0.5.4` candidate, "refactor capa datos completo") absorbe el resto si la migración orgánica no completa al final del MVP.

### Quick wins ejecutados en Sprint 1 (parcial 2.4 + 2.5)

- **3 servicios refactorizados a DI centralizado** (2-02.b + 2-03): chat-memory, appointment-service, ai-analysis — usan `getAdminSupabaseClient()` en vez de `createClient` inline (commit `ccd6a50`).
- **2-37 logger estructurado** con scrubbing PII básico: `src/lib/utils/logger.ts`. Reemplaza `console.log` de widget.ts. Pino/Sentry/OTEL diferido a Sprint 3 tarea 4-03.

### Lo que NO se migra ahora

- Las 57 queries en `src/lib/actions/**` y 10 en `src/app/api/**` siguen funcionando vía cliente Supabase directo. Funcionalmente correctos, RLS + service_role bypass operativos.
- Los ~426 `as any` permanecen como deuda técnica documentada. Lint actual: 120 errores `no-explicit-any` — baseline del sprint, no introducir nuevos.

### Métricas para seguimiento

Comandos de auditoría puntual (correr cada cierre de sprint):

```bash
# Queries inline pendientes:
grep -rEn 'supabase\.from\(' src/lib/actions/ src/app/api/ | wc -l

# as any pendientes:
grep -rEn '\bas any\b' src/ --include='*.ts' --include='*.tsx' | wc -l
```

Objetivo MVP `v0.4.0`: <30 queries inline + <300 `as any`. Si se cumple orgánicamente → no Sprint dedicado. Si no → planificar `v0.5.4`.

## Alternativas consideradas

| Alternativa                                         | Por qué descartada                                            |
| --------------------------------------------------- | ------------------------------------------------------------- |
| Big-bang refactor en Sprint 1                       | Bloquea cierre + 80 archivos diff = riesgo regresión          |
| Repositorios solo para código nuevo, sin política   | Sin enforcement → la deuda crece                              |
| Esperar a Fase 2 (adapter HubSpot/Zoho) para migrar | Demasiado tarde; los adapters consumen los repos directamente |
| Migrar solo actions/ (skip api/ y worker)           | Inconsistente; api/ es la capa más expuesta                   |

## Impacto en Sprint 1

- 34h estim de refactor reducidas a 4h reales (DI services + 2-37 logger).
- 30h liberadas se distribuyen: Bloque 2.7 testing (16h estim) + SP-2-CLOSE (4h 30min) + margen.

## Referencias

- `src/lib/repositories/` (Bloque 2.3)
- `src/lib/schemas/` (Bloque 2.2)
- `src/lib/utils/logger.ts` (2-37)
- `plans/260520-1342-sprint-1-capa-datos/phase-04-refactor-queries.md`
- `plans/260520-1342-sprint-1-capa-datos/phase-05-type-safety-y-limpieza.md`
