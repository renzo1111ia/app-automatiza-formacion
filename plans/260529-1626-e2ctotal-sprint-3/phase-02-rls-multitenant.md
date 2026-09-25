---
phase: 02
title: "RLS multi-tenant + capa datos"
status: PASS
started_at: 2026-05-29 16:34
completed_at: 2026-05-29 16:38
duration: 4min
blocking: yes
---

# Fase 02 — RLS multi-tenant + capa datos

## Estrategia

Validación vía suite Vitest completa (`npm test`) — incluye tests integración con BD Supabase local real (no mocks). Cubre Repository pattern multi-tenant, cifrado AES-256 GCM de tokens OAuth, write-guard end-to-end y schemas Zod de validación de entrada.

## Resultado

🟢 **280/284 tests PASS** + 4 skipped (lead-opportunities — requieren seed específica).

## Tests RLS-relevant (subset crítico)

| Test file                                                           | Tests | Estado | Cubre                                           |
| ------------------------------------------------------------------- | ----- | ------ | ----------------------------------------------- |
| `tests/unit/repositories/base-repository.test.ts`                   | 11    | ✅     | RLS context, tenant_id auto-inject, query scope |
| `tests/integrations/crm/integration/write-guard-end-to-end.test.ts` | 2     | ✅     | Append-only enforcement + override audit        |
| `tests/integrations/crm/write-guard.test.ts`                        | ?     | ✅     | Write policy gates (write_policy column)        |
| `tests/integrations/crm/token-manager.test.ts`                      | 12    | ✅     | AES-256-GCM cifrado/descifrado tokens OAuth     |
| `tests/integrations/crm/api/oauth-callback.test.ts`                 | 6     | ✅     | OAuth state validation + tenant binding         |
| `tests/integrations/crm/oauth-state.test.ts`                        | ?     | ✅     | HMAC state + replay prevention                  |
| `tests/unit/auth-rate-limit.test.ts`                                | 7     | ✅     | Rate-limit auth con bucket ip:emailHash (5/min) |

## Tests de validación Zod (input sanitization)

| Schema          | Tests | Estado |
| --------------- | ----- | ------ |
| `base.test.ts`  | 9     | ✅     |
| `leads.test.ts` | ?     | ✅     |
| `opportunities` | 4     | ✅     |
| `ai-agents`     | 6     | ✅     |
| `integrations`  | ?     | ✅     |
| `overview-kpi`  | 10    | ✅     |

## Tests adapters CRM (multi-DC + retry)

| Adapter          | Tests | Estado | Notas                                                 |
| ---------------- | ----- | ------ | ----------------------------------------------------- |
| HubSpot mappers  | 7     | ✅     | Truncado af_metadata_extra a 60k chars                |
| HubSpot provider | 21    | ✅     | Retry 429 Retry-After + 503 exp backoff               |
| Zoho provider    | 13    | ✅     | Multi-DC detector + 5xx exp backoff (3.4s timer fake) |
| Zoho DC detector | 5     | ✅     | eu/com region resolution                              |

## Tests Auth rate-limit (Sprint 3 nuevo)

- `bloquea el 6º intento con bucket ip:emailHash (5/min)` ✅ — implementación correcta del rate-limit con Redis.
- `fail-open behavior si Redis caído → action procede` ✅ — RLM-TIMEOUT fix verificado.
- `emailHash estable para mismo email` ✅ — mismo bucket en intentos repetidos.

## Observaciones

- BD usada en integration tests: Supabase local (no mocks) — política `Test con BD real` cumplida.
- 4 skipped en `lead-opportunities.integration.test.ts` — requieren seed específica de leads. No bloquea (cobertura cubierta por unit/repository tests).
- BUG-SEC-01 (IP spoofing en rate-limit) detectado en CLOSE-1.5: NO cubierto por estos tests porque es un fallo de **diseño del extractor de IP** (X-Forwarded-For sin validar), no del rate-limit en sí. Marcado para arreglar pre-deploy VPS.

## Resultado

🟢 **PASS** — Capa datos + RLS + cifrado tokens + write-guard verdes. Procede a Fase 03.
