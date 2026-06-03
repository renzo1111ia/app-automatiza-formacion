# Fase 05 — Webhooks firmados HMAC

- **Env**: vps
- **Estado**: 🟡 PASS con 1 MED abierto
- **Método**: spec sprint-0 (cubierto Fase 02) + probes firma inválida + inspección body 503.

## Probes firma inválida

| Endpoint                                    | Input                     | HTTP | Veredicto                                             |
| ------------------------------------------- | ------------------------- | ---- | ----------------------------------------------------- |
| `/api/webhooks/retell`                      | firma bogus               | 503  | 🟢 fail-closed (secret no config en dev)              |
| `/api/webhooks/whatsapp`                    | x-hub-signature bogus     | 503  | 🟢 fail-closed, body genérico `Service misconfigured` |
| `/api/webhooks/crm`                         | x-tenant-id + firma bogus | 403  | 🟢 rechazado                                          |
| `/api/webhooks/workflow/{wid}/{path}/{nid}` | sin firma                 | 404  | 🟢 workflow inexistente, no expone HMAC               |

## Inspección body 503 (info leak)

| Endpoint | Body 503                                              | Leak?                                             |
| -------- | ----------------------------------------------------- | ------------------------------------------------- |
| whatsapp | `{"error":"Service misconfigured"}`                   | 🟢 **NO** (genérico — endurecido vs run 27-05)    |
| retell   | `{"error":"RETELL_WEBHOOK_SECRET not configured..."}` | 🟡 menciona nombre env var → `E2E-260603-002-MED` |

## Regresiones

- `E2E-260527-007-CRIT` (whatsapp 503 info leak): **mitigado** → ahora body genérico. Degradado de CRIT a no-issue para whatsapp. Retell aún expone nombre (nuevo MED, no CRIT — el nombre no es secreto).
- `E2E-260527-003-MED` (cron 503 unauth info leak): mismo patrón, incluido en `E2E-260603-002`.

## Bugs

- 🟡 `E2E-260603-002-MED` — retell/cron/crm 503 exponen nombre de env var. Fix fuera de scope rama deps-audit, recomendado próximo sprint hardening.

## Resultado

🟡 **PASS con warning** — 4/4 webhooks fail-closed correctamente (defensa HMAC intacta). 1 bug MED de mensajería (no compromete firma). 0 CRIT/HIGH.
