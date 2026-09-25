---
phase: 06
title: "Widget embed público"
status: PASS
started_at: 2026-05-29 16:42
completed_at: 2026-05-29 16:43
duration: 1min
blocking: no
---

# Fase 06 — Widget embed público

## Tests Playwright (Fase 01)

| Spec ID | Caso                                  | Esperado            | Real | Resultado |
| ------- | ------------------------------------- | ------------------- | ---- | --------- |
| 1-23    | GET `/api/widget/embed.js` sin id     | 400                 | 400  | ✅        |
| 1-23    | GET `/api/widget/embed.js?id=NO-UUID` | 400 (XSS guard)     | 400  | ✅        |
| 1-23    | GET `/api/widget/embed.js?id=<UUID>`  | 200 + JS sanitizado | 200  | ✅        |

## Smoke curl directo (re-verificación)

```bash
curl -o nul -w "%{http_code}\n" http://localhost:8500/api/widget/embed.js
# → 400 ✅

curl -o nul -w "%{http_code}\n" "http://localhost:8500/api/widget/embed.js?id=abc"
# → 400 ✅ (XSS guard activo: id NO-UUID rechazado)
```

## Aspectos no cubiertos automáticamente

- **Submit lead vía widget** real: requiere widget configurado con allowed_domains. Cubierto vía manual SP-4B.
- **Rate-limit widget**: 100 requests concurrentes contra widget. No ejecutado en E2C local — diferido a SP-4B (test bajo carga real en VPS).
- **CORS allowed_domains rechazo de origin no permitido**: cubierto por configuración Next, no testeado E2E.

## Resultado

🟢 **PASS** — Endpoint embed.js correcto, XSS guard activo (UUID validation), 200 sanitizado con UUID válido.
