# dashboard-af — E2E Runs History

> Histórico acumulativo de ejecuciones del plan E2E Full (ver [`e2e-full-test-plan.md`](./e2e-full-test-plan.md)).
>
> **Cada run añade entrada al INICIO** (más reciente primero). No se borran entradas, se acumulan.

## Cabecera

- **Acumulativo desde**: 26-05-2026
- **Comando**: `/e2etotal [--env local|vps|staging|prod] [--skip-fase N] [--only-fase N] [--no-cleanup]`
- **Plan maestro**: [`e2e-full-test-plan.md`](./e2e-full-test-plan.md) v1.0

## Template entrada nueva run

```markdown
### Run YYYY-MM-DD HH:MM — operator: {nombre} — env: {local|vps|...}

- **Plan dir**: `plans/YYMMDD-HHmm-e2etotal-run/`
- **Branch / HEAD**: `{branch}` @ `{shortsha}`
- **App version**: `vX.Y.Z` (de `/api/version`)
- **Plan version**: `1.0`
- **Duración total**: `Xh Ymin`
- **Resultado**: 🟢 PASS | 🟡 PASS con warnings | 🔴 FAIL

#### Resultados por fase

| Fase                | Estado | Pass/Total | Bugs | Notas                    |
| ------------------- | ------ | ---------- | ---- | ------------------------ |
| 00 Pre-checks       | 🟢     | 7/7        | 0    | —                        |
| 01 Auth+RBAC        | 🟢     | N/M        | 0    | —                        |
| 02 RLS multi-tenant | 🟢     | N/M        | 0    | —                        |
| 03 CRUD entidades   | 🟡     | N/12       | 2    | voice_agents update KO   |
| 04 Integrations     | 🟢     | N/M        | 0    | —                        |
| 05 Webhooks         | 🟢     | N/M        | 0    | —                        |
| 06 Widget           | 🟢     | N/M        | 0    | —                        |
| 07 Observability    | 🟡     | N/M        | 1    | Sentry DSN VPS no recibe |
| 08 Cleanup          | 🟢     | OK         | 0    | —                        |

#### Bugs encontrados

**Cerrados in-session** (commit ref):

- `E2E-YYMMDD-001-MED-typo-validation-leads` — fix `bc9c71c` — leads form validation message typo.

**Abiertos (próximo sprint)**:

- `E2E-YYMMDD-002-HIGH-voice-agents-update` — UPDATE devuelve 500 cuando `variants` vacío. Plan: añadir Zod refine en VoiceAgentSchema. Owner: TBD.

#### Métricas

- Pass rate fases 00-02: 100%
- Pass rate fase 03: X/12 entidades = Y%
- Bugs CRIT/HIGH abiertos: N
- Tiempo total: Xh Ymin
- Screenshots: N capturadas
- Console errors: N (todos no-críticos)
- Network 5xx: N

#### Link al INFORME-FINAL

[`plans/YYMMDD-HHmm-e2etotal-run/INFORME-FINAL.md`](../plans/YYMMDD-HHmm-e2etotal-run/INFORME-FINAL.md)

---
```

## Runs

### Run 2026-05-27 12:35 UTC — operator: Claude (autoexec) — env: local

- **Plan dir**: [`plans/260527-1235-e2etotal-run/`](../plans/260527-1235-e2etotal-run/)
- **Branch / HEAD**: `auditoria-v2-medio-proyecto` @ `6f8ad73`
- **App version**: `v0.3.0-rc.1`
- **Plan version**: `1.1`
- **Duración total**: `~17 min`
- **Modo**: barrido único de detección (no fix in-session, por instrucción usuario para informe bloque 7)
- **Resultado**: 🟡 PASS con bugs

#### Resultados por fase

| Fase                        | Estado | Pass/Total | Bugs | Notas                                                     |
| --------------------------- | ------ | ---------- | ---- | --------------------------------------------------------- |
| 00 Pre-checks               | 🟢     | 8/8        | 0    | git+server+supabase+playwright OK                         |
| 01 Auth+RBAC                | 🟢     | 1/1        | 0    | login admin OK con `BeaOli#AF*2026!`                      |
| 02 RLS endpoints admin-only | 🟡     | 5/7        | 2    | 5/7 retornan 401 OK; leads/ingest HTTP 000, cron 503      |
| 03 Sweep 28 rutas dashboard | 🟡     | 26/28      | 3    | CSP CRIT bloquea Supabase local, orchestrator hooks crash |
| 04 OAuth probes             | 🟡     | 2/3        | 1    | google/auth HTTP 000                                      |
| 05 Webhooks firma inválida  | 🟡     | 1/3        | 1    | whatsapp 503 info leak                                    |
| 06 Widget público           | 🔴     | 0/2        | 2    | embed.js 400+text/plain, widget/[id] HTTP 000             |
| 07 Observability+headers    | 🟢     | 8/9        | 1    | security headers OK; version unknown                      |
| 08 Informe+commit           | 🟢     | OK         | 0    | —                                                         |

#### Bugs encontrados (9 únicos)

**Abiertos (next sprint)** — NO se fixearon in-session por instrucción usuario:

**🔴 CRIT (3)**:

- `E2E-260527-003-CRIT` — CSP `connect-src` bloquea Supabase local (`127.0.0.1:8100`). Casi seguro afecta VPS.
- `E2E-260527-004-CRIT` — React "Rendered more hooks" en `/dashboard/orchestrator`. Feature inaccesible.
- `E2E-260527-007-CRIT` — `/api/webhooks/whatsapp` retorna 503 con firma bogus. Info leak + riesgo Meta desactiva webhook.

**🟠 HIGH (4)**:

- `E2E-260527-001-HIGH` — `/api/leads/ingest` HTTP 000 (no response).
- `E2E-260527-006-HIGH` — 3 endpoints HTTP 000 (leads/ingest, google/auth, widget/[id]).
- `E2E-260527-008-HIGH` — `/api/widget/embed.js` retorna 400 + `text/plain` (debería ser JS).

**🟡 MED (2)**:

- `E2E-260527-002-MED` — `/api/cron/appointments/reminders` 503 unauth (info leak).
- `E2E-260527-005-MED` — `/dashboard/orchestrator` redirige a `/onboarding` sin mensaje (consecuencia de #004).
- `E2E-260527-009-MED` — `/api/version` campos commit/branch/deployedAt = "unknown".

#### Patrón sistémico detectado

3 bugs (#001, #002, #007) tienen misma raíz: handlers inician Redis/BullMQ ANTES de validar auth/firma. Fix recomendado: refactor cross-handler para validación-first.

#### Métricas

- Pass rate fases 00-02 (críticas): 100% en auth+RBAC, parcial en endpoints (2 bugs)
- Pass rate fase 03 (sweep): 26/28 rutas navegan (93%). 2 con bugs CRIT
- Bugs CRIT abiertos: 3
- Bugs HIGH abiertos: 4
- Bugs MED abiertos: 3 (uno consecuencia de CRIT)
- Tiempo total: ~17 min
- Screenshots: 24 capturadas (`docs/screenshots/e2e-01..24-*.png`)
- Console errors únicos: 22 (todos vinculados a #003 CSP + 1 a #004 hooks)
- Network 5xx: 0 servidor (solo CSP-blocked client-side)

#### Link al INFORME-FINAL

[`plans/260527-1235-e2etotal-run/INFORME-FINAL.md`](../plans/260527-1235-e2etotal-run/INFORME-FINAL.md) — pensado para incluir en bloque/página 7 del informe externo.

---

## Estadísticas globales acumuladas

- **Runs totales**: 1
- **Entornos cubiertos**: local (1)
- **Entidades testeadas (única)**: 0/12 (CRUD real no ejecutado en modo barrido)
- **Endpoints API testeados (único)**: 14/30+ (7 admin-only + 3 OAuth + 3 webhooks + 1 widget)
- **Bugs únicos encontrados**: 9
- **Bugs cerrados in-session histórico**: 0 (modo detección único)
- **Bugs abiertos pendientes**: 9 (3 CRIT, 4 HIGH, 2 MED)
- **Tiempo total invertido en E2E full**: 0h 17min
- **Última cobertura completa (todas las fases verdes)**: nunca

## Observaciones inter-run (aprendizajes acumulados)

> Se actualiza cuando el operador detecta un patrón que aplica a todos los runs futuros.

- **2026-05-27 run #1**: Detectado patrón sistémico — varios handlers (`webhooks/whatsapp`, `cron/appointments/reminders`, `leads/ingest`) inicializan dependencias externas (Redis/BullMQ) antes de validar auth/firma. Vigilar en runs futuros si se introduce un cuarto caso.
- **2026-05-27 run #1**: CSP `connect-src` no contempla URLs de entornos dev/VPS (`localhost:8100`, `127.0.0.1:8100`, `dev.automatizaformacion.com`). Bug raíz que oculta otros bugs en client-side. Verificar en cada bump de plan que las URLs target están en CSP.
- **2026-05-27 run #1**: Modo barrido (~17min) es 10x más rápido que CRUD completo (~3h) y detectó 9 bugs significativos. Útil como pre-screen antes de invertir en CRUD completo.

## Convenciones

- **Entrada nueva**: SIEMPRE al inicio de la sección "Runs", NUNCA al final.
- **No editar entradas pasadas** salvo correcciones de typos. Si un bug cambia de estado, NO retro-editar: anotar en run siguiente.
- **Bugs cross-run**: si un mismo bug ID aparece en N runs, marcarlo como "regresión recurrente" en "Observaciones inter-run".
- **Stats globales**: recalcular tras cada run (manualmente o script futuro).
