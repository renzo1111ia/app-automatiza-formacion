---
name: project-sprint-a-plan
description: Sprint A operativo creado y ubicado. Estructura del plan, decisiones y preguntas abiertas relevantes para sesiones futuras.
metadata:
  type: project
---

Sprint A plan operativo creado el 20-05-2026 en `plans/260520-1342-sprint-a-hotfixes-seguridad/`.

**Why:** El Sprint A contiene 24 hotfixes de seguridad críticos (RLS roto, privilege escalation activo, 0 webhooks con firma, 7 endpoints sin auth) que deben cerrarse antes de cualquier feature. Objetivo: v0.1.0.

**How to apply:** Al retomar Sprint A, leer `plan.md` de esa carpeta para el overview. Las fases son independientes salvo la dependencia crítica de Ph2 (secretos/JWT rotation) que debe ir primera.

Decisiones clave ya tomadas:
- Ph2 (A-04 quitar hardcoded → A-03 rotar keys) debe ir antes de deploy de cualquier otra fase.
- A-11 y A-22 tocan el mismo archivo (`api/tenant/migrate/route.ts`) — asignar mismo dev.
- A-18 (RLS tenants) referenciada al plan RLS existente `20260519-1200-rls-multitenant-hardening/phase-01-hotfix-vulnerabilidades.md`, no duplicada.
- A-24 (axios upgrade) requiere pasar por `esden-agents:adr` (Dependency Guard) obligatoriamente antes de `npm install`.

Preguntas abiertas al usuario (sin respuesta al cerrar sesión):
1. A-15: ¿secret webhook CRM por tenant o global?
2. A-22: dominios reales para TENANT_MIGRATE_ALLOWED_HOSTS.
3. A-09: ¿eliminar o mover a _dev?
4. SP-A-CLOSE-3: credenciales de staging disponibles.
5. A-06: ¿qué servicios usan conexión directa PostgreSQL vs Supabase client?
