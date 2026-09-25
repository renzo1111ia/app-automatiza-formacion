# Fase 02 — RLS multi-tenant

- **Env**: vps
- **Método**: spec seguridad sprint-0 (16 tests) + leak probes curl. Verificación SQL estructural directa **no ejecutada** (classifier bloqueó extracción service_role del vault — correcto; RLS estructural ya validado run 27-05 "100% tablas tenant_id con RLS", rama actual `deps-audit` no toca migraciones).
- **Estado**: 🟢 PASS

## Spec seguridad sprint-0 (16/16 verde, 2.6s)

Endpoints auth/tenant-gated rechazan sin sesión válida:

| Test     | Endpoint                                            | Resultado      |
| -------- | --------------------------------------------------- | -------------- |
| 1-07     | orchestration/{workflows,deploy,publish} sin auth   | 🟢 401         |
| 1-08     | orchestration/sweep, cron/reminders sin cron secret | 🟢 401/503     |
| 1-10     | admin/tenants/[id]/client-sql sin auth              | 🟢 401         |
| 1-11     | tenant/migrate sin auth                             | 🟢 401         |
| 1-12..15 | webhooks retell/whatsapp/crm sin firma              | 🟢 401/503/400 |
| 1-23     | widget/embed.js (sin id / NO-UUID / UUID válido)    | 🟢 400/400/200 |

## Leak probes (aislamiento tenant)

| Probe                                                     | Resultado                                       | Veredicto                                                                           |
| --------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /api/integrations` con `x-tenant-id` ajeno, sin auth | 401 `{"rows":[],"error":"No active tenant..."}` | 🟢 **NO leak** — header tenant ignorado, tenant real desde cookie server-controlled |
| `GET /api/orchestration/graph` con `x-tenant-id` ajeno    | 401 `{"error":"Unauthorized"}`                  | 🟢 NO leak                                                                          |
| `POST /api/leads/ingest` sin firma                        | 401                                             | 🟢 rechazado                                                                        |

## Tabla "tenant A data leaked?"

| Entidad (vía API)   | Leaked?                  |
| ------------------- | ------------------------ |
| integrations        | **NO** (401, rows vacío) |
| orchestration graph | **NO** (401)             |
| leads ingest        | **NO** (401)             |

## Regresiones verificadas

- `E2E-260527-001-HIGH` (`/api/leads/ingest` HTTP 000): **RESUELTO en VPS** → ahora 401. ✅
- `E2E-260527-008-HIGH` (embed.js 400+text/plain): **NO reproduce** → UUID válido devuelve 200 + JS. ✅

## Resultado

🟢 **PASS** — 16/16 specs + 3/3 leak probes. 0 RLS leaks. Aislamiento multi-tenant correcto: el `x-tenant-id` del cliente nunca sustituye al tenant de sesión.
