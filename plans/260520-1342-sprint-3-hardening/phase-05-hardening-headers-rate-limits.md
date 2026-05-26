---
title: "Phase 05 — Hardening: CSP Headers, Rate Limits, CSRF, npm audit CI (4-06 + 4-08)"
sprint: 4
phase: 5
tasks: [4-06, 4-08]
effort: 16-20h
status: pending
agents: [af-agents:security, af-agents:code]
last_updated: 24-05-2026 (effort corregido 10-14h → 16-20h tras research R2; incluye 4-08 withRateLimit HOF Server Actions, 6h)
---

> ⚠️ **Paso 0 OBLIGATORIO antes de Implementation Steps** (R2 hallazgo):
> verificar runtime de `middleware.ts` (Edge vs Node). Si es Edge, `ioredis` NO funciona y hay que mover el rate-limiter a API Routes o usar `@upstash/redis` (HTTP-based). Comando:
>
> ```powershell
> grep -nE "export const runtime|export const config" src/middleware.ts src/proxy.ts
> ```
>
> Si no encuentra `runtime: "edge"`, asumir Node runtime (default Next 16) y `ioredis` funciona. Si encuentra Edge, replantear approach ANTES de implementar.

# Phase 05 — Hardening: Headers + Rate Limits + CSRF

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) línea 333 (4-06)
- Researcher report: [researcher-wcag-hardening-d-20260520.md](../reports/researcher-wcag-hardening-d-20260520.md) — secciones 2-5
- ADR deps: [adr-auditoria-dependencias-20260520.md](../reports/adr-auditoria-dependencias-20260520.md) — sección 8 (política seguridad propuesta)
- Sprint 0: auth en endpoints de orquestación (DA-2-001) + webhooks signatures — ya completados
- DEEP-FINDINGS-SUMMARY: DA-3 — seguridad perimetral

## Overview

- **Priority:** P1
- **Status:** Pendiente (independiente de otras fases, puede hacerse en paralelo)
- **Descripción:** Añadir headers de seguridad HTTP (CSP, HSTS, X-Frame-Options), rate limiting en middleware usando Redis (ya en stack), verificar protección CSRF, y configurar npm audit en CI.

## Key Insights

- **Rate limits con ioredis** (ya en stack): sin nueva dependencia — implementar sliding window directo
- **CSRF:** Next.js 16 App Router + Server Actions tiene protección built-in. Solo verificar, no añadir librería
- **CSP headers:** `unsafe-inline` necesario para Tailwind v4 en MVP — aceptar compromiso; `strict-dynamic` en Sprint 4
- **IMPORTANTE:** CSP debe implementarse DESPUÉS de que Sprint 0 corrija el XSS en widget embed (DA-3-004). Si Sprint 0 no está completo, el CSP protege parcialmente
- Next.js 16 CVE GHSA-ffhc-5mcf-pf4q (XSS via CSP nonces) ya corregido por 1-26 — condición previa
- `npm audit en CI` previene regresión de CVEs en futuros PRs — complementa el hook `af-deps-guard.cjs` ya activo
- Renovate bot: configuración mínima para auto-PR de patch updates (no auto-merge)

## Requirements

### Funcionales

- Security headers en TODAS las rutas (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Rate limiting activo: `/api/auth/*` → 5 req/min/IP; `/api/webhooks/*` → 30 req/min/IP; `/api/*` general → 100 req/min/IP
- CSRF: verificar que Server Actions tienen protección, documentar; añadir `Origin` check en API Routes POST críticos sin CSRF de Next.js
- npm audit en CI: falla build si hay High o Critical CVEs
- Renovate bot configurado (patch auto-PR, minor manual-review, major bloqueado)

### No funcionales

- Rate limiting: latencia añadida < 2ms (Redis local, operación INCR es O(1))
- Headers: no romper funcionalidades existentes (CORS para widget embed, CSP para LLM API calls)
- Sin nuevas dependencias de producción

## Architecture

```
Security layers:

1. Next.js Middleware (middleware.ts)
   ├─ Rate limiting: sliding window Redis
   └─ CSRF check: Origin header verification

2. next.config.js headers()
   ├─ Content-Security-Policy
   ├─ Strict-Transport-Security
   ├─ X-Frame-Options: DENY
   ├─ X-Content-Type-Options: nosniff
   ├─ Referrer-Policy
   └─ Permissions-Policy

3. CI Pipeline (.github/workflows/security.yml)
   ├─ npm audit --audit-level=high
   └─ (futuro) SAST scan

4. Renovate (.github/renovate.json)
   ├─ patch devDeps: auto-PR (human approves)
   ├─ minor prodDeps: auto-PR (human approves)
   └─ major: blocked — ADR required
```

## Related Code Files

### Modificar

- `src/middleware.ts` — añadir rate limiting + CSRF check
- `next.config.js` — headers() con security headers

### Crear

- `src/lib/rate-limiter.ts` — helper sliding window Redis
- `.github/workflows/security.yml` — npm audit job
- `.github/renovate.json` — Renovate config

## Implementation Steps

### Paso 1: Helper rate limiter (sin nueva dep)

```typescript
// src/lib/rate-limiter.ts
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;
  const ttlMs = windowMs - (now % windowMs);

  const pipe = redis.pipeline();
  pipe.incr(windowKey);
  pipe.pexpire(windowKey, ttlMs);
  const results = await pipe.exec();
  const count = (results?.[0]?.[1] as number) ?? 1;

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetMs: ttlMs,
  };
}
```

### Paso 2: Rate limiting en middleware.ts

```typescript
// middleware.ts — añadir al inicio del handler
import { rateLimit } from "@/lib/rate-limiter";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Rate limits por tipo de endpoint
  const pathname = request.nextUrl.pathname;
  let limit = 100,
    windowMs = 60_000;

  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    limit = 5; // anti-brute force login
  } else if (pathname.startsWith("/api/webhooks")) {
    limit = 30;
  } else if (pathname.startsWith("/api/admin")) {
    limit = 50;
  }

  const { allowed, remaining, resetMs } = await rateLimit(
    `ip:${ip}:${pathname.split("/")[2] || "root"}`,
    limit,
    windowMs
  );

  if (!allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(resetMs / 1000)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  // CSRF check para API Routes POST (no Server Actions — ya protegidas por Next.js)
  if (
    request.method === "POST" &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhooks")
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && !origin.endsWith(host || "")) {
      return new NextResponse("CSRF check failed", { status: 403 });
    }
  }

  // Continuar con el resto del middleware existente
  return NextResponse.next();
}
```

### Paso 3: Security headers en next.config.js

```javascript
// next.config.js
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Tailwind v4 requiere unsafe-inline styles en MVP
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "img-src 'self' data: blob: https:",
      // LLM APIs + Supabase
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co " +
        "https://api.anthropic.com https://api.openai.com " +
        "https://generativelanguage.googleapis.com " +
        "https://*.ingest.sentry.io",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Widget embed: necesita frame-ancestors más permisivo para iframe en sitios de clientes
      {
        source: "/api/widget/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};
```

**NOTA:** El widget embed (`/api/widget/embed.js`) necesita excepción de `frame-ancestors` — los clientes lo embeben en sus sitios. Ajustar CSP específico para rutas del widget.

### Paso 4: Verificar CSRF en Server Actions

Next.js 16 App Router protege Server Actions automáticamente con:

1. Verificación de `Content-Type: application/x-www-form-urlencoded` o `multipart/form-data`
2. Comprobación de `Origin` header vs Host
3. SameSite=Lax en cookies de Supabase Auth

**Documentar** en `docs/security/csrf-protection.md` que Server Actions tienen CSRF built-in. No instalar librería adicional.

Para API Routes POST sin Server Actions, el check de `Origin` en middleware (Paso 2) es suficiente.

### Paso 5: npm audit en CI

```yaml
# .github/workflows/security.yml
name: Security Audit
on:
  push:
    branches: [developer, staging]
  pull_request:
    branches: [developer]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm ci
      - name: npm audit
        run: npm audit --audit-level=high
        # Falla si hay High o Critical — no permite merge
```

### Paso 6: Renovate bot

```json
// .github/renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "prConcurrentLimit": 3,
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "matchDepTypes": ["devDependencies"],
      "automerge": false,
      "addLabels": ["dependencies", "patch"]
    },
    {
      "matchUpdateTypes": ["minor", "patch"],
      "matchDepTypes": ["dependencies"],
      "automerge": false,
      "addLabels": ["dependencies", "minor"],
      "reviewers": ["renzo1111ia"]
    },
    {
      "matchUpdateTypes": ["major"],
      "enabled": false,
      "description": "Major upgrades requieren ADR — no auto-PR"
    }
  ],
  "ignoreDeps": ["typescript", "eslint"],
  "schedule": ["before 9am on Monday"]
}
```

## Todo List

- [ ] `src/lib/rate-limiter.ts` — sliding window Redis
- [ ] Rate limiting en `middleware.ts` (no romper auth middleware existente de Sprint 0)
- [ ] Verificar que middleware.ts no excede budget de Edge Runtime (Redis call < 2ms)
- [ ] Security headers en `next.config.js`
- [ ] Excepción CSP para `/api/widget/*` (frame-ancestors)
- [ ] Excepción CSP para connect-src: todos los dominios LLM + Supabase
- [ ] Verificar CSP no rompe ninguna funcionalidad con Playwright E2E (Ph1)
- [ ] Documentar CSRF protection en `docs/security/csrf-protection.md`
- [ ] Origin check en middleware para API Routes POST críticos
- [ ] `.github/workflows/security.yml` — npm audit CI
- [ ] `.github/renovate.json` — Renovate config
- [ ] Habilitar Renovate app en GitHub repo (admin task)
- [ ] Test rate limiting: 6 intentos login/min → 429 en el 6to
- [ ] Verificar headers con https://securityheaders.com o curl -I

## Success Criteria

- `curl -I https://app.url` muestra: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- 6 intentos de login en 1 minuto → 5 pasan, el 6to devuelve 429
- `npm audit --audit-level=high` en CI pasa (sin High/Critical CVEs tras Sprint 0)
- CSRF: POST a `/api/auth/login` desde origen diferente → 403
- Renovate bot crea PR automática en el próximo lunes con actualizaciones patch

## Risk Assessment

| Riesgo                                                              | Prob  | Impacto | Mitigación                                                                                                              |
| ------------------------------------------------------------------- | ----- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| CSP rompe LLM API calls (connect-src incompleto)                    | Media | Alto    | Verificar TODOS los dominios externos en connect-src antes de deploy; console.log en dev para detectar blocked requests |
| Rate limiting en Edge Runtime — ioredis no compatible               | Alta  | Alto    | Redis en middleware SOLO si Next.js usa Node runtime; mover check a API Route si es Edge                                |
| Renovate genera demasiados PRs simultáneos                          | Media | Bajo    | `prConcurrentLimit: 3` limita PRs activos                                                                               |
| npm audit falla por vulnerabilidades conocidas en dev deps (eslint) | Media | Bajo    | `--audit-level=high` solo falla en High+; Medium dev vulns se ignoran                                                   |

## Security Considerations

- Rate limiting por IP: los IPs pueden estar detrás de NAT compartido — el límite de 100 req/min es generoso para uso normal
- CSP con `unsafe-inline` en styles: aceptable para MVP; la alternativa (hash-based CSP) requiere configuración Tailwind más compleja
- HSTS `preload`: una vez enviado, no se puede revertir fácilmente. Asegurarse de que HTTPS está configurado correctamente en Easypanel antes de deployar
- El rate limiter usa Redis compartido con BullMQ — asegurarse que las keys `rl:*` no interfieren con keys de BullMQ (prefijos distintos)
- Webhooks (`/api/webhooks/*`): el rate limit NO reemplaza la validación de firma HMAC (ya implementada en Sprint 0). Son capas complementarias

## Next Steps

- Lighthouse test de CSP headers como parte de Ph1 Playwright
- Sprint 4 puede migrar CSP a `strict-dynamic` eliminando `unsafe-inline` si se configura Tailwind para no generar inline styles
- Budget alerts (basado en llm_usage_logs de Ph3) pueden añadirse como endpoint protegido en Sprint 4

---

## Tarea adicional 4-08 — Rate limit wrapper `withRateLimit()` para Server Actions críticas (informe Renzo)

**Origen:** [Informe Renzo Módulo Chatbot Web V1](../../docs/Informes%20de%20programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf) §3 🔴 (generalización del fix puntual de 1-27 Sprint 0).

**Problema:** El rate limiting de 4-06 (esta fase) se aplica en `middleware.ts` y cubre `/api/*`. Pero los Server Actions de Next.js viajan por POST a la ruta de la página con cabecera `Next-Action` y el middleware NO los intercepta. Quedan sin cubrir todas las Server Actions de `src/lib/actions/*` que llaman a LLMs o hacen escrituras costosas. 1-27 cubre puntualmente el widget; 4-08 generaliza a todas las críticas.

**Server Actions a cubrir (mínimo identificado):**

- `getChatbotResponse` (widget) — ya cubierto por 1-27, migrar al wrapper genérico.
- Server actions del **simulator/playground** que llaman OpenAI directamente.
- Server actions del **knowledge base** que generan embeddings (`text-embedding-3-small` cuesta dinero por request).
- Server actions de **agent variant testing** (A/B testing manual del Agent Builder).
- Otros consumidores de `openai.chat.completions.create()` / `openai.embeddings.create()` que NO sean BullMQ workers (los workers ya tienen su propia cadencia).

**Implementación:**

1. Crear `src/lib/api/with-rate-limit.ts` con HOF `withRateLimit(actionFn, { key, perMinute, identify })`:

   ```ts
   export function withRateLimit<TArgs extends unknown[], TResult>(
     actionFn: (...args: TArgs) => Promise<TResult>,
     opts: {
       key: string; // ej: 'widget', 'simulator', 'kb-embed'
       perMinute: number; // límite
       identify: (...args: TArgs) => Promise<string>; // returns 'tenantId:ip' o 'widgetId:ip'
     }
   ): (...args: TArgs) => Promise<TResult | { success: false; error: string }>;
   ```

2. Reutiliza el helper `rateLimitWidget()` creado en 1-27 (renombrar a `rateLimitGeneric()` y parametrizar el prefijo de key).
3. Aplicar wrap a las server actions críticas identificadas. Cada una tiene su propia `perMinute` configurable (tabla en `docs/architecture/rate-limits.md`).
4. Documentar en `docs/architecture/server-actions-rate-limits.md`: por qué el middleware no las cubre + lista de actions con su límite + cómo añadir una nueva.
5. Tests: cada action wrapped tiene un test que verifica el rate limit (mismo patrón que 1-27).

**Estimación:** 6h (incluida en subtotal Sprint 3).

**Cross-refs:**

- 1-27 Sprint 0 (widget hardening): es el caso de uso piloto; 4-08 lo eleva a infraestructura reutilizable.
- 4-06 (esta fase, `/api/*` rate limit): comparten el `rate-limiter.ts` y el cliente Redis.
- 4-09 (E2E widget): los tests de rate limit del widget se reutilizan para validar `withRateLimit` con otros consumidores.
