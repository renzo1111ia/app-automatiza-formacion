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

_(vacío — primer run pendiente de ejecución)_

## Estadísticas globales acumuladas

- **Runs totales**: 0
- **Entornos cubiertos**: ninguno todavía
- **Entidades testeadas (única)**: 0/12
- **Endpoints API testeados (único)**: 0/30+
- **Bugs únicos encontrados**: 0
- **Bugs cerrados in-session histórico**: 0
- **Bugs abiertos pendientes**: 0
- **Tiempo total invertido en E2E full**: 0h
- **Última cobertura completa (todas las fases verdes)**: nunca

## Observaciones inter-run (aprendizajes acumulados)

> Se actualiza cuando el operador detecta un patrón que aplica a todos los runs futuros.

- _(vacío)_

## Convenciones

- **Entrada nueva**: SIEMPRE al inicio de la sección "Runs", NUNCA al final.
- **No editar entradas pasadas** salvo correcciones de typos. Si un bug cambia de estado, NO retro-editar: anotar en run siguiente.
- **Bugs cross-run**: si un mismo bug ID aparece en N runs, marcarlo como "regresión recurrente" en "Observaciones inter-run".
- **Stats globales**: recalcular tras cada run (manualmente o script futuro).
