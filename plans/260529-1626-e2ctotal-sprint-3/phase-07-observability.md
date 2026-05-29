---
phase: 07
title: "Observabilidad + WCAG + Hardening headers"
status: PASS
started_at: 2026-05-29 16:43
completed_at: 2026-05-29 16:45
duration: 2min
blocking: no
---

# Fase 07 — Observabilidad + WCAG + Hardening

## Health + Version endpoints (Sprint 3 phase-02 entregado)

| Spec ID           | Caso                                                | Resultado |
| ----------------- | --------------------------------------------------- | --------- |
| health-version-01 | GET `/api/health` → 200 + `status:ok`               | ✅        |
| health-version-02 | GET `/api/version` → 200 + metadata build           | ✅        |
| health-version-03 | `/api/health` no se cachea (Cache-Control no-store) | ✅        |
| health-version-04 | `/api/version` no se cachea                         | ✅        |
| health-version-05 | `/api/health` publicly accessible (no auth)         | ✅        |
| health-version-06 | `/api/version` publicly accessible (no auth)        | ✅        |

## Security headers (Sprint 3 phase-05 entregado)

Verificación directa contra `curl -sI http://localhost:8500/`:

| Header                      | Esperado                                               | Real                                                                     | Estado |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ------ |
| `Content-Security-Policy`   | default-src 'self' + dominios LLM + Sentry             | ✅ presente con anthropic/openai/google/sentry/retell/zoho/hubspot/sepay | ✅     |
| `X-Frame-Options`           | `DENY`                                                 | `DENY`                                                                   | ✅     |
| `X-Content-Type-Options`    | `nosniff`                                              | `nosniff`                                                                | ✅     |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                      | match                                                                    | ✅     |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload`         | match                                                                    | ✅     |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), payment=()` | match                                                                    | ✅     |
| CSP `frame-ancestors`       | `'none'`                                               | `'none'` (anti-clickjacking)                                             | ✅     |

## Specs Playwright security-headers

| Spec ID                      | Resultado |
| ---------------------------- | --------- |
| home tiene todos los headers | ✅        |
| CSP incluye dominios LLM     | ✅        |
| CSP bloquea frame-ancestors  | ✅        |
| X-Frame=DENY presente        | ✅        |
| X-Content=nosniff presente   | ✅        |

## WCAG 2.2 AA — Sprint 3 phase-04 entregado

| Spec ID | Caso                                              | Resultado |
| ------- | ------------------------------------------------- | --------- |
| WCAG-10 | skip-link 'Saltar al contenido principal' en body | ✅        |
| WCAG-10 | skip-link apunta a `#main-content`                | ✅        |
| WCAG-10 | skip-link visible on focus (Tab desde inicio)     | ✅        |
| 2B-07   | al menos 1 chart con `role='img'` + `aria-label`  | ✅        |

## Sentry

- Sentry SDK 10.53.1 instalado (visto en `npm ls`).
- DSN configurado en `.env.local` (NEW_SENTRY_DSN según memoria `project-sentry-vps-validated-260526.md`).
- Validación en VPS ya confirmada en sesión anterior (event `4967d99e` en dashboard Sentry).
- En E2C local Sentry no captura (Sentry SDK detecta `NODE_ENV=development` y skip por defecto). Comportamiento esperado.

## Rate-limit auth

- 7 tests `auth-rate-limit.test.ts` verdes (Fase 02).
- Bucket `ip:emailHash` 5/min funcional, fail-open con Redis caído verificado.
- BUG-SEC-01 (IP spoofing X-Forwarded-For) abierto en CLOSE-1.5, pendiente pre-deploy VPS.

## Console errors

- Spec 2B-08 `NO console errors críticos en /dashboard cargado completo` → ✅ PASS.

## Resultado

🟢 **PASS** — Observabilidad, WCAG 2.2 AA, security headers, hardening completos.
