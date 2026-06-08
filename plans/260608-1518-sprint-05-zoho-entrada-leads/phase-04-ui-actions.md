# Fase 04 — UI configuración + Server Actions

**Contexto:** [plan.md](plan.md) · referencia `src/app/dashboard/settings/integrations/google-sheets/*` + `src/lib/integrations/sheets/actions.ts`

## Overview

- **Prioridad:** P1
- **Estado:** 🔘 Pendiente · depende de Fases 01-03
- **Estimación:** 2-3h
- UI para que el tenant active Zoho como fuente de entrada de leads, configure el mapeo de campos y dispare pull manual. **Más simple que el wizard de Sheets**: Zoho ya tiene OAuth conectado (Sprint 2), no hay Picker de "hoja".

## Key Insights

- La conexión OAuth Zoho ya existe (Sprint 2). Esta UI **no repite el OAuth** — solo configura el pull de entrada sobre la integración Zoho ya conectada.
- Sin Google Picker: el tenant elige criterios de búsqueda (módulo Leads + filtro) y el mapeo de campos Zoho → AF.
- Reutilizar componentes existentes del área de integraciones CRM (`crm-section.tsx`, `write-policy-editor.tsx` si aplica).

## Requirements

**Funcionales:**

- Página `/dashboard/settings/integrations/zoho-pull` (o pestaña dentro de la sección Zoho existente).
- Mostrar si Zoho está conectado (si no → CTA a conectar OAuth, Sprint 2).
- Configurar: criterio de pull, `field_mapping` (editor), toggle `writeback_enabled`, toggle `is_active`.
- Botón "Sincronizar ahora" (pull manual) + estado de última sync + `last_sync_error`.

**No funcionales:** auth obligatoria (Server Actions resuelven tenant del usuario, nunca aceptan `tenant_id` del cliente); WCAG 2.2 AA en la página.

## Related Code Files

**Crear:**

- `src/lib/integrations/zoho-pull/actions.ts` — Server Actions: `getZohoSyncStatusAction`, `saveZohoSyncConfigAction` (criterio + mapping), `toggleZohoSyncActiveAction`, `toggleZohoWritebackAction`, `triggerManualZohoPullAction`, `suggestZohoFieldMappingAction`.
- `src/app/dashboard/settings/integrations/zoho-pull/page.tsx` — Server Component, carga estado.
- `src/app/dashboard/settings/integrations/zoho-pull/ZohoSyncClient.tsx` — Client Component: config + estado + botón sync.
- `src/app/dashboard/settings/integrations/zoho-pull/ZohoFieldMappingEditor.tsx` — editor de mapeo Zoho field → AF target.

**Leer para contexto:**

- `src/app/dashboard/settings/integrations/google-sheets/SheetsWizardClient.tsx` + `SheetMappingEditor.tsx` (patrón UI).
- `src/lib/integrations/sheets/actions.ts` (patrón Server Actions + `requireCurrentTenant`).
- `src/lib/integrations/crm/server-actions.ts` (helpers `requireTenantId`, `getIntegrationByProvider`).

## Architecture

```
page.tsx (server) ──► getZohoSyncStatusAction()
   │                       (¿Zoho conectado? config actual + última sync)
   ▼
ZohoSyncClient.tsx
   ├─ si NO conectado → CTA "Conectar Zoho" (link a OAuth Sprint 2)
   ├─ ZohoFieldMappingEditor (Zoho field → AF target, writeback per field)
   ├─ toggles: is_active / writeback_enabled
   └─ "Sincronizar ahora" → triggerManualZohoPullAction() → enqueueZohoPull()
```

## Implementation Steps

1. **`actions.ts`**: cada action usa `requireTenantId()`/`requireCurrentTenant()`, resuelve la integración Zoho del tenant, lee/escribe `zoho_sync_connections`. `triggerManualZohoPullAction` → `enqueueZohoPull(integrationId)`. `suggestZohoFieldMappingAction` → llama `provider` para listar campos de Zoho y sugerir mapping.
2. **`page.tsx`**: server component, `getZohoSyncStatusAction()`, render `ZohoSyncClient`.
3. **`ZohoSyncClient.tsx`**: estado conectado/no, editor de mapping, toggles, botón sync con feedback (toast). Reutilizar el sistema de toast del proyecto (Sprint 1).
4. **`ZohoFieldMappingEditor.tsx`**: lista de filas (campo Zoho → target AF + writeback checkbox), añadir/eliminar/editar.
5. Verificar registro de la ruta en la navegación de settings de integraciones.
6. typecheck + lint + build.

## Todo List

- [ ] `zoho-pull/actions.ts` (6 Server Actions con tenant scoping)
- [ ] `page.tsx` server component
- [ ] `ZohoSyncClient.tsx`
- [ ] `ZohoFieldMappingEditor.tsx`
- [ ] Integrar en navegación de settings + toasts
- [ ] typecheck + lint + build verdes

## Success Criteria

- Tenant con Zoho conectado ve la página de configuración de entrada.
- Tenant sin Zoho conectado ve CTA para conectar (no error).
- Guardar mapping persiste en `zoho_sync_connections`.
- "Sincronizar ahora" encola un pull y muestra feedback.
- Página sin sesión redirige a /login (no fuga de datos).

## Risk Assessment

- **Acoplamiento con la UI Zoho existente (Sprint 2)**: decidir si es página nueva o pestaña en la sección Zoho. Recomendación: página/pestaña separada "Entrada de leads" para no tocar la UI de salida ya estable.

## Security Considerations

- Server Actions nunca aceptan `tenant_id` del cliente (resuelven del usuario autenticado).
- Página protegida por auth (redirige a /login).

## Next Steps

- Fase 05: tests unitarios + E2C + cierre del sprint (CLOSE-1/1.5/2/4/5 + bump v0.5.0).
