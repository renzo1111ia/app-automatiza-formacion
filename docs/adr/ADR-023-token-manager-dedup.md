# ADR-023 — TokenManager con Promise dedup in-process (MVP)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Sprint:** SP-3 (Sprint 2)
- **Deciders:** Javi HP

## Contexto

El antiguo `factory.ts` (Sprint 1) cacheaba la instance del provider con el `accessToken` embebido. Si N requests concurrentes encontraban un token expirado, las N llamaban a refresh → race condition → el primer refresh consumía el `refresh_token`, los siguientes recibían `invalid_grant` del provider (sobre todo Zoho que es estricto con el rate limit de refreshes: 10/10min).

Además, cuando un provider rotaba el `refresh_token` (HubSpot ocasionalmente), NO se persistía a DB. Tras un cold start, el sistema cargaba el viejo refresh_token y fallaba indefinidamente.

## Decisión

Crear `TokenManager` con:

1. **Cache in-memory** `Map<integrationId, TokenState>` con TTL implícito por `expiresAt` (5 min de buffer).
2. **Dedup lock** `Map<integrationId, Promise<TokenState>>` — cuando hay refresh in-flight, las requests concurrentes esperan al existente. Solo 1 llamada al provider OAuth endpoint.
3. **DB writeback automático**: cuando refresh devuelve nuevo `refresh_token` o `api_domain` (Zoho rotación de DC), `TokenManager` re-cifra y UPDATE inmediato a `integrations.credentials_cipher` + `metadata.api_domain`.
4. **Registry de refreshers** por `crm_type` — cada provider hace `registerRefresher('zoho', fn)` como side-effect al importar el archivo.

## Alternativas rechazadas

| Alternativa                                    | Razón rechazo                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Redis lock `SET NX EX 30`                      | YAGNI para MVP single-instance. Documentado como migración futura.                   |
| Token cache directo en cada provider class     | Romperíamos dedup cross-provider sobre la misma integration.                         |
| Refresh síncrono en cada `getValidTokens` call | Penaliza camino crítico (refresh ~200-500ms vs 0ms cache hit).                       |
| Sin DB writeback — solo cache memory           | Cold start tras rotación pierde el nuevo `refresh_token`. Reproduce el bug original. |

## Consecuencias

**Positivas:**

- N requests concurrentes → 1 refresh. Cero `invalid_grant` por race.
- Cold start tras redeploy: lee DB y arranca limpio (tokens persistidos correctos).
- Provider classes no necesitan duplicar cache logic — solo registrar su refresh callback.
- Test fácil: mockear `getValidTokens` para no hitting DB en provider tests.

**Negativas / costes:**

- Map in-process rompe en multi-instance horizontal. Migración a Redis cuando se escale (>1 réplica Next.js).
- Memory grows con número de integraciones activas (acceptable: <1KB por integration, <1000 tenants MVP).
- Test setup de dedup requiere `vi.useFakeTimers` para no esperar 5min real — cubierto en tests.

## Implementación

- `src/lib/integrations/crm/token-manager.ts` (cache + dedup + DB writeback).
- `src/lib/integrations/crm/providers/zoho.ts` + `hubspot.ts` registran refresher al final del archivo.
- `tests/integrations/crm/token-manager.test.ts` cubre dedup (5 promises concurrentes → 1 call).

## Migración futura (Sprint 3+ multi-instance)

```typescript
// Sustituir Map por Redis SETNX cuando escalemos horizontalmente.
const lockKey = `crm:refresh:${integrationId}`;
const acquired = await redis.set(lockKey, "1", "NX", "EX", 30);
if (!acquired) {
  // esperar y leer del cache (también en Redis con TTL).
}
```

API pública `getValidTokens(id)` no cambia — solo el storage backend.

## Referencias

- Research: `plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md` §5.
- Bug original Sprint 1: `invalid_grant` race condition en Zoho (notas internas).
