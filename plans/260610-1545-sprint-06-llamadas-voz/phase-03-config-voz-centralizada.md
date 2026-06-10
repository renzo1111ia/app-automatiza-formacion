# Fase 03 — Config de voz centralizada en `/dashboard/voice-agents`

## Context Links

- Plan: [plan.md](plan.md)
- Página config voz (real): `src/app/dashboard/voice-agents/page.tsx` (~1554 líneas) + `RetellConfigModal.tsx`
- Server actions: `src/lib/actions/voice-agents.ts`, `retell-sync.ts`, `ultravox-sync.ts`
- Sidebar: `src/components/layout/Sidebar.tsx:72-76` ("Agentes de Voz" → `/dashboard/voice-agents`)

## Overview

- **Prioridad**: Media.
- **Status**: 🔘 Pendiente.
- **Descripción**: Garantizar que **toda** la configuración de agentes de voz vive en
  `/dashboard/voice-agents` (orden de Javi HP). Auditar y consolidar cualquier config de voz dispersa.

## Key Insights

- `/dashboard/voice-agents` ya es la página real de config (Retell + Ultravox, variantes A/B, prompts,
  voces, números, sync de recursos, visor de transcripciones). El sidebar ya apunta ahí desde "Agentes de Voz".
- El trabajo aquí es **auditoría + consolidación**, no construcción desde cero: localizar si hay piezas de
  config de voz fuera (p.ej. en Constructor, `agents/`, `simulator/`, `settings/`) y moverlas/enlazarlas.

## Requirements

**Funcionales**

- Un usuario encuentra y edita TODA la config de agentes de voz desde `/dashboard/voice-agents`.
- Si existe config de voz en otra pantalla, se mueve aquí o se reemplaza por un enlace a aquí.

**No funcionales**

- No romper flujos existentes de Retell/Ultravox.
- Mantener archivos <200 líneas en lo nuevo; la página existente ya es grande (no se trocea salvo necesidad).

## Architecture

```
/dashboard/voice-agents  ← ÚNICO punto de configuración de voz
  ├─ Agentes (CRUD, provider RETELL|ULTRAVOX)
  ├─ Prompts / Config A/B (variantes)
  ├─ Voces / Números (sync de recursos)
  ├─ API keys (RetellConfigModal)
  └─ (consolidado) cualquier ajuste de voz que estuviera en Constructor/Settings/Simulator
```

## Related Code Files

**Auditar (grep de config de voz fuera de voice-agents)**

- `src/app/dashboard/agents/**`, `src/app/dashboard/playground/**`, `src/app/dashboard/simulator/**`,
  `src/app/dashboard/settings/**`, `src/app/dashboard/orchestrator/**`, `src/app/dashboard/web-chatbot/**`.

**Modificar (según hallazgos)**

- Mover/enlazar piezas de config de voz a `voice-agents/`.
- `src/components/layout/Sidebar.tsx` — confirmar que "Agentes de Voz" es el único acceso a config de voz.

## Implementation Steps

1. Auditoría: `grep` por `voice|retell|ultravox|voz|agente de voz|from_number|voice_id` en `src/app/dashboard/**`
   excluyendo `voice-agents/` y `conversaciones-voz/`. Listar config dispersa real (no consumo, solo config).
2. Para cada pieza encontrada: decidir mover a `voice-agents/` o reemplazar por enlace.
3. Aplicar la consolidación con cambios mínimos.
4. Verificar que no quedan rutas alternativas de configuración de voz.

## Todo List

- [ ] Auditoría de config de voz dispersa.
- [ ] Consolidar/enlazar a `/dashboard/voice-agents`.
- [ ] Confirmar acceso único desde sidebar.
- [ ] Smoke test de Retell/Ultravox config tras consolidar.

## Success Criteria

- No existe configuración de agentes de voz fuera de `/dashboard/voice-agents`.
- Los flujos Retell/Ultravox siguen funcionando (crear/editar agente, sync, API key).

## Risk Assessment

- **Alcance abierto**: la auditoría puede no encontrar nada disperso (la config ya podría estar centralizada),
  en cuyo caso esta fase se reduce a verificación + nota. Tiempo se ajusta a la baja.
- **Mover config con estado**: si se mueve UI con lógica, riesgo de romper sync. Mitigación: enlazar en vez de mover cuando el coste de mover sea alto.

## Security Considerations

- API keys de Retell/Ultravox: nunca exponerlas en cliente; mantener el patrón actual del `RetellConfigModal`.

## Next Steps

- Independiente de fases 01/02/04; puede ejecutarse en paralelo.
