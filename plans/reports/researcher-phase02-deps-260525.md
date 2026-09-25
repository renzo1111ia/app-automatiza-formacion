# researcher-phase02-deps-260525

**Audit**: Compatibilidad deps Phase 02 Observabilidad Sprint 3  
**Stack base**: Node 22.22.3, Next.js ^16.2.6, React 19, BullMQ 5.73.0, TypeScript ^5  
**Fecha**: 25-05-2026

---

## Resumen ejecutivo

- **Pino v10**: GO. Node 22 compatible, Next.js App Router compatible en Node runtime. Types nativos incluidos — `@types/pino` es REDUNDANTE, eliminar del plan.
- **pino-http**: REPLANTEAR. Diseñado para Express/Fastify/Connect; Next.js App Router no usa middleware de request estilo HTTP servidor. No aporta nada en este stack — eliminar del plan.
- **@bull-board/api + @bull-board/express v7**: GO CON CAVEATS. `@bull-board/nextjs` NO EXISTE en npm (404 confirmado). La integración correcta es Express adapter dentro de un Route Handler catch-all. Hacky pero documentado, funciona en production con Next.js App Router via Pages-style catch-all o separando un micro-proceso Express.
- **@sentry/nextjs v10.53.1**: GO. Soporta Next.js 16 explícitamente en `peerDependencies`. Setup manual disponible, evita wizard interactivo. No hay integración Sentry preexistente en el proyecto.
- **Edge runtime**: restricción crítica documentada abajo — Pino BLOQUEADO en Edge, bull-board idem. Las rutas `/api/health` y `/api/version` deben ejecutarse en Node runtime (o usar `console.log` si permanecen en Edge).

---

## Tabla de compatibilidad

| Dependencia           | Versión exacta a pinear | Compatible Node 22      | Compatible Next.js 16 App Router          | Necesaria                                   |
| --------------------- | ----------------------- | ----------------------- | ----------------------------------------- | ------------------------------------------- |
| `pino`                | `10.3.1`                | SI                      | SI (Node runtime only)                    | SI                                          |
| `pino-http`           | `11.0.0`                | SI (en Express/Fastify) | NO — no aplica en App Router              | NO — eliminar                               |
| `@types/pino`         | — (no instalar)         | —                       | —                                         | REDUNDANTE — pino v8+ incluye types nativos |
| `@bull-board/api`     | `7.1.5`                 | SI                      | SI (via Express adapter en Route Handler) | SI                                          |
| `@bull-board/nextjs`  | NO EXISTE (404 npm)     | —                       | —                                         | BLOQUEANTE — ver sección bull-board         |
| `@bull-board/express` | `7.1.5`                 | SI                      | SI (adapter requerido para Next.js)       | SI (en lugar de @bull-board/nextjs)         |
| `@sentry/nextjs`      | `10.53.1`               | SI (node >=18)          | SI (peerDep incluye ^16.0.0-0)            | CONDICIONAL — ver sección Sentry            |

---

## Hallazgos críticos

### 1. `@bull-board/nextjs` — paquete INEXISTENTE

`npm show @bull-board/nextjs` devuelve **404 Not Found**. El paquete no existe en el registry público.

El plan de Phase 02 lo menciona como `^6.x` pero la versión actual de bull-board es la **7.x** (latest 7.1.5, publicada Enero 2025). No hay rama 6.x activa.

**Ruta real para Next.js App Router**: usar `@bull-board/api` + `@bull-board/express` dentro de un Route Handler catch-all:

```
src/app/api/bull-board/[[...slug]]/route.ts
```

El Express adapter puede ser montado como sub-app y las peticiones re-enrutadas manualmente. Es un patrón documentado en GitHub Issues #882 y #444, con ejemplos funcionales para App Router. Alternativa más limpia: proceso Express separado en puerto interno (no expuesto), solo accesible desde admin autenticado.

**Impacto**: el plan debe reemplazar `@bull-board/nextjs` por `@bull-board/express@7.1.5`. Actualizar phase-02 antes de instalar.

### 2. Pino v10 (no v9) — el plan pide `^9.x` pero latest es `10.3.1`

Pino saltó de v9 a v10 con breaking change: **Node 18 dropped** (Node 20+ requerido). Node 22 = totalmente compatible.

El plan original especifica `^9.x`. Con `^9` npm instalará la última 9.x (9.6.x aproximadamente), que también es compatible. Sin embargo, **v10.3.1 es la mejor elección**: soporte nativo TypeScript stripping (Node 22 feature), activamente mantenida, 0 issues conocidos con Node 22. Recomendado pinear `10.3.1` directamente.

### 3. `@types/pino` — redundante, NO instalar

Pino incluye types TypeScript nativos desde v8. La rama DefinitelyTyped `@types/pino` lleva deprecated desde entonces. Instalarla puede generar conflictos de tipos duplicados. Eliminar del plan.

### 4. `pino-http` — eliminar del plan

`pino-http` es middleware HTTP estilo `(req, res, next) => {}` diseñado para Express/Fastify/Connect. Next.js App Router no expone `req`/`res` del servidor HTTP subyacente — los Route Handlers reciben `Request` Web API. `pino-http` no tiene ningún punto de enganche válido en este stack.

El logging HTTP en App Router se hace llamando directamente `logger.info({ url, method, status })` al inicio/fin del route handler. No se necesita middleware wrapper.

### 5. `@sentry/nextjs` — compatible, pero setup requiere decisión

Versión `10.53.1` (latest) tiene `peerDependencies: { next: "^13.2.0 || ^14.0 || ^15.0.0-rc.0 || ^16.0.0-0" }`. Next.js 16 completamente soportado.

**Sin wizard**: el setup manual (documentado en `docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/`) crea 3 archivos: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.edge.config.ts`. No requiere `npx @sentry/wizard` interactivo. Controlable por el equipo.

**Cuidado con dependencias transitivas**: `@sentry/nextjs@10` arrastra `@opentelemetry/api`, `@opentelemetry/semantic-conventions`, `rollup@^4`. Son prod dependencies. Aumenta bundle node pero no bundle cliente (tree-shaken).

**No hay integración Sentry preexistente** en el proyecto (grep confirma 0 matches en `src/`).

---

## Restricciones Edge runtime

Pino usa `process.stdout.write`, `worker_threads`, y `Buffer` — APIs Node.js puras. **Incompatible con Edge runtime**.

Bull-board también requiere Node runtime (Redis connections, BullMQ adapter).

| Ruta                          | Runtime actual             | Logger recomendado                   |
| ----------------------------- | -------------------------- | ------------------------------------ |
| `/api/health`                 | Edge (asumido)             | `console.log` o mover a Node runtime |
| `/api/version`                | Edge (asumido)             | `console.log` o mover a Node runtime |
| `/api/webhooks/*`             | Node runtime               | `pino` — GO                          |
| Server Actions                | Node runtime               | `pino` — GO                          |
| BullMQ workers                | Node runtime               | `pino` — GO                          |
| `/api/bull-board/[[...slug]]` | Node runtime (obligatorio) | No aplica logger aquí                |

Si `/api/health` y `/api/version` se crean como nuevas rutas en Phase 02, crearlas directamente con `export const runtime = 'nodejs'` para poder usar Pino. Si se mantienen en Edge, usar `Response.json()` con `console.log` — suficiente para health checks.

---

## Riesgos top 3

| #   | Riesgo                                                                              | Probabilidad         | Mitigación                                                                                                         |
| --- | ----------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | `@bull-board/nextjs` inexistente bloquea instalación                                | ALTA (certeza)       | Reemplazar por `@bull-board/express@7.1.5` + Route Handler catch-all. Actualizar plan antes de `npm install`.      |
| 2   | Sentry arrastra OpenTelemetry — conflicto si el stack añade OTel propio en Sprint 4 | MEDIA                | Documentar en ADR que Sentry gestiona el OTel collector. No instalar `@opentelemetry/*` manualmente.               |
| 3   | Pino en Edge runtime rompe build con error `Dynamic Code Evaluation`                | ALTA (si se intenta) | Enforcar `export const runtime = 'nodejs'` en todas las rutas que importen el logger. Test de build verifica esto. |

---

## Recomendación final — lista de instalación corregida

**Producción:**

```
pino@10.3.1
@bull-board/api@7.1.5
@bull-board/express@7.1.5
@sentry/nextjs@10.53.1
```

**Dev/peer (NO instalar):**

- `@types/pino` — eliminar del plan (redundante)
- `pino-http` — eliminar del plan (no aplica)
- `@bull-board/nextjs` — no existe, eliminar del plan

**Decisión aplazable**: `@sentry/nextjs` puede diferirse a post-MVP si Pino + logs Dokploy cubren observabilidad mínima para Sprint 3. La condición de 5K errores/mes free tier es válida, pero el setup añade ~30min de integración no trivial. **Recomendado incluirlo** en Sprint 3 dado que Next.js 16 ya está en `peerDependencies` y el setup manual es controlable.

---

## Fuentes

- [pino npm releases](https://www.npmjs.com/package/pino) — versión 10.3.1 confirmada
- [pino v10 breaking changes issue](https://github.com/pinojs/pino/issues/2317) — Node 18 dropped, Node 20+ requerido
- [bull-board Next.js issue #882](https://github.com/felixmosh/bull-board/issues/882) — sin adapter oficial Next.js
- [Sentry Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) — Next.js 16 soportado
- [@sentry/nextjs npm](https://www.npmjs.com/package/@sentry/nextjs) — peerDeps verificados via `npm show`
- [Next.js edge logging con Pino](https://www.trysmudford.com/blog/nextjs-edge-logging/) — restricciones Edge documentadas
- [Next.js discussions Edge logging](https://github.com/vercel/next.js/discussions/67213) — confirmación pino no funciona en Edge

---

## Cuestiones sin resolver

1. ¿Las rutas `/api/health` y `/api/version` existen ya o se crean en Phase 02? Si se crean nuevas, forzar Node runtime desde el inicio.
2. ¿El plan de bull-board prevé protección de acceso admin a `/api/bull-board`? La ruta expone estado interno de queues — necesita middleware de auth.
3. ¿Sprint 4 planea añadir OpenTelemetry propio? Si sí, coordinar con Sentry para evitar colisión de instrumentación.
