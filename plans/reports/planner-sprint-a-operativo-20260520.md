# Reporte: Plan operativo Sprint A — Hotfixes de seguridad

**Fecha:** 20-05-2026
**Autor:** planner
**Plan creado:** `plans/260520-1342-sprint-a-hotfixes-seguridad/`

---

## Resumen de lo planificado

Plan operativo completo del Sprint A (Fase A del RoadMap). Cubre las 24 tareas de desarrollo (A-01 a A-24) + las 5 tareas de cierre (SP-A-CLOSE-1 a 5), organizadas en 7 fases.

Total estimado: **~93h 30min** de desarrollo + tiempo variable de corrección de bugs en CLOSE-4.
Con paralelismo de 2 devs: reducible a **~44-50h reales** (1-1.5 semanas).

---

## Archivos creados (8)

| Archivo | Tareas cubiertas | Estimación |
|---------|-----------------|------------|
| `plans/260520-1342-sprint-a-hotfixes-seguridad/plan.md` | Overview + dependencias + criterios éxito | — |
| `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-01-orquestador-bullmq.md` | A-01, A-02 | 7h |
| `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-02-secretos-y-credenciales.md` | A-03, A-04, A-05, A-06 | 12h |
| `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-03-endpoints-sin-auth.md` | A-07, A-08, A-09, A-10, A-11 | 15h 30min |
| `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-04-webhooks-y-firmas.md` | A-12, A-13, A-14, A-15 | 16h |
| `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-05-privilege-escalation-rls.md` | A-16, A-17, A-18, A-19, A-20, A-21 | 24h |
| `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-06-otros-criticos.md` | A-22, A-23, A-24 | 14h |
| `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-07-cierre-sprint.md` | SP-A-CLOSE-1..5 | 5h 30min + bugs |

---

## Dependencias críticas detectadas

### 1. Ph2 (secretos) bloquea el deploy de todo lo demás
Las rotaciones de JWT (A-03, A-04) deben completarse antes de hacer cualquier deploy de las otras fases. Si se despliega código de Ph3/Ph4/Ph5 con las keys viejas aún en código, el sistema funcionará con las keys comprometidas hasta que se roten.

**Orden obligatorio**: A-04 (quitar hardcoded) → A-03 (rotar en Supabase) → deploy → resto de fases.

### 2. A-11 y A-22 tocan el mismo archivo
`api/tenant/migrate/route.ts` es editado por A-11 (Ph3, auth en GET) y A-22 (Ph6, SSRF en handler). Deben asignarse al mismo dev o coordinarse en el mismo commit para evitar conflicto de merge.

### 3. A-18 depende del pre-check de auth_user_id
Antes de aplicar la migration RLS de `tenants` (A-18), verificar que no hay filas con `auth_user_id IS NULL`. Si las hay → backfill obligatorio antes de la migration. Sin este check, la migration bloquea usuarios existentes.

### 4. A-16 requiere backfill antes del deploy
El cambio de `user_metadata.is_admin` a `app_metadata.is_admin` requiere un script de backfill para los administradores existentes. Si se deployas sin backfill, todos los admins pierden acceso.

### 5. A-24 (axios) pasa por esden-agents:adr obligatoriamente
El hook `esden-deps-guard.cjs` bloquea la instalación sin ADR aprobado. Delegar a `esden-agents:adr` antes de intentar `npm install`.

---

## Solapes documentados con plan RLS existente

| Tarea Sprint A | Solape con plan RLS | Acción tomada en este plan |
|---|---|---|
| A-03 (rotar JWTs) | phase-01-hotfix Paso 3 | Referencia explícita, sin duplicar SQL |
| A-04 (quitar hardcoded) | phase-01-hotfix Pasos 2+5 | Referencia explícita para `server.ts`; resto de archivos propios de A-04 |
| A-18 (RLS tenants USING true) | phase-01-hotfix Paso 1 | Referencia explícita con link al SQL, sin duplicar |
| A-16 (is_admin escalation) | NO cubierto en plan RLS | Implementado íntegramente en Ph5 |

---

## Decisiones tomadas durante la planificación

1. **Orden de ejecución de Ph2**: A-04 antes de A-03 (quitar primero del código, luego rotar). Invertir el orden deja una ventana donde las keys están rotadas pero el código sigue con las viejas commiteadas.

2. **CRON_SECRET como mecanismo de auth para crons** (A-08): elegido sobre IP allowlist por ser más portable (no depende de la IP del scheduler de Easypanel, que puede cambiar).

3. **Sanitización de widget ID por regex conservador** (A-23): `^[a-zA-Z0-9_-]{1,64}$`. Si los IDs reales del sistema tienen otro formato, ajustar antes de deployar. Documentado como punto de verificación pre-deploy.

4. **Devolución de 404 (no 403) para IDOR** (A-21): no confirmar la existencia de recursos de otros tenants. Decisión de seguridad estándar (information hiding).

5. **secret por tenant vs global para webhook CRM** (A-15): documentado como decisión de diseño pendiente de confirmación. Se propone evaluar secret por tenant (almacenado en tabla `integrations`) para mayor aislamiento.

6. **Tareas adicionales propuestas** (fuera del scope A-01..A-24): DA-2-008 (service_key en Map sin cifrado, 2h) y DA-3-011 (timing attack WhatsApp, 30min). Documentadas en Ph6 como "requieren aprobación" — no ejecutar sin orden.

---

## Preguntas abiertas para el usuario

1. **A-15 (webhook CRM)**: ¿El secret de verificación del webhook CRM debe ser por tenant (en tabla `integrations`) o global (en env var)? Si es por tenant, A-15 requiere acceso de escritura a la tabla `integrations` y aumenta la estimación a ~6h.

2. **A-22 (SSRF allowlist)**: ¿Cuáles son los dominios de tenants reales que deben estar en `TENANT_MIGRATE_ALLOWED_HOSTS`? Se necesita esta lista antes del deploy para configurarla en Easypanel.

3. **A-09 (test endpoint)**: ¿Se elimina completamente o se mueve a `_dev` con guard de `NODE_ENV !== 'production'`? El plan documenta ambas opciones; preferencia del equipo determina cuál implementar.

4. **SP-A-CLOSE-3 (test manual)**: ¿Hay credenciales de staging disponibles para el test manual? El manager necesita un usuario admin y un usuario no-admin en el entorno de staging para preparar la guía.

5. **A-06 (app_user)**: ¿El worker BullMQ actual usa la `DATABASE_URL` con usuario `postgres`? Si usa la conexión via Supabase client, A-06 solo aplica a conexiones directas pg. Confirmar qué servicios usan conexión directa PostgreSQL vs Supabase client.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Plan operativo completo creado con 8 archivos. Las 24 tareas de desarrollo y 5 de cierre están descompuestas en steps granulares con agentes asignados, risks y success criteria.
**Concerns:** (1) Orden Ph2 → resto es crítico y dependiente de coordinación con ventana de mantenimiento de producción. (2) A-11 y A-22 comparten archivo — requiere coordinación de edición. (3) 5 preguntas abiertas documentadas arriba que pueden afectar estimaciones de A-15, A-22 y A-06.
