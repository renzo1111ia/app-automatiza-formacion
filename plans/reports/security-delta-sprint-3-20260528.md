# Security Delta Report — Sprint 3 Hardening (CLOSE-1.5)

**Fecha**: 28-05-2026
**Modo**: delta (OWASP 2021 sobre developer..feature/sprint-03-hardening)
**Scope**: 35 archivos src/ + Dockerfile + next.config.ts
**Ejecutor**: af-agents:security (auto-invocado por manager en SP-4-CLOSE-1.5)
**Rama auditada**: feature/sprint-03-hardening

---

## Resumen ejecutivo

| Severidad             | Count | Detalle                                                                                                 |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| 🔴 Crítico            | 0     | Ninguno — sprint NO bloqueado                                                                           |
| 🟠 Alto               | 2     | BUG-SEC-01 (IP spoofing en rate-limit), BUG-SEC-02 (webhook workflow sin auth — pre-existente agravado) |
| 🟡 Medio              | 2     | BUG-SEC-03 (email en logs servidor), BUG-SEC-04 (whatsapp.ts SUPABASE_URL non-null assertion)           |
| 🟢 Bajo / Informativo | 3     | Docker ANON_KEY build-arg, lead_id en respuesta webhook, asPlainClient sin bypass RLS                   |

**Veredicto: PASS** — No hay findings críticos. El sprint puede continuar a CLOSE-2.

---

## Findings críticos

_Ninguno._

---

## Findings altos

### BUG-SEC-01 — IP Spoofing en rate-limit de auth actions (A07:2021)

**Archivo**: `src/lib/rate-limiter.ts` línea 135-138 + `src/lib/actions/auth.ts` línea 22-29
**OWASP**: A07:2021 Identification & Authentication Failures
**Severidad**: 🟠 Alto

**Descripción**:
`extractClientIp()` lee `X-Forwarded-For` directamente del header de la request sin
verificar que el header fue puesto por un proxy de confianza (Dokploy/traefik). En entornos
donde el origen llega directamente al proceso Node.js sin pasar por traefik (exposición directa
al puerto 8500), un atacante puede fabricar:

```http
POST /login
X-Forwarded-For: 1.2.3.4
```

Con esto su bucket de rate-limit usa IP `1.2.3.4` en lugar de su IP real. Puede rotar
headers para obtener prácticamente intentos ilimitados (5 intentos/minuto por IP fabricada).

El esquema `ip:emailHash` mitiga parcialmente el ataque (si ataca el mismo email con IPs
distintas, los buckets son distintos — no se comparte cuota con otros usuarios legítimos),
pero no protege contra brute-force al mismo email fabricando IPs.

**Contexto de explotabilidad en AF**:

- En producción (Dokploy + traefik), traefik añade `X-Forwarded-For` real y el atacante no
  puede fabricarlo (traefik lo sobreescribe). La explotabilidad baja considerablemente.
- En desarrollo local (puerto 8500 expuesto directamente), la evasión es trivial.
- El riesgo real depende de si el VPS expone alguna vez el puerto 8500 directamente.
  Actualmente la arquitectura usa traefik como único punto de entrada — si esta invariante
  se mantiene, el riesgo en prod es bajo-medio.

**Fix recomendado**:
Añadir al extractClientIp una lista de IPs de proxy de confianza, o preferir `X-Real-IP`
(que traefik pone y es más difícil de falsificar en este stack). Alternativamente, documentar
explícitamente en `rate-limiter.ts` que la función asume proxy de confianza y añadir un
ADR al respecto.

```typescript
// Opción 1: Priorizar X-Real-IP (traefik la fija, no la propaga del cliente)
export function extractClientIp(request: Request): string {
  // X-Real-IP es inyectado por traefik desde la conexión TCP real, no propagable
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim() || "unknown";
  // Fallback a XFF solo en desarrollo sin proxy
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return "unknown";
}
```

**Decisión recomendada para el controller**: abrir BUG-SEC-01, resolver antes del deploy VPS
(Sprint 4B / CLOSE-5 VPS). NO bloquea el cierre del sprint actual porque el VPS usa traefik
como único punto de entrada según la arquitectura confirmada.

---

### BUG-SEC-02 — Webhook workflow sin autenticación (A01:2021) — pre-existente agravado

**Archivo**: `src/app/api/webhooks/workflow/[workflowId]/[path]/[nodeId]/route.ts`
**OWASP**: A01:2021 Broken Access Control
**Severidad**: 🟠 Alto (pre-existente en `developer`; delta no lo empeora pero tampoco lo arregla)

**Descripción**:
El handler `/api/webhooks/workflow/[workflowId]/[path]/[nodeId]` es un endpoint público sin
ningún mecanismo de autenticación ni firma HMAC. Cualquier actor externo que conozca
(o adivine por fuzzing) un `workflowId` y `nodeId` válidos puede:

1. Enviar un payload arbitrario con un número de teléfono fabricado.
2. Provocar un upsert de un lead en la BD del tenant objetivo (tenant_id viene del workflow, no del caller).
3. Disparar la orquestación (`executeWorkflow`) con payload arbitrario, enviando mensajes
   WhatsApp y activando llamadas de voz para números que el atacante controla.

La respuesta incluye el `lead_id` interno, que podría usarse en ataques posteriores.

**Nota sobre scope del delta**: la ausencia de autenticación existía antes del Sprint 3 (confirmado
en `developer` branch). El refactor de lint en este delta cambió tipos (`Record<string, any>`
→ `Record<string, unknown>`) sin alterar el modelo de seguridad. Sin embargo, el delta
NO aprovechó la oportunidad de añadir autenticación y el endpoint sigue siendo un vector.

**Fix recomendado**:
Añadir validación de shared secret configurable por workflow en `graph_data.config.webhook_secret`.
Si ausente, rechazar con 401. Alternativamente, habilitar un token de acceso de 1 solo uso
almacenado en la BD y validado antes de procesar.

**Decisión recomendada para el controller**: abrir BUG-SEC-02, prioridad alta para antes del
deploy VPS público (Sprint 4B). NO bloquea el cierre del sprint actual (pre-existente, no agravado).

---

## Findings medios

### BUG-SEC-03 — Email en claro en logs del servidor (A09:2021)

**Archivo**: `src/lib/actions/auth.ts` líneas 65, 86, 105
**OWASP**: A09:2021 Security Logging & Monitoring Failures
**Severidad**: 🟡 Medio

**Descripción**:
Las funciones de login escriben el email del usuario en claro en logs de servidor:

```typescript
console.log(`[AUTH] Intentando login para ${email} en ${AUTH_SUPABASE_URL}`);
console.log(`[AUTH] Login inicial exitoso para ${email}, procesando perfil...`);
console.log(`[AUTH] Login completado para ${email}. Redirigiendo...`);
```

En un sistema con logging centralizado (Pino + Sentry), los emails quedan en:

- Pino logs (sistema de ficheros del contenedor o stdout → Loki/cualquier sink futuro)
- Potencialmente en Sentry si Pino captura uncaught errors con contexto de scope

Los emails son PII según GDPR. Registrarlos en logs puede crear obligaciones de retención
y borrado que complican el cumplimiento.

**Fix recomendado**: sustituir `${email}` por un hash o truncado antes de loguear:

```typescript
const emailTag = email.split("@")[0].slice(0, 3) + "***@" + email.split("@")[1];
console.log(`[AUTH] Intentando login para ${emailTag}`);
```

O usar `createHash('sha256').update(email).digest('hex').slice(0,8)` como identificador opaco.

**Nota**: esto es una práctica de hardening, no una vulnerabilidad de explotabilidad directa.
El fix es quick-win y recomendable para antes del primer deploy con usuarios reales.

---

### BUG-SEC-04 — Non-null assertion en SUPABASE_URL en whatsapp.ts (A05:2021)

**Archivo**: `src/lib/integrations/whatsapp.ts` línea 87
**OWASP**: A05:2021 Security Misconfiguration
**Severidad**: 🟡 Medio

**Descripción**:

```typescript
const supabase = createClient(process.env.SUPABASE_URL!, getAuthServiceRoleKey());
```

El operador `!` fuerza TypeScript a ignorar que `SUPABASE_URL` puede ser `undefined` en runtime.
Si la variable de entorno no está configurada (contenedor mal configurado), `createClient`
recibe `undefined` como URL y el comportamiento es un error silencioso o un crash no informativo.

El resto del codebase usa `requireEnv()` / `requireEnvAny()` para fallo explícito. Esta excepción
en un try-catch (pause check) hace que el error quede silenciado en `catch (e) → console.warn`
y el mensaje WhatsApp **se envía de todos modos** sin verificar la pausa (fail-open silencioso).

**Impacto secundario de seguridad**: si el check de pausa falla silenciosamente, leads marcados
como `is_ai_paused = true` pueden recibir mensajes WhatsApp no deseados (bypass del control
de consentimiento / opt-out).

**Fix recomendado**: sustituir `process.env.SUPABASE_URL!` por
`requireEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"])` de `@/lib/env`, y propagar
el error explícitamente en lugar de tragárselo en el catch exterior.

---

## Findings bajos / informativos

### INFO-01 — ANON_KEY aún se pasa como ARG en build Docker

**Archivo**: `Dockerfile` líneas 19-21
**Descripción**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` se pasa como `ARG/ENV` durante el build y queda
embebido en la imagen (era la intención original — Next.js lo incrusta en el bundle cliente).
Es correcto: la anon key es pública por diseño. Solo informativo para documentar que esta var
sí es una "Build Arg que se embebe" intencionalmente, a diferencia de `SERVICE_ROLE_KEY`.

**Acción**: ninguna. Comportamiento correcto y documentado.

---

### INFO-02 — lead_id expuesto en respuesta del webhook workflow

**Archivo**: `src/app/api/webhooks/workflow/[workflowId]/[path]/[nodeId]/route.ts` línea 134
**Descripción**: la respuesta incluye `lead_id: lead.id` (UUID interno). En combinación con
BUG-SEC-02 (sin auth), un atacante obtiene el UUID del lead que creó. Este UUID solo es útil
si tiene otras vulnerabilidades que lo acepten como parámetro — actualmente el daño es limitado.
Si BUG-SEC-02 se resuelve, este finding pierde relevancia.

**Acción**: resolver junto con BUG-SEC-02.

---

### INFO-03 — asPlainClient() cast no introduce bypass RLS

**Archivos**: `src/lib/core/processors/QualificationProcessor.ts`, `src/lib/core/scheduler.ts`
**Descripción**: el cast `supabase as unknown as SupabaseClient` no cambia el cliente subyacente
ni sus credenciales. El cliente sigue siendo el obtenido por `getSupabaseServerClient()`, que usa
`SUPABASE_SERVICE_ROLE_KEY` si está definida (ver nota abajo). El `asPlainClient` es un truco
de tipos TypeScript puro y no tiene implicaciones de seguridad en runtime.

**Nota importante (PRE-EXISTENTE, FUERA DE SCOPE DEL DELTA)**:
`getSupabaseServerClient()` en `src/lib/supabase/server.ts` usa:

```typescript
const key = requireEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
```

Si `SUPABASE_SERVICE_ROLE_KEY` está definida (lo está en runtime), este cliente NO aplica RLS
a pesar de su nombre. Esto es un BUG pre-existente **fuera del scope del delta** (server.ts no
fue modificado en este sprint). Se menciona para que el controller lo conozca pero no se crea
BUG aquí — debe resolverse en un sprint de RLS hardening (referencia audit anterior).

---

## Áreas auditadas con OK confirmado

| Punto focal                                      | Veredicto             | Detalle                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `auth-config.ts` getAuthServiceRoleKey() lazy | ✅ OK                 | Función en runtime, sin build-time eval. Error explícito si falta. Sin race condition (proceso Node.js single-thread). 7 callers migrados correctamente.                                                                                                    |
| 2. `auth.ts` rate-limit bucket key               | ⚠️ OK con reserva     | `ip:emailHash` es correcto por diseño. El riesgo de spoofing (BUG-SEC-01) no bloquea el cierre pero debe resolverse antes de VPS.                                                                                                                           |
| 3. `rate-limiter.ts` timeout 100ms               | ✅ OK                 | `Promise.race` correctamente implementado. Fail-open coherente con política del proyecto. No hay race condition entre timeout y resolución real (timer se cancela implícitamente al resolver la carrera).                                                   |
| 4. `webhooks/workflow/.../route.ts`              | ⚠️ OK (pre-existente) | Sin firma HMAC — pre-existente en developer. Refactor lint-only, no agravado. BUG-SEC-02 abierto para sprint 4B.                                                                                                                                            |
| 5. `webhooks/retell/route.ts`                    | ✅ OK                 | `verifyRetellWebhook` sigue invocándose en la primera línea del handler antes de procesar body. La migración a `getAuthServiceRoleKey()` no alteró el flujo de validación de firma.                                                                         |
| 6. `proxy.ts` (ex middleware)                    | ✅ OK                 | Lógica de auth idéntica al middleware anterior (diff confirmado). Runtime Node.js es compatible con `createServerClient` + cookies de Supabase SSR. `app_metadata` read-only para admin check — DA-2-005 resuelto.                                          |
| 7. `next.config.ts` CSP                          | ✅ OK                 | `unsafe-eval` solo en `NODE_ENV !== 'production'`. Build de producción tiene CSP estricta. `turbopack.root: process.cwd()` es configuración interna de Turbopack — no expone paths ni crea SSRF.                                                            |
| 8. `Dockerfile` secretos embebidos               | ✅ OK                 | `SUPABASE_SERVICE_ROLE_KEY` eliminado del build (objetivo principal del hardening). Solo `NEXT_PUBLIC_*` vars quedan — correctas por ser públicas. No hay DSN de Sentry, OpenAI keys u otros secretos hardcodeados.                                         |
| 9. `whatsapp.ts` sendTextMessage pause check     | ⚠️ OK con reserva     | `getAuthServiceRoleKey()` import dinámico funciona correctamente. El riesgo identificado (BUG-SEC-04) es la non-null assertion en SUPABASE_URL que puede silenciar el check. No es un bypass intencional.                                                   |
| 10. `asPlainClient()` RLS isolation              | ✅ OK                 | Cast TypeScript puro, no altera credenciales. Todas las queries via `asPlainClient` mantienen sus filtros `tenant_id` o `eq("tenant_id", tenantId)`. Revisados QualificationProcessor (2 usos) y scheduler (3 usos): todos con filtros de tenant correctos. |

---

## Mejoras de seguridad introducidas en este delta (positivas)

1. **Docker SERVICE_ROLE_KEY removida del build** — Elimina la mayor vulnerabilidad de exposición
   de credenciales admin (bypass RLS) via `docker history`/`docker inspect`.

2. **getAuthServiceRoleKey() lazy getter** — 7 callers migrados. El key solo existe en memoria
   del proceso runtime, no en capas de imagen ni variables de build.

3. **Rate-limit en auth actions** (loginAction 5/min, resetPasswordAction 3/min) — Cierra OWASP
   A07:2021 brute-force / credential stuffing para Server Actions que el middleware no cubría.

4. **Timeout 100ms en Redis rate-limit** — Previene que un Redis caído bloquee el proceso de
   login indefinidamente (detectado en /e2etotal: >1.5min de bloqueo sin el fix).

5. **admin check via app_metadata** en proxy.ts — DA-2-005 resuelto: privilege escalation via
   `user_metadata.is_admin` ya no es posible.

6. **CSP `unsafe-eval` solo en dev** — Producción mantiene CSP estricta; dev tiene el fix de
   BUG-3-13 para no romper React DevTools.

7. **WCAG-08/09/10** — aria-labels, headings, skip-link: mejoras de accesibilidad que reducen
   superficie de ataques de screen-reader spoofing (edge case).

---

## Tabla de BUGs a abrir

| ID         | Severidad | Título                                                         | Sprint Target       |
| ---------- | --------- | -------------------------------------------------------------- | ------------------- |
| BUG-SEC-01 | 🟠 Alto   | IP spoofing en rate-limit via X-Forwarded-For no validado      | Sprint 4 / pre-VPS  |
| BUG-SEC-02 | 🟠 Alto   | Webhook workflow genérico sin autenticación ni firma HMAC      | Sprint 4B / pre-VPS |
| BUG-SEC-03 | 🟡 Medio  | Email en claro en logs de servidor (auth.ts)                   | Sprint 4 / backlog  |
| BUG-SEC-04 | 🟡 Medio  | Non-null assertion SUPABASE_URL en whatsapp.ts sendTextMessage | Sprint 4 / backlog  |

---

## Status

**Status**: DONE
**Veredicto**: PASS — Sprint 3 puede continuar a CLOSE-2 (E2C Local + WCAG)
**Concerns**: BUG-SEC-01 y BUG-SEC-02 deben resolverse antes del primer deploy VPS con tráfico real
