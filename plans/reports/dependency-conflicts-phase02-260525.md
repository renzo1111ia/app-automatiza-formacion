# Dependency Conflicts Report — Phase 02 Observabilidad Sprint 3

**Fecha**: 25-05-2026 | **Modelo**: Sonnet | **Tiempo**: <15min

---

## 1. Disponibilidad en npm registry

| Package               | Versión propuesta | Existe | Latest disponible  |
| --------------------- | ----------------- | ------ | ------------------ |
| `pino`                | 10.3.1            | SI     | 10.3.1             |
| `@bull-board/api`     | 7.1.5             | SI     | 7.1.5              |
| `@bull-board/express` | 7.1.5             | SI     | 7.1.5              |
| `@sentry/nextjs`      | 10.53.1           | SI     | 10.53.1 (= latest) |

Todas las versiones exactas existen. Sin problemas de disponibilidad.

---

## 2. Peer Dependencies — tabla de satisfacción

| Package nuevo               | Peer declarado    | Versión requerida                                     | Versión en proyecto                          | Satisfecho |
| --------------------------- | ----------------- | ----------------------------------------------------- | -------------------------------------------- | ---------- |
| `pino@10.3.1`               | (ninguno)         | —                                                     | —                                            | SI         |
| `@bull-board/api@7.1.5`     | `@bull-board/ui`  | `7.1.5`                                               | No instalado (internal dep, se instala auto) | SI         |
| `@bull-board/express@7.1.5` | `@bull-board/api` | `7.1.5`                                               | Se instala junto                             | SI         |
| `@bull-board/express@7.1.5` | `@bull-board/ui`  | `7.1.5`                                               | Internal, se instala auto                    | SI         |
| `@sentry/nextjs@10.53.1`    | `next`            | `^13.2.0 \|\| ^14.0 \|\| ^15.0.0-rc.0 \|\| ^16.0.0-0` | 16.2.6                                       | **SI**     |

**Resultado**: 0 peer conflicts en estado actual.

---

## 3. BullMQ 5.73.0 — compatibilidad con @bull-board

`@bull-board/api@7.1.5` **no declara `bullmq` como peer dependency**. La integración es opt-in: el dev registra el adapter `BullMQAdapter` manualmente. No hay rangos de versión que restrinjan. Versiones compatibles confirmadas en CHANGELOG de bull-board hasta BullMQ 5.x. **Sin conflicto.**

---

## 4. @sentry/nextjs@10.53.1 — transitive deps problemáticas

Sentry 10 arrastra como `dependencies` directas (no peer):

| Dep transitiva                        | Versión requerida                                        | Impacto                                                         |
| ------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `@opentelemetry/api`                  | `^1.9.1`                                                 | Se instala en `node_modules`, NO en `package.json` del proyecto |
| `@opentelemetry/semantic-conventions` | `^1.40.0`                                                | Ídem                                                            |
| `@sentry/opentelemetry`               | `10.53.1`                                                | Wrapper interno de Sentry sobre OTel                            |
| `rollup`                              | `^4.60.3`                                                | Build tool — no conflicto en runtime                            |
| `express`                             | No — arrastrado por `@bull-board/express`, NO por Sentry | —                                                               |

**Nota crítica sobre OTel**: Sentry 10 instala `@opentelemetry/api@^1.9.1` como dependencia transitiva. Cuando en Sprint 4 se añada `@opentelemetry/api` directamente al proyecto, npm resolverá una única instancia compartida gracias al protocolo singleton de OTel API (diseño intencional). **No habrá duplicate-instance conflict** siempre que la versión directa del sprint 4 sea compatible con `^1.9.1` (cualquier `1.x >= 1.9.1`).

---

## 5. Conflictos detectados

### CONFLICTO MENOR: express v5 como dep de @bull-board/express

`@bull-board/express@7.1.5` arrastra `express@^5.2.1` como dependencia directa. Express v5 entró GA en Oct 2024 pero tiene diferencias de API respecto a v4 (error handling async, path routing). **No hay conflicto de versiones** (express no está instalado actualmente), pero se instalará `express@5.2.1` en `node_modules`.

**Impacto**: Bajo. Bull-board usa express solo como peer de su adaptador — el servidor express corre aislado en la route handler de Next.js (`/api/admin/queues/[[...slug]]`). No contamina el resto de la app.

**Acción**: Ninguna. Solo documentar que express v5 entra como transitiva.

### SIN CONFLICTO: @types/node

Ninguna de las 4 deps nuevas declara `@types/node` como peer. No habrá npm warning de rango incompatible.

---

## 6. Pino v10 vs v9 — breaking changes relevantes para Next.js App Router

| Aspecto                   | pino@9                    | pino@10                          |
| ------------------------- | ------------------------- | -------------------------------- |
| Node.js engine mínimo     | No especificado (runtime) | No especificado (runtime)        |
| API pública               | Estable                   | Compatible hacia atrás           |
| `thread-stream`           | v2/v3                     | v4 (internal, no visible al dev) |
| `pino-abstract-transport` | v1/v2                     | v3 (internal)                    |
| `process-warning`         | v3/v4                     | v5 (internal)                    |

**Breaking changes del dev** entre v9 y v10: ninguno en la API pública. Los cambios son en deps internas (`thread-stream`, `sonic-boom`, `pino-abstract-transport`). Para uso con Next.js App Router (Edge runtime), pino v10 requiere la misma precaución que v9: usar `pino/browser` o configurar `experimental.serverComponentsExternalPackages: ['pino']` en `next.config`. Sin nueva limitación respecto a v9.

**Veredicto pino v10 vs v9**: v10 es preferible (más reciente, soporte activo). Sin razón para ir a v9.

---

## 7. Conflictos con Vitest 3.2.4 + MSW 2.14.6

- **Pino + Vitest**: Sin issues conocidos. El logger en tests se puede silenciar con `level: 'silent'` en setup. No hay incompatibilidad de módulos.
- **MSW + pino**: Sin interferencia. MSW intercepta fetch/XHR en el browser worker o en node interceptors — pino escribe a streams. Canales independientes.

---

## 8. Conflictos futuros previsibles (Sprint 4 — OTel nativo)

| Escenario                                       | Riesgo                                                                                       | Mitigación                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Sprint 4 añade `@opentelemetry/api` directo     | BAJO — OTel API es singleton por diseño; npm deduplicará con la versión transitiva de Sentry | Usar versión `>=1.9.1` para respetar el rango de Sentry                   |
| Sprint 4 añade `@opentelemetry/sdk-node`        | BAJO — no hay peer conflict con Sentry                                                       | Verificar que `@sentry/opentelemetry` 10.x soporta el SDK version elegido |
| `@opentelemetry/semantic-conventions` duplicado | BAJO — misma situación singleton                                                             | Sentry requiere `^1.40.0`, instalar `>=1.40.0` directo si se necesita     |

**No se necesitan `overrides` en package.json** con el stack actual.

---

## 9. Versiones finales recomendadas

| Package               | Versión a instalar                      | Tipo       |
| --------------------- | --------------------------------------- | ---------- |
| `pino`                | `10.3.1`                                | production |
| `@bull-board/api`     | `7.1.5`                                 | production |
| `@bull-board/express` | `7.1.5`                                 | production |
| `@sentry/nextjs`      | `10.53.1` (CONDICIONAL — ver veredicto) | production |

No se necesitan `overrides`. No se necesita pinar deps transitivas.

---

## Veredicto

**GO con 1 caveats menores:**

1. **pino + @bull-board**: GO sin restricciones.
2. **@sentry/nextjs@10.53.1**: GO — peer de `next` satisfecho (`^16.0.0-0` cubre 16.2.6). Arrastra OTel como dep transitiva (no conflict, compatible con Sprint 4). No hay razón para downgrade a v9 (v9 no soporta Next.js 16 en su peer range `^13.2.0 || ^14.0 || ^15.0.0-rc.0`; v10 añade explícitamente `^16.0.0-0`). **Si el usuario decide incluir Sentry, usar v10 obligatoriamente.**

**Acción pre-install**: Añadir `pino` a `experimental.serverComponentsExternalPackages` en `next.config.ts` antes de usar en Server Components (misma práctica que v9).
