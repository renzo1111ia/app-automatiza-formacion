---
title: "OWASP Top 10 2021 — Quick Check"
date: 2026-05-18
agent: Audit-Deps+Security (Sonnet)
methodology: Análisis estático superficial (grep + lectura de código clave)
---

# OWASP Top 10 2021 — Quick Check

> Análisis estático. No incluye análisis dinámico, pen testing, ni revisión de base de datos en vivo.
> Estado: OK / At Risk / Partial / N/A

---

## A01:2021 — Broken Access Control

**Estado**: At Risk

**Evidencias:**

1. **Multi-tenancy sin tenant_id garantizado** — El middleware (`src/middleware.ts`) valida autenticación vía Supabase auth, pero no verifica que el `tenant_id` de la cookie pertenezca al usuario autenticado. La cookie `af-tenant-id` se lee directamente sin validación server-side del ownership.

2. **Middleware solo protege `/dashboard` y `/login`** — Rutas bajo `/api/*` NO pasan por el middleware de autenticación según la config del matcher (`/((?!_next/static|...).*)`). Los API routes son responsables de su propia auth — verificar que todos lo implementan.

3. **Admin check inconsistente** — El check de admin en middleware lee `user_metadata.is_admin`, `user_metadata.admin`, `app_metadata.is_admin`, `app_metadata.admin` — 4 variantes distintas (`src/middleware.ts:62-68`). Esta inconsistencia sugiere que el sistema ha tenido varios esquemas de roles sin migración limpia.

4. **D-002 confirmado (multi-tenancy)** — La spec documenta que hubo "datos hardcodeados de un tenant visible para otro". El código no muestra hardcoding literal de tenant_id, pero el flujo de tenant selection via cookie sin server-side ownership validation es el vector.

**Finding:** F-05-OWASP-001 — Falta validación server-side de propiedad de tenant_id
- Archivo: `src/middleware.ts`, `src/lib/actions/tenant.ts`
- Severidad: High
- Fix: Verificar en middleware que el tenant_id de la cookie corresponde a un tenant al que el usuario autenticado tiene acceso, consultando la tabla de relaciones usuario-tenant en Supabase.

---

## A02:2021 — Cryptographic Failures

**Estado**: At Risk

**Evidencias:**

1. **JWTs de producción hardcodeados en código fuente** (ver F-05-SEC-001/002/003) — El mayor cryptographic failure del proyecto. La exposición del JWT service_role es equivalente a exponer la master password de la base de datos.

2. **`crypto` npm package** (`package.json`) — El paquete npm `crypto@1.0.1` es un stub deprecated que advierte al usar `require('crypto')`. Node.js tiene `node:crypto` nativo. No es un fallo criptográfico per se, pero es una dependencia fantasma innecesaria.

3. **Verificación HMAC en WhatsApp webhook** — El WhatsApp POST handler implementa HMAC-SHA256 correctamente (`src/app/api/webhooks/whatsapp/route.ts:39-47`), pero solo cuando `WHATSAPP_APP_SECRET` está configurado. Si no está, acepta cualquier POST.

4. **Sin TLS forzado** — `next.config.ts` no configura HSTS ni fuerza HTTPS. La presencia de `http://` en la URL interna (`http://interno-supabase-a201be...`) sugiere que el tráfico interno puede ser sin TLS.

**Finding:** F-05-OWASP-002 — Secretos criptográficos expuestos en repositorio
- Archivos: `src/lib/auth-config.ts`, `src/lib/supabase/server.ts`, `src/lib/actions/tenant.ts`
- Severidad: Critical
- Fix: Ver F-05-SEC-001 — eliminar fallbacks, rotar JWT

---

## A03:2021 — Injection

**Estado**: Partial (mejor de lo esperado, pero con gaps)

**Evidencias:**

1. **Sin Prisma, pero sin SQL injection directa detectada** — La spec (D-003) advertía sobre SQL directo. Los paquetes `pg` y `postgres` están presentes, pero la revisión del código de aplicación muestra que las queries van principalmente via `@supabase/supabase-js` query builder (`.from('tabla').select().eq()...`), que usa queries parametrizadas.

2. **`src/app/api/tenant/migrate/route.ts:263`** — Llamada a `{tenantUrl}/rest/v1/rpc/exec_sql` — Esta ruta ejecuta SQL arbitrario en instancias de tenant. Si `tenantUrl` o el body de la request no están validados estrictamente, es un vector de SQL injection.

3. **Widget embed script** (`src/app/api/widget/embed.js/route.ts:22,87`) — El parámetro `id` se interpola directamente en el script JS generado: `var widgetId = "${id}"`. Si `id` contiene caracteres especiales (`"`, `;`, etc.), puede inyectar código JavaScript en el script embebido.

4. **`dangerouslySetInnerHTML` en layout.tsx:24** — El contenido es un script estático de detección de tema (no interpolación de user input), por lo que es un uso controlado y seguro.

**Finding:** F-05-OWASP-003 — Inyección de código en widget embed script
- Archivo: `src/app/api/widget/embed.js/route.ts:22`
- Severidad: High
- Fix: Sanitizar/validar el parámetro `id` (debe ser UUID/alphanumeric); escapar caracteres especiales en interpolación

**Finding:** F-05-OWASP-004 — exec_sql en route de migración de tenant
- Archivo: `src/app/api/tenant/migrate/route.ts:263`
- Severidad: High (análisis pendiente — ver Fase 2/4)
- Fix: Auditar completamente la ruta; si ejecuta SQL dinámico, restringir a operaciones específicas y validar estrictamente

---

## A04:2021 — Insecure Design

**Estado**: At Risk

**Evidencias:**

1. **Secrets como fallback en lugar de fail-fast** — El patrón `process.env.SECRET || "hardcoded_value"` representa un diseño inseguro: la aplicación arranca aunque las variables de entorno críticas no estén configuradas, usando secretos de producción reales como fallback. Esto hace que un error de configuración sea transparente e invisible.

2. **Redis sin autenticación** — `docker-compose.yml:59` — Redis corre sin contraseña (`redis-server --appendonly yes ...` sin `--requirepass`). BullMQ y los workers de la aplicación tienen acceso libre a la queue. Si Redis está accesible en red (puerto 6379 expuesto en `ports: "6379:6379"`), cualquier proceso en el host puede manipular las colas.

3. **Sin security headers** — `next.config.ts` no configura Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, ni HSTS. Un proyecto con datos de leads PII debería tener headers de seguridad.

4. **`@anthropic-ai/claude-code` en devDeps del proyecto de producción** — Introduce ~600 dependencias adicionales con CVEs. No debería estar en un proyecto de cliente de producción.

**Finding:** F-05-OWASP-005 — Redis expuesto sin autenticación
- Archivo: `docker-compose.yml:59`
- Severidad: High (si el host está en red compartida o si el puerto 6379 está expuesto al exterior)
- Fix: Añadir `--requirepass <strong-password>` y quitar el binding de puerto externo en producción

**Finding:** F-05-OWASP-006 — Ausencia de security headers HTTP
- Archivo: `next.config.ts`
- Severidad: Medium
- Fix: Añadir headers en `next.config.ts`:
```typescript
async headers() {
    return [{
        source: '/(.*)',
        headers: [
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
    }];
}
```

---

## A05:2021 — Security Misconfiguration

**Estado**: At Risk

**Evidencias:**

1. **Secretos hardcodeados como fallback** (ya documentado en A02/A04)
2. **Redis sin auth y puerto expuesto** (ya documentado en A04)
3. **`next.config.ts` — bodySizeLimit: '10mb'** para Server Actions. Es un límite generoso que puede facilitar ataques de carga masiva de datos contra server actions.
4. **Sin rate limiting** — No hay middleware de rate limiting detectado en las rutas API. Los endpoints de webhooks, autenticación y server actions están sin protección de rate limit.
5. **NEXT_TELEMETRY_DISABLED=1** — Correcto.
6. **Docker build args expuestos** — `NEXT_PUBLIC_*` vars se pasan como `ARG` en Dockerfile y se incrustan en el bundle del cliente (por diseño de Next.js). Esto es correcto para variables públicas, pero confirma que cualquier secret en `NEXT_PUBLIC_*` va al browser.

**Finding:** F-05-OWASP-007 — Sin rate limiting en endpoints críticos
- Archivos: `src/app/api/webhooks/`, `src/app/api/orchestration/`, `src/middleware.ts`
- Severidad: Medium
- Fix: Implementar rate limiting con `next-rate-limit` o middleware propio usando Redis

---

## A06:2021 — Vulnerable and Outdated Components

**Estado**: At Risk

**Evidencias:**

- `next` 16.1.6 — 9 CVEs activos (High + Moderate) — ver risk-matrix.md
- `axios` 1.14.0 — 12 CVEs activos (High + Moderate) — ver risk-matrix.md
- `langsmith` transitiva — 3 CVEs (High + Moderate) — ver risk-matrix.md
- 20 vulnerabilidades totales detectadas por `npm audit`
- 37 paquetes con actualizaciones disponibles

**Finding:** F-05-OWASP-008 — Componentes vulnerables sin actualizar
- Severidad: High (next + axios son directas y tienen CVEs High)
- Fix: Ejecutar el plan de actualización documentado en `outdated.md`

---

## A07:2021 — Identification and Authentication Failures

**Estado**: Partial

**Evidencias:**

1. **Auth basada en Supabase** — Supabase maneja el ciclo de vida de sesiones (JWT, refresh tokens). El middleware redirige usuarios no autenticados a `/login`. El flujo básico es correcto.

2. **Admin check con 4 variantes** — (`src/middleware.ts:62-68`) — Ver A01. El check de admin busca en `user_metadata.is_admin`, `user_metadata.admin`, `app_metadata.is_admin`, `app_metadata.admin`. Esto sugiere que el campo se ha renombrado varias veces sin migración de datos. Un usuario con `admin: true` en metadata antigua aún tendría acceso admin, y un usuario nuevo con `is_admin: true` también. Posibles inconsistencias.

3. **Cookie `af-tenant-id`** — Sin `httpOnly` ni `secure` explícito verificado en el código de `setTenantCookies` (`src/lib/actions/tenant.ts:16`). La cookie tiene `path: "/"` y `maxAge: 30 días` pero no se especifican flags de seguridad. Si no tiene `httpOnly`, es accesible desde JavaScript del cliente.

**Finding:** F-05-OWASP-009 — Cookie tenant-id sin flags de seguridad explícitos
- Archivo: `src/lib/actions/tenant.ts:16`
- Severidad: Medium
- Fix:
```typescript
cookieStore.set("af-tenant-id", tenantId, {
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,  // No accesible desde JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
});
```

---

## A08:2021 — Software and Data Integrity Failures

**Estado**: Partial

**Evidencias:**

1. **Dockerfile usa `npm ci`** — Correcto; usa el lockfile para reproducibilidad.
2. **Sin verificación de integridad de webhooks en Retell** — Ver F-05-SEC-005. Los datos de llamadas llegan sin verificación de origen.
3. **`exec_sql` endpoint** — Si existe una ruta que ejecuta SQL arbitrario en tenants, es un vector de integridad de datos crítico (ver F-05-OWASP-004).
4. **Dependencia `langsmith`** — CVE `GHSA-3644-q5cj-c5c7` — Deserialization de manifests públicos sin verificación de confianza. Si el sistema usa prompts de LangSmith Hub, pueden ser manipulados.

---

## A09:2021 — Security Logging and Monitoring Failures

**Estado**: Partial

**Evidencias:**

1. **Logging presente pero no estructurado** — El código usa `console.log`, `console.warn`, `console.error` extensamente pero sin formato estructurado (JSON) ni correlation IDs.
2. **No hay evidencia de sistema de alertas** — No se detectó integración con sistemas de monitoring (Sentry, Datadog, etc.) en el código fuente.
3. **Logs de webhook sí existen** — `[RETELL WEBHOOK] Received event: ${body.event}` y `[WHATSAPP WEBHOOK] ❌ Verification failed` — hay logging básico de seguridad.
4. **No hay audit log de acciones admin** — El panel de settings y creación de tenants no tiene logging de auditoría de quién hizo qué cambio.

**Finding:** F-05-OWASP-010 — Sin monitoring ni alertas de seguridad
- Severidad: Medium
- Fix: Integrar Sentry para error tracking; añadir audit log para operaciones admin

---

## A10:2021 — Server-Side Request Forgery (SSRF)

**Estado**: At Risk

**Evidencias:**

1. **`next` 16.1.6 — CVE GHSA-c4j6-fc7j-m34r (CVSS 8.6)** — SSRF via WebSocket upgrades. El framework mismo tiene una vulnerabilidad de SSRF activa. Ver `outdated.md`.

2. **`axios` CVEs SSRF** — `GHSA-3p68-rc4w-qgx5`, `GHSA-pmwg-cvhr-8vh7`, `GHSA-m7pr-hjqh-92cm` — Múltiples bypasses de NO_PROXY que permiten SSRF. Axios se usa para llamadas a servicios externos (WhatsApp, CRM, Retell).

3. **`src/app/api/tenant/migrate/route.ts:263`** — Hace fetch a `{tenantUrl}/rest/v1/...` donde `tenantUrl` proviene de datos del tenant. Si un tenant puede controlar su `tenantUrl`, puede dirigir las llamadas a servidores internos (SSRF).

**Finding:** F-05-OWASP-011 — SSRF potencial en route de migración de tenant
- Archivo: `src/app/api/tenant/migrate/route.ts`
- Severidad: High (análisis pendiente confirmación en Fase 2/4)
- Fix: Validar que `tenantUrl` sea una URL de Supabase legítima (allowlist de dominios)

---

## Resumen OWASP

| # | Categoría | Estado | Findings |
|---|-----------|--------|---------|
| A01 | Broken Access Control | At Risk | F-05-OWASP-001 |
| A02 | Cryptographic Failures | At Risk | F-05-OWASP-002, F-05-SEC-001/002/003 |
| A03 | Injection | Partial | F-05-OWASP-003, F-05-OWASP-004 |
| A04 | Insecure Design | At Risk | F-05-OWASP-005, F-05-OWASP-006 |
| A05 | Security Misconfiguration | At Risk | F-05-OWASP-007 |
| A06 | Vulnerable Components | At Risk | F-05-OWASP-008 |
| A07 | Auth Failures | Partial | F-05-OWASP-009 |
| A08 | Software Integrity | Partial | F-05-SEC-005 (webhook sin firma) |
| A09 | Logging/Monitoring | Partial | F-05-OWASP-010 |
| A10 | SSRF | At Risk | F-05-OWASP-011 |

**Categorías OK**: Ninguna — todas tienen al menos un finding o están en "Partial"
**Categorías At Risk**: A01, A02, A04, A05, A06, A10 (6 de 10)
**Categorías Partial**: A03, A07, A08, A09 (4 de 10)
