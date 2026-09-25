---
title: "9-06 — Cierre genérico (template reutilizable)"
status: reference
priority: P3
estimation: 4-8h por CRM al activarse
phase_id: 9-06
sprint_id: SP-9
branch: feature/sprint-09-{crm}-adapter (por CRM)
created: 2026-05-21
---

# Phase 06 — Cierre genérico Tier 2 (template reutilizable)

## Context Links

- [plan.md](plan.md) — overview Sprint 9
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-06-tier2-on-demand.md`
- Sprint 2 cierre pattern: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-08-cierre-sprint.md`

## Overview

- **Prioridad:** P3 — **Reference template**
- **Estado:** Reference — NO se ejecuta, solo se copia/adapta cuando se cierra un Tier 2
- **Descripción:** Plantilla de tareas de cierre reutilizable para cualquier mini-sprint Tier 2 (9-01..9-05). Copiar este archivo y adaptarlo al CRM concreto al iniciar el cierre.

## Cómo usar este template

Al cerrar un mini-sprint Tier 2:

1. Copiar este archivo dentro del folder `plans/YYMMDD-HHmm-sprint-9-XX-{crm}/`
2. Renombrar a `phase-NN-cierre-{crm}.md`
3. Reemplazar `{crm}`, `{X}` por valores concretos del CRM
4. Ajustar versión target según orden de activación
5. Ejecutar la checklist

## Tareas de cierre (template)

### SP-9-{crm}-CLOSE-1 — Auto test (1h)

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run test:contract  # debe incluir el nuevo adapter
```

### SP-9-{crm}-CLOSE-2 — E2E Playwright (1-2h)

- [ ] UI admin del CRM funcional (OAuth o API Key según corresponda)
- [ ] Lead Esden → contact en el CRM < 5 min
- [ ] (Si aplica) Webhook pull → lead actualizado
- [ ] Audit log entries
- [ ] Desconectar limpio (revoke + delete webhook si aplica)
- [ ] RLS multi-tenant

### SP-9-{crm}-CLOSE-3 — Test manual dev (30min-1h)

- [ ] Token / API Key revocado → error UI claro
- [ ] Rate limit respetado (sin 429)
- [ ] Configuración del tenant persiste correctamente

### SP-9-{crm}-CLOSE-4 — Corrección bugs (variable)

### SP-9-{crm}-CLOSE-5 — PR + cierre (30min)

- [ ] PR `feature/sprint-09-{crm}-adapter` → `developer`
- [ ] Bump `package.json` → `v0.5.{X}` (siguiente patch disponible)
- [ ] Update `RoadMap.md` (marcar Tier 2 {crm} done)
- [ ] Update `docs/project-changelog.md` con sección "Tier 2 {crm}"
- [ ] Tag `v0.5.{X}`

## Todo List (template)

- [ ] CLOSE-1 typecheck/lint/build/test pass
- [ ] CLOSE-1 contract test extendido al nuevo adapter
- [ ] CLOSE-2 Playwright E2E completo
- [ ] CLOSE-3 test manual completo
- [ ] CLOSE-4 bugs cerrados (0 P1/P2)
- [ ] CLOSE-5 PR creado y mergeado
- [ ] CLOSE-5 versión bumped
- [ ] CLOSE-5 changelog actualizado
- [ ] CLOSE-5 RoadMap actualizado
- [ ] CLOSE-5 Tag aplicado

## Estimación template

| Tarea                  | Estimación      |
| ---------------------- | --------------- |
| CLOSE-1 Auto test      | 1h              |
| CLOSE-2 E2E Playwright | 1-2h            |
| CLOSE-3 Test manual    | 30min-1h        |
| CLOSE-4 Bugs           | variable        |
| CLOSE-5 PR + cierre    | 30min           |
| **Total**              | **3-5h + bugs** |

## Success Criteria (template)

- `typecheck` + `lint` + `build` + `test` → 0 errores
- Playwright E2E verde
- Contract test incluye el nuevo adapter
- PR mergeado en `developer`
- Versión bumpeada y tag aplicado

## Risk Assessment (template)

| Riesgo                          | Prob  | Impacto | Mitigación                             |
| ------------------------------- | ----- | ------- | -------------------------------------- |
| Documentación Tier 2 incompleta | Media | Bajo    | Doc tenant obligatoria antes de cierre |
| Test sandbox limitado           | Baja  | Bajo    | Usar account dedicado del CRM          |

## Security Considerations

- No secrets en commits
- API Keys / tokens cifrados en BD
- Verificar RLS multi-tenant antes de cierre

## Next Steps

- Al activarse un Tier 2, copiar este archivo y adaptarlo
- Reusar como guía consistente para mantener calidad cross-CRM
