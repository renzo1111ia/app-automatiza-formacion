---
title: "4-05 — UI admin (formulario conexión + mapping)"
status: pending
priority: P2
estimation: 8-12h
phase_id: 4-05
sprint_id: SP-4
branch: feature/sprint-04-google-sheets
created: 2026-05-21
---

# Phase 05 — UI admin conexión Sheets (4-05)

## Context Links

- [plan.md](plan.md) — overview Sprint 4
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-01-google-sheets-bidireccional.md` (sección UI)
- Sprint 2 UI patterns: `../260520-1342-sprint-2-adapter-hubspot-zoho/phase-05-ui-admin-conexion-crm.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 4-01 + 4-02 + 4-03 + 4-04 (mínimo backend funcional)
- **Descripción:** Formulario de conexión Sheets en el panel admin reusando el componente genérico de Sprint 2. Permite: lanzar OAuth, elegir o crear spreadsheet, configurar mapping de columnas, ver estado de sync.

## Key Insights

- Reusar `ConnectionForm` genérico de Sprint 2 con variante `sheets`
- Después de OAuth callback exitoso, redirigir a paso 2: "elegir spreadsheet o crear desde plantilla"
- Mapping columnas: UI tipo tabla con dropdown (columna Sheet ↔ campo Esden)
- Estado de sync: badge live (last sync at, errores recientes, status)
- Botón "Test connection" que llama `SheetsAdapter.testConnection()`

## Requirements

**Funcionales:**

- Página `/admin/integrations/sheets` con flow wizard 3 pasos:
  1. OAuth consent → callback
  2. Elegir spreadsheet existente o crear desde plantilla
  3. Mapping de columnas + write_policy por campo
- Botón "Desconectar" → marca `status='revoked'` + revoca token en Google
- Badge de estado: `connected | revoked | error | syncing`
- Modal de errores recientes (últimos 10 de `crm_write_audit`)

**No funcionales:**

- Mobile-friendly (academias pequeñas operan desde móvil)
- Loading states + optimistic updates
- Toasts informativos (Tailwind + shadcn)

## Architecture

```
src/app/admin/integrations/sheets/page.tsx
  → server component que lee `crm_connections` del tenant
  → renderiza wizard según estado

Components:
  src/components/integrations/sheets-connection-form.tsx
    → wrapper de wizard
  src/components/integrations/sheets-step-oauth.tsx
    → botón "Conectar con Google" → redirect /api/oauth/google-sheets/start
  src/components/integrations/sheets-step-spreadsheet.tsx
    → opciones: usar existente (input ID) / crear desde plantilla
  src/components/integrations/sheets-step-mapping.tsx
    → tabla mapping columnas ↔ campos Esden + write_policy
  src/components/integrations/sheets-status-badge.tsx
    → live status
```

## Related Code Files

**Crear:**

- `src/app/admin/integrations/sheets/page.tsx`
- `src/components/integrations/sheets-connection-form.tsx`
- `src/components/integrations/sheets-step-oauth.tsx`
- `src/components/integrations/sheets-step-spreadsheet.tsx`
- `src/components/integrations/sheets-step-mapping.tsx`
- `src/components/integrations/sheets-status-badge.tsx`
- `src/lib/actions/sheets-connect.ts` (server actions)

**Modificar:**

- `src/app/admin/integrations/page.tsx` (añadir card Sheets)
- `src/lib/repositories/integrations-repository.ts` (queries específicas Sheets)

## Implementation Steps

1. Crear page `sheets/page.tsx` server component
2. Implementar step 1 (OAuth): botón redirect a `/api/oauth/google-sheets/start`
3. Implementar step 2 (spreadsheet): radio "existente" / "crear desde plantilla" + form
4. Implementar step 3 (mapping): tabla editable con drag-drop o select por fila
5. Server action `saveFieldMappings(tenantId, mappings)`
6. Server action `disconnectSheets(tenantId)` con revoke en Google
7. `sheets-status-badge.tsx` con polling 30s
8. Modal "Ver errores recientes" con queries `crm_write_audit`
9. Test E2E Playwright básico del flujo wizard
10. A11y check (labels, ARIA, keyboard nav)

## Todo List

- [ ] Page `sheets/page.tsx` server component
- [ ] Wizard wrapper `sheets-connection-form.tsx`
- [ ] Step OAuth con botón redirect
- [ ] Step spreadsheet (existente vs nueva)
- [ ] Step mapping columnas
- [ ] `saveFieldMappings()` server action
- [ ] `disconnectSheets()` con revoke
- [ ] `sheets-status-badge.tsx` con polling
- [ ] Modal errores recientes
- [ ] Toasts informativos
- [ ] Loading skeletons
- [ ] Test connection button
- [ ] A11y audit
- [ ] Playwright smoke test

## Success Criteria

- Admin completa los 3 pasos del wizard sin errores
- Estado de sync reflejado en badge en < 30s
- Mapping de columnas persistido y aplicado en siguiente push
- "Test connection" devuelve OK con token válido, error claro si revocado
- Mobile responsive sin overflow

## Risk Assessment

| Riesgo                                       | Prob  | Impacto | Mitigación                                      |
| -------------------------------------------- | ----- | ------- | ----------------------------------------------- |
| Mapping confuso para usuarios no técnicos    | Alta  | Medio   | Wizard guiado + tooltips + defaults razonables  |
| Spreadsheet existente sin columnas esperadas | Media | Medio   | Validar headers con `verifyTemplateStructure()` |
| Polling status genera carga                  | Baja  | Bajo    | Polling 30s + websocket en fase futura          |

## Security Considerations

- Server actions verifican `tenantId` del usuario autenticado
- No exponer tokens en cliente bajo ninguna circunstancia
- CSRF protection en server actions Next 16
- Revoke token al desconectar (call a Google revocation endpoint)

## Next Steps

- Habilita test manual del Sprint completo
- Conecta con 4-06 (audit log para mostrar historial)
