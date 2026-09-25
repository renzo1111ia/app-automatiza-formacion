# E2E-260603-002-MED — 503 de webhooks expone nombre de env var interna

- **Severity**: MED (info leak menor — el nombre de env var no es secreto, está en `.env.example`)
- **Fase**: 05 (webhooks)
- **Estado**: 🟡 ABIERTO (fix fuera de scope rama `deps-audit` — recomendado para próximo sprint de hardening)
- **Archivos**: `src/lib/api-auth.ts:163, 254, 299`

## Síntoma

Webhooks con secret no configurado en VPS devuelven 503 con body que menciona el nombre interno de la env var:

- `POST /api/webhooks/retell` → `{"error":"RETELL_WEBHOOK_SECRET not configured. Required to validate Retell webhooks."}`
- (CRON_SECRET y webhook_crm_secret tienen el mismo patrón en api-auth.ts)

## Contraste

`POST /api/webhooks/whatsapp` ya devuelve genérico: `{"error":"Service misconfigured"}` — **mitigación correcta ya aplicada** (resuelve parte de `E2E-260527-007`). Retell/CRON/CRM aún exponen nombre.

## Severidad y alcance

- Info leak menor: el nombre de env var aparece en `.env.example` (no es secreto). No revela valores.
- El comportamiento `503 fail-closed` es **correcto** (invariant defensivo documentado inter-run). Solo el mensaje es subóptimo.
- **NO se fixea in-session**: la rama actual es `feature/sp-7-deps-audit-26` (auditoría de dependencias), no hardening de webhooks. Tocar `api-auth.ts` (crítico de seguridad) fuera de scope sin revisión dedicada no procede.

## Fix recomendado (próximo sprint)

Alinear los 3 mensajes 503 con el genérico de whatsapp (`"Service misconfigured"`), dejando el nombre de la env var solo en `console.error` server-side.

```ts
// en vez de exponer el nombre:
console.error("[webhook] RETELL_WEBHOOK_SECRET not configured");
return serviceUnavailable("Service misconfigured");
```

## Nota

Los secrets de Retell/WhatsApp NO están configurados en el VPS dev → de ahí los 503. Esperado en entorno dev. En producción con secrets configurados, el flujo correcto es 401 firma inválida (verificado: CRM con secret per-tenant → 403).
