# Phase B — Bug fixes + empty states audit

**Tiempo:** 1.5-2h
**Bloquea:** Phase D (necesitas páginas sin crashes para que los screenshots salgan bien).
**Dependencias:** Phase A DONE.

## Objetivo

Que CUALQUIER página del dashboard responda con UX dignified cuando:

1. La BD no tiene datos para esa sección → empty state amistoso, NUNCA alert/error
2. Una acción admin requiere config que no está → graceful message, NUNCA alert/error
3. Una llamada falla por schema cache / RLS → fallback con retry o mensaje, NUNCA alert/error

## Bugs específicos detectados (TODOS)

### B.1 — Alerts en AIAgentInbox.tsx

Sustituir TODOS los `alert(...)` por toast o inline-error.

Ubicaciones (verificadas en sesión anterior):

- [src/components/agents/AIAgentInbox.tsx:536](src/components/agents/AIAgentInbox.tsx#L536) `alert(res.error)`
- [src/components/agents/AIAgentInbox.tsx:550](src/components/agents/AIAgentInbox.tsx#L550) `alert(res.error)`
- [src/components/agents/AIAgentInbox.tsx:563](src/components/agents/AIAgentInbox.tsx#L563) `alert(res.error)`
- [src/components/agents/AIAgentInbox.tsx:588](src/components/agents/AIAgentInbox.tsx#L588) `alert("Error al eliminar lead: " + res.error)`
- [src/components/agents/AIAgentInbox.tsx:601](src/components/agents/AIAgentInbox.tsx#L601) `alert("Error al vaciar chat: " + res.error)`
- [src/components/agents/AIAgentInbox.tsx:652](src/components/agents/AIAgentInbox.tsx#L652) `alert("Error al guardar flujo: " + res.error)`
- [src/components/agents/AIAgentInbox.tsx:1163](src/components/agents/AIAgentInbox.tsx#L1163) `alert("Error al guardar segmentación: " + res.error)`
- [src/components/agents/AIAgentInbox.tsx:1192](src/components/agents/AIAgentInbox.tsx#L1192) `alert("Error al actualizar teléfono: " + res.error)`
- [src/components/agents/AIAgentInbox.tsx:1222](src/components/agents/AIAgentInbox.tsx#L1222) `alert("Error al borrar variables: " + res.error)`

Verificar también con `grep -rnE "alert\(|window\.alert" src/` si hay más en otros archivos.

**Implementación**: usar la librería ya existente del proyecto. Buscar primero `sonner` o `react-hot-toast` en `package.json`. Si no hay, añadir un wrapper simple `src/lib/ui/toast.ts` que use el componente `<Toast>` ya en `src/components/ui/`. Si tampoco existe → crear toast component (Radix UI + Tailwind, accesible WCAG 2.2 AA: `role="alert"` + `aria-live="polite"`).

### B.2 — Empty state AIAgentInbox cuando 0 conversaciones

Si `leads.length === 0` y `loading === false`, mostrar:

```tsx
<EmptyState
  icon={<MessageSquare className="h-16 w-16 text-slate-300" />}
  title="Aún no hay conversaciones"
  description="Cuando un lead inicie un chat por WhatsApp o web, aparecerá aquí."
  action={
    <Button onClick={() => setIsCreateLeadModalOpen(true)}>
      <PlusCircle className="mr-2 h-4 w-4" />
      Crear lead manualmente
    </Button>
  }
/>
```

Crear `src/components/ui/EmptyState.tsx` reutilizable (si no existe ya).

### B.3 — Bug `Orchestration disabled for tenant`

El alert dispara cuando el componente intenta crear un workflow auto en mount, pero el flag `tenants.config.test_orchestrator_enabled` está `false` para los tenants seed.

Opciones de fix (escoger UNA — preferida la 1):

1. **Recomendada**: el componente NO debe crear workflow auto en mount. Detectar el flag antes y mostrar:
   ```tsx
   {
     !tenantConfig.test_orchestrator_enabled && (
       <EmptyState
         title="Orquestador de flujos desactivado"
         description="Activa el orquestador en Ajustes para crear workflows automatizados."
         action={<Link href="/dashboard/settings/orchestrator">Ir a Ajustes</Link>}
       />
     );
   }
   ```
2. Activar el flag por defecto en seed-demo.ts:
   ```ts
   config: { ..., test_orchestrator_enabled: true }
   ```
   Y re-aplicar seed en LOCAL + VPS.

Hacer AMBAS: opción 1 es la UX correcta + opción 2 es para que la UI demo del seed funcione sin tener que tocar el flag manualmente.

### B.4 — Bug schema cache `web_widgets.updated_at`

Error: `Could not find the 'updated_at' column of 'web_widgets' in the schema cache`.

Causas posibles:

- Columna no existe en VPS (LOCAL sí). Verificar: `SELECT column_name FROM information_schema.columns WHERE table_name='web_widgets';` contra VPS via REST API.
- O columna existe pero PostgREST tiene cache stale. Solución: enviar request a `/supabase/rest/v1/` con header `Prefer: schema=public` o esperar a que PostgREST reconstruya.
- O hay migration faltante. Verificar `supabase/migrations/*web_widgets*` y ver si `updated_at` está.

**Pasos**:

1. Inspeccionar todas las migrations `supabase/migrations/*web_widgets*` para confirmar que `updated_at` está definida.
2. Si no está → crear migration `supabase/migrations/<ts>_add_web_widgets_updated_at.sql`:
   ```sql
   ALTER TABLE web_widgets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
   CREATE OR REPLACE TRIGGER trg_web_widgets_updated_at
     BEFORE UPDATE ON web_widgets
     FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
   ```
   (Verificar que `moddatetime` extension está activa; si no usar trigger funcional propio.)
3. Aplicar migration LOCAL (`npx supabase migration up`) y VPS (via REST API o psql tunnel).
4. Forzar reload schema cache PostgREST: `NOTIFY pgrst, 'reload schema';` (vía SQL).

### B.5 — Empty state audit otras páginas

Revisar TODAS las páginas dashboard y añadir empty state si no lo tienen. Lista:

- `/dashboard` — métricas a 0: ya está OK (muestra "0" en cards), pero validar que no tira errores.
- `/dashboard/calls` — si no hay llamadas, debe decir "Sin llamadas registradas".
- `/dashboard/historial` — empty state si no hay historial.
- `/dashboard/calendar` — empty state si no hay agendamientos.
- `/dashboard/whatsapp` — empty state si no hay convos.
- `/dashboard/campanas` — empty state si no hay campañas + CTA "Crear primera campaña".
- `/dashboard/agents` — empty state si no hay agentes IA.
- `/dashboard/voice-agents` — idem.
- `/dashboard/web-chatbot` — idem.
- `/dashboard/knowledge` — idem.
- `/dashboard/playground` — qué hace cuando no hay agente seleccionado.
- `/dashboard/simulator` — idem.
- `/dashboard/onboarding` — idem.
- `/dashboard/admin` — empty state RLS si no hay datos cross-tenant.
- `/dashboard/orchestrator` — relacionado con B.3.
- `/dashboard/settings` — admin-only, validar viewer user redirige bien.
- `/dashboard/minutos`, `/dashboard/costs`, `/dashboard/logs` — idem.
- `/dashboard/demo` — qué hace.

**Estrategia**: en lugar de revisar 23 páginas una por una manualmente, lanzar `af-agents:uxui` o `af-agents:code` con un Task que recorra `src/app/dashboard/**/page.tsx` + componentes principales, detecte casos de "sin datos" y proponga / aplique empty states.

## Acceptance criteria Phase B

- [ ] 0 llamadas a `alert()` o `window.alert()` en src/ (verificar con grep)
- [ ] AIAgentInbox muestra empty state limpio cuando no hay convos
- [ ] /conversaciones no dispara dialogs al cargar (B.3 resuelto)
- [ ] Migration de `web_widgets.updated_at` aplicada LOCAL + VPS (B.4 resuelto)
- [ ] Mínimo 10 páginas dashboard con empty state implementado (B.5)
- [ ] WCAG 2.2 AA: los empty states tienen `role="status"` o equivalente, contraste suficiente, focus visible en botones de acción
- [ ] Tests local (npm run typecheck + npm run build) pasan
- [ ] Tests Playwright smoke: navegar a las 5 páginas principales después de fresh seed, 0 console errors, 0 dialogs no esperados
- [ ] Commit + push: `fix(ui): replace alert() with toast + empty states across dashboard`

## Plan de ataque

1. (15 min) Crear `EmptyState` component reutilizable + toast wrapper.
2. (30 min) AIAgentInbox: fix B.1 + B.2 + B.3 en un solo barrido.
3. (15 min) B.4: investigar + migration + aplicar.
4. (30-60 min) B.5: delegar a `af-agents:code` o hacer manualmente las 10+ páginas restantes.
5. (10 min) Tests + commit + push.

## Output

Actualizar `execution-log.md` por cada bug B.X resuelto con: ubicación del fix + cambios + status.
