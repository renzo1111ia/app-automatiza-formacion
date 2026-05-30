---
title: "Phase 09 — Auth rate-limit + Security agent pro-activo (SP-4-AUTH-RATELIMIT + SP-4-SEC-PROACTIVE)"
sprint: 3
phase: 9
tasks: [SP-4-AUTH-RATELIMIT, SP-4-SEC-PROACTIVE]
effort: 2h 30min
status: in_progress
agents: [af-agents:security, af-agents:code, af-agents:testing, af-agents:manager]
last_updated: 27-05-2026 (creada tras pregunta usuario sobre ThrottlerGuard /auth/login + agente seguridad pro-activo)
---

# Phase 09 — Auth rate-limit + Security agent pro-activo

## Context Links

- Phase 05 hardening (donde nació `withRateLimit` HOF): [phase-05-hardening-headers-rate-limits.md](phase-05-hardening-headers-rate-limits.md)
- HOF reusable: [src/lib/api/with-rate-limit.ts](../../src/lib/api/with-rate-limit.ts)
- Rate limiter base: [src/lib/rate-limiter.ts](../../src/lib/rate-limiter.ts)
- Auth actions actuales (sin rate-limit): [src/lib/actions/auth.ts](../../src/lib/actions/auth.ts)
- Agent security actual: [.claude/agents/security.md](../../.claude/agents/security.md)
- Manager orquestador: [.claude/agents/manager.md](../../.claude/agents/manager.md)
- CLAUDE.md proyecto (Phase Completion Protocol): [CLAUDE.md](../../CLAUDE.md)

## Overview

- **Priority:** P0 (seguridad activa expuesta)
- **Status:** En Desarrollo
- **Descripción:** Cerrar dos huecos detectados durante la auditoría V2:
  1. `loginAction` y `resetPasswordAction` no tienen rate-limit → vector brute-force + email-bomb.
  2. Agente `af-agents:security` existe pero es reactivo, no se invoca proactivamente en cada cierre de fase/sprint.

## Key Insights

- **NO crear infraestructura nueva** — `withRateLimit` HOF ya existe (Sprint 3 4-08). Solo aplicar.
- **Bucket por IP + email-hash** (no email plano) — evita log-leak de PII y mitiga username-enumeration.
- **`headers()` Next 16 async** — `loginAction`/`resetPasswordAction` ya son `"use server"`, `headers()` está disponible nativamente.
- **Fail-open consciente** — si Redis cae, la auth sigue funcionando (decisión heredada de `rate-limiter.ts`).
- **Auditoría delta, no full-scan** — el agent security en cierres de fase solo escanea `git diff developer..HEAD` para no ralentizar cada CLOSE.
- **Orquestación manager** — el manager debe invocar `af-agents:security` automáticamente en el Phase Completion Protocol, no esperar pregunta del usuario.

## Requirements

### Funcionales — §1 Auth rate-limit

- `loginAction(email, password)`: máximo **5 intentos / min** por bucket `ip:emailHash`.
- `resetPasswordAction(email)`: máximo **3 intentos / min** por bucket `ip:emailHash` (anti email-bomb).
- Respuesta al exceder: `{ error: "Demasiados intentos. Inténtalo en Xs." }` con mensaje localizado ES — NO leakear el código `rate_limit_exceeded` al usuario final.
- Tests Vitest: 6º intento login → bloqueado, 4º reset → bloqueado, buckets IP-distintas no se cruzan, fail-open si Redis no responde.

### Funcionales — §2 Security agent pro-activo

- `.claude/agents/security.md` reescrito al stack AF real (RLS multi-tenant, OAuth tokens cifrados AES-256, webhooks HMAC, Server Actions LLM, widget público, BullMQ).
- Checklist OWASP 2021 explícito (A01..A10) mapeado a componentes del proyecto.
- `.claude/agents/manager.md` añade paso obligatorio `af-agents:security` en Phase Completion Protocol entre CLOSE-1 (tests verdes) y CLOSE-2 (E2C local) — auditoría **delta** sobre archivos modificados en el sprint, no full-scan.
- `CLAUDE.md` proyecto: actualizar sección "Phase/Sprint Completion Protocol" con el nuevo paso 1.5 security delta.
- Política documentada: cuándo full-scan (release candidate, MVP GA) vs delta (cierres rutinarios).

### No funcionales

- Latencia añadida a `loginAction`: < 5ms (1 roundtrip Redis local).
- Sin nuevas dependencias.
- El agent security NO modifica código (solo audita y reporta) — mantiene su política existente.

## Architecture

```
Auth rate-limit (§1):

Browser → /login form → loginAction (Server Action)
                          │
                          ├─ headers() → extractClientIp() → ip
                          ├─ sha256(email).slice(0,16) → emailHash
                          ├─ withRateLimit({ key: "auth-login", perMinute: 5,
                          │                  identify: () => `${ip}:${emailHash}` })
                          │     │
                          │     ├─ Redis INCR rl:sa:auth-login:{ip}:{emailHash}:{bucket}
                          │     └─ allowed? → continue : return { error: "Demasiados intentos…" }
                          │
                          └─ supabase.auth.signInWithPassword() → redirect /dashboard


Security agent pro-activo (§2):

Phase Completion Protocol:
  CLOSE-1 (typecheck+lint+build+test verdes)
    │
    ├─ CLOSE-1.5 NUEVO → manager invoca af-agents:security
    │                     ├─ git diff developer..HEAD --name-only
    │                     ├─ Filtra src/**/*.{ts,tsx} + supabase/migrations/* + .env.example
    │                     ├─ Checklist OWASP 2021 delta sobre esos files
    │                     └─ Report: plans/reports/security-delta-{sprint}.md
    │                          ├─ findings críticos → BLOQUEA cierre, manager abre BUG-X
    │                          └─ findings medios/bajos → registra y permite cierre
    │
  CLOSE-2 (E2C local)
  CLOSE-4 (bug fixes)
  CLOSE-5 (PR)
```

## Related Code Files

### Modificar

- [src/lib/actions/auth.ts](../../src/lib/actions/auth.ts) — envolver `loginAction` y `resetPasswordAction` con `withRateLimit`.
- [.claude/agents/security.md](../../.claude/agents/security.md) — reescritura completa al stack AF.
- [.claude/agents/manager.md](../../.claude/agents/manager.md) — añadir paso CLOSE-1.5 security delta en Phase Completion Protocol.
- [CLAUDE.md](../../CLAUDE.md) — actualizar sección Phase/Sprint Completion Protocol con CLOSE-1.5.

### Crear

- `tests/unit/auth-rate-limit.test.ts` — tests del rate-limit aplicado a auth actions.
- `docs/security/security-agent-protocol.md` — protocolo de uso del agent (cuándo delta vs full-scan, cómo interpretar findings).

### Leer (contexto)

- [src/lib/api/with-rate-limit.ts](../../src/lib/api/with-rate-limit.ts) — HOF a reutilizar (ya existe).
- [src/lib/rate-limiter.ts](../../src/lib/rate-limiter.ts) — `extractClientIp` ya existe.
- [tests/unit/with-rate-limit.test.ts](../../tests/unit/with-rate-limit.test.ts) — patrón de test a copiar.

## Implementation Steps

### §1 Auth rate-limit

**Paso 1.1:** Helper local `hashEmail(email)` con `crypto.createHash("sha256")` (8 bytes para no log-leakear).

**Paso 1.2:** Crear adaptador interno en `src/lib/actions/auth.ts`:

```typescript
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { withRateLimit } from "@/lib/api/with-rate-limit";
import { extractClientIp } from "@/lib/rate-limiter";

function hashEmailForBucket(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

async function identifyAuthBucket(email: string): Promise<string> {
  const h = await headers();
  const ip = extractClientIp(
    new Request("http://internal", { headers: Object.fromEntries(h.entries()) })
  );
  return `${ip}:${hashEmailForBucket(email)}`;
}
```

**Paso 1.3:** Refactor `loginAction` → renombrar implementación actual a `_loginAction` (interno) y exportar wrapped:

```typescript
async function _loginAction(email: string, password: string) {
  /* lógica actual sin cambios */
}

export const loginAction = withRateLimit(_loginAction, {
  key: "auth-login",
  perMinute: 5,
  identify: (email) => identifyAuthBucket(email),
});
```

Mapear retorno `rate_limit_exceeded` a `{ error: "Demasiados intentos. Inténtalo en Xs." }` — el `LoginForm` ya muestra `error` como string, no necesita cambios UI.

**Paso 1.4:** Mismo patrón para `resetPasswordAction` con `perMinute: 3` y `key: "auth-reset"`.

**Paso 1.5:** Tests en `tests/unit/auth-rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock headers() y supabase signInWithPassword para aislar el rate-limit.

describe("loginAction rate-limit", () => {
  it("permite 5 intentos / min y bloquea el 6º", async () => {
    /* ... */
  });
  it("buckets IP-distintas no se cruzan", async () => {
    /* ... */
  });
  it("fail-open si Redis cae", async () => {
    /* ... */
  });
});

describe("resetPasswordAction rate-limit", () => {
  it("permite 3 intentos / min y bloquea el 4º", async () => {
    /* ... */
  });
});
```

### §2 Security agent pro-activo

**Paso 2.1:** Reescribir `.claude/agents/security.md` con:

- Stack AF real: RLS multi-tenant (incidente DA-2 audit), tokens OAuth AES-256 encrypted-at-rest (Sprint 1), webhooks HMAC (Sprint 0 1-26), Server Actions LLM cost-bound, widget público con domain allowlist, BullMQ jobs sin auth interna.
- Checklist OWASP 2021 explícito A01..A10 mapeado a componentes del proyecto (no genérico).
- Política de invocación: full-scan en releases (v0.X.0, RC, MVP GA) vs delta en cierres rutinarios.
- Output: report estructurado en `plans/reports/security-delta-{sprint}-{date}.md` con findings críticos/altos/medios/bajos.

**Paso 2.2:** Editar `.claude/agents/manager.md` sección "Fin de fase (Phase Completion Protocol — automático)":

```diff
1. Delegar a `af-agents:testing` — typecheck + lint + build + unit tests + (browser tests si UI).
+ 1.5. Delegar a `af-agents:security` — auditoría delta sobre archivos del sprint (git diff developer..HEAD). Findings críticos bloquean cierre.
2. Delegar a `af-agents:review` — code review.
```

**Paso 2.3:** Actualizar `CLAUDE.md` proyecto sección "Phase/Sprint Completion Protocol (automático)":

- Añadir paso "1.5 Security delta" entre el paso 1 (tests automáticos) y el paso 2 (E2C local).
- Mapping tabla actualizada con `SP-N-CLOSE-1.5 Security delta` → ejecutor `af-agents:security`.
- Detector: full-scan se ejecuta SOLO si la sprint cierra un bump major (v0.X.0 con X cambia) o si es release candidate (`rc.*`).

**Paso 2.4:** Crear `docs/security/security-agent-protocol.md`:

- Cómo invocar manualmente: `@security audit delta` / `@security audit full`.
- Severidades: crítico (bloquea cierre), alto (abre BUG-X en RoadMap), medio (registra para próximo sprint), bajo (informativo).
- Plantilla de report.
- Falsos positivos conocidos: listar (ej. `unsafe-inline` styles aceptado para Tailwind v4 MVP).

## Todo List

### §1 Auth rate-limit (1h estimada)

- [ ] Helper `hashEmailForBucket` + `identifyAuthBucket` en `auth.ts`
- [ ] Wrap `loginAction` con `withRateLimit` (5/min, key="auth-login")
- [ ] Wrap `resetPasswordAction` con `withRateLimit` (3/min, key="auth-reset")
- [ ] Mapeo de `rate_limit_exceeded` → mensaje ES amigable
- [ ] Tests Vitest 4 specs nuevos en `tests/unit/auth-rate-limit.test.ts`
- [ ] Verificar suite completa: `npm test` 228 → 232 verdes
- [ ] Verificar typecheck + lint baseline preservado

### §2 Security agent pro-activo (1h 30min estimada)

- [ ] Reescritura completa de `.claude/agents/security.md` con stack AF + OWASP 2021
- [ ] Editar `.claude/agents/manager.md` Phase Completion Protocol con paso 1.5
- [ ] Actualizar `CLAUDE.md` proyecto sección Phase/Sprint Completion Protocol
- [ ] Crear `docs/security/security-agent-protocol.md` con plantilla de report
- [ ] Validar invocación del agent en local: `Task(subagent_type="af-agents:security", prompt="audit delta...")`
- [ ] Actualizar `dev-team-handover.md` con la nueva política

## Success Criteria

### §1

- 6 intentos `loginAction("admin@x.com", "wrong")` en 1 min desde mismo IP → 6º devuelve `{ error: "Demasiados intentos…" }`.
- `loginAction` desde IP-A no bloquea a IP-B (buckets aislados).
- Si Redis stop → auth sigue funcionando (fail-open verificable con `docker stop redis` en local).
- Tests Vitest 228 → 232 verdes (4 nuevos).
- TypeCheck + lint baseline 0 nuevos errores.

### §2

- `Task(subagent_type="af-agents:security", prompt="audit delta")` produce report en `plans/reports/security-delta-sprint-3-20260527.md` con secciones OWASP A01..A10.
- Manager invoca `af-agents:security` automáticamente al ejecutar `/sprint close` (verificable en próximo CLOSE).
- `docs/security/security-agent-protocol.md` accesible desde dev-onboarding.md.

## Risk Assessment

| Riesgo                                                            | Prob  | Impacto | Mitigación                                                                             |
| ----------------------------------------------------------------- | ----- | ------- | -------------------------------------------------------------------------------------- |
| Rate-limit bloquea login legítimo tras reset password             | Baja  | Medio   | 5/min es generoso; tests E2E sprint-2-close hacen login secuencial — no superan límite |
| `headers()` en Server Action sin request HTTP (test unit)         | Alta  | Bajo    | Mock `next/headers` en tests; ya patrón en suite existente                             |
| Security delta tarda > 5min en cierres → ralentiza Phase Protocol | Media | Bajo    | Limitar scope a `git diff developer..HEAD --name-only -- src/`; cap 50 archivos        |
| Falsos positivos OWASP saturan reports                            | Media | Bajo    | Lista de falsos positivos conocidos en `security-agent-protocol.md`                    |
| Manager olvida invocar security en cierres antiguos pre-protocolo | Baja  | Medio   | Hook `af-roadmap-keeper` puede flagear si CLOSE-1.5 falta cuando CLOSE-2 se marca 🟢   |

## Security Considerations

- El `emailHash` no es reversible (sha256), pero un atacante con diccionario podría enumerar — mitigación: solo se usa para bucket, NO se devuelve en respuestas ni se loguea en claro.
- El rate-limit por IP es vulnerable a NAT compartido (varias víctimas mismo IP) — el bucket combinado `ip:emailHash` mitiga: distintas cuentas no se bloquean entre sí.
- Fail-open es decisión consciente — si Redis cae, preferimos servicio degradado a denial-of-service total. El log Pino captura el fallo para investigación.
- El agent security NUNCA modifica código (regla heredada) — solo audita. Manager interpreta findings y abre BUG-X manualmente o delega a `af-agents:code`.

## Next Steps

- Tras cierre: añadir `loginAction` + `resetPasswordAction` a la tabla de `docs/architecture/rate-limits.md`.
- Sprint 4 (post-MVP) puede añadir 2FA TOTP (opcional) reforzando A07 OWASP — backlog ya menciona esta línea.
- Sprint Costes-LLM puede consumir el mismo patrón de security delta para auditar nuevos endpoints LLM.
