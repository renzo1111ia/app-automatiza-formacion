# E2E-260527-005-MED — `/dashboard/orchestrator` redirige a `/dashboard/onboarding` sin feedback

**Severity**: MED
**Fase**: 03 sweep dashboard
**Detección**: navegar como admin a `/dashboard/orchestrator` → URL final = `/dashboard/onboarding`.

## Esperado

- Si orchestrator requiere onboarding previo → mostrar toast/modal explicando "Completa el onboarding antes de acceder a workflows" + redirect explícito.
- Si es bug → no redirigir.

## Observado

Redirect silencioso sin mensaje al usuario. Consecuencia probable de [[E2E-260527-004-CRIT]] (React crash → boundary fallback hardcoded redirect).

## Impacto

- UX rota: usuario hace click en menú "Orchestrator", aparece "Onboarding" sin saber por qué.
- Si el feature gate es intencional, la implementación es incorrecta (debe ser explícita).

## Fix sugerido (no ejecutado)

1. Resolver primero [[E2E-260527-004-CRIT]].
2. Si tras resolver el crash sigue redirigiendo: añadir mensaje + log + comprobar lógica de gating onboarding.

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
