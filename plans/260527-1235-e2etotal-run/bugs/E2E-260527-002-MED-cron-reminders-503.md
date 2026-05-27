# E2E-260527-002-MED — `/api/cron/appointments/reminders` → 503 unauth

**Severity**: MED
**Fase**: 02 RLS / endpoints
**Detección**: curl `GET http://localhost:8500/api/cron/appointments/reminders` sin Authorization → HTTP 503.

## Esperado

401 Unauthorized (falta `Authorization: Bearer $CRON_SECRET`).

## Observado

HTTP 503 Service Unavailable. Sugiere que el handler intentó arrancar (¿conectar a Redis/BullMQ?) antes de validar el secret. Si Redis está caído o el queue no está montado, el endpoint cae antes de chequear auth.

## Comando para reproducir

```bash
curl -v --max-time 5 http://localhost:8500/api/cron/appointments/reminders
```

## Impacto

- Information leak: revela estado de dependencias internas a anon.
- Auth check debería ser primer paso del handler (defense in depth).

## Fix sugerido (no ejecutado)

Mover validación de `CRON_SECRET` ANTES de cualquier conexión a Redis/BullMQ en `src/app/api/cron/appointments/reminders/route.ts`.

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
