---
title: "6-04 — UI admin (locationId + pipeline mapping)"
status: pending
priority: P2
estimation: 6-12h
phase_id: 6-04
sprint_id: SP-6
branch: feature/sprint-06-ghl-adapter
created: 2026-05-21
---

# Phase 04 — UI admin GHL (6-04)

## Context Links

- [plan.md](plan.md) — overview Sprint 6
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-03-gohighlevel-adapter.md`
- Sprint 2 UI patterns: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-05-ui-admin-conexion-crm.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 6-01..6-03 backend listo
- **Descripción:** UI wizard de conexión GHL: OAuth consent, display de `locationId`, selección de pipeline + stages mapping, mapping de custom fields, test connection.

## Key Insights

- Tras OAuth, mostrar `locationId` para que el admin confirme
- Pipelines vienen via `GET /opportunities/pipelines` → render como dropdown
- Stages dentro del pipeline también dropdown
- Custom fields del location via `GET /locations/{id}/customFields` → tabla mapping

## Requirements

**Funcionales:**

- Página `/admin/integrations/ghl` con wizard:
  1. OAuth consent → callback
  2. Mostrar `locationId` + nombre de location
  3. Seleccionar pipeline + mapping stages a Esden stages
  4. Mapping custom fields
- Test connection button
- Desconectar con revoke

**No funcionales:**

- Mobile responsive
- A11y
- Loading states

## Architecture

```
src/app/admin/integrations/ghl/page.tsx

Components:
  src/components/integrations/ghl-connection-form.tsx
  src/components/integrations/ghl-pipeline-selector.tsx
  src/components/integrations/ghl-stage-mapping.tsx
  src/components/integrations/ghl-custom-fields-mapping.tsx
```

## Related Code Files

**Crear:**

- `src/app/admin/integrations/ghl/page.tsx`
- `src/components/integrations/ghl-connection-form.tsx`
- `src/components/integrations/ghl-pipeline-selector.tsx`
- `src/components/integrations/ghl-stage-mapping.tsx`
- `src/components/integrations/ghl-custom-fields-mapping.tsx`
- `src/lib/actions/ghl-connect.ts`

**Modificar:**

- `src/app/admin/integrations/page.tsx` (card GHL)

## Implementation Steps

1. Page server component
2. Botón OAuth → redirect `/start`
3. Tras callback: query `/locations/{id}` para mostrar nombre
4. Pipeline selector: query `/opportunities/pipelines`
5. Stage mapping: dropdowns por etapa Esden
6. Custom fields mapping: tabla con query `/locations/{id}/customFields`
7. Test connection button
8. Server action `saveGHLConfig`
9. Server action `disconnectGHL` con revoke
10. A11y + Playwright smoke

## Todo List

- [ ] Page GHL server component
- [ ] Wizard wrapper
- [ ] OAuth button
- [ ] Display locationId + nombre
- [ ] Pipeline selector con query API
- [ ] Stage mapping dropdowns
- [ ] Custom fields mapping
- [ ] Test connection
- [ ] Desconectar con revoke
- [ ] Toasts + loading
- [ ] A11y check
- [ ] Playwright smoke

## Success Criteria

- Admin completa wizard sin errores
- LocationId correcto reflejado tras OAuth
- Pipeline + stage mapping persistido y aplicado en push
- Custom fields mapping funcional
- Test connection OK

## Risk Assessment

| Riesgo                            | Prob  | Impacto | Mitigación                           |
| --------------------------------- | ----- | ------- | ------------------------------------ |
| Pipelines API endpoint distinto   | Media | Bajo    | Verificar contra GHL sandbox primero |
| Custom fields IDs cambian         | Media | Bajo    | Refrescar mapping si tenant lo pide  |
| Mobile overflow con tabla mapping | Baja  | Bajo    | Responsive cards en mobile           |

## Security Considerations

- Server actions con tenantId auth
- No exponer tokens
- CSRF protection

## Next Steps

- Habilita 6-05 (tests)
