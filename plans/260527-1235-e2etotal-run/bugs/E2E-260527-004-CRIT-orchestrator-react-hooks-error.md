# E2E-260527-004-CRIT — `/dashboard/orchestrator` crash React: "Rendered more hooks than during the previous render"

**Severity**: CRIT
**Fase**: 03 sweep dashboard
**Detección**: navegar como admin a `/dashboard/orchestrator` → React lanza hook-order violation y la página redirige silenciosamente a `/dashboard/onboarding`.

## Esperado

Página `/dashboard/orchestrator` carga el workflow builder visualmente.

## Observado

1. React error en console:
   ```
   Error: Rendered more hooks than during the previous render.
     at updateWorkInProgressHook
     at updateMemo
     at Object.useMemo
     at Router (next/dist/client/...)
   ```
2. URL del browser termina en `/dashboard/onboarding`, NO en `/orchestrator`. Sin mensaje al usuario.
3. Probable causa: componente con hooks condicionales (`if (x) useEffect(...)` o similar).

## Comando para reproducir

Login como admin → navegar a `/dashboard/orchestrator` → ver console + URL final.

## Impacto

- Feature **workflow builder** completamente inaccesible.
- UX confusa: usuario click en "Orchestrator" → aterriza en "Onboarding" sin explicación.
- Riesgo SEO/perfil: ruta documentada como existente está rota.

## Fix sugerido (no ejecutado)

Auditar `src/app/dashboard/orchestrator/page.tsx` y sus child components. Buscar early returns ANTES de hooks, o hooks dentro de condicionales. Aplicar regla React: TODOS los hooks deben llamarse en el mismo orden en cada render.

## Bug relacionado

E2E-260527-005-MED-orchestrator-silent-redirect (mismo origen, distinto síntoma)

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
