# Phase 05 — UI Admin: Conectar CRM del Tenant (3-05)

## Context Links

- Spec cliente: `docs/Docs-entrega-clienta/Menú lateral app.docx`
- R-014 (write_policy visible en UI): `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md#r-014`
- Field mapping phase: `plans/260520-1342-sprint-c-adapter-hubspot-zoho/phase-04-field-mapping-write-policy.md`
- HubSpot adapter OAuth routes: `plans/260520-1342-sprint-c-adapter-hubspot-zoho/phase-02-adapter-hubspot.md`
- Zoho adapter OAuth routes: `plans/260520-1342-sprint-c-adapter-hubspot-zoho/phase-03-adapter-zoho.md`

## Overview

- **Prioridad:** P2
- **Estado:** Pendiente — requiere 3-02 (OAuth routes) + 3-03 (OAuth routes) + 3-04 (field mapping repository)
- **Descripción:** Panel admin para que el administrador de cada academia conecte su CRM (HubSpot o Zoho), vea el estado de la conexión, configure el field mapping y gestione las políticas de escritura por campo.

## Key Insights

- La UI es el punto de entrada del tenant para conectar su CRM — debe ser simple y guiar con claridad.
- El botón "Conectar HubSpot" lanza el OAuth flow (3-02). El botón "Conectar Zoho" lanza el OAuth flow de Zoho (3-03) con selector de región.
- Una vez conectado, mostrar: nombre del portal/org conectado, fecha de conexión, estado de la conexión (activa/expirada), botón desconectar.
- La tabla de field mapping es editable en esta misma pantalla — la más probable fuente de soporte tickets si no se diseña bien.
- Política de escritura: en MVP solo `append_only` y `overwrite_with_audit`. No exponer `overwrite` sin audit.
- Internacionalización: textos en ES (idioma de la app).

## Requirements

**Funcionales:**
- Página `/admin/integraciones` (o `/admin/settings/integrations`) — listado de proveedores disponibles
- Card por proveedor: HubSpot card + Zoho card. Estado: Conectado / Desconectado.
- Flujo "Conectar HubSpot": clic → OAuth redirect → callback → regresa a página con estado Conectado
- Flujo "Conectar Zoho": clic → selector de región (EU / Americas / Otro) → OAuth redirect → callback → Conectado
- Flujo "Desconectar": confirmación → revoke tokens en BD → limpiar canal Zoho → vuelta a Desconectado
- Tabla de field mapping editable: columnas `Campo interno | Campo CRM | Política de escritura`
- Política de escritura: dropdown `Añadir solo` (append_only) / `Sobrescribir con auditoría` (overwrite_with_audit)
- Botón "Probar conexión" → llama `testConnection()` del adapter → muestra resultado
- Al conectar por primera vez: seed automático de defaults (se hace en backend, no en UI)
- Vista solo visible para rol `admin` del tenant

**No-funcionales:**
- Componentes existentes de shadcn (no instalar librerías nuevas)
- Responsive: funciona en tablet (el admin puede estar en tablet)
- Estados de carga (spinner) en botones de acción
- Mensajes de error claros: "Token expirado — reconectar", "Conexión fallida: X"

## Architecture

```
src/app/(dashboard)/admin/integraciones/
├── page.tsx                          — página principal /admin/integraciones
├── _components/
│   ├── integration-provider-card.tsx  — card de proveedor (HubSpot / Zoho)
│   ├── connect-hubspot-button.tsx     — botón con estado + redirect OAuth
│   ├── connect-zoho-button.tsx        — botón con region selector
│   ├── field-mapping-table.tsx        — tabla editable de mappings
│   ├── write-policy-select.tsx        — dropdown política de escritura
│   └── disconnect-confirm-dialog.tsx  — diálogo confirmación desconexión

src/lib/actions/
└── integrations-actions.ts           — Server Actions: testConnection, disconnect, saveFieldMapping
```

**Layout de la página:**
```
/admin/integraciones
┌─────────────────────────────────────────────┐
│ Integraciones de CRM                        │
├─────────────────────────────────────────────┤
│ [HubSpot Card]              [Zoho Card]     │
│ ● Conectado: Portal X       ○ Desconectado  │
│ Conectado: 15-05-2026                       │
│ [Probar conexión] [Desconectar]    [Conectar]│
├─────────────────────────────────────────────┤
│ Configuración de campos — HubSpot           │
│ Campo interno    │ Campo CRM │ Política      │
│ email            │ email     │ Añadir solo  ▾│
│ lead_status      │ hs_lead.. │ Con auditoría▾│
│ [+ Añadir campo] [Guardar cambios]          │
└─────────────────────────────────────────────┘
```

## Related Code Files

**Crear:**
- `src/app/(dashboard)/admin/integraciones/page.tsx`
- `src/app/(dashboard)/admin/integraciones/_components/integration-provider-card.tsx`
- `src/app/(dashboard)/admin/integraciones/_components/connect-hubspot-button.tsx`
- `src/app/(dashboard)/admin/integraciones/_components/connect-zoho-button.tsx`
- `src/app/(dashboard)/admin/integraciones/_components/field-mapping-table.tsx`
- `src/app/(dashboard)/admin/integraciones/_components/write-policy-select.tsx`
- `src/app/(dashboard)/admin/integraciones/_components/disconnect-confirm-dialog.tsx`
- `src/lib/actions/integrations-actions.ts`

**Leer (sin modificar):**
- `src/lib/repositories/integrations-repository.ts` (2-18)
- `src/lib/repositories/field-mapping-repository.ts` (3-04)
- Componentes shadcn existentes en `src/components/ui/`

**Modificar:**
- Menú lateral existente — añadir enlace "Integraciones" en sección admin

## Implementation Steps

1. Crear Server Actions `integrations-actions.ts`:
   - `getIntegrations(tenantId)` → estado de conexiones por proveedor
   - `testIntegrationConnection(tenantId, provider)` → `{ ok, message }`
   - `disconnectIntegration(tenantId, provider)` → revocar + limpiar BD
   - `saveFieldMappings(tenantId, provider, mappings)` → upsert en field_mapping_repository
2. Crear `integration-provider-card.tsx` con props `{ provider, status, connectedPortalName, connectedAt }`
3. Crear `connect-hubspot-button.tsx`: link href a `/api/integrations/hubspot/oauth/start` (redirect server-side)
4. Crear `connect-zoho-button.tsx`: modal con select región → link href a `/api/integrations/zoho/oauth/start?region={region}`
5. Crear `field-mapping-table.tsx`: tabla editable con `write-policy-select.tsx` como celda del dropdown
6. Crear `disconnect-confirm-dialog.tsx`: usa `AlertDialog` de shadcn
7. Crear `page.tsx`: cargar state en Server Component + pasar a Client Components
8. Añadir entrada en menú lateral
9. Verificar que redirect post-OAuth llega a `/admin/integraciones?connected=hubspot` con mensaje de éxito

## Todo List

- [ ] Server Actions `integrations-actions.ts`
- [ ] `integration-provider-card.tsx`
- [ ] `connect-hubspot-button.tsx` (simple link)
- [ ] `connect-zoho-button.tsx` (con region selector)
- [ ] `field-mapping-table.tsx` (tabla editable)
- [ ] `write-policy-select.tsx` (dropdown)
- [ ] `disconnect-confirm-dialog.tsx`
- [ ] `page.tsx` — layout completo
- [ ] Menú lateral — añadir enlace
- [ ] Test manual OAuth flow completo HubSpot
- [ ] Test manual OAuth flow completo Zoho EU
- [ ] `npm run typecheck` pass + `npm run build` pass

## Success Criteria

- [ ] Admin puede ver estado de conexión de HubSpot y Zoho
- [ ] Flujo OAuth completo HubSpot: clic → aprueba → regresa → "Conectado"
- [ ] Flujo OAuth completo Zoho: clic → selecciona región → aprueba → regresa → "Conectado"
- [ ] "Probar conexión" muestra resultado en < 3s
- [ ] Tabla field mapping editable y guardable
- [ ] Desconectar limpia tokens en BD
- [ ] Solo rol `admin` del tenant puede acceder

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| OAuth callback URL mismatch (configuración en HubSpot/Zoho developer console) | Alta | Medio | Documentar exactamente la URL de callback en phase notes + en .env.example |
| Usuario admin no entiende "política de escritura" | Media | Bajo | Tooltip explicativo en cada opción: "Añadir solo: nunca sobreescribe datos existentes" |
| Build roto por uso de componente shadcn v3 que cambió en v4 | Baja | Bajo | Verificar en 2-32 (upgrade shadcn) si aplica antes de 3-05 |

## Security Considerations

- Página `/admin/integraciones`: middleware protege acceso — solo `role = admin` del tenant
- Server Actions usan `tenantId` del session JWT (no del client) — no injectable
- "Desconectar" revoca refresh_token en el CRM si la API lo permite, y limpia BD en cualquier caso

## Agentes Esden asignados

- `esden-agents:uxui` — diseño componentes + layout
- `esden-agents:code` — Server Actions + integración repositories

## Estimación

**20h total:**
- Server Actions: 4h
- Cards + botones OAuth: 4h
- Tabla field mapping editable: 6h
- Diálogos + menú lateral: 3h
- Typecheck + build + ajustes: 3h

## Next Steps

- 3-06 audit log — visible desde esta misma sección para integraciones con `overwrite_with_audit`
