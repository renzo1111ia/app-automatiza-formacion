---
title: "Dependency Risk Matrix"
date: 2026-05-18
agent: Audit-Deps+Security (Sonnet)
source: npm audit --json + análisis manual
---

# Dependency Risk Matrix

> Resumen de 20 vulnerabilidades detectadas por `npm audit` (0 Critical, 12 High, 8 Moderate).
> Riesgo de migración: S = Semanas, M = Mes, L = Largo plazo (trimestre+).

---

## Vulnerabilidades Directas (dependencias en package.json)

| Paquete | Versión actual | CVE / Advisory | Severidad | CVSS | Riesgo migración | Recomendación |
|---------|---------------|----------------|-----------|------|------------------|---------------|
| `next` | 16.1.6 | GHSA-c4j6-fc7j-m34r — SSRF WebSocket | **High** | 8.6 | S | `npm install next@16.2.6 eslint-config-next@16.2.6` |
| `next` | 16.1.6 | GHSA-492v-c6pp-mqqv — Middleware bypass (route injection) | **High** | 8.1 | S | Idem — mismo fix |
| `next` | 16.1.6 | GHSA-26hh-7cqf-hhc6 — Middleware bypass App Router | **High** | 7.5 | S | Idem |
| `next` | 16.1.6 | GHSA-36qx-fr4f-26g5 — Middleware bypass i18n | **High** | 7.5 | S | Idem |
| `next` | 16.1.6 | GHSA-q4gf-8mx6-v5v3 — DoS Server Components | **High** | 7.5 | S | Idem |
| `next` | 16.1.6 | GHSA-8h8q-6873-q5fj — DoS Server Components v2 | **High** | 7.5 | S | Idem |
| `next` | 16.1.6 | GHSA-mg66-mrh9-m8jx — DoS connection exhaustion | **High** | 7.5 | S | Idem |
| `next` | 16.1.6 | GHSA-ffhc-5mcf-pf4q — XSS CSP nonces | Moderate | 4.7 | S | Idem |
| `next` | 16.1.6 | GHSA-gx5p-jg67-6x7h — XSS beforeInteractive | Moderate | 6.1 | S | Idem |
| `next` | 16.1.6 | GHSA-ggv3-7p47-pfv8 — HTTP smuggling rewrites | Moderate | — | S | Idem |
| `next` | 16.1.6 | GHSA-mq59-m269-xvcx — CSRF Server Actions null origin | Moderate | — | S | Idem |
| `axios` | 1.14.0 | GHSA-pf86-5x62-jrwf — Prototype Pollution gadgets | **High** | 7.4 | S | `npm install axios@^1.16.1` |
| `axios` | 1.14.0 | GHSA-6chq-wfr3-2hj9 — Header Injection via PP | **High** | 7.4 | S | Idem |
| `axios` | 1.14.0 | GHSA-pmwg-cvhr-8vh7 — NO_PROXY bypass SSRF | **High** | 7.2 | S | Idem |
| `axios` | 1.14.0 | GHSA-q8qp-cvcw-x6jj — Prototype pollution HTTP adapter | **High** | 7.4 | S | Idem |
| `axios` | 1.14.0 | GHSA-3p68-rc4w-qgx5 — SSRF NO_PROXY normalization | Moderate | 4.8 | S | Idem |
| `bullmq` | 5.73.0 | GHSA-w5hq-g745-h8pq (via uuid) — Buffer out-of-bounds | Moderate | — | S | `npm install bullmq@^5.76.10` |

---

## Vulnerabilidades Transitivas (no en package.json directo)

| Paquete | Versión | CVE / Advisory | Severidad | CVSS | Introducido por | Riesgo migración | Recomendación |
|---------|---------|----------------|-----------|------|-----------------|------------------|---------------|
| `hono` | ≤4.12.17 | GHSA-q5qw-h33p-qvwr — Arbitrary file access serveStatic | **High** | 7.5 | `@anthropic-ai/claude-code` (devDep) | S | Solo en devDeps — no afecta prod |
| `hono` | ≤4.12.17 | GHSA-5pq2-9x2x-5p6w — Cookie attribute injection | Moderate | 5.4 | `@anthropic-ai/claude-code` | S | Solo en devDeps |
| `@hono/node-server` | ≤1.19.12 | GHSA-wc8c-qw6v-h7f6 — Auth bypass encoded slashes | **High** | 7.5 | `@anthropic-ai/claude-code` | S | Solo en devDeps |
| `langsmith` | ≤0.5.26 | GHSA-3644-q5cj-c5c7 — Deserialization untrusted manifests | **High** | 7.1 | `langchain` | M | Actualizar `langchain` a ^1.4.0 |
| `langsmith` | ≤0.5.26 | GHSA-fw9q-39r9-c252 — Prototype Pollution lodash set() | Moderate | 5.6 | `langchain` | M | Idem |
| `fast-xml-builder` | ≤1.1.6 | GHSA-5wm8-gmm8-39j9 — Attribute injection XSS/XXE | **High** | 6.1 | `@aws-sdk/*` | S | Actualizar `@aws-sdk/*` a ^3.1048.0 |
| `fast-xml-parser` | <5.7.0 | GHSA-gh4j-gqv2-49f6 — XML comment/CDATA injection | Moderate | 6.1 | `@aws-sdk/*` | S | Idem |
| `fast-uri` | ≤3.1.1 | GHSA-q3j6-qgpj-74h6 — Path traversal percent-encoded | **High** | 7.5 | transitiva profunda | M | `npm audit fix` |
| `flatted` | ≤3.4.1 | GHSA-25h7-pfq9-p65f — DoS unbounded recursion parse() | **High** | 7.5 | transitiva profunda | M | `npm audit fix` |
| `flatted` | ≤3.4.1 | GHSA-rf6f-7fwh-wjgh — Prototype Pollution parse() | **High** | — | transitiva profunda | M | Idem |
| `express-rate-limit` | 8.0.1-8.5.0 | GHSA-46wh-pxpv-q5gq — IPv4-mapped IPv6 bypass rate limit | **High** | 7.5 | transitiva profunda | M | `npm audit fix` |
| `path-to-regexp` | 8.0.0-8.3.0 | GHSA-j3q9-mxjg-w52f — DoS sequential optional groups | **High** | 7.5 | transitiva profunda | S | `npm audit fix` |
| `picomatch` | ≤2.3.1 | GHSA-c2c7-rcm5-vvqj — ReDoS extglob quantifiers | **High** | 7.5 | transitiva profunda | S | `npm audit fix` |
| `minimatch` | ≤3.1.3, 10.x | GHSA-7r86-cg39-jmmj — ReDoS GLOBSTAR | **High** | 7.5 | transitiva profunda | S | `npm audit fix` |
| `postcss` | <8.5.10 | GHSA-qx2v-qp2m-jg93 — XSS via </style> in stringify | Moderate | 6.1 | `next` | S | Actualizar `next` |
| `brace-expansion` | múltiples | GHSA-f886-m6hf-6m8v — DoS zero-step sequence | Moderate | 6.5 | transitiva profunda | S | `npm audit fix` |
| `follow-redirects` | ≤1.15.11 | GHSA-r4q5-vmmm-2653 — Auth headers leak cross-domain | Moderate | — | `axios` | S | Actualizar `axios` |
| `uuid` | 11.x, 13.0.0 | GHSA-w5hq-g745-h8pq — Buffer out-of-bounds v3/v5/v6 | Moderate | — | `bullmq`, `langchain` | S | Actualizar ambos |
| `ip-address` | ≤10.1.0 | GHSA-v2v4-37r5-5v8g — XSS Address6 HTML methods | Moderate | — | `express-rate-limit` | M | `npm audit fix` |

---

## Resumen ejecutivo por prioridad

### Acción inmediata (sprint actual)
```bash
npm install next@16.2.6 eslint-config-next@16.2.6
npm install axios@^1.16.1
npm install bullmq@^5.76.10
npm install langchain@^1.4.0
npm install @aws-sdk/client-bedrock-agent-runtime@^3.1048.0
npm install @aws-sdk/client-bedrock-runtime@^3.1048.0
npm install @aws-sdk/client-s3@^3.1048.0
npm install @aws-sdk/s3-request-presigner@^3.1048.0
npm audit fix  # para transitivas reparables automáticamente
```

### Acción planificada (próximo sprint)
- `@supabase/supabase-js` 2.106.0 — verificar cambios auth API
- `@supabase/ssr` 0.10.3 — revisar breaking changes SSR
- `retell-sdk` 5.25.1 — verificar webhooks API

### Largo plazo
- `typescript` 6.x — sprint dedicado, breaking changes
- `lucide-react` 1.x — sprint dedicado, renombrado de iconos
- `shadcn` 4.x — revisar componentes afectados

---

## Nota sobre `@anthropic-ai/claude-code` en devDependencies

Este paquete está en `devDependencies` pero introduce múltiples CVEs de `hono` y `@hono/node-server`. Al ser devDep, **no afecta el bundle de producción** siempre que el Dockerfile use `npm ci --omit=dev` en el stage de runner. El Dockerfile actual no lo hace explícitamente — se confía en que `standalone` excluye devDeps. Verificar.

Adicionalmente, `@anthropic-ai/claude-code` es una herramienta de desarrollo interno y **no debería estar en el repositorio del proyecto de producción** — genera noise en el árbol de dependencias y CVEs que confunden el audit.
