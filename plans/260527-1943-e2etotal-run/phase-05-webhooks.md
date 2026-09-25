# Fase 05 — Webhooks firmados VPS

**Inicio:** 2026-05-27 20:18 UTC
**Cierre:** 2026-05-27 20:25 UTC
**Duración:** ~7min
**Estado:** 🟡 PASS con observaciones (defensa básica 🟢, verif HMAC end-to-end diferida)

## Endpoints testeados

| Endpoint                      | Request                                | HTTP | Body                                                            | Interpretación                                                                                                                      |
| ----------------------------- | -------------------------------------- | ---- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/webhooks/retell`   | sin firma                              | 503  | `{"error":"RETELL_WEBHOOK_SECRET not configured. Required..."}` | 🟢 Defensa correcta: sin secret en env → rechaza TODO (no procesa por defecto). Coherente con `dev-dash-envs.env` línea 43 (vacío). |
| `POST /api/webhooks/retell`   | con `X-Retell-Signature: deadbeef`     | 503  | `{"error":"RETELL_WEBHOOK_SECRET not configured. Required..."}` | 🟢 Mismo comportamiento — secret missing es ante todo.                                                                              |
| `POST /api/webhooks/whatsapp` | sin firma                              | 503  | `{"error":"Service misconfigured"}`                             | 🟢 Defensa correcta: `WHATSAPP_APP_SECRET=` vacío (esperado, WA no activo).                                                         |
| `POST /api/webhooks/crm`      | sin headers                            | 400  | `{"error":"Missing x-tenant-id header"}`                        | 🟡 Ver hallazgo MED abajo.                                                                                                          |
| `POST /api/webhooks/crm`      | con `x-tenant-id: 00000000-...`        | 403  | `{"error":"Tenant not found"}`                                  | 🟢 Defensa correcta: tenant UUID inexistente → rechaza.                                                                             |
| `POST /api/webhooks/crm`      | con tenant inválido + `x-crm-provider` | 403  | `{"error":"Tenant not found"}`                                  | 🟢 Tenant validation prevalece sobre provider.                                                                                      |

## Bugs detectados

### `E2E-260527-003-MED-crm-webhook-leak-validation-order`

- **Severity:** MEDIUM
- **OWASP:** A09 (Security Logging & Monitoring Failures + info disclosure)
- **Surface:** S3 Webhook signatures HMAC
- **Descripción:** `/api/webhooks/crm` valida `x-tenant-id` ANTES de la firma HMAC. Esto leakea info al atacante (sabe que la app espera ese header y que el flujo es tenant-scoped) sin obligarle a tener el secret primero. Mejor patrón: validar firma → derivar tenant del payload firmado.
- **Evidencia:** `curl POST /api/webhooks/crm` sin headers → 400 "Missing x-tenant-id header" (revela arquitectura interna).
- **Recomendación:** invertir orden de validación en `src/app/api/webhooks/crm/route.ts`: primero parsear `x-crm-signature` HMAC, luego extraer tenant_id del payload validado. Patrón estándar GitHub/Stripe webhooks.
- **NO bloquea** este run. Convertir en BUG-X para próximo sprint (post-MVP).

## Diferidos

- **Test HMAC end-to-end válido**: requiere generar firma HMAC correcta con el secret real del proveedor (Retell/WA/CRM). Como los secrets están vacíos en VPS dev, no se puede probar el happy path. Diferir a SP-4B Renzo cuando se activen los providers reales.
- **Replay protection con timestamp**: verificar window 5min — diferido (depende de happy path).

## Observaciones positivas

- **NO hay endpoint webhook que acepte requests sin alguna forma de auth/firma/tenant válido.** La defensa fail-closed (`503 not configured` cuando secret vacío) es más segura que fail-open (200 sin validar).
- El comportamiento `503` vs `401`/`403` es debatible: algunos auditores prefieren `401` para "no autorizado" (más informativo) y `503` solo para "infra caída". En este caso 503 es defendible porque sin secret no es ausencia de auth del cliente sino misconfig del servidor.

## Status

**Status:** DONE_WITH_CONCERNS
**Summary:** 3/3 endpoints webhook defienden correctamente sin firma. 1 MED detectado (orden validación CRM).
**Concerns:** verif HMAC end-to-end válido diferida hasta que secrets reales estén configurados en VPS.
