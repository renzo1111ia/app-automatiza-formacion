# E2E-260527-007-CRIT — `/api/webhooks/whatsapp` retorna 503 con firma inválida (info leak)

**Severity**: CRIT
**Fase**: 05 webhooks
**Detección**: POST `/api/webhooks/whatsapp` con body `{}` y firma bogus → HTTP 503.

## Esperado

401 Unauthorized (firma HMAC inválida).

## Observado

HTTP 503 Service Unavailable. Igual patrón que `/api/cron/appointments/reminders` ([[E2E-260527-002-MED]]): la dependencia (Redis/queue/BullMQ) se intenta inicializar ANTES de validar la firma.

## Comando para reproducir

```bash
curl -v --max-time 5 -X POST http://localhost:8500/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=deadbeef" \
  -d '{"foo":"bar"}'
```

## Impacto

- **Info leak**: revela a anon que la infra interna está degradada (Redis caído). Pista para attacker.
- **DoS**: requests externos no-autenticados consumen recursos del worker antes de validación.
- **WhatsApp Meta podría dejar de enviar webhooks** si interpreta 503 como caído (Meta tiene retry exponential backoff y desactiva subscriptions con 503 sostenidos).

## Fix sugerido (no ejecutado)

1. Validación HMAC SIEMPRE primero en `src/app/api/webhooks/whatsapp/route.ts`.
2. Solo después, conectar a Redis/BullMQ.
3. Aplicar mismo patrón a TODOS los webhook handlers.

## Bugs relacionados

- [[E2E-260527-002-MED]] cron-reminders-503
- [[E2E-260527-001-HIGH]] leads-ingest-no-response

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
