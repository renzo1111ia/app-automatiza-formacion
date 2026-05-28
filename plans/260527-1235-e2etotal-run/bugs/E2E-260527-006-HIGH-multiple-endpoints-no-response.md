# E2E-260527-006-HIGH — Múltiples endpoints retornan HTTP 000 (no response)

**Severity**: HIGH
**Fase**: 04, 06
**Detección**: curl con `--max-time 5` retorna HTTP 000 (conexión cae, sin respuesta del server).

## Endpoints afectados

| Endpoint                        | Método | Status | Observado                                                      |
| ------------------------------- | ------ | ------ | -------------------------------------------------------------- |
| `/api/leads/ingest`             | POST   | 000    | [[E2E-260527-001-HIGH]]                                        |
| `/api/integrations/google/auth` | GET    | 000    | Probablemente handler crashea o falta env config Google        |
| `/widget/invalid-id-test`       | GET    | 000    | Página dynamic `widget/[id]` no maneja 404 graceful, crash SSR |

## Esperado

Todos deberían responder con HTTP code (4xx para errores cliente, 5xx server). HTTP 000 = el server NO mandó respuesta. Causa típica: handler con `throw` sin try/catch global, async sin `await`, dependencia externa colgada.

## Impacto

- Caen workers/handlers internos.
- En producción podría tumbar instancias Dokploy.
- DoS-vector trivial: cualquier scanner público puede tirar el server.

## Fix sugerido (no ejecutado)

Audit a cada handler:

- `src/app/api/leads/ingest/route.ts`
- `src/app/api/integrations/google/auth/route.ts`
- `src/app/widget/[id]/page.tsx`

Añadir try/catch wrapping + Sentry capture. Verificar que `await` se aplica a todas las promesas. Para widget/[id]: añadir `notFound()` cuando id no existe.

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
