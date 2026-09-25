# E2E-260527-009-MED — `/api/version` retorna campos `commit`/`branch`/`deployedAt` como "unknown"

**Severity**: MED
**Fase**: 07 observability
**Detección**: GET `/api/version`.

## Esperado

```json
{
  "version": "0.3.0-rc.1",
  "commit": "e3f8e24",
  "branch": "feature/sprint-03-hardening",
  "deployedAt": "2026-05-27T12:00:00Z",
  "nodeVersion": "v24.13.0"
}
```

## Observado

```json
{
  "version": "0.3.0-rc.1",
  "commit": "unknown",
  "branch": "unknown",
  "deployedAt": "unknown",
  "nodeVersion": "v24.13.0"
}
```

## Impacto

- Imposible rastrear qué commit corre en local/VPS desde el endpoint.
- Útil para soporte cliente, debugging incidentes, validación deploy.
- En VPS probablemente igual de roto (mismo handler).

## Fix sugerido (no ejecutado)

En `src/app/api/version/route.ts`: leer `process.env.NEXT_PUBLIC_GIT_SHA`, `NEXT_PUBLIC_GIT_BRANCH`, `NEXT_PUBLIC_DEPLOYED_AT`. Poblar estas envs en build script (`next.config.ts` con `env:` field o GitHub Action que las inyecte).

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
