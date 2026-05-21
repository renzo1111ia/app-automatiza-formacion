---
title: "7-05 — UI admin (API Key + Account URL + mapping)"
status: pending
priority: P2
estimation: 3-8h
phase_id: 7-05
sprint_id: SP-7
branch: feature/sp-7-activecampaign-adapter
created: 2026-05-21
---

# Phase 05 — UI admin ActiveCampaign (7-05)

## Context Links

- [plan.md](plan.md) — overview Sprint 7
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-04-activecampaign-adapter.md`
- Sprint 2 UI patterns: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-05-ui-admin-conexion-crm.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 7-01..7-04 backend
- **Descripción:** UI más simple del bloque (no OAuth wizard): formulario API Key + Account URL + mapping de pipeline/automation + test connection.

## Key Insights

- Sin OAuth → flow muy simple (2 pasos: credenciales + mapping)
- Validar credenciales al guardar antes de persistir (`validateACCredentials`)
- Pipelines via `GET /dealGroups` (en AC se llama "deal groups" = pipelines)
- Automations via `GET /automations`

## Requirements

**Funcionales:**
- Página `/admin/integrations/activecampaign` con form:
  1. API Key + Account URL inputs + Test connection button
  2. Pipeline selector (dropdown via `GET /dealGroups`)
  3. Stage mapping (dropdowns)
  4. Automation selector opcional (dropdown via `GET /automations`)
  5. Tag mapping
  6. Custom fields mapping
- Botón "Desconectar" elimina webhook en AC

**No funcionales:**
- Mobile responsive
- A11y
- Validación on-blur

## Architecture

```
src/app/admin/integrations/activecampaign/page.tsx

Components:
  src/components/integrations/ac-connection-form.tsx
  src/components/integrations/ac-pipeline-selector.tsx
  src/components/integrations/ac-automation-selector.tsx
  src/components/integrations/ac-fields-mapping.tsx
```

## Related Code Files

**Crear:**
- `src/app/admin/integrations/activecampaign/page.tsx`
- `src/components/integrations/ac-connection-form.tsx`
- `src/components/integrations/ac-pipeline-selector.tsx`
- `src/components/integrations/ac-automation-selector.tsx`
- `src/components/integrations/ac-fields-mapping.tsx`
- `src/lib/actions/ac-connect.ts`

**Modificar:**
- `src/app/admin/integrations/page.tsx` (card AC)

## Implementation Steps

1. Page server component
2. Form inputs API Key + Account URL
3. Test connection button → call `validateACCredentials`
4. Si OK → siguiente paso mapping
5. Pipeline selector (GET dealGroups)
6. Stage mapping
7. Automation selector
8. Tag mapping
9. Custom fields mapping
10. Server action `saveACConfig` que también registra webhook
11. Server action `disconnectAC` con DELETE webhook en AC
12. A11y check + Playwright smoke

## Todo List

- [ ] Page AC server component
- [ ] Form API Key + Account URL
- [ ] Test connection button
- [ ] Pipeline selector
- [ ] Stage mapping
- [ ] Automation selector
- [ ] Tag mapping
- [ ] Custom fields mapping
- [ ] `saveACConfig` + auto-registro webhook
- [ ] `disconnectAC` + delete webhook
- [ ] Validación inline
- [ ] Toasts + loading
- [ ] A11y
- [ ] Playwright smoke

## Success Criteria

- Admin guarda credenciales válidas y se registra webhook automáticamente
- Pipeline + stage mapping persistido y aplicado en push
- Tag mapping funcional
- Test connection devuelve OK con credenciales válidas

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Account URL formato incorrecto | Alta | Bajo | Regex validación al on-blur |
| Test connection lento (timeout) | Baja | Bajo | Timeout 10s + retry button |
| Webhook registro falla pero config OK | Media | Medio | Mostrar warning + retry manual |

## Security Considerations

- Server actions con tenantId auth
- API Key cifrada antes de persistir
- CSRF protection

## Next Steps

- Habilita 7-06 (tests + cierre)
