# Fase 06 — Widget embed público

- **Env**: vps
- **Estado**: 🟢 PASS
- **Método**: probes curl embed.js + página widget pública.

## Resultados

| Check                                             | HTTP / valor                   | Veredicto                                                               |
| ------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `GET /api/widget/embed.js?id={uuid}` content-type | 200 + `application/javascript` | 🟢 **regresión E2E-260527-008 RESUELTA** (era text/plain)               |
| `GET /api/widget/embed.js` sin id                 | 400                            | 🟢                                                                      |
| `GET /api/widget/embed.js?id=<script>` (XSS)      | 400                            | 🟢 XSS guard UUID                                                       |
| `GET /widget/{uuid}` sin auth                     | 200                            | 🟢 carga pública — **regresión E2E-260527-006 RESUELTA** (era HTTP 000) |
| `GET /widget/notauuid`                            | 200                            | 🟢 shell Next.js renderiza, validación de datos client-side (no leak)   |

## Headers

embed.js sirve con CSP completo (`frame-ancestors 'none'`) y content-type JS correcto. La validación UUID estricta vive en el endpoint que sirve JS ejecutable (400), no en el shell de página.

## Regresiones verificadas

- `E2E-260527-006-HIGH` (`/widget/[id]` HTTP 000): **RESUELTA** → 200. ✅
- `E2E-260527-008-HIGH` (embed.js 400+text/plain): **RESUELTA** → 200 + application/javascript. ✅

## Diferido

- Rate-limit (100 req → bloqueo) y `allowed_domains` (origin no permitido → bloqueo): requieren widget real configurado + carga sostenida contra VPS producción. No ejecutado (no destructivo). Cubierto a nivel unit en Vitest (rate-limiter tests).
- Submit lead vía widget: mutación en VPS, diferido a SP-4B.

## Resultado

🟢 **PASS** — 5/5 probes correctos. 2 regresiones HIGH previas resueltas en VPS. 0 bugs nuevos.
