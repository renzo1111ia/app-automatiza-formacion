# E2E-260527-001-HIGH — `/api/leads/ingest` no responde (HTTP 000)

**Severity**: HIGH
**Fase**: 02 RLS / endpoints
**Detección**: curl `POST http://localhost:8500/api/leads/ingest` sin auth → HTTP 000 (conexión cae/timeout).

## Esperado

401 Unauthorized o 400 Bad Request (firma HMAC ausente).

## Observado

HTTP 000 — el server no respondió. Posibles causas: handler lanza unhandled exception, middleware se cuelga, falta `await`, dependency externa bloquea.

## Comando para reproducir

```bash
curl -v --max-time 5 -X POST http://localhost:8500/api/leads/ingest \
  -H "Content-Type: application/json" -d '{}'
```

## Impacto

Endpoint público de ingesta de leads no devuelve respuesta. En producción podría caer worker, perder requests del cliente, o ser DoS-vector.

## Fix sugerido (no ejecutado en este barrido)

Revisar `src/app/api/leads/ingest/route.ts` — añadir try/catch global + log de entrada. Verificar que validación HMAC no bloquea antes de devolver respuesta.

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
