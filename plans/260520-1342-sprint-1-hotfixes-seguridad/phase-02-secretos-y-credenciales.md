# Phase 02 — Secretos y credenciales

## Context Links
- [plan.md](plan.md) — overview Sprint 1
- [RoadMap Bloque 1.2](../RoadMap.md) — tareas 1-03, 1-04, 1-05, 1-06
- [DEEP-FINDINGS-SUMMARY.md](../../docs/audit/deep/DEEP-FINDINGS-SUMMARY.md) — F-05-SEC-001, F-04-002, R-023.a
- [Plan RLS — phase-01-hotfix-vulnerabilidades.md](../20260519-1200-rls-multitenant-hardening/phase-01-hotfix-vulnerabilidades.md) — Pasos 2, 3, 5 (SOLAPE 1-03, 1-04)
- [DECISIONES-AUDITOR-JAVIER-HP.md](../../docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md) — R-023.a (Easypanel)

## Overview

**Prioridad:** P1 — Crítico. Credenciales comprometidas en git history. Bloqueante para deploy a producción.
**Estado:** 🔘 Pendiente
**Estimación:** 12h base (1-03: 2h + 1-04: 6h + 1-05: 1h + 1-06: 3h) | **+1h condicional** si 1-06 detecta worker con `pg` directo → 13h max
**Agentes:** `esden-agents:security` (1-03, 1-04, 1-05) + `esden-agents:database` (1-06)

> AVISO: 1-03 (rotación de JWTs) y 1-04 (eliminación de hardcoded keys) tienen pasos que ya están **documentados en el plan RLS** `phase-01-hotfix-vulnerabilidades.md` (Pasos 2, 3, 5). Esta fase **refiere** esos pasos sin duplicarlos. Ver sección Implementation Steps para el mapeo exacto.

Esta fase debe ejecutarse **primero** (antes que Ph3, Ph4, Ph5) porque las rotaciones de keys requieren coordinar env vars y restart de servicios antes de cualquier otro deploy.

## Key Insights

- **F-05-SEC-001 / F-04-002**: Las claves JWT (service_role + anon) están hardcodeadas en 9 puntos del código fuente: `auth-config.ts:19`, `supabase/server.ts:7`, `actions/tenant.ts:52,76` y al menos 5 más. Están commiteadas al git history — rotar es obligatorio aunque se quiten del código.
- **R-023.a**: La contraseña por defecto `postgres:postgres` está activa en Easypanel. El puerto 5432 puede estar accesible desde internet. Doble vector: contraseña trivial + posible exposición de red.
- 1-05 y 1-06 son acciones de base de datos sin cambios de código fuente — pueden ejecutarse en paralelo con 1-03/1-04 el día 1.

## Requirements

### Funcionales
- 1-03: Rotar claves JWT service_role y anon key en Supabase dashboard. Actualizar todas las env vars en Easypanel.
- 1-04: Eliminar los 9 puntos de código con credenciales hardcoded. Lanzar error explícito si la env var falta (no fallback).
- 1-05: Cambiar password del usuario Postgres `postgres` por contraseña fuerte. Cerrar/firewallizar puerto 5432 a internet.
- 1-06: Crear usuario Postgres `app_user` con permisos limitados (no superuser). Actualizar connection string en env vars.

### No funcionales
- La rotación de 1-03 debe realizarse en ventana de mantenimiento (bajo tráfico).
- 1-04: la búsqueda exhaustiva con Grep antes de dar por terminada la tarea (`grep -rE "(eyJhbGci|FALLBACK_|service_role)" src/` → 0 resultados).
- 1-06: el script SQL de creación de `app_user` debe ser reutilizable en Fase 2 (guardarlo en `supabase/scripts/`).

## Architecture

```
ANTES:
  src/lib/supabase/server.ts:7     → const FALLBACK_SERVICE_KEY = "eyJhbGci..."
  src/lib/auth-config.ts:19        → SUPABASE_ANON_KEY = "eyJhbGci..."
  src/lib/actions/tenant.ts:52,76  → service_role key hardcoded
  ...5 más                         → keys hardcoded dispersas

  Postgres: usuario postgres, pass "postgres", puerto 5432 posiblemente público

DESPUÉS (Ph2 aplicada):
  Todos los archivos: process.env.SUPABASE_SERVICE_ROLE_KEY ?? throw Error()
  Easypanel env vars: keys rotadas (nuevas, sin relación con las comprometidas)
  Postgres: usuario postgres con pass fuerte + usuario app_user (least privilege)
  Puerto 5432: sólo accesible desde red interna Easypanel
```

## Related Code Files

**Modificar (1-04):**
- `src/lib/supabase/server.ts` — eliminar `FALLBACK_SERVICE_KEY`, `FALLBACK_ANON_KEY`, `FALLBACK_URL` (Pasos 2+5 del plan RLS phase-01)
- `src/lib/auth-config.ts:19` — eliminar key hardcoded
- `src/lib/actions/tenant.ts:52,76` — eliminar keys hardcoded
- [Otros 5 puntos identificados con Grep antes de empezar]

**Crear (1-06):**
- `supabase/scripts/create-app-user.sql` — script SQL reutilizable

**Acciones manuales (1-03, 1-05):**
- Supabase dashboard: rotar service_role + anon key
- Easypanel: actualizar env vars + cerrar firewall puerto 5432

## Implementation Steps

### 1-03 — Rotar JWTs comprometidos (2h)

> **SOLAPE con plan RLS**: Este paso corresponde al **Paso 3** de [phase-01-hotfix-vulnerabilidades.md](../20260519-1200-rls-multitenant-hardening/phase-01-hotfix-vulnerabilidades.md#paso-3--rotar-claves-jwt-en-supabase-h3-15-min-acción-manual). Seguir esos steps exactamente.

Resumen del proceso (ver plan RLS para detalle completo):
1. Acceder al dashboard de Supabase (proyecto producción en Easypanel).
2. Settings → API → "Reset service_role key" y "Reset anon key".
3. Actualizar env vars en Easypanel (SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY).
4. Reiniciar servicios (Next.js + worker BullMQ).
5. Verificar: `curl -H "apikey: <KEY_VIEJA>" <SUPABASE_URL>/rest/v1/` → debe dar 401.
6. Coordinar con 1-04: primero 1-04 (quitar del código) → luego 1-03 (rotar) → luego deploy.

**IMPORTANTE**: No rotar sin haber completado primero 1-04 (eliminar los hardcoded). Si se rota antes, el código seguirá funcionando con las keys viejas (que seguirán en el git history).

### 1-04 — Quitar JWTs hardcodeados de 9 puntos (6h)

> **SOLAPE con plan RLS**: Los pasos de eliminación de `server.ts` corresponden a los **Pasos 2 y 5** de [phase-01-hotfix-vulnerabilidades.md](../20260519-1200-rls-multitenant-hardening/phase-01-hotfix-vulnerabilidades.md). Seguir ese plan para `server.ts`. Los otros 7 archivos son propios de esta tarea.

1. Grep exhaustivo: `grep -rn "eyJhbGci\|FALLBACK_\|service_role" src/` → listar los 9+ puntos.
2. Para cada punto identificado:
   - Reemplazar el literal hardcoded por `process.env.SUPABASE_SERVICE_ROLE_KEY` (o la variable correspondiente).
   - Añadir guard: `if (!process.env.VAR) throw new Error("Missing VAR env var")`.
   - NUNCA añadir valor por defecto — si falta la var, la app debe fallar explícitamente al arrancar.
3. Para `src/lib/supabase/server.ts`: seguir exactamente Pasos 2+5 del plan RLS phase-01.
4. Para `src/lib/auth-config.ts:19`: extraer key a `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Para `src/lib/actions/tenant.ts:52,76`: extraer a env var y verificar que el flujo de tenant sigue funcionando.
6. Verificación final: `grep -rE "(eyJhbGci|FALLBACK_)" src/` → 0 resultados.
7. Actualizar `.env.example` con los nombres de variables correctos (sin valores reales).

### 1-05 — Cambio password Postgres + cerrar puerto 5432 (1h)

1. Conectar al panel de Easypanel.
2. Cambiar password del usuario `postgres` por contraseña fuerte (mínimo 32 chars, generada aleatoriamente — no guardar en código).
3. Actualizar `DATABASE_URL` en env vars de Easypanel (Next.js + worker).
4. Firewall: en configuración de red de Easypanel, restringir puerto 5432 a red interna únicamente (no expuesto a internet).
5. Verificar: intentar `psql -h <IP_PUBLICA> -U postgres` → debe fallar con connection refused o timeout.
6. Verificar: la app sigue conectando correctamente (health check del servicio).

### 1-06 — Crear usuario Postgres `app_user` con permisos limitados (3h, +1h condicional)

> **Step 1 — Verificación de kickoff (OBLIGATORIO antes de empezar 1-06):**
> Hacer `grep -rn "require('pg')\|require(\"pg\")\|postgres-js\|from 'pg'\|from \"pg\"\|createClient.*DATABASE_URL" worker.js` en la raíz del proyecto.
>
> - **Si usa `pg`/`postgres-js` directo** → el worker conecta con su propia cadena de conexión. Ampliar 1-06: incluir actualización de la cadena de conexión del worker hacia `app_user`. **Añadir +1h a la estimación de esta tarea (total: 4h)**.
> - **Si usa Supabase client** (`@supabase/ssr`, `createClient`) → 1-06 no afecta al worker. Solo aplica a scripts admin. Estimación permanece en 3h.
>
> Documentar el resultado en el log de la tarea antes de ejecutar cualquier paso siguiente.

1. Crear `supabase/scripts/create-app-user.sql`:

```sql
-- Script: crear usuario app_user con privilegios mínimos (least privilege)
-- Reutilizable en Fase 2 para refactor completo de conexiones

-- Crear usuario
CREATE USER app_user WITH PASSWORD '<PLACEHOLDER_GENERADO_EXTERNAMENTE>';

-- Permisos sobre schema public (lectura y escritura de tablas de la app)
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Permisos futuros (para tablas nuevas que se creen)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- NUNCA GRANT: SUPERUSER, CREATEDB, CREATEROLE, REPLICATION
-- NUNCA: acceso a schema supabase_auth, _analytics, _realtime

-- Verificar
SELECT usename, usesuper, usecreatedb, usecreaterole
FROM pg_user WHERE usename = 'app_user';
```

2. Ejecutar el script en la base de datos de producción via Easypanel terminal.
3. Actualizar `DATABASE_URL` en env vars para que los scripts admin usen `app_user` (no `postgres`).
4. **Si worker usa `pg` directo** (resultado del Step 1): actualizar también la cadena de conexión del worker hacia `app_user`. Verificar que el worker arranca correctamente tras el cambio.
5. Guardar nota en `.env.example`: `DATABASE_URL=postgresql://app_user:<PASS>@<HOST>:5432/<DB>`.
6. Este script se reutiliza en Fase 2 (2-02) cuando se migre completamente a `@supabase/ssr` con el usuario correcto.

## Todo List

- [ ] 1-04: Grep `eyJhbGci|FALLBACK_|service_role` en `src/` — listar los 9 puntos exactos
- [ ] 1-04: Fix `src/lib/supabase/server.ts` (siguiendo plan RLS phase-01 Pasos 2+5)
- [ ] 1-04: Fix `src/lib/auth-config.ts:19`
- [ ] 1-04: Fix `src/lib/actions/tenant.ts:52,76`
- [ ] 1-04: Fix los otros 5-6 puntos identificados con Grep
- [ ] 1-04: Verificación final grep → 0 resultados
- [ ] 1-04: Actualizar `.env.example`
- [ ] 1-03: Coordinar ventana de mantenimiento
- [ ] 1-03: Rotar service_role key en Supabase dashboard
- [ ] 1-03: Rotar anon key en Supabase dashboard
- [ ] 1-03: Actualizar env vars en Easypanel
- [ ] 1-03: Reiniciar servicios y verificar funcionamiento
- [ ] 1-03: curl test con keys viejas → 401
- [ ] 1-05: Cambiar password postgres en Easypanel
- [ ] 1-05: Actualizar DATABASE_URL en env vars
- [ ] 1-05: Cerrar puerto 5432 a internet en firewall Easypanel
- [ ] 1-05: Verificar app sigue conectando correctamente
- [ ] 1-06: **Step 1 kickoff** — grep worker.js para detectar pg directo vs Supabase client
- [ ] 1-06: Documentar resultado del Step 1 en log de tarea
- [ ] 1-06: Crear `supabase/scripts/create-app-user.sql`
- [ ] 1-06: Ejecutar script en producción
- [ ] 1-06: Actualizar DATABASE_URL para scripts admin con app_user
- [ ] 1-06 (condicional — solo si worker usa pg directo): Actualizar cadena de conexión del worker y verificar arranque
- [ ] Typecheck: `npm run typecheck` → 0 errores nuevos

## Success Criteria

- `grep -rE "(eyJhbGci|FALLBACK_)" src/` → 0 resultados (1-04 completo).
- Keys JWT antiguas responden 401 en curl test (1-03 completo).
- `psql -h <IP_PUBLICA> -U postgres` falla con connection refused (1-05 completo).
- `psql -h <HOST_INTERNO> -U app_user -d <DB>` conecta con permisos correctos (1-06 completo).
- App y worker funcionan correctamente con las nuevas credenciales (health check).

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|------------|
| Rotación de keys deja servicios sin acceso si env vars no se actualizan a tiempo | Alta | Crítico | Preparar env vars ANTES de rotar; ventana de mantenimiento corta (<30min) |
| Cerrar puerto 5432 rompe herramientas de administración externas | Media | Medio | Documentar acceso alternativo vía Easypanel terminal; no cerrar sin confirmación |
| app_user sin permisos suficientes rompe queries actuales | Baja | Alto | Ejecutar primero en staging; verificar con suite de tests antes de producción |

## Security Considerations

- Las keys rotadas en 1-03 siguen siendo recuperables de git history — no es posible eliminarlas retroactivamente sin reescribir el historial (no se hace). El riesgo residual es: alguien con acceso al repo puede ver las keys viejas, que ya no funcionan.
- El password de `app_user` (1-06) NUNCA va en código ni en git. Solo en Easypanel env vars y canal seguro.
- `.env.example` solo muestra el nombre de la variable, nunca un valor real.

## Next Steps

→ [Phase 03 — Endpoints sin auth](phase-03-endpoints-sin-auth.md) (iniciar tras rotación exitosa de keys)
→ [Phase 05 — Privilege escalation y RLS](phase-05-privilege-escalation-rls.md) (depende de 1-03/1-04 para tener env limpio)
