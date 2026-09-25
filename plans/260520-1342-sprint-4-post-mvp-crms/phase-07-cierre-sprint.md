---
title: "SP-5-CLOSE — Cierre Sprint 4"
sprint_task: SP-5-CLOSE-1..5
status: pending
priority: P2
effort: 9-12h + bugs
branch: feature/sprint-05-fase-5-post-release
---

# SP-5-CLOSE — Cierre Sprint 4

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Patrón idéntico a SP-1-CLOSE, SP-2-CLOSE, SP-3-CLOSE, SP-4-CLOSE

## Nota sobre "cierre Sprint 4"

Sprint 4 es incremental — cada integración 5-01..5-04 tiene su propio PR y bump de versión. Por tanto, el "cierre de Sprint 4" se ejecuta cuando se considera que el conjunto de integraciones implementadas es suficiente para un hito (ej. las 4 integraciones + 5-05 completo).

**Puede haber cierres parciales:** si solo se implementa 5-01 + 5-04, se puede hacer un cierre parcial con v0.5.0 + v0.5.3 sin esperar 5-02/5-03.

---

## Tareas de cierre

### SP-5-CLOSE-1 — Auto test (1h 30min)

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

- Todos los tests deben pasar antes de continuar
- Si hay errores: corregir antes de pasar a CLOSE-2
- Incluye `adapter.contract.test.ts` (5-05) si está implementado

### SP-5-CLOSE-2 — Test E2E local (3-4h)

Playwright — recorrido completo por cada integración implementada:

- [ ] Activar integración Sheets en UI admin → OAuth consent → spreadsheet vinculado → lead sync verificado
- [ ] Activar integración Salesforce en UI admin → OAuth consent → lead sync → ver en SF sandbox
- [ ] Activar integración GHL en UI admin → OAuth consent → contact sync → ver en GHL sandbox
- [ ] Activar integración AC en UI admin → API Key → contact sync → ver en AC trial
- [ ] Verificar webhooks (si aplica): editar en CRM → ver update en Esden
- [ ] Verificar audit log: cada sync aparece en `crm_write_audit`
- [ ] RLS: tenant A no ve conexiones de tenant B

### SP-5-CLOSE-3 — Test manual dev (2h)

Recorrido funcional confirmando:

- [ ] Flujo completo de un lead desde creación hasta sync en cada CRM
- [ ] Error handling visible: token expirado → UI muestra error claro; 429 → se reintenta
- [ ] Rate limiting: AC 5 req/s no genera errores en bulk
- [ ] Drive webhook channel: renovación automática funcional

### SP-5-CLOSE-4 — Corrección de bugs detectados (variable)

- Bugs detectados en CLOSE-2 o CLOSE-3 → corregir → re-ejecutar CLOSE-1

### SP-5-CLOSE-5 — Cierre + PR (30min)

- PR a `developer` desde cada rama feature de integración completada
- Bump de versión según integraciones completadas:
  - Solo 5-01: `v0.5.0`
  - 5-01 + 5-04: `v0.5.0` + `v0.5.3` (o el último bump aplicado)
  - Todas 5-01..5-05: `v0.5.4`
- Actualizar RoadMap.md (cambiar estado de tareas E a completado)
- Invitar a planificar siguientes integraciones Tier 2 (si procede)

---

## Estimación

| Tarea                         | Estimación      |
| ----------------------------- | --------------- |
| SP-5-CLOSE-1: Auto test       | 1h 30min        |
| SP-5-CLOSE-2: E2E local       | 3-4h            |
| SP-5-CLOSE-3: Test manual dev | 2h              |
| SP-5-CLOSE-4: Corrección bugs | variable        |
| SP-5-CLOSE-5: PR + cierre     | 30min           |
| **Total**                     | **7-8h + bugs** |

---

## Success Criteria

- `npm run typecheck` + `lint` + `build` + `test` → 0 errores
- Playwright E2E: todos los flujos de integración verificados
- Audit trail completo en `crm_write_audit`
- PR a `developer` mergeado
- Versión bumpeada en package.json
