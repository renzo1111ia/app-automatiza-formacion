# E2E-260527-008-HIGH — `/api/widget/embed.js` retorna 400 (debería ser 200 con JS)

**Severity**: HIGH
**Fase**: 06 widget público
**Detección**: GET `/api/widget/embed.js` sin querystring → HTTP 400.

## Esperado

200 OK con `Content-Type: application/javascript` (o `text/javascript`) y JS válido para embed.

## Observado

- HTTP 400 Bad Request
- `Content-Type: text/plain;charset=UTF-8` (también incorrecto — debería ser JS)
- `X-Content-Type-Options: nosniff`

Probablemente el handler requiere `?widget_id=xxx` o `?tenant_id=xxx` en querystring y devuelve 400 si falta. Si es así, falta documentación clara o fallback con error JS-friendly.

## Comando para reproducir

```bash
curl -v http://localhost:8500/api/widget/embed.js
```

## Impacto

- Si la clienta intenta usar el snippet "tal cual" como en docs, falla.
- Si el snippet con query no funciona en otro origen → CSP/CORS añadido.

## Fix sugerido (no ejecutado)

Auditar `src/app/api/widget/embed.js/route.ts`:

- Documentar query params requeridos.
- Si falta query: devolver JS con `console.error("widget_id required")` (200), NO 400 con text/plain.
- Verificar CORS abierto para dominios cliente.

## Status

ABIERTO — sin fix por instrucción de barrido detección único.
