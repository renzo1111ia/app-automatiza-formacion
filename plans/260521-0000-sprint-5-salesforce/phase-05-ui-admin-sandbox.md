---
title: "5-05 — UI admin (sandbox toggle + mapping)"
status: pending
priority: P2
estimation: 8-12h
phase_id: 5-05
sprint_id: SP-5
branch: feature/sp-5-salesforce-adapter
created: 2026-05-21
---

# Phase 05 — UI admin Salesforce (5-05)

## Context Links

- [plan.md](plan.md) — overview Sprint 5
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-02-salesforce-adapter.md`
- Sprint 2 UI patterns: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-05-ui-admin-conexion-crm.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 5-01..5-04 backend listo
- **Descripción:** UI admin del wizard de conexión Salesforce: toggle sandbox/prod, OAuth consent, configuración de Lead vs Contact mode, mapping de campos, test connection, doc inline para Workflow Rule del pull.

## Key Insights

- Toggle sandbox/prod debe ser visible y con warning de "no mezclar"
- Mostrar `instance_url` tras OAuth para confirmar org correcta
- Decisión Lead vs Contact: radio button con explicación contextual
- Doc inline (collapsible) para setup Workflow Rule del pull
- Badge live: `connected | sandbox | error | webhook-not-configured`

## Requirements

**Funcionales:**
- Página `/admin/integrations/salesforce` con wizard:
  1. Toggle sandbox/prod
  2. OAuth consent → callback
  3. Confirmar `instance_url` correcto
  4. Modo Lead vs Contact
  5. Mapping de campos + stage mapping para Opportunity
- Botón "Test connection" (query `User` SOQL)
- Botón "Desconectar" con revoke
- Doc collapsible para Workflow Rule setup

**No funcionales:**
- Mobile responsive
- A11y compliant
- Toasts informativos

## Architecture

```
src/app/admin/integrations/salesforce/page.tsx
  → server component lee crm_connections del tenant

Components:
  src/components/integrations/salesforce-connection-form.tsx
    → wizard wrapper
  src/components/integrations/salesforce-env-toggle.tsx
    → sandbox vs prod
  src/components/integrations/salesforce-mode-selector.tsx
    → Lead vs Contact
  src/components/integrations/salesforce-mapping-table.tsx
    → field + stage mapping
  src/components/integrations/salesforce-webhook-instructions.tsx
    → collapsible doc Workflow Rule
```

## Related Code Files

**Crear:**
- `src/app/admin/integrations/salesforce/page.tsx`
- `src/components/integrations/salesforce-connection-form.tsx`
- `src/components/integrations/salesforce-env-toggle.tsx`
- `src/components/integrations/salesforce-mode-selector.tsx`
- `src/components/integrations/salesforce-mapping-table.tsx`
- `src/components/integrations/salesforce-webhook-instructions.tsx`
- `src/lib/actions/salesforce-connect.ts`

**Modificar:**
- `src/app/admin/integrations/page.tsx` (añadir card Salesforce)

## Implementation Steps

1. Page `salesforce/page.tsx` server component
2. Wizard wrapper componente
3. Env toggle con warning explícito
4. Botón OAuth → redirect `/start?env=...`
5. Tras callback: mostrar `instance_url` para confirmación
6. Mode selector Lead vs Contact con explicación
7. Mapping table con dropdowns por campo
8. Webhook instructions collapsible (markdown render)
9. Server action `saveSalesforceConfig`
10. Server action `disconnectSalesforce` con revoke (`POST oauth/revoke`)
11. Test connection button → call testConnection() del adapter
12. A11y audit + Playwright smoke

## Todo List

- [ ] Page Salesforce server component
- [ ] Wizard wrapper
- [ ] Env toggle sandbox/prod
- [ ] OAuth button con env param
- [ ] Confirm instance_url tras callback
- [ ] Mode Lead vs Contact
- [ ] Mapping table (Lead/Contact/Opp)
- [ ] Stage mapping para Opportunity
- [ ] Webhook instructions collapsible
- [ ] Test connection button
- [ ] Desconectar con revoke
- [ ] Toasts + loading states
- [ ] A11y check
- [ ] Playwright smoke

## Success Criteria

- Admin completa wizard sin errores con cuenta sandbox
- Mode Lead vs Contact aplicado en siguiente push
- Test connection devuelve OK con sandbox válido
- Webhook instructions claros (admin SF puede seguirlos)
- Desconectar revoca token y limpia estado

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Confusión sandbox vs prod | Alta | Alto | Warning UI + diferentes colores en badge |
| Mapping campos custom no documentado | Media | Medio | Permitir custom fields free-text + validación pre-push |
| Doc Workflow Rule muy técnica | Media | Bajo | Vídeo loom embebido (futuro) o screenshots step-by-step |

## Security Considerations

- Server actions con tenantId del usuario auth
- CSRF protection Next 16
- No exponer tokens
- Revoke token al desconectar

## Next Steps

- Habilita 5-07 (tests) que cubre flujo UI
