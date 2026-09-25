# Fase 01 — Auth + RBAC matrix LOCAL · BUG REAL ENCONTRADO + FIX APLICADO

**Inicio:** 2026-05-27 20:56 UTC
**Cierre:** 2026-05-27 21:14 UTC
**Duración:** ~18min
**Estado:** 🟢 PASS con fix in-session

## Resumen ejecutivo

`/e2etotal --env local` reveló un **BUG HIGH real en `41d429c`** que `/e2etotal --env vps` NO pudo detectar (VPS aún no había desplegado el commit). El bug fue **identificado, documentado, fixeado y testeado in-session** en ~18min.

## El bug: `BUG-RLM-01-HIGH-redis-econnreset-blocks-auth`

### Síntoma observado

Tras hacer 1 login wrong-pass (que respondió correctamente en ~2s con "Invalid login credentials"), el 2º intento se quedó con el botón "Iniciando sesión..." disabled durante **>1.5 minutos**.

### Root cause confirmado

Log del dev server (`.next/dev/logs/next-development.log` línea timestamp `07:04:33.512`):

```
07:04:33.512 [rate-limiter] Redis error: read ECONNRESET
07:04:33.764 [AUTH] Intentando login para ratelimit-local-260527@example.com
07:04:33.810 [AUTH] Error de Supabase: Invalid login credentials
[gap de 1.5min hasta siguiente actividad]
07:06:01.275 [Browser] React DevTools warning  ← siguiente render
```

**Análisis:**

1. ioredis tira `ECONNRESET` (Redis container hace hiccup).
2. ioredis intenta reconectar con `retryStrategy: (times) => Math.min(times * 100, 2000)`.
3. `pipe.exec()` en `rate-limiter.ts:89` **bloquea esperando reconexión** porque NO había timeout duro.
4. La promise de `rateLimit()` cuelga indefinidamente → `withRateLimit` HOF cuelga → `loginAction` cuelga → UX muestra "Iniciando sesión..." durante minutos.

### Por qué `/e2etotal --env vps` NO lo detectó

- VPS no tenía `41d429c` desplegado todavía (`/api/version commit=""` confirmado).
- En VPS prod, Redis es probablemente más estable (Dokploy gestiona healthchecks).
- El bug solo se manifiesta cuando Redis pierde conexión transient + ioredis reconecta + no hay timeout duro.

### Por qué `/e2etotal --env local` SÍ lo detectó

- Dev server tenía el commit local cargado (Node v24 vs v22 VPS confirma).
- Redis local `af-redis` container hace ECONNRESET ocasional bajo carga (logs lo muestran).
- 6 intentos consecutivos saturaron las conexiones y dispararon el bug.

## El fix aplicado

### Cambio en `src/lib/rate-limiter.ts`

**Antes (líneas 86-90 originales):**

```typescript
const pipe = redis.pipeline();
pipe.incr(windowKey);
pipe.pexpire(windowKey, ttlMs);
const results = await pipe.exec(); // ← BLOQUEABA INDEFINIDAMENTE
```

**Después:**

```typescript
const pipe = redis.pipeline();
pipe.incr(windowKey);
pipe.pexpire(windowKey, ttlMs);

const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(
    () => reject(new Error(`rate-limit timeout >${RATE_LIMIT_TIMEOUT_MS}ms`)),
    RATE_LIMIT_TIMEOUT_MS
  )
);

const results = await Promise.race([pipe.exec(), timeoutPromise]);
```

**Constante nueva:**

```typescript
const RATE_LIMIT_TIMEOUT_MS = 100;
```

**Comentario JSDoc** documenta el incident root cause + decisión de timeout 100ms.

### Test añadido en `tests/unit/rate-limiter.test.ts`

Test nuevo `fail-open con timeout duro 100ms si Redis cuelga` que simula `pipe.exec()` como promise que **nunca resuelve**. Verifica:

- `result.allowed === true` (fail-open mantiene UX).
- `elapsed < 500ms` (NUNCA bloquea más de medio segundo).
- `elapsed >= 90ms` (respeta el timeout configurado).

## Resultados

| Métrica                           | Antes fix   | Después fix |
| --------------------------------- | ----------- | ----------- |
| Latencia worst-case `rateLimit()` | ~1.5 min ❌ | ~100ms ✅   |
| Tests Vitest rate-limiter         | 8/8 verdes  | 9/9 verdes  |
| Suite total Vitest                | 235/235     | 236/236     |
| TypeCheck                         | 🟢          | 🟢          |
| Lint baseline                     | preservado  | preservado  |

## Status

**Status:** DONE
**Summary:** Bug HIGH detectado + fix aplicado + test añadido + suite 236/236 verde. Cero regresión.
**Bug cerrado in-session:** `BUG-RLM-01-HIGH-redis-econnreset-blocks-auth` — commit dentro de este run.

## Observación de valor

**Este es el ROI real del `/e2ctotal` local:** detectar bugs que tests unitarios + smoke VPS NO pueden ver. Sin esta verificación funcional con navegador real contra Redis real, el bug habría llegado a producción y se habría manifestado como "auth se cuelga aleatoriamente" — issue difícil de reproducir y debuggear post-deploy.

La política "fail-open consciente" del `rate-limiter.ts` era conceptualmente correcta pero le faltaba la garantía de **timeout duro** que cualquier infrastructure-as-code asume implícitamente. Patrón a aplicar en cualquier dependencia I/O bloqueante crítica para UX.
