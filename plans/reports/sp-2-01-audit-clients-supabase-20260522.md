# SP-2 tarea 2-01 — Auditoría de clientes directos `pg`/`postgres` + `service_role`

**Fecha**: 22-05-2026 19:30
**Autor**: Javi HP
**Sprint**: Sprint 1 — Capa de datos (SP-2)
**Tarea**: 2-01 (Bloque 2.1, 4h estimadas — completada en ~20min con grep)

## 1. Clientes `pg`/`postgres` directos

**Total: 3 archivos, TODOS en `src/scripts/` (admin)** — política permite mantenerlos.

| Archivo                             | Tipo         | Decisión                    |
| ----------------------------------- | ------------ | --------------------------- |
| `src/scripts/run-migration.ts`      | Script admin | ✅ Mantener (admin sin RLS) |
| `src/scripts/migrate-scheduling.ts` | Script admin | ✅ Mantener (admin sin RLS) |
| `src/scripts/migrate-agents.ts`     | Script admin | ✅ Mantener (admin sin RLS) |

**Verificación**: 0 imports `pg`/`postgres` en `src/app/api/**` y `src/lib/actions/**`. ✅

## 2. Usos de `service_role` en código de producción

**Total: 12 archivos. 8 son uso real (createClient con service_role), 4 son referencias auxiliares (helpers env / comments / SQL strings).**

### 2.1 USO REAL — requieren refactor a `@supabase/ssr` o justificación documentada

| Archivo                                               | Línea | Contexto                                        | Razón de uso                | Acción 2-02/2-03                                                        |
| ----------------------------------------------------- | ----- | ----------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `src/app/api/cron/appointments/reminders/route.ts`    | 61    | `createClient(URL, SERVICE_ROLE_KEY)` para cron | Cron sin sesión humana      | ✅ Justificado (cron requiere bypass RLS). Documentar en comment + ADR. |
| `src/app/api/integrations/google/callback/route.ts`   | 26    | OAuth callback escribe tokens cifrados          | Sin sesión user en callback | ⚠️ Refactor: pasar a server action con sesión renovada tras callback    |
| `src/app/api/orchestration/sweep/route.ts`            | 22    | Cron sweep que itera tenants                    | Cron multi-tenant           | ✅ Justificado (cron). Documentar.                                      |
| `src/app/api/webhooks/retell/route.ts`                | 145   | Webhook Retell sin sesión humana                | Webhook externo             | ✅ Justificado (webhook). Ya cubierto por HMAC en 1-12.                 |
| `src/lib/services/ai-analysis.ts`                     | 20    | Servicio AI server-side                         | Background worker           | ⚠️ Refactor: aceptar `supabaseClient` como param desde caller           |
| `src/lib/services/appointment-service.ts`             | 10    | Servicio appointments                           | Compartido cron + webhook   | ⚠️ Refactor: idem ai-analysis (DI)                                      |
| `src/lib/services/chat-memory.ts`                     | 11    | Memoria chat                                    | Background worker           | ⚠️ Refactor: idem                                                       |
| `src/lib/core/processors/WhatsAppAIProcessor.ts`      | 581   | Procesador WhatsApp AI                          | Background worker (BullMQ)  | ✅ Justificado (worker). Documentar.                                    |
| `src/lib/core/processors/WhatsAppWebhookProcessor.ts` | 306   | Procesador webhook WhatsApp                     | Webhook externo             | ✅ Justificado (webhook). Ya cubierto por HMAC en 1-14.                 |

### 2.2 USO AUXILIAR — no requieren refactor

| Archivo                               | Línea   | Contexto                                                                                                                      | Acción        |
| ------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/lib/actions/tenant.ts`           | 92, 114 | `requireEnvAny([SUPABASE_SERVICE_ROLE_KEY, SERVICE_ROLE_KEY])` helper env. Crea clientes admin para operaciones cross-tenant. | ✅ OK (admin) |
| `src/lib/actions/voice-agents.ts`     | 11      | Solo comentario JSDoc                                                                                                         | ✅ OK         |
| `src/app/api/tenant/migrate/route.ts` | 230-242 | SQL strings con `service_role` en policy DDL (no es uso de cliente)                                                           | ✅ OK         |

## 3. Resumen ejecutivo

- **0 imports directos `pg`/`postgres`** en código de producción (`src/app/api/**`, `src/lib/actions/**`). Los 3 archivos en `src/scripts/` son admin y se mantienen.
- **8 puntos de `service_role` real en código de producción**:
  - **5 justificados (cron + webhooks + worker BullMQ)** — documentar en comments + ADR (`docs/adr/0015-uso-service-role-justificado.md`).
  - **3 requieren refactor** (`ai-analysis.ts`, `appointment-service.ts`, `chat-memory.ts`): cambiar a **Dependency Injection** del `SupabaseClient`, recibido como parámetro del caller (route handler u orchestrator). El caller decide qué cliente usar (service_role para worker / ssr para user request).

## 4. Plan de ejecución 2-02 + 2-03

### 2-02 — Refactor a supabase-ssr + DI (12h estim)

1. **Upgrade @supabase/ssr 0.10.3 + supabase-js 2.106.1** (1h) — ADR previo `af-agents:adr`.
2. **Crear ADR-0015** "Uso justificado de service_role" — 5 puntos cron/webhook/worker (30min).
3. **Refactor DI en services** `ai-analysis.ts`, `appointment-service.ts`, `chat-memory.ts` (3-4h):
   - Cada función acepta `supabase: SupabaseClient` como param.
   - Eliminar `createClient(url, SERVICE_ROLE_KEY)` interno.
   - Caller pasa el cliente apropiado.
4. **Refactor `google/callback`** (2-3h): renovar sesión tras OAuth y usar cliente ssr en lugar de service_role para escribir tokens cifrados.
5. **Auth flows test** (2h): login, refresh, logout funcionan tras upgrade ssr 0.10.

### 2-03 — Verificar 0 service_role residuales no documentados (3h estim)

1. Tras 2-02, ejecutar `grep -r "SERVICE_ROLE\|service_role" src/lib/services src/lib/actions src/app/api`.
2. Cada match debe tener comment `// SERVICE_ROLE_JUSTIFIED: <razón>` apuntando a ADR-0015.
3. Cualquier match sin justificación → refactor obligatorio.
4. Test integración: crear lead via API → verificar RLS aplica (no se usa service_role en path user).

## 5. Recomendación de orden

Como las 3 refactors de DI (`ai-analysis`, `appointment-service`, `chat-memory`) tocan código consumido por workers BullMQ + Server Actions, **hacerlas DESPUÉS** del Bloque 2.3 (Repository pattern) — los repos ya van a recibir `supabase` como dependency, y los services pueden encajar en ese mismo patrón.

**Por tanto, 2-02 se parte en**:

- **2-02.a** (3h): upgrade ssr + ADR-0015 + documentar 5 puntos justificados → arrancable ya.
- **2-02.b** (5h): refactor DI en 3 services + google/callback → después de 2.3 Repository.

## 6. Criterios de cierre 2-01 (esta tarea)

- ✅ Inventario completo realizado (este documento).
- ✅ Clasificación migrar/justificar/mantener para cada match.
- ✅ Plan de acción 2-02 + 2-03 definido con tiempos.
- ✅ `npm run typecheck` sin errores (sin cambios de código todavía).

**Tarea 2-01 cerrable en estado 🔵 Subida `feature/sprint-01-capa-datos` tras commit.**
