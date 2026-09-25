---
title: "Audit Data Layer — Findings"
date: 2026-05-18
agent: Audit-Data (Sonnet)
phase: 4
---

# Audit Data Layer

## Perímetro auditado

- `src/lib/supabase/` — cliente, servidor, tenant-client, tenant-router
- `src/lib/auth-config.ts` — credenciales de auth
- `src/middleware.ts` — auth middleware
- `src/lib/cache/tenant-cache.ts` — capa Redis
- `supabase/migrations/*.sql` — 28 migraciones (+ archivos SQL sueltos)
- `supabase/schema.sql`, `supabase/tenants.sql`, `supabase/knowledge_base.sql`, `supabase/MASTER_RESTORE.sql`
- `src/lib/actions/*.ts` — server actions (calls, analytics, inbox, etc.)
- `src/lib/services/ai-analysis.ts`, `post-analysis.ts`, `fact-extractor.ts`
- `src/lib/core/intelligence/qualifier.ts`
- `src/scripts/` — scripts de migración directa
- Grep exhaustivo de "airtable" en todo el repositorio

---

## Resumen ejecutivo

El sistema usa **exclusivamente `@supabase/supabase-js`** como cliente de base de datos. No se encontró ninguna referencia a Airtable en el código fuente (D-001 no confirmado en código — la referencia era solo en el diagrama PNG de la clienta). Sin embargo, se detectaron **7 findings** de severidad Critical-High, siendo el más grave la **ausencia de filtro `tenant_id` en la función `fetchCalls`** (la principal vista del historial de leads), que expone datos cross-tenant a usuarios autenticados de otros tenants. Adicionalmente, se usan **credenciales de Supabase hardcodeadas** como fallback (anon key y service_role key) en múltiples archivos de producción, y **3 scripts de migración** usan `postgres` directo con contraseñas hardcodeadas a IPs de producción.

---

## Cliente DB observado

| Mecanismo | Dónde | Propósito |
|-----------|-------|-----------|
| `@supabase/supabase-js` (`createClient`) | `src/lib/supabase/client.ts` | Cliente browser (anon key) |
| `@supabase/supabase-js` (`createClient`) | `src/lib/supabase/server.ts` | Cliente servidor con service_role key |
| `@supabase/ssr` (`createServerClient`) | `src/middleware.ts` | Auth middleware (anon key) |
| `@supabase/supabase-js` | `src/lib/supabase/tenant-client.ts` | Cliente externo por tenant (mode "external") |
| `postgres` (librería npm) | `src/scripts/run-migration.ts`, `migrate-agents.ts`, `migrate-scheduling.ts` | Scripts de migración directa — NO en runtime de la app |

**No se detectó uso de `pg` o `postgres` en rutas de la aplicación (API routes, server actions, workers).** El uso de `postgres` se limita a 3 scripts de dev/ops que corren manualmente. Sin embargo, estos scripts tienen contraseñas hardcodeadas y apuntan a IPs de producción.

---

## Findings (prefijo F-04-XXX)

### F-04-001: fetchCalls sin filtro tenant_id — Cross-tenant data leak

**Severidad:** Critical | **Esfuerzo fix:** Bajo (1-2h)

**Archivo:** `src/lib/actions/calls.ts:72-128`

`fetchCalls` (la función principal del historial de leads, usada en el dashboard por todos los usuarios) hace `getSupabaseServerClient()` y llama a `.from("lead").select(...)` sin ningún filtro `.eq("tenant_id", ...)`. Como el servidor usa `service_role` que bypasea RLS, cualquier usuario autenticado ve **todos los leads de todos los tenants**. La función `getActiveTenantId()` está importada pero **nunca se llama** en este flujo.

```typescript
// calls.ts:72-98 — SIN tenant_id filter
const supabase = await getSupabaseServerClient();
let query = supabase
    .from("lead")
    .select(`*, llamadas:llamadas (...), lead_cualificacion (...)`, { count: "exact" })
    .order("fecha_ingreso_crm", { ascending: false })
    .range(from, to);
// ← no hay .eq("tenant_id", tenantId) en ningún punto
```

**Fix:** Añadir `getActiveTenantId()` y `.eq("tenant_id", tenantId)` al query de `lead` y al query de `appointments` (línea 139-142, también sin filtro).

---

### F-04-002: Credenciales Supabase hardcodeadas en código fuente

**Severidad:** Critical | **Esfuerzo fix:** Bajo (30min)

**Archivos:**
- `src/lib/supabase/client.ts:16` — NEXT_PUBLIC_SUPABASE_ANON_KEY como fallback hardcodeado
- `src/lib/supabase/client.ts:20` — mismo JWT en segundo fallback
- `src/lib/supabase/server.ts:7` — FALLBACK_SERVICE_KEY (service_role JWT)
- `src/lib/supabase/server.ts:8` — FALLBACK_ANON_KEY (anon JWT)
- `src/lib/auth-config.ts:13-19` — AUTH_SUPABASE_ANON_KEY y AUTH_SUPABASE_SERVICE_ROLE_KEY hardcodeadas

Todos los tokens tienen `"exp": 1893456000` (año 2030) y `"iss": "supabase"`. El service_role key da acceso de administrador a toda la BD y está en el código fuente del repositorio git.

**Fix:** Eliminar todos los fallbacks hardcodeados. Hacer que la app falle explícitamente si las env vars no están configuradas. Rotar las claves en Supabase Dashboard.

---

### F-04-003: Scripts de migración con `postgres` directo a IPs de producción

**Severidad:** Critical | **Esfuerzo fix:** Medio (2h)

**Archivos:**
- `src/scripts/migrate-agents.ts:21` — `postgresql://postgres:postgres@46.62.193.169:5432/postgres`
- `src/scripts/migrate-scheduling.ts:16` — misma IP
- `src/scripts/run-migration.ts:27` — IP con hostname derivado

Los scripts usan `sql.unsafe(query)` sobre queries de ALTER TABLE con la credencial `postgres:postgres` (password por defecto) apuntando directamente a la IP de producción `46.62.193.169`. Esto constituye:
1. Password por defecto de PostgreSQL expuesta en código.
2. Acceso directo a puerto 5432 en producción (bypasea Supabase API y RLS por completo).
3. `sql.unsafe()` ejecuta SQL sin prepared statements.

**Fix:** Eliminar estos scripts del repositorio o moverlos a `.gitignore`. Usar exclusivamente el SQL Editor de Supabase Dashboard o Supabase CLI para migraciones. Cambiar la contraseña del usuario `postgres`.

---

### F-04-004: Política RLS de `knowledge_base` usa `app.current_tenant` nunca seteado

**Severidad:** Critical | **Esfuerzo fix:** Bajo (1h)

**Archivo:** `supabase/migrations/20260424_knowledge_and_billing.sql:31`

```sql
CREATE POLICY "Tenants can only access their own knowledge base"
ON knowledge_base FOR ALL
USING (tenant_id::text = current_setting('app.current_tenant', true));
```

El código de la aplicación **nunca ejecuta** `SET app.current_tenant = '...'` antes de las queries a `knowledge_base`. El segundo argumento `true` en `current_setting` devuelve `NULL` si la variable no está seteada, lo que hace que la política falle silenciosamente — si el cliente de Supabase usa `anon`, la política bloquea todo; si usa `service_role`, bypasea la política. En ningún caso protege tenant_id correctamente.

**Fix:** Cambiar la política para usar `auth.jwt() ->> 'tenant_id'` igual que `knowledge_base_embeddings`, o usar la misma política `service_role_all_*` que el resto de tablas y aplicar filtro en código.

---

### F-04-005: Política RLS de `ai_agents` y `ai_agent_variants` no aísla por tenant

**Severidad:** High | **Esfuerzo fix:** Bajo (1h)

**Archivo:** `supabase/migrations/20260404_ai_agents.sql:33-39`

```sql
CREATE POLICY "Tenants can only see their own agents"
ON ai_agents FOR ALL
USING (tenant_id = (SELECT id FROM tenants WHERE id = ai_agents.tenant_id));
-- Esta condición siempre es TRUE para cualquier fila — no filtra nada

CREATE POLICY "Tenants can only see their own agent variants"
ON ai_agent_variants FOR ALL
USING (agent_id IN (SELECT id FROM ai_agents));
-- Devuelve todos los agents de todos los tenants
```

Ambas políticas son tautológicas: la primera compara `tenant_id` consigo mismo; la segunda devuelve todos los agent IDs sin filtrar por tenant. Si se accede con `anon` key, un usuario ve agentes de otros tenants.

**Fix:** Usar `auth.jwt() ->> 'tenant_id'` igual que `knowledge_base_embeddings` y `orchestration_graphs`.

---

### F-04-006: Políticas RLS de `web_widgets` sin aislamiento real

**Severidad:** High | **Esfuerzo fix:** Bajo (30min)

**Archivo:** `supabase/migrations/20260427_web_widgets.sql:20-32`

```sql
USING (tenant_id IN (SELECT id FROM tenants));
-- Devuelve todos los tenants — no filtra nada
```

La política SELECT de `web_widgets` usa `tenant_id IN (SELECT id FROM tenants)` que devuelve todos los UUIDs de tenants existentes. Cualquier usuario autenticado puede leer widgets de cualquier tenant.

**Fix:** Cambiar a `USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)`.

---

### F-04-007: Cache Redis sin invalidación en mutaciones de leads

**Severidad:** High | **Esfuerzo fix:** Medio (3h)

**Archivo:** `src/lib/cache/tenant-cache.ts`

La capa de cache Redis (`withTenantCache`, `setTenantConfigCache`) almacena configuración de tenant con TTL de 5 minutos. Sin embargo, en ninguna de las server actions que **mutan datos de leads** (calls.ts, inbox.ts, analytics.ts) se invoca `invalidateTenantConfigCache`. El cache está pensado para `tenant_orchestrator_config`, pero si en el futuro se cachean leads u otros datos de negocio, el patrón actual causará que usuarios vean datos obsoletos.

Adicionalmente, `invalidateTenantConfigCache` usa `redis.keys(pattern)` que es O(N) y puede ser bloqueante en Redis con muchas claves.

**Fix (inmediato):** Documentar explícitamente qué datos se cachean. Usar `redis.scan` en lugar de `redis.keys`. Asegurar que cualquier mutación de datos cacheados llame a `invalidateTenantConfigCache`.

---

### F-04-008: getPrograms sin filtro tenant_id

**Severidad:** High | **Esfuerzo fix:** Bajo (15min)

**Archivo:** `src/lib/actions/calls.ts:441-455`

```typescript
export async function getPrograms() {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from("programas")
        .select("*")
        .order("nombre");
    // ← sin .eq("tenant_id", tenantId)
}
```

Devuelve todos los programas de todos los tenants. Permite que un tenant vea los cursos/masters de otros clientes.

**Fix:** Añadir `getActiveTenantId()` y filtrar por `tenant_id`.

---

### F-04-009: Umbral years_experience difiere entre spec y código

**Severidad:** High | **Esfuerzo fix:** Bajo (15min) + decisión de negocio

**Archivo:** `src/lib/core/intelligence/qualifier.ts:78-103`

La spec de la clienta (00-client-spec-extraction.md §3.5, Regla B) establece `years_experience >= 2` para estudios técnicos/FP. El código implementa:
- Regla B (Técnico/FP): `>= 3 años`
- Regla C (Sin estudios/Básico): `>= 5 años`

La spec no menciona Regla C explícitamente — solo define exclusiones por tipo de profesión manual, no por umbral de años. El umbral de 2 vs 3 puede cambiar el resultado de cualificación de leads reales.

**Fix:** Confirmar con la clienta el umbral correcto. Actualizar `qualifier.ts` según la decisión.

---

### F-04-010: qualified enum diverge entre spec y código

**Severidad:** Medium | **Esfuerzo fix:** Bajo (1h)

**Archivos:**
- `src/lib/services/ai-analysis.ts:51` — `qualified: "si" | "no" | "anulado"`
- `src/lib/core/intelligence/qualifier.ts:6` — `QualificationStatus: "cualificado" | "no cualificado"`

La spec oficial (00-client-spec-extraction.md §3.5) define `qualified = "apto"` o `"no apto"`. El código usa dos sistemas paralelos con nomenclaturas distintas:
- `ai-analysis.ts` usa `"si"/"no"/"anulado"`
- `qualifier.ts` usa `"cualificado"/"no cualificado"`
- `lead_cualificacion.cualificacion` almacena cualquier string que llegue

Ninguno coincide con la spec de la clienta.

**Fix:** Definir un enum canónico en `src/types` y unificar todas las referencias.

---

### F-04-011: `motivo_descarte` / `MOTIVO_DESCARTE` — campo no en schema BD como columna tipada

**Severidad:** Medium | **Esfuerzo fix:** Medio (2h)

**Archivos:**
- `src/lib/services/post-analysis.ts:75` — se guarda en `motivo_anulacion` (columna BD)
- `src/lib/services/ai-analysis.ts:67` — `MOTIVO_DESCARTE` como campo de extracted_data
- `src/lib/services/post-analysis.ts:75` — mapea `MOTIVO_DESCARTE → motivo_anulacion`

La spec usa `{motivo_descarte}` pero la BD tiene la columna `motivo_anulacion`. El mapeo existe pero es implícito y no validado. Los valores enum de `motivo_descarte` de la spec no están en ningún CHECK constraint de BD.

**Fix:** Añadir constraint CHECK en `lead_cualificacion.motivo_anulacion` con los valores válidos de la spec. Documentar el mapeo `motivo_descarte → motivo_anulacion`.

---

### F-04-012: `tenant_orchestrator_config` tiene RLS policy USING(true) sin aislamiento

**Severidad:** Medium | **Esfuerzo fix:** Bajo (30min)

**Archivo:** `supabase/migrations/20260404_orchestrator_v3.sql:43-44`

```sql
CREATE POLICY "tenant_config_access" ON tenant_orchestrator_config
FOR ALL USING (true);
```

La política no filtra por tenant: cualquier usuario autenticado puede leer/modificar configuración de orquestación de otros tenants. El backend usa service_role (que bypasea RLS), pero si en algún punto se usa `anon` o `authenticated` para esto, hay fuga.

**Fix:** Cambiar a `USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)`.

---

### F-04-013: Tabla `chat_messages` RLS policy USING(true) sin aislamiento

**Severidad:** Medium | **Esfuerzo fix:** Bajo (30min)

**Archivo:** `supabase/migrations/20260404_chat_messages.sql:25-26`

```sql
CREATE POLICY "service_role_all_chat_messages" ON chat_messages FOR ALL USING (true);
```

A diferencia de otras tablas que tienen `TO service_role`, esta política es para **todos los roles** (sin especificar `TO`). Equivale a política pública sin restricciones. El campo `tenant_id` en esta tabla es `TEXT NOT NULL` en lugar de `UUID REFERENCES tenants(id)`, lo que además rompe la integridad referencial.

**Fix:** Añadir `TO service_role` a la política existente. Añadir política separada con `TO authenticated USING (tenant_id = current_setting('app.current_tenant', true))` o equivalente. Migrar `tenant_id` de TEXT a UUID con FK.

---

## Esquema BD: código vs spec cliente

| Tabla esperada por spec | Tabla en migrations | Tabla en código | Gap / Nota |
|------------------------|-------------------|-----------------|-----------|
| `tenants` | `tenants` (tenants.sql) | `tenants` | OK |
| `tenant_orchestrator_config` | `tenant_orchestrator_config` (orchestrator_v3.sql) | `tenant_orchestrator_config` | OK — RLS deficiente (F-04-012) |
| `lead` | `lead` (multitenant_schema.sql) | `lead` | OK — falta filtro en fetchCalls (F-04-001) |
| `lead_cualificacion` | `lead_cualificacion` (multitenant_schema.sql) | `lead_cualificacion` | OK — columna `anios_experiencia` vs spec `years_experience` (ver nomenclatura) |
| `lead_programas` | `lead_programas` (multitenant_schema.sql) | `lead_programas` | OK |
| `ai_agents` | `ai_agents` (ai_agents.sql) | `ai_agents` | OK — RLS tautológica (F-04-005) |
| `ai_agent_variants` | `ai_agent_variants` (ai_agents.sql) | `ai_agent_variants` | OK — RLS tautológica (F-04-005) |
| `voice_agents` | `voice_agents` (retell_config.sql) | `voice_agents` | OK |
| `voice_agent_variants` | Implícito en retell config | Parcial | Spec define tabla separada; código usa config JSONB en tenants |
| `chat_summaries` | `chat_summaries` (knowledge_base.sql) | `chat_summaries` | OK — 1 fila por lead_id (UNIQUE) |
| `chat_messages` | `chat_messages` (chat_messages.sql) | `chat_messages` | tenant_id es TEXT no UUID (F-04-013) |
| `llamadas` | `llamadas` (multitenant_schema.sql) | `llamadas` | OK |
| `intentos_llamadas` | `intentos_llamadas` (multitenant_schema.sql) | `intentos_llamadas` + `intentos` (legacy) | Duplicación con tabla `intentos` legacy |
| `appointments` / `agendamientos` | AMBAS existen: `appointments` (orchestrator_v3) y `agendamientos` (multitenant_schema) | Código usa ambas | Duplicación no resuelta — `appointments` tiene `scheduled_at`, `agendamientos` tiene `fecha_agendada_cliente` |
| `availability_slots` | `availability_slots` (orchestrator_v3.sql) | `availability_slots` | OK |
| `orchestration_graphs` | `orchestration_graphs` (orchestration_system.sql) | `orchestration_graphs` | OK |
| `orchestration_rules` | `orchestration_rules` (orchestration_system.sql) | `orchestration_rules` | OK |
| `workflows` | `workflows` (orchestration_system.sql) | `workflows` | OK |
| `knowledge_base` | `knowledge_base` (knowledge_and_billing.sql) | `knowledge_base` | RLS con `app.current_tenant` no seteado (F-04-004) |
| `knowledge_base_embeddings` | `knowledge_base_embeddings` (knowledge_base.sql) | `knowledge_base_embeddings` | OK |
| `programas` | `programas` (multitenant_schema.sql) | `programas` | Sin filtro tenant en getPrograms (F-04-008) |

**Tablas en código no en spec:**
- `client_configs` (orchestrator_v2_schema.sql) — tabla de routing avanzado, no en spec de la clienta
- `system_logs`, `ai_agent_logs`, `lead_events` — tablas de logs internas
- `web_widgets` — chatbot web (en menú lateral de la clienta, no en BD spec)
- `campanas` — presente en code y migrations pero solo mencionada como campo en `lead`, no como tabla en spec

---

## Nomenclatura de variables de leads: código vs spec

| Variable oficial spec (A/B) | Prompt Virginia (C) | Columna BD | Campo en código | Gap / Severidad |
|---------------------------|--------------------|-----------|-----------------|----|
| `{user_name}` | `{{user_name}}` | `nombre` + `apellido` | `lead.nombre`, `USER_NAME` en metadata | Mapeo funcional. BD usa nombre/apellido separados. |
| `{id_lead}` | `{{id_lead}}` | `id`, `id_lead_externo` | `lead.id_lead_externo` | OK — se mapea a `id_lead_externo` |
| `{user_country}` | `{{user_country}}` | `pais` | `lead.pais`, `USER_COUNTRY` | Mapeo funcional — nombre de columna difiere |
| `{user_phone}` | `{{user_phone}}` | `telefono` | `lead.telefono` | OK |
| `{curse_name}` | `{{curse_name}}` | No columna; en `metadata.course_name` | `CURSE_NAME` en ai-analysis, `course_name` en orchestrator | **Discrepancia**: spec usa `curse_name` (typo), código usa `course_name` en algunos lugares y `CURSE_NAME` en otros. D-004 — Medium |
| `{user_studies}` | `{{user_studies}}` | `nivel_estudios` (lead_cualificacion) | `USER_ESTUDIES` en ai-analysis | **Triple discrepancia**: spec→`user_studies`, código→`USER_ESTUDIES`, BD→`nivel_estudios`. D-008 — Medium |
| `{nivel_estudios}` | No en C | `nivel_estudios` (lead_cualificacion) | `nivel_estudios` en code | Columna BD existe. Spec A/B define como separado de `user_studies`. D-008 — Medium |
| `{user_profession}` | `{{user_profesion}}` | No columna; en `metadata` | `USER_PROFESION` en ai-analysis | **Discrepancia**: spec→`profession`, prompt activo→`profesion`, código usa `USER_PROFESION` (sin s). D-004 — **Critical** |
| `{user_age}` | `{{user_age}}` | No columna; en metadata | `USER_AGE` | No hay columna BD dedicada. Se guarda en `lead.metadata` JSONB. Medium |
| `{year_experience}` | `{{years_experience}}` | `anios_experiencia` (lead_cualificacion) | `years_experience`, `YEARS_EXPERIENCE`, `YEARS_EXPERIENCIE`, `YEARS_ EXPERIENCIE` | **4 variantes** en el código. BD usa `anios_experiencia`. D-005 — **Critical** |
| `{user_motivations}` | `{{user_motivations}}` | No columna; en metadata | `USER_MOTIVATIONS` | No hay columna BD dedicada. Medium |
| `{qualified}` | `{{qualified}}` | `cualificacion` (lead_cualificacion) | `"si"/"no"/"anulado"` (ai-analysis) y `"cualificado"/"no cualificado"` (qualifier) | **Ninguno coincide** con spec `"apto"/"no apto"`. F-04-010 — High |
| `{estado}` | `{{estado}}` | No columna explícita; en `lead.current_stage` o metadata | `current_stage` en lead | Spec define 7 valores; BD tiene `current_stage` text libre sin enum. Medium |
| `{motivo_descarte}` | `{{motivo_descarte}}` | `motivo_anulacion` (lead_cualificacion) | `MOTIVO_DESCARTE` → `motivo_anulacion` | Mapeo implícito sin validación. F-04-011 — Medium |
| `{conversation_status}` | `{{conversation_status}}` | No columna BD | `conversation_status` en fact-extractor | Solo en metadata. No hay columna BD. Medium |
| `{scheduled_call_confirmed}` | `{{scheduled_call_confirmed}}` | `confirmado` (agendamientos) | `scheduled_call_confirmed` en ai-analysis | OK — se mapea a `agendamientos.confirmado` |
| `{fecha_agenda}` | `{{fecha_agenda}}` | `fecha_agendada_cliente` (agendamientos) y `scheduled_at` (appointments) | `fecha_agendada_lead` en código | Duplicidad appointments/agendamientos. Medium |
| `{resumen_conversacion}` | `{{resumen_conversacion}}` | `chat_summaries.summary` | `summary` en chat_summaries | Funcional. Spec indica "no mostrar al lead" — no verificado en UI |
| `{qa_handled}` | `{{qa_handled}}` | No columna BD | `qa_handled` en fact-extractor metadata | Solo en metadata JSONB. Low |
| `{qa_topic}` | `{{qa_topic}}` | No columna BD | `qa_topic` en fact-extractor metadata | Valores divergentes entre A/B y C. D-009 — Medium |
| `{regla_aplicada}` | `{{regla_aplicada}}` | No columna BD | `regla_aplicada` en fact-extractor metadata | Solo en metadata JSONB. Low |

---

## Rastros de Airtable

Búsqueda exhaustiva en todo el repositorio (`.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.sql`, `.md`, `.env`):

**Resultado: 0 ocurrencias encontradas en código fuente.**

El término "Airtable" no aparece en ningún archivo del código fuente, `package.json`, variables de entorno, o SQL. La divergencia D-001 (Airtable vs Supabase) solo existe en el diagrama PNG entregado por la clienta (`Flujo-agent-ia-voz-whatsapp.png`), que era una referencia al CRM externo previo, no una dependencia de código. **D-001 DESCARTADA: no hay Airtable en el código.**

---

## RLS: estado actual

### Tablas con RLS habilitado y políticas correctas (service_role bypass)

Todas las tablas del schema multitenant (lead, llamadas, agendamientos, lead_cualificacion, conversaciones_whatsapp, intentos_llamadas, intentos, notificaciones, programas, lead_programas, campanas, system_logs) tienen:
- `ENABLE ROW LEVEL SECURITY`
- Política `service_role_all_*` con `USING (true) WITH CHECK (true)` **para rol `service_role`**

Este diseño es correcto para el backend: el servidor usa service_role y la política se lo permite. Sin embargo, **no hay políticas para rol `authenticated`**, lo que significa que si en algún punto se usa la anon/JWT del usuario para queries directas, RLS bloquea todo (denegación por defecto).

### Tablas con RLS deficiente o nulo

| Tabla | Problema | Severidad |
|-------|----------|-----------|
| `knowledge_base` | `current_setting('app.current_tenant', true)` nunca seteado — policy inefectiva | Critical (F-04-004) |
| `ai_agents` | Policy tautológica — no filtra por tenant | High (F-04-005) |
| `ai_agent_variants` | Policy devuelve todos los agents — no filtra por tenant | High (F-04-005) |
| `web_widgets` | `tenant_id IN (SELECT id FROM tenants)` — devuelve todos los tenants | High (F-04-006) |
| `tenant_orchestrator_config` | `USING (true)` sin rol ni tenant_id — acceso universal | Medium (F-04-012) |
| `chat_messages` | `USING (true)` sin especificar rol — acceso universal | Medium (F-04-013) |
| `orchestration_graphs/rules/workflows` | `auth.jwt() ->> 'tenant_id'` — correcta, pero depende de que el JWT contenga `tenant_id` claim (no verificado) | Pendiente verificación en Fase 5 |

### Tablas con RLS habilitado pero sin policies definidas (bloqueo total)

No se detectaron tablas con RLS habilitado y sin políticas. Todas las tablas con RLS habilitado tienen al menos una política.

### Riesgo de bypass RLS

**No se detectó bypass RLS** en código de producción (rutas API, server actions, workers). El único mecanismo de bypass es el uso de `service_role` key, que es la estrategia intencionada. Sin embargo, dado que `getSupabaseServerClient` (server.ts) usa `service_role` como fallback, si no hay filtros explícitos en el código (como en F-04-001 y F-04-008), el bypass de RLS se convierte en un vector de data leak real.

La protección real de multi-tenancy recae **en el código de la aplicación** (filtros `.eq("tenant_id", ...)`) y **no en RLS**. Esto es un patrón de mayor riesgo que confiar en RLS, porque requiere que cada query sea correcta individualmente.

---

**Status:** DONE_WITH_CONCERNS

**Summary:** Auditoría completa del data layer. 0 referencias a Airtable en código (D-001 descartada). 13 findings detectados (3 Critical, 5 High, 5 Medium). El más grave: `fetchCalls` devuelve leads de todos los tenants sin filtrar. Credenciales de producción hardcodeadas en código fuente.

**Concerns:**
- El middleware (`src/middleware.ts`) usa `createServerClient` de `@supabase/ssr` con anon key para validar sesión, pero el JWT no inyecta `tenant_id` como claim verificable. Esto puede hacer inefectivas las políticas RLS que dependen de `auth.jwt() ->> 'tenant_id'`. Requiere verificación en Fase 5.
- No se pudo verificar el estado real de RLS en producción (solo análisis estático de SQL). Las políticas pueden estar duplicadas o en conflicto si se ejecutaron múltiples migraciones con `CREATE POLICY IF NOT EXISTS` sobre las mismas tablas.
- La duplicación de tablas `appointments` + `agendamientos` y `intentos` + `intentos_llamadas` indica que el schema tiene deuda técnica de migración no resuelta.
