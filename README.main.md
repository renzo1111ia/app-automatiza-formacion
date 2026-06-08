# dashboard-af

> **Versión:** v0.4.0 &nbsp;·&nbsp; **Actualizado:** 2026-06-08 · Sprint 4 Google Sheets 🟢 CERRADO v0.4.0 (CLOSE-1/1.5/2/4 verdes, 2 fixes seguridad). Previo: Sprint 3 🟢 (PR #22 merged 30-05) + SP-7 deps audit (PR #23 merged 03-06). E2E VPS 03-06 🟢 PASS (0 CRIT/HIGH). Detalle por sprint en las tablas de abajo.

AI CRM + Workflow Orchestrator multi-tenant para academias y centros de formación. Automatiza la captación, cualificación y conversión de leads mediante agentes de IA (voz + chat), integración con HubSpot y Zoho CRM, y paneles de gestión por tenant.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend / SSR | Next.js 16 + React 19 + Tailwind CSS |
| Base de datos | PostgreSQL vía Supabase self-hosted |
| Autenticación + multi-tenant | Supabase Auth + RLS |
| Colas / workers | BullMQ + Redis |
| IA conversacional | LangChain multi-LLM |
| Voz | Retell + Ultravox |
| CRMs | HubSpot + Zoho CRM |

---

## Quick Start

```bash
# 1. Clonar
git clone <repo-url> dashboard-af
cd dashboard-af

# 2. Variables de entorno
cp .env.example .env.local
# Configurar con credenciales de producción

# 3. Instalar y arrancar
npm install
npm run dev
```

> Requisitos: Node.js 22.x LTS · npm 10.x

---

## Releases

| Sprint | Versión | Estado | Release date |
|--------|---------|--------|-------------|
| SP-1 | v0.1.0 | 🟡 En Desarrollo (25/26 dev a 🔵 · 2 diferidas pre-deploy · … _ver nota↓_ | — |
| SP-2 | v0.2.0 | 🟢 Completada (merged a developer vía PR #5, commit 94c035a) | Vie 22-05-2026 23:41 (merge PR #5) |
| SP-3 | v0.2.7 (final con hotfix BUG-2-01 — bumpeada desde v0.2.5) | 🟢 COMPLETADA (mergeado a developer 24-05-2026 19:55) | 24-05-2026 19:55 |
| SP-4 | v0.3.0 (MVP completo, post-hardening) | 🔘 Pendiente | — |
| SP-5 | v0.5.0 | 🟡 SPIKE En Desarrollo (28-05-2026 — 5/6 subtareas dev cubiertas, Sub 8 pendiente) | — |
| SP-6 | v0.6.0 | 🔘 Pendiente | — |
| SP-7 | v0.7.0 | 🔘 Pendiente | — |
| SP-8 | v0.8.0 | 🔘 Pendiente | — |
| SP-9 | v0.9.0 | 🔘 Pendiente (bloqueado hasta SP-4..SP-7 completos) | — |
| SP-10 | v0.10.x+ (incremental por CRM) | 🔘 Backlog (on-demand) | — |
| SP-11 (offset +1) | v0.11.0 | 🔘 Pendiente | — |

> "Release date" se rellena cuando el sprint pasa a 🟢 COMPLETADA (`Fin Real` del RoadMap).

---

## Versión actual

**v0.4.0**

---

## Licencia

MIT
