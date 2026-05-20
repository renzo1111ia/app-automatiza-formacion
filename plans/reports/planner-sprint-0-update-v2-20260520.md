# Reporte: Sprint 0 — Actualización v2 de decisiones del usuario

**Fecha:** 2026-05-20
**Planner:** planner (Sonnet)
**Plan actualizado:** `plans/260520-1342-sprint-0-hotfixes-seguridad/`

---

## Resumen de cambios aplicados

### A-15 — Secret webhook CRM por tenant (phase-04)
- Decisión: secret POR TENANT, no global.
- Implementación añadida: nueva columna `integrations.webhook_secret_hash`. El secret se genera al dar de alta la integración. La validación en `webhooks/crm/route.ts` cruza `tenant_id` del payload contra el hash almacenado por tenant.
- Compatibilidad MVP documentada: HubSpot (`X-HubSpot-Signature-v3`) + Zoho (header custom `X-Webhook-Secret`).
- `CRM_WEBHOOK_SECRET` global eliminado de `.env.example` — reemplazado por nota sobre secret en DB.
- **Estimación: 4h → 6h** (+2h capa multi-tenant).

### A-22 — Allowlist SSRF dinámica por tenant (phase-06)
- Decisión: allowlist dinámica en `tenants.allowed_migrate_hosts text[]`, no env var estática.
- Los dominios se rellenan tras el alta de cada tenant. Si lista vacía → 403 (deny by default).
- Implementación añadida: migración SQL para la columna + helper `validateTenantUrl(url, allowedHosts)` + UI admin para gestionar la lista por tenant.
- `TENANT_MIGRATE_ALLOWED_HOSTS` env var eliminada — reemplazada por columna en DB.
- **Estimación: 6h → 8h** (+2h allowlist dinámica + UI admin).

### A-09 — Guard condicional en `/api/test/orchestrator` (phase-03)
- Decisión: guard temporal por configuración del tenant, no eliminación.
- Implementación añadida: nueva columna `tenants.test_orchestrator_enabled boolean DEFAULT false`. El endpoint responde solo si `test_orchestrator_enabled = true` AND webhook config completa. Deny by default para tenants nuevos.
- UI admin: toggle para activar/desactivar por tenant.
- Riesgo residual documentado: el endpoint sigue accesible sin autenticación de sesión — solo gateado por config. Creado ítem de deuda técnica en Fase 3: "Eliminar `/api/test/orchestrator` o migrar a admin con auth".
- **Estimación: 30min → 2h** (+1h 30min columna + validación + UI admin).

### A-06 — Verificación worker BullMQ (phase-02)
- Añadido Step 1 obligatorio al arrancar Sprint 0: grep en `worker.js` para detectar si usa `pg`/`postgres-js` directo o Supabase client.
- Si pg directo → ampliar A-06 con cadena de conexión del worker hacia `app_user`. **+1h condicional**.
- Si Supabase client → A-06 solo afecta scripts admin, estimación sin cambio.
- **Estimación: 3h base (+1h condicional → 4h max)**.

### SP-A-CLOSE-5-bis — Promoción a staging y validación clienta (phase-07)
- Nueva tarea añadida al cierre del sprint.
- **No bloquea el cierre del Sprint 0** (que se cierra al mergear a `developer` + bump v0.1.0).
- **Sí bloquea la promoción a `main`** — solo ocurre con aprobación de la clienta y autorización explícita del usuario (Renzo).
- Agente: `af-agents:deployment`.
- Estimación: variable (~1h coordinación + 1-3 días espera clienta).

### Sección "Tracking de tiempos" en plan.md
- Añadida referencia a `plans/logs/sprint-a/` para logs detallados por tarea y resumen del sprint.
- Responsabilidades documentadas: `roadmap-keeper` (estados en RoadMap.md) + `productivity` (logs detallados).
- Los archivos de logs NO se crean en este plan — los crea el agente de sistema de logs en paralelo.

---

## Nuevas estimaciones del sprint (totales)

| Fase | Est. anterior | Est. nueva | Delta |
|------|--------------|------------|-------|
| Ph2 — Secretos y credenciales | 12h | 12h base (+1h cond.) | +1h condicional |
| Ph3 — Endpoints sin auth | 15h 30min | 17h | +1h 30min |
| Ph4 — Webhooks y firmas | 16h | 18h | +2h |
| Ph6 — Otros críticos | 14h | 16h | +2h |
| Ph7 — Cierre sprint | 5h 30min + bugs | 5h 30min + bugs + variable clienta | +variable |
| **TOTAL desarrollo** | **~88h** | **~94h base (95h max)** | **+6h base (+7h max)** |
| **TOTAL con cierre** | **~93h 30min + bugs** | **~99h 30min base + bugs** | **+6h base** |

---

## Nuevas dependencias detectadas

1. **A-09 → migración DB**: A-09 ahora requiere ejecutar una migración SQL (`tenants.test_orchestrator_enabled`) antes de desplegar el código del guard. Añadir Step de migración al plan de deploy de Ph3.

2. **A-15 → migración DB**: A-15 requiere migración SQL (`integrations.webhook_secret_hash`) antes de que el endpoint valide por tenant. La migración debe ejecutarse antes del deploy de Ph4.

3. **A-22 → migración DB**: A-22 requiere migración SQL (`tenants.allowed_migrate_hosts`) y que los admins configuren los hosts por tenant ANTES de activar la validación en producción. Riesgo de bloqueo operacional si se activa sin configurar.

4. **A-15 + A-22 + A-09 → UI admin**: Las tres tareas añaden UI de administración. Verificar que no se solapan en los mismos componentes de UI admin para evitar conflictos de edición de archivos.

5. **SP-A-CLOSE-5-bis → SP-A-CLOSE-5**: La tarea bis depende de que SP-A-CLOSE-5 esté completamente cerrada en `developer`. No se puede iniciar antes.

---

**Status:** DONE
**Summary:** Aplicadas todas las decisiones del usuario sobre A-15, A-22, A-09, A-06, SP-A-CLOSE-5-bis y tracking de tiempos. Total sprint actualizado: ~94h base (+6h respecto al plan v1).
**Concerns:** Ninguno bloqueante. Las tres migraciones DB añadidas (A-09, A-15, A-22) requieren coordinación de deploy explícita para no activar guards antes de que los datos estén configurados en producción.
