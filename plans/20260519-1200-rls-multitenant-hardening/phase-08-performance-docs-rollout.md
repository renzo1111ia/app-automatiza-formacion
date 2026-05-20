# Fase 8 — Performance, docs y rollout

**Prioridad:** 🟡 Media (cierre y operacionalización)
**Tiempo estimado:** 3h 30min
**Estado:** ⏳ Pendiente

## Context Links
- [Plan overview](plan.md)
- Fases 1-7 (todas prerequisito)

## Overview

Validar que el nuevo modelo RLS no degrada performance, actualizar la documentación del proyecto, y ejecutar un rollout controlado a producción con monitorización activa.

## Key Insights

- Las políticas RLS añaden una subquery por SELECT (`user_tenant_ids()`). Postgres con `STABLE` la memoiza por query, pero queries con muchos joins pueden ver overhead acumulado.
- La documentación debe servir tanto a humanos (devs nuevos) como a agentes IA (Claude, Cursor). Patrones explícitos = código correcto automáticamente.
- Rollout: aplicar a staging primero, observar 24h con tráfico de prueba antes de prod. Tener plan de rollback claro.

## Requirements

### Funcionales
- EXPLAIN ANALYZE en top-10 queries más frecuentes; comparar antes/después.
- Optimizar políticas si alguna query degrada > 20%.
- Actualizar `docs/system-architecture.md` con nueva capa de seguridad.
- Crear `docs/runbook-add-tenant-scoped-table.md` (guía paso a paso).
- Actualizar `docs/code-standards.md` con patrón Repository + Zod.
- Plan de rollback documentado.

### No funcionales
- Monitorización activa primeras 24h post-deploy.
- Alertas Sentry para errores RLS (`permission denied for table` o `policy check failed`).

## Architecture

```
docs/
├── system-architecture.md     ← Sección nueva: "Capa de seguridad multi-tenant"
├── code-standards.md          ← Sección nueva: "Repositories y validación Zod"
├── runbook-add-tenant-scoped-table.md  ← NUEVO
├── runbook-rls-troubleshooting.md      ← NUEVO
└── development-roadmap.md     ← Marcar fase RLS como ✅ completada
```

## Related Code Files

**Crear:**
- `docs/runbook-add-tenant-scoped-table.md`
- `docs/runbook-rls-troubleshooting.md`
- `scripts/explain-rls-queries.sql`

**Modificar:**
- `docs/system-architecture.md`
- `docs/code-standards.md`
- `docs/development-roadmap.md`
- `docs/project-changelog.md`

## Implementation Steps

### Paso 1 — Performance: EXPLAIN ANALYZE top queries (1h 0min)

Identificar top-10 queries por frecuencia (revisar logs de Supabase o pg_stat_statements):

```sql
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%FROM lead%' OR query LIKE '%FROM llamadas%'
ORDER BY calls DESC
LIMIT 10;
```

Para cada una, antes/después:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM lead WHERE fecha_ingreso_crm > now() - interval '30 days';
```

Verificar:
- Uso del índice `idx_lead_tenant` o compuesto.
- `user_tenant_ids()` aparece como InitPlan (ejecutada una sola vez).
- No hay seq scan en tablas grandes.

Si hay degradación:
- Considerar índices compuestos adicionales (`tenant_id, fecha_X`).
- Considerar marcar funciones como `PARALLEL SAFE`.

### Paso 2 — Actualizar `system-architecture.md` (45 min)

Añadir sección:

```markdown
## Capa de seguridad multi-tenant

El aislamiento de datos entre clientes se garantiza en tres capas defensivas:

### Capa 1 — PostgreSQL Row-Level Security
- Tabla `tenant_members(user_id, tenant_id, role)` define pertenencia.
- Función `user_tenant_ids()` (SECURITY DEFINER, STABLE) usada por todas las políticas.
- Cada tabla con `tenant_id` tiene 4 políticas authenticated + 1 service_role tenant-scoped.
- Service role requiere `SET LOCAL app.tenant_id` para acceder a datos; sin él devuelve 0 filas.

### Capa 2 — Clientes Supabase segregados
- `createUserClient()`: request-scoped, JWT del usuario (auth.uid()). Para UI y server actions.
- `createSystemClient({ tenantId })`: service_role + SET LOCAL. Para webhooks, workers, cron.
- `createProvisioningClient()`: service_role sin scope. Solo provisioning. ESLint bloquea import desde código de request.

### Capa 3 — Repositories + Zod en boundaries
- `src/lib/repositories/<entidad>.ts` es la única vía legítima a la DB.
- Zod valida inputs HTTP, webhooks, y respuestas de APIs externas.
- Lint rule prohibe importar `@supabase/*` desde rutas/componentes.

### Tests anti-fuga
- Suite parametrizada `tests/rls/` cubre las 11+ tablas × 4 verbos.
- CI bloquea PRs si algún test falla.
```

### Paso 3 — Runbooks operacionales (45 min)

**`docs/runbook-add-tenant-scoped-table.md`:**

```markdown
# Runbook: Añadir tabla tenant-scoped

## Checklist
1. [ ] Migration con columna `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
2. [ ] Índice `idx_<tabla>_tenant ON <tabla>(tenant_id)`
3. [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
4. [ ] 4 políticas authenticated (SELECT/INSERT/UPDATE/DELETE) usando `user_tenant_ids()` y `user_has_tenant_role()`
5. [ ] 1 política service_role usando `current_tenant_id()`
6. [ ] Regenerar `src/types/database.ts`
7. [ ] Crear `src/lib/schemas/<entidad>.ts` (Zod schemas)
8. [ ] Crear `src/lib/repositories/<entidad>.ts`
9. [ ] Añadir entrada a `tests/rls/tenant-isolation.test.ts` (tabla en array)
10. [ ] Run `npm run test:rls` localmente

## Plantilla de migration
[código SQL completo de plantilla]
```

**`docs/runbook-rls-troubleshooting.md`:**

```markdown
# Runbook: Troubleshooting RLS

## Síntoma: "0 filas devueltas cuando esperaba datos"
- ¿Usuario tiene entry en tenant_members? `SELECT * FROM tenant_members WHERE user_id = '<uid>'`
- ¿Cliente correcto? Si es system, ¿se llamó set_tenant_context()?
- ¿Política existe? `SELECT * FROM pg_policies WHERE tablename = '<table>'`

## Síntoma: "permission denied for table X"
- Posiblemente role anon sin policy. Verificar `GRANT SELECT ON ... TO authenticated`.

## Síntoma: webhook devuelve 0 filas
- ¿resolveTenantId encontró el tenant? Logs deben mostrar el ID resuelto.
- ¿system-client setea GUC? Tracear con `SELECT current_setting('app.tenant_id')`.
```

### Paso 4 — Plan de rollback (15 min)

Documentar en `docs/runbook-rls-troubleshooting.md`:

```markdown
## Plan de rollback de emergencia

Si tras deploy hay incidente crítico (login roto, datos invisibles):

1. **Frontend rollback** (5 min): revertir el deploy de Next.js.
2. **DB rollback** (10 min): aplicar migration de rollback:
   ```sql
   -- Reactivar políticas service_role permisivas temporalmente
   CREATE POLICY "emergency_service_role_all" ON public.lead
     FOR ALL TO service_role USING (true) WITH CHECK (true);
   -- (repetir en todas las tablas afectadas)
   ```
3. Investigar root cause con logs Sentry.
4. Aplicar fix forward, no quedarse en estado degradado.
```

### Paso 5 — Rollout (45 min activo + 24h pasivo)

1. **Día 1 mañana:** merge a `dev` → deploy a staging.
2. **Día 1 todo el día:** smoke tests + observar logs Sentry + métricas Supabase.
3. **Día 2 mañana:** revisar 24h de telemetría.
   - Tasa de errores RLS: target < 0.1%.
   - p95 latencia DB: degradación < 10% vs baseline.
   - Cero incidentes reportados.
4. **Día 2 tarde:** PR `dev` → `main`, deploy a prod en ventana baja (sábado madrugada típicamente).
5. **Post-deploy:** monitorización activa 2h, on-call disponible 24h.

## Todo List

- [ ] EXPLAIN ANALYZE top-10 queries
- [ ] Optimizar políticas si hay degradación >20%
- [ ] Actualizar `system-architecture.md`
- [ ] Actualizar `code-standards.md`
- [ ] Crear `runbook-add-tenant-scoped-table.md`
- [ ] Crear `runbook-rls-troubleshooting.md`
- [ ] Documentar plan de rollback
- [ ] Configurar alertas Sentry específicas para RLS errors
- [ ] Deploy a staging + 24h observación
- [ ] PR a `main` + merge
- [ ] Deploy a prod en ventana baja
- [ ] Monitorización activa 2h post-deploy
- [ ] Actualizar `project-changelog.md` y `development-roadmap.md`

## Success Criteria

- ✅ Top-10 queries con p95 latencia < 110% del baseline.
- ✅ Docs actualizadas con la nueva arquitectura.
- ✅ Runbooks accesibles para devs y agentes IA.
- ✅ Deploy a prod sin incidentes en las primeras 24h.
- ✅ Tasa de errores RLS < 0.1% en Sentry.

## Risk Assessment

| Riesgo | Mitigación |
|---|---|
| Degradación performance imprevista | Plan de rollback con migration de emergency policies |
| Devs nuevos no leen docs | Lint rules + CI tests son defensa redundante |
| Webhooks de socios externos fallan tras deploy | Comunicar ventana de mantenimiento; logging permisivo primeros 3 días |

## Security Considerations

- El runbook de rollback contiene SQL que reabre el aislamiento. Acceso restringido al equipo on-call, no en repo público.
- Sentry alerts deben filtrar PII de logs (tenant_id es OK, telefono/email NO).

## Next Steps

→ Plan completado. Continuar con sprint MVP (Fase C: HubSpot + Zoho + Google Sheets bidireccional).
