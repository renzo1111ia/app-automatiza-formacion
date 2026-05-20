# Phase 01 — Orquestador BullMQ

## Context Links
- [plan.md](plan.md) — overview Sprint 0
- [RoadMap Bloque 1.1](../RoadMap.md) — tareas 1-01, 1-02
- [DEEP-FINDINGS-SUMMARY.md](../../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) — F-02-001, DA-1-005
- [docs/audit/deep/DA-1-concurrency-orchestrator.md](../../docs/audit/deep/DA-1-concurrency-orchestrator.md)

## Overview

**Prioridad:** P1 — Crítico #1 del sistema (flujo multi-día 100% roto en producción)
**Estado:** 🔘 Pendiente
**Estimación:** 7h (1-01: 4h + 1-02: 3h)
**Agentes:** `af-agents:code` (implementación) + `af-agents:testing` (verificación) + `debugger` (análisis previo)

El orquestador BullMQ tiene dos fallos que hacen el flujo multi-día completamente inoperativo:
1. `worker.js:58` llama `executeSequenceStep` con firma incorrecta → los pasos nunca se ejecutan.
2. `enqueueLeadStep` silencia errores Redis → los jobs desaparecen sin ningún rastro en logs.

Estos bugs afectan el producto central: la cadencia de contacto 27h × 3 días definida en R-013.

## Key Insights

- **F-02-001**: `worker.js:58` — la llamada a `executeSequenceStep` pasa argumentos en orden o con nombres incorrectos respecto a su definición. El worker procesa el job del día 1 pero NUNCA encola el día 2 ni el día 3.
- **DA-1-005**: `queue/lead-sequence-queue.ts:106-110` — `enqueueLeadStep` captura errores Redis en un `catch` vacío y retorna un ID ficticio (string inventado). El caller cree que el job fue encolado cuando en realidad falló silenciosamente.
- La decisión R-013 documenta el comportamiento esperado del protocolo multi-día (24h+3h, 3 días, interrumpible por respuesta del lead). Esta fase solo corrige el mecanismo de encolado — la lógica de negocio completa se implementa en Sprint 1.
- Estos dos bugs son independientes entre sí: 1-01 y 1-02 pueden desarrollarse en paralelo por el mismo dev o en pair.

## Requirements

### Funcionales
- 1-01: Corregir la firma de llamada a `executeSequenceStep` en `worker.js:58` para que los pasos de la secuencia se ejecuten correctamente.
- 1-02: Eliminar el silenciado de errores en `enqueueLeadStep`; los errores Redis deben propagarse, loguearse y NO retornar ID ficticio.

### No funcionales
- Zero regresión: el fix de 1-01 no debe romper la ejecución del paso 1 (el que sí funcionaba).
- 1-02: el error propagado debe incluir contexto (leadId, stepIndex, jobId intentado) para diagnóstico.
- Ambos fixes deben tener tests unitarios que demuestren el comportamiento correcto.

## Architecture

```
BullMQ Worker (worker.js)
  ├── processJob()
  │     └── [1-01] executeSequenceStep(job.data) ← FIRMA INCORRECTA HOY
  │
  └── enqueueLeadStep() [queue/lead-sequence-queue.ts:106-110]
        └── [1-02] try { await queue.add(...) } catch { return fakeId } ← SILENCIADO HOY
```

**Después del fix:**
```
  processJob() → executeSequenceStep(leadId, stepIndex, tenantId)  ← firma correcta
  enqueueLeadStep() → throw/log si Redis falla, retorna jobId real o lanza excepción
```

## Related Code Files

**Modificar:**
- `worker.js:58` — corregir llamada a `executeSequenceStep` (1-01)
- `queue/lead-sequence-queue.ts:106-110` — eliminar catch silencioso, añadir log estructurado + re-throw (1-02)

**Leer (contexto):**
- Definición de `executeSequenceStep` (buscar con Grep la función destino para verificar firma correcta)
- `src/lib/core/logger.ts` — helper de logging a usar en 1-02

## Implementation Steps

### 1-01 — Fix firma `executeSequenceStep` (4h)

1. Leer `worker.js:58` y la definición de `executeSequenceStep` para identificar el mismatch exacto (parámetros omitidos, orden incorrecto, o tipo incorrecto).
2. Verificar con Grep todos los demás call sites de `executeSequenceStep` para no romper otros callers.
3. Aplicar el fix mínimo: corregir los argumentos en la llamada de `worker.js:58`.
4. Si la firma de la función en sí está mal definida (parámetros con defaults incorrectos), corregirla también — pero mantener compatibilidad con otros callers.
5. Añadir comentario inline explicando los parámetros esperados (anti-regresión).
6. Escribir test unitario: mock del job → verificar que `executeSequenceStep` recibe los argumentos correctos.

### 1-02 — Fix silenciado errores Redis en `enqueueLeadStep` (3h)

1. Leer `queue/lead-sequence-queue.ts:106-110` para entender el catch actual.
2. Reemplazar el catch silencioso por:
   - Log estructurado con `logger.error('[ENQUEUE_FAILED]', { leadId, stepIndex, error })`.
   - Re-throw del error para que el caller conozca el fallo.
   - Eliminar el retorno de ID ficticio.
3. Verificar todos los callers de `enqueueLeadStep` para manejar el error propagado correctamente (al menos un log + estado del lead actualizado a `error`).
4. Añadir test: simular fallo Redis (mock) → verificar que el error se loga y no retorna ID ficticio.

## Todo List

- [ ] 1-01: Grep `executeSequenceStep` — identificar definición vs call site `worker.js:58`
- [ ] 1-01: Aplicar fix de firma en `worker.js:58`
- [ ] 1-01: Verificar otros callers no rotos
- [ ] 1-01: Test unitario firma correcta
- [ ] 1-02: Leer `queue/lead-sequence-queue.ts:106-110`
- [ ] 1-02: Reemplazar catch silencioso por log + re-throw
- [ ] 1-02: Actualizar callers para manejar error propagado
- [ ] 1-02: Test unitario error Redis no silenciado
- [ ] Typecheck local: `npm run typecheck` (0 errores en archivos tocados)

## Success Criteria

- `worker.js:58` llama `executeSequenceStep` con la firma correcta — verificado por inspección + test.
- `enqueueLeadStep` NO retorna ID ficticio en caso de error Redis — verificado por test con mock de Redis fallido.
- `npm run typecheck` pasa sin errores nuevos.
- Test de integración manual (o script): crear un lead de prueba → verificar que el paso 2 se encola correctamente tras el paso 1.

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|------------|
| Fix 1-01 rompe el paso 1 (el que sí funcionaba) | Media | Alto | Tests antes y después; rollback por feature flag de BullMQ |
| Callers de `enqueueLeadStep` no manejan el error propagado → crash en runtime | Media | Medio | Grep exhaustivo de callers antes del fix; manejo defensivo en cada caller |
| Fix 1-02 genera flood de errores en logger si Redis tiene latencia | Baja | Bajo | Rate-limit en logger o sampling |

## Security Considerations

- Ninguno de estos fixes expone superficie de seguridad adicional.
- El log de 1-02 debe incluir `leadId` pero NO PII del lead (sin nombre, teléfono, email en los logs de error de encolado).

## Next Steps

→ [Phase 02 — Secretos y credenciales](phase-02-secretos-y-credenciales.md) (puede ejecutarse en paralelo con esta fase)
