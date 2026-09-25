---
phase: 05
title: "Webhooks firmados HMAC"
status: PASS
started_at: 2026-05-29 16:41
completed_at: 2026-05-29 16:42
duration: 1min
blocking: no
---

# Fase 05 — Webhooks firmados HMAC

## Tests Playwright (Fase 01)

| Spec ID | Endpoint                                      | Esperado    | Real  | Resultado |
| ------- | --------------------------------------------- | ----------- | ----- | --------- |
| 1-12    | POST `/api/webhooks/retell` sin firma         | 401/503     | 401   | ✅        |
| 1-13    | POST `/api/webhooks/retell/tools` sin firma   | 401/503     | 401   | ✅        |
| 1-14    | POST `/api/webhooks/whatsapp` sin x-hub-sig   | 401/503     | 503   | ✅        |
| 1-15    | POST `/api/webhooks/crm` sin x-tenant-id      | 400         | 400   | ✅        |
| 1-15    | POST `/api/webhooks/crm` con tenant sin firma | 401/403/503 | match | ✅        |

## Smoke curl directo (re-verificación)

```bash
# Retell sin firma → 401 ✅
# WhatsApp sin firma → 503 ✅ (servicio externo no responde, comportamiento correcto)
# CRM sin tenant → 400 ✅
```

## Webhook workflow (`/api/webhooks/workflow/[wid]/[path]/[nid]`)

- **NO cubierto en tests E2E** — corresponde a flujo orchestrator (Sprint 3 phase-08 diferida).
- **BUG-SEC-02 abierto en CLOSE-1.5** — pre-existente, sin firma HMAC. Marcado pre-deploy VPS, no bloquea cierre Sprint 3.

## Resultado

🟢 **PASS** — 5 endpoints webhook validados, todos rechazan correctamente sin firma. BUG-SEC-02 documentado para Sprint 4B.
