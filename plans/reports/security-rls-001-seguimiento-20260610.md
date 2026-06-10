# BUG-SEC RLS-001 — Seguimiento y cierre completo (10-06-2026)

> Auditoría exhaustiva del modelo RLS multi-tenant tras detectar el IDOR de lectura cross-tenant.
> Estado: **20 de 21 tablas cerradas**. 1 caso especial (`tenants`) documentado como BUG-SEC-RLS-002.

## Origen

`base_schema.sql` (DO block) creaba `authenticated_read_* USING (true)` para todas las tablas multi-tenant
→ cualquier usuario `authenticated` podía leer filas de cualquier tenant vía anon key. **IDOR confirmado**
(componentes cliente costs/logs/inbox leían con anon key filtrando tenant_id en el cliente).

## Fix aplicado (2 migraciones)

### Migración 1 — `20260610193500_fix_rls_authenticated_tenant_isolation.sql`

17 tablas con `tenant_id` UUID directo (+ `chat_messages` con cast `id::text`):
advisors, agendamientos, ai_agent_logs, appointments, conversaciones_whatsapp, intentos,
intentos_llamadas, lead, lead_cualificacion, lead_programas, llamadas, notificaciones,
orchestration_graphs, system_logs, voice_agents, workflows, chat_messages.
Patrón: `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())`.

### Migración 2 — `20260610201500_fix_rls_residual_tenant_isolation.sql`

3 tablas residuales detectadas en auditoría completa:

- `campanas` — tenant_id directo (8 filas de 2 tenants → leak real confirmado).
- `availability_slots` — sin tenant_id; filtra vía `advisor_id → advisors.tenant_id`.
- `lead_events` — sin tenant_id; filtra vía `lead_id → lead.tenant_id`.

## Verificación (local + VPS)

| Test                     | Resultado                                      |
| ------------------------ | ---------------------------------------------- |
| Tenant real ve SUS datos | ✅ (lead: 29 local / 15 VPS; campanas: 4 de 8) |
| Tenant inválido ve 0     | ✅ (antes veía todo)                           |
| Migración 1 en VPS       | ✅ aplicada 10-06 (21 abiertas → 4)            |
| Migración 2 en local     | ✅ aplicada (3 cerradas)                       |
| Migración 2 en VPS       | ⏳ pendiente este push                         |

## Tablas YA correctas antes del fix (no requieren acción)

Las que usan el patrón `*_owner_or_admin` filtran bien: ai*agents, ai_agent_variants, integrations,
knowledge_base, programas, web_widgets, sheet*_, zoho\__, simulator_sessions, crm_write_audit,
lead_opportunities, campaigns, tenant_holidays.

## ⚠️ BUG-SEC-RLS-002 — `tenants` (caso especial, NO tocar a ciegas)

**Problema**: `tenants` tiene `authenticated_read_tenants USING (true)` → expone
`supabase_anon_key`, `client_email`, `config` de TODOS los tenants. Leak grave en teoría.

**Mitigante**: NINGÚN componente cliente lee `tenants` con anon key (28 usos, todos server/service_role).
El leak solo es alcanzable vía `GET /rest/v1/tenants` directo con la anon key pública. Severidad ALTA pero
no explotable por la UI normal.

**Por qué NO se cierra en esta migración**: simulacro psql mostró que al quitar la política OPEN, el rol
`authenticated` deja de ver INCLUSO su propia fila (`tenants_select_owner_or_admin` con
`auth_user_id = auth.uid()` devolvió 0 en el simulacro pese a que `auth.uid()` resuelve bien). Como TODAS
las demás políticas dependen del subquery `SELECT id FROM tenants WHERE auth_user_id = auth.uid()`, cerrar
`tenants` mal dejaría a TODOS los clientes sin ver sus datos. El simulacro psql NO replica fielmente el
contexto de PostgREST (GUC `request.jwt.claims` vs sesión real), así que NO es fiable para decidir aquí.

**Fix correcto (pendiente, verificar con login REAL)**:

1. Reproducir con un login PostgREST real (no psql) para confirmar el comportamiento del subquery.
2. Si el owner-policy funciona con login real → simplemente `DROP POLICY authenticated_read_tenants` (la
   owner-policy ya cubre el acceso legítimo a la fila propia).
3. Si no → función `SECURITY DEFINER public.current_user_tenant_ids()` que resuelva el tenant saltándose RLS,
   y re-cablear las políticas dependientes para usarla. Además: NO exponer columnas sensibles
   (`supabase_anon_key`, `client_email`) ni siquiera a la fila propia vía una vista restringida.

## Próximos pasos

- [ ] Aplicar migración 2 al VPS (este push).
- [ ] BUG-SEC-RLS-002: cerrar `tenants` con verificación de login real (sprint de hardening / Renzo).
- [ ] Raíz: corregir `base_schema.sql` para que instalaciones FRESH nazcan con el patrón filtrado
      (evitar que el bug se reintroduzca). Pendiente — las 2 migraciones forward convergen entornos
      existentes pero base_schema sigue creando políticas OPEN.
