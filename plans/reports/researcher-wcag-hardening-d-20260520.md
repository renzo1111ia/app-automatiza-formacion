---
title: "Researcher Report — WCAG 2.2 AA + Hardening — Sprint 4"
date: 2026-05-20
agent: researcher-wcag-hardening (Sonnet)
sprint: 4
sources:
  - docs/audit/deep/DA-5-accessibility.md (24 findings)
  - docs/audit/deep/DEEP-FINDINGS-SUMMARY.md
---

# Researcher: WCAG 2.2 AA + Hardening (CSP / CSRF / Rate Limits)

## 1. WCAG 2.2 AA — Análisis de findings DA-5

### Distribución de esfuerzo por severidad

| Severidad | Count | Esfuerzo total estimado |
|-----------|-------|------------------------|
| Critical (6) | DA-5-003, 013, 014, 015, 023 + 1 | ~8-12h |
| High (9) | DA-5-001, 004, 006, 008, 010, 012, 016, 017, 018 | ~14-20h |
| Medium (6) | DA-5-002, 005, 007, 009, 011, 019 | ~6-8h |
| Low (1) | DA-5-020, 024 (también High) | ~1h |

### Quick wins (impacto alto, esfuerzo S) — hacer primero

1. **DA-5-017 — Skip to main content** (30min): Una línea de código en `DashboardShell.tsx`
2. **DA-5-023 — role="dialog"** (1h): 4 modales, markup puro
3. **DA-5-007 — autocomplete en login** (15min): 2 inputs en login/reset-password
4. **DA-5-015 — tr tabIndex** (45min): `tabIndex={0}` + `onKeyDown` en `HistorialTable.tsx`
5. **DA-5-006 — div→button en agents** (30min): `agents/page.tsx:263`
6. **DA-5-002 — aria-hidden SVGs** (20min): `Sidebar.tsx:294,324`

### Agrupación por componente para implementación eficiente

| Componente | Findings | Horas est. |
|-----------|----------|-----------|
| AIAgentInbox.tsx (1832 líneas) | DA-5-001, 009, 012, 013, 016 | 8-12h |
| HistorialTable.tsx | DA-5-004, 014, 015, 016 | 4-6h |
| CreateLeadDialog.tsx | DA-5-003, 021, 023 | 3-4h |
| DashboardShell.tsx + layout | DA-5-017, 018 | 2h |
| globals.css + tokens | DA-5-010, 011 | 3-4h |
| calendar/page.tsx | DA-5-005, 019, 022 | 3-4h |
| agents/page.tsx | DA-5-005, 006 | 1-2h |
| Sidebar.tsx | DA-5-002, 017 | 1h |
| login + reset-password | DA-5-007, 021 | 1h |
| Sistema toasts (nueva funcionalidad) | DA-5-024 | 3-4h |

### Herramientas de auditoría WCAG 2.2 AA

| Herramienta | Uso | Instalación |
|-------------|-----|-------------|
| `jest-axe` | Unit tests accesibilidad (axe-core en Jest/Vitest) | `npm install -D jest-axe @types/jest-axe` |
| `@axe-core/playwright` | Tests accesibilidad en E2E Playwright | `npm install -D @axe-core/playwright` |
| Lighthouse CLI | Audit manual de a11y score | `npx lighthouse http://localhost:3000 --only-categories=accessibility` |
| axe DevTools (browser ext.) | Auditoría manual durante desarrollo | Extensión Chrome, gratis |

**DECISIÓN:** `@axe-core/playwright` en E2E tests + Lighthouse score ≥90 como criterio de éxito. Sin jest-axe adicional (Vitest es suficiente con @axe-core/playwright para verificaciones programáticas).

### shadcn/ui Dialog — migración de modales (RESUELVE DA-5-013, 014, 023)

El proyecto ya tiene `shadcn/ui` instalado. El componente `Dialog` de shadcn usa Radix UI que automáticamente proporciona:
- `role="dialog"` + `aria-modal="true"`
- Focus trap automático
- Cierre con Escape
- `aria-labelledby` automático

```bash
npx shadcn@latest add dialog  # CLI 3.x en proyecto
```

Migrar los 4 modales manuales a `Dialog` de shadcn resuelve 3 findings Critical de un golpe. Esfuerzo: ~4-6h por modal incluyendo refactor de lógica.

### sonner para toasts (RESUELVE DA-5-024)

`sonner` es el toast recomendado por shadcn. Ya existe en el ecosistema del proyecto.

```bash
npx shadcn@latest add sonner
```

Reemplaza todos los `alert()` + `window.confirm()` en el codebase. Esfuerzo estimado para búsqueda/reemplazo: 3-4h.

### DA-5-010 — Contraste opacity fraccional

**Fix global** en `globals.css`:
```css
/* ANTES: problemático */
/* Uso: text-muted-foreground/40 en 25+ sitios */

/* DESPUÉS: nueva variable de contraste seguro */
:root {
  --secondary-text: #5a6475;  /* ratio 5.1:1 sobre blanco */
}
.dark {
  --secondary-text: #a8b4c8;  /* ratio 5.8:1 sobre #020617 */
}
```

Luego buscar/reemplazar `text-muted-foreground/[0-9]` → `text-[--secondary-text]` en todos los componentes. Trabajo mecánico pero extenso (~25 archivos).

---

## 2. CSP Headers — Next.js 16

### Implementación en next.config.js

```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'nonce-{NONCE}'",  // Next.js 16 soporta nonces
      "style-src 'self' 'unsafe-inline'",    // Tailwind inline styles (problema conocido)
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
];
```

**NOTA CRÍTICA:** Next.js 16 tiene `GHSA-ffhc-5mcf-pf4q` — XSS via CSP nonces en App Router. Esto se resuelve upgradeando a `next@16.2.6` (Sprint 1, 1-26). El CSP de Sprint 4 debe implementarse DESPUÉS de 1-26.

**Problema con `'unsafe-inline'` en styles:** Tailwind v4 genera estilos inline en algunos casos. Se puede usar `style-src 'self' 'unsafe-inline'` como compromiso para MVP, con un audit de la generación de estilos antes de llegar a `strict-dynamic`.

---

## 3. CSRF Tokens — Next.js 16

### Estado actual en Next.js 16 App Router

Next.js 16 App Router con Server Actions tiene **protección CSRF built-in** vía:
1. `SameSite=Lax` en cookies de sesión de Supabase Auth por defecto
2. Verificación de `Origin` header en Server Actions
3. `__Host-` prefix cookies para Server Actions

**DECISIÓN:** Para el MVP, la protección CSRF nativa de Next.js 16 Server Actions es SUFICIENTE. No instalar `next-csrf` ni `csurf` (legacy, deprecated).

Para API Routes que aceptan POST desde terceros (webhooks), ya se implementa validación HMAC por firma (Sprint 1). Los webhooks propios no necesitan CSRF (son server-to-server).

**Excepción:** Si se añaden API Routes que aceptan requests desde el browser (no Server Actions), verificar `Origin` header manualmente:

```typescript
// Verificación CSRF manual para API Routes custom
if (request.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
  return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
}
```

---

## 4. Rate Limits — Next.js Middleware + Redis

### Opción recomendada: Redis (ya en stack, BullMQ usa ioredis)

```typescript
// middleware.ts — sliding window rate limit
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;
  
  const count = await redis.incr(windowKey);
  if (count === 1) await redis.pexpire(windowKey, windowMs);
  
  return count <= limit;
}

// En middleware.ts
export async function middleware(request: NextRequest) {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  // Rate limit: 100 req/min por IP en API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowed = await rateLimit(`ip:${ip}`, 100, 60_000);
    if (!allowed) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }
  
  // Rate limit más estricto: 5 intentos login/min
  if (request.nextUrl.pathname === '/api/auth/login') {
    const allowed = await rateLimit(`login:${ip}`, 5, 60_000);
    if (!allowed) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }
}
```

**Sin nueva dependencia:** `ioredis` ya está en el stack (BullMQ lo usa). No instalar `rate-limiter-flexible` ni `@upstash/ratelimit` — YAGNI.

### Límites recomendados por endpoint

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| `/api/auth/*` | 5 req | 1 min |
| `/api/webhooks/*` | 30 req | 1 min |
| `/api/orchestration/*` | 20 req | 1 min |
| `/api/*` (general) | 100 req | 1 min |
| `/api/widget/embed.js` | 200 req | 1 min |

---

## 5. npm audit en CI (recomendado ADR)

```yaml
# .github/workflows/security.yml
- name: Security audit
  run: npm audit --audit-level=high
  continue-on-error: false  # Falla el build si hay high/critical
```

---

## 6. Estimaciones implementación

| Componente | Estimación |
|-----------|-----------|
| WCAG quick wins (DA-5-017, 023, 007, 015, 006, 002) | 3-4h |
| Migrar 4 modales a shadcn Dialog (DA-5-013, 014) | 8-12h |
| Sistema toasts sonner (DA-5-024) + reemplazar alert() | 4-6h |
| Contraste opacity fraccional globals.css (DA-5-010) | 3-4h |
| Labels htmlFor CreateLeadDialog (DA-5-003) | 1h |
| Responsive AIAgentInbox (DA-5-012) | 8-12h |
| Títulos de página metadata (DA-5-018) | 2h |
| Resto findings Medium/Low | 4-6h |
| **Total D-05 WCAG** | **33-47h** |
| CSP headers next.config.js | 3-4h |
| Rate limiting Redis en middleware | 4-6h |
| CSRF — verificación + documentación | 1-2h |
| npm audit CI + Renovate config | 3h |
| **Total D-06 Hardening** | **11-15h** |

**NOTA:** DA-5-012 (responsive AIAgentInbox) es L (esfuerzo grande). Si el total de Sprint 4 excede 120h, este finding se puede marcar como tech debt y posponer a Sprint 5. Los otros 23 findings caben en 20-32h.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** WCAG 2.2 AA requiere 33-47h si se incluye DA-5-012 (responsive). Sin DA-5-012, baja a 25-35h. Hardening (CSP + rate limits + CSRF) es 11-15h. Stack recomendado: shadcn Dialog para modales (ya en proyecto), sonner para toasts (ya en shadcn), ioredis para rate limits (ya en proyecto), CSP en next.config.js. Sin nuevas deps excepto @axe-core/playwright para E2E a11y tests.
**Concerns:** DA-5-012 (AIAgentInbox responsive) tiene esfuerzo L (8-12h solo ese finding) y puede tensionar el presupuesto. Recomiendo incluirlo en el plan pero marcarlo como última prioridad dentro de D-05 para poder cortarlo si el sprint va largo.
