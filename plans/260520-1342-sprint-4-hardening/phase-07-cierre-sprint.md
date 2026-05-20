---
title: "Phase 07 — Cierre Sprint 4 (SP-4-CLOSE-1..5)"
sprint: 4
phase: 7
tasks: [SP-4-CLOSE-1, SP-4-CLOSE-2, SP-4-CLOSE-3, SP-4-CLOSE-4, SP-4-CLOSE-5]
effort: 8h + bugs (variable)
status: pending
agent: esden-agents:testing
---

# Phase 07 — Cierre Sprint 4

## Context Links

- Plan overview: [plan.md](plan.md)
- RoadMap: [RoadMap.md](../RoadMap.md) líneas 341-345 (SP-4-CLOSE-1..5)
- Sprints anteriores: misma estructura en Sprint 1 (phase-07), Sprint 2 (phase-07), Sprint 3

## Overview

- **Priority:** P1
- **Status:** Pendiente — bloqueado por Ph1-Ph6 completas
- **Descripción:** Protocolo de cierre de sprint: auto tests, E2E completo, test manual del dev, corrección de bugs, y PR a `developer` con bump a `v0.4.0` (MVP completo).

## Prerequisito absoluto

**TODAS las fases Ph1-Ph6 deben estar en estado Completado** antes de iniciar este phase.
No hay excepciones salvo DA-5-012 (responsive AIAgentInbox, P2, puede quedar como tech debt).

## Tasks

### SP-4-CLOSE-1 — Auto Test (1h 30min)

Ejecutar la suite completa de tests automáticos en orden:

```bash
npm run typecheck      # TypeScript — 0 errores
npm run lint           # ESLint — 0 errores o warnings críticos
npm run build          # Next.js build — success
npm run test:coverage  # Vitest — coverage ≥80%
npm run test:e2e       # Playwright — 0 failed
npm audit --audit-level=high  # 0 High/Critical CVEs
```

Criterio de éxito: TODOS los comandos terminan con exit code 0.
Si alguno falla: corregir inmediatamente (no pasar a CLOSE-2).

**Checklist:**
- [ ] `npm run typecheck` — 0 errores
- [ ] `npm run lint` — 0 errores bloqueantes
- [ ] `npm run build` — success, sin warnings de producción
- [ ] `npm run test:coverage` — lines ≥80%, functions ≥80%
- [ ] `npx playwright test` — 0 failed, ≥6 specs passing
- [ ] `npm audit --audit-level=high` — 0 findings High/Critical

---

### SP-4-CLOSE-2 — Test E2E Local + WCAG 2.2 AA (4h)

Recorrido completo del MVP en browser local. Es el test más extenso del sprint por ser el cierre del MVP.

**Flujos a verificar (checklist):**

**Auth:**
- [ ] Login con credenciales válidas → dashboard
- [ ] Login con credenciales inválidas → mensaje error accesible (no alert())
- [ ] Logout → cookie eliminada, redirige a login
- [ ] Reset password flow completo

**Leads / Historial:**
- [ ] Crear nuevo lead desde formulario → aparece en tabla
- [ ] Buscar lead en historial → resultados correctos
- [ ] Abrir modal detalle de lead → foco va al modal, Escape cierra
- [ ] Eliminar lead → modal de confirmación (no confirm()), acción ejecutada

**Agents / Inbox:**
- [ ] Seleccionar agente de la lista (con teclado y mouse)
- [ ] Ver conversación en inbox
- [ ] Abrir template selector → focus trap activo

**Calendario:**
- [ ] Ver citas del día
- [ ] Confirmar/cancelar cita → modal de confirmación accesible

**Settings / CRM (Sprint 3):**
- [ ] Panel de integraciones accesible
- [ ] (Si sandbox disponible) OAuth HubSpot/Zoho flow

**Dashboard Costes LLM (Sprint 4):**
- [ ] Gráfica costes por proveedor visible para admin
- [ ] Vista tenant muestra solo sus propios costes

**WCAG 2.2 AA keyboard check:**
- [ ] Tab desde inicio de página → navega por skip link, sidebar, contenido
- [ ] Skip link funcional (Tab → Enter → salta a #main-content)
- [ ] Modal crear lead: Tab navega por todos los campos, Escape cierra
- [ ] Historial table: fila seleccionable con Enter/Space
- [ ] Lighthouse a11y score ≥90 en `/dashboard` (captura screenshot)

**Security headers (con DevTools o curl):**
- [ ] CSP presente en response headers
- [ ] X-Frame-Options: DENY
- [ ] Sentry captura error de prueba (opcional)

---

### SP-4-CLOSE-3 — Test Manual del Dev (2h)

Test exploratorio libre por parte del developer. Sin script fijo.
Objetivo: encontrar bugs que los tests automáticos no detectaron.
Focus en: edge cases multi-tenant, flujos de error, responsive (si se implementó DA-5-012).

Documento de hallazgos: anotar en SP-4-CLOSE-4.

---

### SP-4-CLOSE-4 — Corrección de Bugs Detectados (variable)

Bugs encontrados en CLOSE-2 y CLOSE-3 se documentan y corrigen aquí.
Criterio para incluir en v0.4.0: bugs críticos o High que bloqueen flujos golden path.
Criterio para posponer a hotfix/Sprint 5: bugs Medium/Low cosméticos.

Tras cada corrección: re-ejecutar CLOSE-1 (auto tests) para confirmar no regresión.

---

### SP-4-CLOSE-5 — Cierre Sprint → PR a developer + bump v0.4.0 (30min)

```bash
# 1. Asegurarse en rama feature/sp-4-hardening
git status  # limpio, todo committed

# 2. Bump de versión
# Editar package.json: "version": "0.3.0" → "1.0.0"
# Editar CHANGELOG.md: añadir fecha a la entrada [v0.4.0]

# 3. Commit final
git add package.json CHANGELOG.md
git commit -m "chore: bump version to v0.4.0 — MVP completo Sprint 4"

# 4. Tag
git tag -a v0.4.0 -m "v0.4.0 — MVP completo: E2E, WCAG 2.2 AA, observabilidad, dashboard LLM, hardening"

# 5. PR a developer (NO a staging ni main — requieren autorización explícita)
gh pr create \
  --base developer \
  --head feature/sp-4-hardening \
  --title "feat: Sprint 4 — Hardening v0.4.0 MVP completo" \
  --body "Sprint 4 completado. Ver plans/260520-1342-sprint-4-hardening/plan.md para detalle."
```

**ATENCIÓN:** `staging` y `main` son ramas protegidas. NO hacer push ni PR a estas ramas sin autorización explícita del usuario/cliente.

**Checklist CLOSE-5:**
- [ ] `package.json` version = "1.0.0"
- [ ] `CHANGELOG.md` entrada [v0.4.0] con fecha
- [ ] Commit con mensaje convencional
- [ ] Tag v0.4.0 creado localmente
- [ ] PR a `developer` creado (NO a staging/main)
- [ ] PR description incluye link al plan
- [ ] Invitar al usuario a planificar Fase E (o decidir pausa post-MVP)

---

## Todo List (phase completa)

- [ ] CLOSE-1: typecheck + lint + build + coverage + E2E + npm audit → todo verde
- [ ] CLOSE-2: recorrido completo MVP en browser (45+ checks)
- [ ] CLOSE-2: Lighthouse a11y ≥90 screenshot
- [ ] CLOSE-3: test exploratorio libre (2h)
- [ ] CLOSE-4: todos los bugs Critical/High corregidos
- [ ] CLOSE-4: re-run CLOSE-1 tras correcciones
- [ ] CLOSE-5: package.json version 1.0.0
- [ ] CLOSE-5: CHANGELOG.md fecha
- [ ] CLOSE-5: tag v0.4.0
- [ ] CLOSE-5: PR a developer

## Success Criteria

- Todos los auto tests pasan sin errores (CLOSE-1)
- Recorrido completo MVP en browser sin bloqueantes (CLOSE-2)
- 0 bugs Critical/High sin resolver (CLOSE-4)
- PR a `developer` creado con todos los cambios del Sprint 4
- Tag `v0.4.0` creado
- Lighthouse a11y score capturado como artefacto del sprint

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| CLOSE-4 desborda tiempo por bugs inesperados | Alta | Variable | Posponer bugs Medium/Low a hotfix; no bloquear v0.4.0 por cosmética |
| Playwright tests flaky en CI (CLOSE-1) | Media | Bajo | Retry 2 configurado; flakyness localizado antes de CLOSE |
| Lighthouse score < 90 por DA-5-012 no resuelto | Media | Medio | Aceptar score entre 85-89 si DA-5-012 fue cortado; documentar en PR |

## Security Considerations

- El PR de cierre NO debe incluir archivos `.env` ni secretos
- Verificar con `git diff HEAD~1 --name-only` que no hay `.env*` en el commit
- Tag v0.4.0 es público en git history — asegurarse de que no hay credenciales en el código antes de tagear
