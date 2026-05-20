# Phase 06 — Otros críticos

## Context Links
- [plan.md](plan.md) — overview Sprint 0
- [RoadMap Bloque 1.6](../RoadMap.md) — tareas 1-22..1-26
- [DEEP-FINDINGS-SUMMARY.md](../../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) — DA-3-002, DA-3-004, DA-3-CVE-001, DA-3-CVE-002
- [docs/audit/deep/DA-3-security-deep.md](../../docs/audit/deep/DA-3-security-deep.md)
- [DECISIONES-AUDITOR-JAVIER-HP.md](../../docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md) — R-023.a (Easypanel)
- [Auditoría dependencias ADR 20-05-2026](../reports/adr-auditoria-dependencias-20260520.md) — findings DEP-001, CVE-002

## Overview

**Prioridad:** P1 — Crítico.
**Estado:** 🔘 Pendiente
**Estimación:** 23h (1-22: 8h + 1-23: 4h + 1-24: 4h + 1-25: 3h + 1-26: 4h)
**Agentes:** `af-agents:code` (1-22, 1-23, 1-25) + `af-agents:adr` (1-24, 1-26, Dependency Guard obligatorio) + `af-agents:security` (verificación post-1-26)

Este bloque contiene cinco vectores:
- **1-22**: SSRF confirmado vía cookie editable por JS — cualquier usuario puede hacer que el servidor haga peticiones a URLs arbitrarias.
- **1-23**: XSS en widget embed servido a sitios de terceros — inyectable desde URL pública.
- **1-24**: `axios@1.14.0` con 15 CVEs activos (SSRF CVSS 7.2 + Prototype Pollution CVSS 7.4).
- **1-25**: `crypto@1.0.1` DEPRECATED — paquete fantasma npm, reemplazar por `node:crypto` built-in.
- **1-26**: `next@16.1.6` con 19 CVEs activos (SSRF CVSS 8.6 + middleware bypass CVSS 8.1). **BLOQUEANTE** para Ph3 y Ph5 — debe ejecutarse primero.

**Orden de ejecución en esta fase:**
1. **1-26 PRIMERO** (bloquea Ph3/Ph5; ADR obligatorio)
2. 1-24 + 1-25 en paralelo (solo package.json + imports, día 1 junto con Ph2)
3. 1-22 + 1-23 tras confirmar 1-26 sin regresiones

## Key Insights

- **DA-3-002**: `api/tenant/migrate/route.ts:247-263` — la cookie `af-tenant-url` se usa directamente como URL destino de una petición HTTP del servidor. La cookie es httpOnly? No se confirma — si es accesible por JS, cualquier usuario puede redirigir el servidor a `http://169.254.169.254/` (metadata AWS) o a servicios internos. **Decisión**: allowlist dinámica POR TENANT almacenada en `tenants.allowed_migrate_hosts text[]`. Los dominios NO se conocen al crear el sistema — se rellenan tras el alta de cada tenant. Si la lista está vacía → endpoint cerrado para ese tenant (deny by default). +2h sobre estimación original por allowlist dinámica + UI admin.
- **DA-3-004**: `api/widget/embed.js/route.ts:16` — el parámetro `id` de la query string se interpola directamente en JavaScript servido como respuesta. Si `id` contiene `</script><script>alert(1)</script>`, ese código se ejecuta en cualquier sitio de tercero que cargue el widget. Fix: sanitizar `id` antes de interpolarlo.
- **DA-3-CVE-001**: `axios@1.14.0` tiene 15 CVEs conocidos. El más grave (SSRF CVSS 7.2) permite a un atacante que controla la URL redirigir peticiones axios a targets arbitrarios, incluyendo servicios internos. El upgrade debe pasar por `af-agents:adr` (Dependency Guard) antes de instalarse.
- **DEP-001**: `crypto@1.0.1` es un paquete npm vacío que ocupa el nombre para prevenir typosquatting. La descripción oficial del paquete dice: *"This package is no longer supported. It's now a built-in Node module."* En auditorías de terceros este paquete levanta banderas rojas inmediatas. Node.js incluye `crypto` como built-in desde v0.x — no hay funcionalidad real que perder.
- **DA-3-CVE-002**: `next@16.1.6` tiene 19 CVEs activos. Los más graves: SSRF via WebSocket upgrades (CVSS 8.6, GHSA-c4j6-fc7j-m34r) y middleware/proxy bypass via dynamic route param injection (CVSS 8.1, GHSA-492v-c6pp-mqqv). El middleware bypass anula directamente las protecciones de auth añadidas por 1-07, 1-08, 1-16 y 1-17 — sin este fix esas tareas son inefectivas. Movida de Sprint 1 (2-27) a Sprint 0 por impacto crítico en seguridad real.

## Requirements

### Funcionales
- 1-22: Implementar allowlist dinámica POR TENANT. Nueva columna `tenants.allowed_migrate_hosts text[]`. El endpoint valida el host de la cookie `af-tenant-url` contra `tenants.allowed_migrate_hosts` del tenant activo. Si la lista está vacía → 403 (deny by default). UI admin para gestionar la lista de hosts por tenant.
- 1-23: Sanitizar el parámetro `id` antes de interpolarlo en el JavaScript del widget embed. Usar una función de escape que garantice que el valor es un identificador seguro (solo alfanumérico + guión).
- 1-24: Actualizar axios a la versión estable más reciente sin CVEs activos. Pasar por `af-agents:adr` primero para validar compatibilidad y breaking changes.

- 1-25: Eliminar `crypto@1.0.1` de `dependencies`. Reemplazar todos los `import ... from 'crypto'` / `require('crypto')` por `import ... from 'node:crypto'` en `src/` y `worker.js`.
- 1-26: Actualizar `next` a `16.2.6` + `eslint-config-next` a `16.2.6` (peer dep ligada). Pasar por `af-agents:adr` primero. Smoke test de rutas críticas. Rollback inmediato si hay regresión. Marcar 2-27 en Sprint 1 como "movida a 1-26".

### No funcionales
- 1-22: La allowlist es dinámica por tenant en columna `tenants.allowed_migrate_hosts text[]`. NO env var estática (los dominios no son conocidos al crear el sistema). Deny by default si la lista está vacía.
- 1-23: La sanitización debe aplicarse en el servidor, no en el cliente (no confiar en el parámetro recibido).
- 1-24: Si el upgrade de axios introduce breaking changes en la API, documentarlos y actualizar los call sites antes de cerrar la tarea.
- 1-25: El reemplazo de imports debe ser exhaustivo — usar grep antes y después de la migración para verificar 0 referencias al paquete npm `crypto`.
- 1-26: Upgrade minor (16.1.6 → 16.2.6) — no se esperan breaking changes pero el middleware es código crítico. Testing obligatorio antes de cerrar la tarea. Si cualquier ruta protegida devuelve 500 tras el upgrade → rollback y reportar.

## Architecture

### 1-22 — SSRF allowlist dinámica por tenant en tenant/migrate

```
ANTES:
  cookie af-tenant-url = "http://cualquier-url.com"
  handler → fetch(cookie.value)  ← SSRF activo

DESPUÉS:
  cookie af-tenant-url = "http://cualquier-url.com"
  handler → leer tenant activo → buscar tenants.allowed_migrate_hosts
           → validateTenantUrl(cookie.value, allowedHosts) → si no en lista → 403
           → si lista vacía → 403 (deny by default)
           → fetch(validatedUrl)

Allowlist check (dinámica por tenant):
  const tenant = await getTenant(tenantId);
  const allowedHosts: string[] = tenant.allowed_migrate_hosts ?? [];
  function validateTenantUrl(url: string, allowedHosts: string[]): URL {
    if (allowedHosts.length === 0) throw new Error('No allowed hosts configured for tenant');
    const parsed = new URL(url); // throws si malformada
    if (!allowedHosts.includes(parsed.hostname)) throw new Error('Host not allowed');
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS allowed');
    return parsed;
  }
```

**Nota**: Este mismo archivo (`tenant/migrate/route.ts`) tiene el bug 1-11 (GET sin auth). 1-11 se trata en Ph3, 1-22 solo toca la parte SSRF del handler. Coordinar para no entrar en conflicto de edición del mismo archivo (asignar ambas al mismo dev o mergear en un mismo commit).

### 1-23 — XSS sanitización widget embed

```ts
// ANTES (api/widget/embed.js/route.ts:16):
const script = `var widgetId = "${id}";`  // ← XSS directo

// DESPUÉS:
function sanitizeWidgetId(raw: string): string {
  // Solo alfanumérico, guión y guión bajo — rechazar todo lo demás
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(raw)) {
    throw new Error('Invalid widget id');
  }
  return raw;
}
const safeId = sanitizeWidgetId(id);
const script = `var widgetId = "${safeId}";`
```

Si `id` no cumple el patrón → devolver 400 con mensaje de error claro.

### 1-24 — Axios upgrade (vía af-agents:adr)

```
ANTES:  "axios": "1.14.0" (15 CVEs activos: SSRF CVSS 7.2, Prototype Pollution CVSS 7.4)
DESPUÉS: "axios": "<versión_más_reciente_sin_CVEs>" (determinar al ejecutar)

Proceso:
  1. af-agents:adr verifica compatibilidad y genera ADR
  2. npm install axios@<versión_aprobada>
  3. Grep de call sites axios en el proyecto → verificar que API no cambió
  4. npm run typecheck → 0 errores
  5. Tests de integración que usen axios
```

### 1-25 — Reemplazar crypto@1.0.1 DEPRECATED por node:crypto

```
ANTES:
  "dependencies": { "crypto": "^1.0.1" }  ← paquete fantasma npm
  import crypto from 'crypto'               ← puede resolver npm o built-in (ambiguo)

DESPUÉS:
  "dependencies": {} (crypto eliminado)
  import crypto from 'node:crypto'          ← explícito, resuelve siempre el built-in

Proceso:
  1. npm uninstall crypto → elimina dep y actualiza package.json + package-lock.json
  2. grep -r "from 'crypto'" src/ worker.js → listar todos los archivos afectados
  3. grep -r "require('crypto')" src/ worker.js → idem para CommonJS
  4. Reemplazar todas las referencias → 'node:crypto'
  5. npm run typecheck → 0 errores
  6. npm run build → confirmar que next resuelve correctamente el built-in
```

### 1-26 — Update next@16.1.6 → next@16.2.6 (vía af-agents:adr)

```
ANTES:
  "next": "16.1.6"              ← 19 CVEs (SSRF CVSS 8.6 + middleware bypass CVSS 8.1)
  "eslint-config-next": "16.1.6" ← peer dep ligada

DESPUÉS:
  "next": "16.2.6"
  "eslint-config-next": "16.2.6"

⚠️ BLOQUEA: 1-07, 1-08, 1-16, 1-17 no pueden cerrarse como "seguras" sin este fix.
   El middleware bypass (GHSA-492v-c6pp-mqqv) permite eludir el middleware de auth
   de Next.js independientemente de lo que implementen 1-07/1-16.

Proceso:
  1. af-agents:adr revisa changelog 16.1.6 → 16.2.6 y confirma no-breaking
  2. npm install next@16.2.6 eslint-config-next@16.2.6
  3. npm run typecheck → 0 errores nuevos
  4. npm run build → build limpio
  5. Smoke test manual:
     - Ruta pública (landing, login) → 200
     - Ruta protegida sin sesión → redirect a /login (no bypass)
     - Ruta protegida con sesión → 200
     - /api/auth/* → respuestas esperadas
  6. Si cualquier smoke test falla → npm install next@16.1.6 eslint-config-next@16.1.6 (rollback)
  7. Marcar 2-27 en plan Sprint 1 como "MOVIDA A 1-26 (completada en Sprint 0)"
```

## Related Code Files

**Modificar (1-22):**
- `src/app/api/tenant/migrate/route.ts:247-263` — añadir `validateTenantUrl()` antes del fetch
- `src/lib/api/validate-tenant-url.ts` — helper con allowlist dinámica (NO env var)

**Crear (1-22):**
- Migración SQL: `supabase/migrations/YYYYMMDD_add_allowed_migrate_hosts_to_tenants.sql`
- UI admin: gestión de hosts permitidos por tenant (añadir/eliminar dominios)

**Modificar (1-23):**
- `src/app/api/widget/embed.js/route.ts:16` — añadir `sanitizeWidgetId()` antes de interpolación

**Modificar (1-24):**
- `package.json` — bump versión axios
- `package-lock.json` — actualizado por npm

**Modificar (1-25):**
- `package.json` — eliminar `"crypto": "^1.0.1"` de dependencies
- `package-lock.json` — actualizado por npm uninstall
- Todos los archivos en `src/` y `worker.js` que contengan `from 'crypto'` o `require('crypto')`

**Modificar (1-26):**
- `package.json` — bump `next` a `16.2.6` y `eslint-config-next` a `16.2.6`
- `package-lock.json` — actualizado por npm

**Crear:**
- `src/lib/api/validate-tenant-url.ts` — helper allowlist SSRF (1-22)
- `src/lib/api/sanitize-widget-id.ts` — helper sanitización XSS (1-23)
- `docs/adr/ADR-001-axios-upgrade.md` — decisión de arquitectura (generado por af-agents:adr, 1-24)
- `docs/adr/ADR-002-next-upgrade-16-2-6.md` — decisión de arquitectura (generado por af-agents:adr, 1-26)

## Implementation Steps

### 1-22 — Fix SSRF con allowlist dinámica por tenant (8h)

> **Decisión**: allowlist dinámica en `tenants.allowed_migrate_hosts text[]`, no env var estática. Los dominios se rellenan tras el alta de cada tenant. +2h sobre estimación original por columna + UI admin.

1. Crear migración SQL: añadir columna `allowed_migrate_hosts text[] DEFAULT '{}'` a tabla `tenants`.
   - `supabase/migrations/YYYYMMDD_add_allowed_migrate_hosts_to_tenants.sql`
   - Default array vacío garantiza deny by default para todos los tenants existentes.

2. Leer `api/tenant/migrate/route.ts:247-263` — entender cómo se obtiene el tenant activo y cómo se usa la cookie `af-tenant-url`.

3. Crear `src/lib/api/validate-tenant-url.ts` con `validateTenantUrl(url, allowedHosts)`.

4. En el handler de `migrate`, antes de cualquier `fetch(cookie.value)`:
   - Obtener el tenant activo (cookied / header según patrón del proyecto).
   - Leer `tenant.allowed_migrate_hosts` de la DB.
   - Llamar a `validateTenantUrl(cookieValue, tenant.allowed_migrate_hosts)`.
   - Si lista vacía → `Response.json({ error: 'No migration hosts configured' }, { status: 403 })`.
   - Si host no en lista → `Response.json({ error: 'Host not allowed' }, { status: 403 })`.

5. UI admin: pantalla/sección para que el admin del sistema añada/elimine hosts permitidos para cada tenant (`tenants.allowed_migrate_hosts`). Agente: `af-agents:uxui`. Estimación UI: ~1h incluida en las 8h.

6. Verificar si la cookie `af-tenant-url` es `httpOnly` y `Secure`. Si no → documentar como riesgo residual.

7. Eliminar `TENANT_MIGRATE_ALLOWED_HOSTS` de `.env.example` si existía — ya no aplica. Añadir nota: "los hosts permitidos se gestionan por tenant en `tenants.allowed_migrate_hosts` vía UI admin".

8. Test:
   - Tenant sin hosts configurados → 403 (deny by default).
   - `http://localhost:8080`, `http://169.254.169.254/` → 403.
   - URL de dominio no en la lista del tenant → 403.
   - URL de dominio en la lista del tenant → comportamiento normal.

### 1-23 — Fix XSS widget embed (4h)

1. Leer `api/widget/embed.js/route.ts:16` — verificar exactamente qué parámetros se interpolan en el JS.
2. Crear `src/lib/api/sanitize-widget-id.ts` con `sanitizeWidgetId()`.
3. Aplicar `sanitizeWidgetId(id)` antes de la interpolación en `route.ts:16`.
4. Si hay otros parámetros interpolados en el mismo archivo (buscar todas las interpolaciones `${}` o concatenaciones de string), sanitizarlos también.
5. Test: `GET /api/widget/embed.js?id=</script><script>alert(1)</script>` → 400 o respuesta con el id rechazado. `GET /api/widget/embed.js?id=abc123` → 200 con JS válido.

### 1-24 — Upgrade axios (4h)

> **OBLIGATORIO**: Pasar por `af-agents:adr` ANTES de instalar. El hook `af-deps-guard.cjs` bloqueará si se intenta instalar sin ADR aprobado.

1. Delegar a `af-agents:adr`:
   - Investigar la versión estable más reciente de axios sin CVEs activos.
   - Verificar breaking changes desde 1.14.0.
   - Generar `docs/adr/ADR-001-axios-upgrade.md`.
2. Con el ADR aprobado:
   - `npm install axios@<versión_aprobada>`.
   - Grep de todos los call sites axios en el proyecto.
   - Si hay breaking changes de API: actualizar call sites.
   - `npm run typecheck` → 0 errores.
   - `npm run test` si hay tests que usen axios.

### 1-25 — Reemplazar crypto@1.0.1 DEPRECATED (3h)

> **Paralelizable** con cualquier otra tarea de Ph6. No requiere ADR (es eliminación de dep, no instalación).

1. `npm uninstall crypto` — elimina la dependencia del `package.json` y actualiza el lockfile.
2. `grep -r "from 'crypto'" src/ worker.js` — listar todos los archivos con import npm ambiguo.
3. `grep -r "require('crypto')" src/ worker.js` — idem para CommonJS (si existe).
4. Por cada archivo encontrado: reemplazar `'crypto'` → `'node:crypto'`.
5. `npm run typecheck` → confirmar 0 errores nuevos (los tipos de `node:crypto` están en `@types/node`).
6. `npm run build` → confirmar que Next.js resuelve el built-in correctamente.
7. `grep -r "from 'crypto'" src/ worker.js` de nuevo → confirmar 0 resultados (verificación final).

### 1-26 — Update next@16.1.6 → next@16.2.6 (4h)

> **EJECUTAR PRIMERO en Ph6.** Bloquea 1-07, 1-08, 1-16, 1-17. ADR obligatorio antes de instalar.

1. Delegar a `af-agents:adr`:
   - Revisar changelog oficial Next.js 16.1.6 → 16.2.6 (breaking changes, deprecaciones).
   - Verificar compatibilidad con React 19.2.3, `@supabase/ssr@0.8.0`, peer deps actuales.
   - Generar `docs/adr/ADR-002-next-upgrade-16-2-6.md`.
2. Con el ADR aprobado:
   - `npm install next@16.2.6 eslint-config-next@16.2.6` (ambos juntos — peer dep ligada).
3. `npm run typecheck` → 0 errores nuevos atribuibles al upgrade.
4. `npm run build` → build limpio.
5. Smoke test manual de rutas críticas:
   - Ruta pública (ej. `/`, `/login`) → respuesta 200 esperada.
   - Ruta protegida sin sesión → redirect a login (NO bypass).
   - Ruta protegida con sesión válida → 200.
   - `/api/auth/*` → respuestas esperadas.
   - `/api/orchestration/deploy` sin auth → 401 (confirmar que middleware no bypasseable).
6. Si cualquier smoke test falla → rollback inmediato: `npm install next@16.1.6 eslint-config-next@16.1.6`, reportar regresión.
7. Actualizar nota en plan Sprint 1: marcar 2-27 como "MOVIDA A 1-26 — completada en Sprint 0".

## Todo List

- [ ] 1-22: Crear migración SQL `tenants.allowed_migrate_hosts text[] DEFAULT '{}'`
- [ ] 1-22: Leer `tenant/migrate/route.ts:247-263` — entender flujo del tenant activo
- [ ] 1-22: Crear `src/lib/api/validate-tenant-url.ts` con allowlist dinámica
- [ ] 1-22: Aplicar validación en handler migrate (leer allowed_migrate_hosts de DB por tenant)
- [ ] 1-22: UI admin — gestión de hosts permitidos por tenant (`af-agents:uxui`)
- [ ] 1-22: Verificar si cookie es httpOnly + Secure; documentar riesgo residual si no
- [ ] 1-22: Eliminar TENANT_MIGRATE_ALLOWED_HOSTS de .env.example; añadir nota sobre DB
- [ ] 1-22: Tests — tenant sin hosts → 403; host no autorizado → 403; host autorizado → OK
- [ ] 1-23: Leer `widget/embed.js/route.ts:16` — identificar todas las interpolaciones
- [ ] 1-23: Crear `src/lib/api/sanitize-widget-id.ts`
- [ ] 1-23: Aplicar sanitización antes de cada interpolación
- [ ] 1-23: Test XSS payload → 400
- [ ] 1-24: Delegar a `af-agents:adr` — versión a instalar + ADR
- [ ] 1-24: Esperar aprobación del ADR
- [ ] 1-24: `npm install axios@<versión_aprobada>`
- [ ] 1-24: Grep call sites axios → verificar compatibilidad
- [ ] 1-24: `npm run typecheck` → 0 errores nuevos
- [ ] **1-25: `npm uninstall crypto`**
- [ ] 1-25: `grep -r "from 'crypto'" src/ worker.js` → listar archivos afectados
- [ ] 1-25: Reemplazar todos los `'crypto'` → `'node:crypto'` en archivos encontrados
- [ ] 1-25: `npm run typecheck` → 0 errores
- [ ] 1-25: `npm run build` → build limpio
- [ ] 1-25: Grep final `from 'crypto'` → 0 resultados (verificación exhaustiva)
- [ ] **1-26: Delegar a `af-agents:adr` — changelog 16.1.6→16.2.6 + compatibilidad + ADR-002**
- [ ] 1-26: Esperar aprobación del ADR
- [ ] 1-26: `npm install next@16.2.6 eslint-config-next@16.2.6`
- [ ] 1-26: `npm run typecheck` → 0 errores nuevos
- [ ] 1-26: `npm run build` → build limpio
- [ ] 1-26: Smoke test rutas críticas (público, protegido sin sesión, protegido con sesión, api/auth)
- [ ] 1-26: Confirmar `/api/orchestration/deploy` sin auth → 401 (middleware no bypasseable)
- [ ] 1-26: Si regresión → rollback next@16.1.6 + reportar bloqueante
- [ ] 1-26: Marcar 2-27 en Sprint 1 como "MOVIDA A 1-26"
- [ ] Typecheck global: `npm run typecheck` → 0 errores

## Success Criteria

- Tenant sin `allowed_migrate_hosts` configurado → 403 (deny by default) (1-22).
- `curl` con URL arbitraria en `af-tenant-url` (host no en lista del tenant) → 403 (SSRF bloqueado) (1-22).
- `GET /api/widget/embed.js?id=<script>alert(1)</script>` → 400 o id rechazado (1-23).
- `npm audit` muestra 0 vulnerabilidades en axios (1-24).
- `npm run typecheck` pasa con la nueva versión de axios (1-24).
- `grep -r "from 'crypto'" src/ worker.js` → 0 resultados (1-25).
- `npm list crypto` → no listado como dependencia directa (1-25).
- `npm list next` muestra `next@16.2.6` (1-26).
- Smoke test de ruta protegida sin sesión → redirect a login, NO bypass (1-26).
- `npm audit` sin CVEs relacionados con `next@16.1.6` tras el upgrade (1-26).

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|------------|
| Allowlist 1-22 bloquea tenants legítimos que aún no configuraron sus hosts → operación paralizada | Alta | Alto | Documentar en onboarding del tenant: configurar `allowed_migrate_hosts` antes de activar migración. El deny by default es intencional — mejor bloquear que permitir SSRF |
| Admin configura un host en la allowlist que luego es comprometido | Baja | Medio | La allowlist no previene ataques si el dominio del tenant es comprometido. Riesgo residual documentado |
| Sanitización 1-23 bloquea IDs de widgets legítimos con caracteres especiales | Baja | Medio | Verificar formato real de los IDs actuales antes de definir el regex |
| Axios upgrade 1-24 introduce breaking changes no detectados por typecheck | Baja | Medio | Grep exhaustivo de call sites + test de integración manual |
| Algún import `'crypto'` no encontrado por grep (1-25) — edge case en archivos generados o config | Baja | Bajo | Ejecutar grep en todo el directorio raíz, no solo `src/`. Incluir `*.config.*` y `worker.js`. `npm run build` detectaría el import roto |
| next@16.2.6 introduce regresión en middleware o Server Actions (1-26) | Media | Alto | Smoke test obligatorio antes de cerrar la tarea. Rollback inmediato si falla cualquier ruta crítica. Estimado 4h incluye tiempo para rollback si necesario |
| 1-07/1-08/1-16/1-17 se completan ANTES que 1-26 — protecciones inefectivas en producción | Media | Alto | Bloquear en plan: Ph3 y Ph5 no pueden marcarse como "seguros" hasta que 1-26 esté en 🔵. Registrado en dependencias del plan.md |

## Security Considerations

- 1-22: La allowlist dinámica por tenant previene SSRF pero no previene que la cookie sea modificada por JS si no es `httpOnly`. Reportar estado de la cookie como hallazgo residual si no es `httpOnly`. Los hosts en `allowed_migrate_hosts` son administrados por el equipo de desarrollo, no por el tenant (para evitar que el propio tenant auto-añada hosts maliciosos).
- 1-23: La sanitización regex `^[a-zA-Z0-9_-]{1,64}$` es conservadora — si los IDs reales del sistema tienen otro formato, ajustar el regex antes de deployar.
- 1-24: Tras el upgrade, verificar que no se introdujeron nuevas transitive dependencies con CVEs conocidos (`npm audit`).
- 1-25: `node:crypto` es el módulo built-in de Node.js — no hay riesgo de supply chain al eliminar el paquete npm. Los tipos de `@types/node` ya cubren `node:crypto` sin cambios adicionales.
- 1-26: El fix de next@16.2.6 cierra 5 variantes de middleware bypass (GHSA-492v, GHS1-267c, GHSA-36qx, GHS1-26hh) y 1 SSRF via WebSocket (GHSA-c4j6). Sin este fix, un atacante puede eludir el middleware de Next.js con peticiones crafteadas independientemente de las protecciones de 1-07/1-16. **Prioridad de ejecución: antes de cualquier tarea de auth.**
- **Coordinación con Ph3 (1-11)**: tanto 1-11 como 1-22 tocan `api/tenant/migrate/route.ts`. Asignar al mismo dev o mismo commit para evitar conflictos de merge.
- **Coordinación 1-26 con Ph3/Ph5**: 1-26 debe completarse y verificarse antes de que 1-07, 1-08, 1-16, 1-17 se marquen como "seguros" — de lo contrario las protecciones son bypasseables.

## Tareas adicionales propuestas (requieren aprobación)

Las siguientes vulnerabilidades se detectaron en el audit pero NO están en las 24 tareas del Sprint 0. Se proponen para evaluación antes de Sprint 1:
- `DA-2-008`: `service_key` de tenant externo en `Map` en memoria sin cifrado — riesgo si proceso crashea o se dumpea memoria. Estimación: 2h.
- `DA-3-011`: Timing attack en WhatsApp verify token con `===` en lugar de `timingSafeEqual`. Estimación: 30min. (Low severity pero trivial de arreglar).

## Next Steps

→ [Phase 07 — Cierre de Sprint](phase-07-cierre-sprint.md)
