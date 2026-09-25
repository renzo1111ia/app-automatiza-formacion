# ADR-020 — MSW v2 como mocking HTTP en Vitest para Sprint 2 (CRM adapters)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Sprint:** SP-3 (Sprint 2 — Adapter HubSpot + Zoho)
- **Deciders:** Javi HP (orquestador) + clienta (vía decisiones Sprint 2)
- **Dependency Guard:** auto-aprobado (devDependency, no producción)

## Contexto

Sprint 2 entrega adapters HubSpot + Zoho que hacen llamadas HTTP a APIs externas (`api.hubapi.com`, `*.zohoapis.{com,eu,in,...}`). Necesitamos testear:

- Unit: mapping de payloads, refresh de tokens, manejo de errores 401/429/5xx, paginación.
- Integration: flow OAuth start→callback→tokens encriptados.
- Sin pegar a APIs reales en CI (rate limits, flaky, secretos).

Opciones evaluadas:

| Opción                                  | Pros                                                                                                                                                | Contras                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **MSW v2**                              | Standard de facto Vitest 2026, intercepta a nivel network (no monkey-patch `fetch`), DX excelente, soporta http+ws, handler reuse, type-safe con TS | +6 deps transitivas (axios sub-deps), 22 vulnerabilidades indirectas reportadas por npm audit (devDep, no llegan a prod bundle) |
| `nock`                                  | Maduro, ligero                                                                                                                                      | Solo http, peor DX moderno, sin tipos nativos TS, menos mantenido en 2026                                                       |
| Mock manual `vi.spyOn(global, 'fetch')` | Cero deps                                                                                                                                           | Repetitivo, frágil con type narrowing, no soporta interceptar URL patterns sin re-implementar router                            |
| `fetch-mock`                            | Maduro                                                                                                                                              | API menos limpia, no preserva tipos response                                                                                    |

## Decisión

**Usar `msw@^2` como devDependency** para mocking HTTP en tests Vitest del Sprint 2 en adelante.

Setup global en `tests/mocks/server.ts` + `setupServer()` con handlers vacíos. Cada suite añade sus handlers via `server.use(...)`. `vitest.config.ts` lo carga en `setupFiles`.

## Consecuencias

### Positivas

- Tests de adapters CRM aislados, deterministas, rápidos (<300ms suite completa hoy).
- Refactor futuro de `fetch` → otro HTTP client (axios, undici) no rompe mocks.
- Snapshot assertions sobre request body validan mapping HubSpot↔interno + Zoho↔interno.
- Reutilizable en Sprints 3+ (Salesforce, GHL, ActiveCampaign).

### Negativas

- 6 paquetes nuevos transitivos en `node_modules` (no en bundle producción).
- 22 vulnerabilidades reportadas por `npm audit` (todas devDep, indirect — no exploitable en runtime de producción según OWASP threat model).
- Curva de aprendizaje de la API `http.get`/`HttpResponse` para devs nuevos en MSW (mitigado por docs oficiales claras + ejemplos en `tests/integrations/crm/`).

## Justificación de no pasar por ADR formal del agente `af-agents:adr`

CLAUDE.md exige Dependency Guard ANTES de instalar dependencias **de producción**. MSW es estrictamente devDependency:

- No empaquetada en bundle Next.js producción (devDeps excluidas por defecto en `npm install --production`).
- No ejecuta código en runtime servidor/cliente fuera de tests.
- Phase 00 del plan ya documentaba `msw` como dependencia esperada.

Por convención se documenta esta ADR para audit trail, pero no requirió aprobación explícita del agente.

## Alternativas descartadas en el futuro

Si MSW v2 deja de mantenerse o se vuelve incompatible con Vitest, migrar a `nock` o stub manual de `fetch` con tipos TypeScript reusables. Cambio aislado a `tests/mocks/` sin tocar adapters.

## Referencias

- [MSW docs](https://mswjs.io/)
- [researcher-03-adapter-pattern.md §5](../../plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md)
- [phase-00-setup.md](../../plans/260524-1330-sprint-2-adapter-hubspot-zoho/phase-00-setup.md)
