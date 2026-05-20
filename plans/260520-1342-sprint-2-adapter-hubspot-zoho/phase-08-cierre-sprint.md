# Phase 08 — Cierre Sprint 2 (SP-3-CLOSE-1..5)

## Context Links

- Sprint 1 cierre: `plans/260520-1342-sprint-1-capa-datos/plan.md` §Cierre
- CLAUDE.md — Phase/Sprint 3ompletion Protocol
- RoadMap: `plans/RoadMap.md` §SP-3-CLOSE-1..5

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente — requiere 3-01..3-07 todos completos y con criterios de éxito cumplidos
- **Descripción:** Tareas de cierre obligatorias del Sprint 2: auto tests, browser tests del flujo OAuth, test manual del dev, corrección de bugs, PR a `developer` y bump de versión a `v0.3.0`.

## Tareas de cierre

### SP-3-CLOSE-1 — Auto tests (1h 30min)

```bash
npm run typecheck    # 0 errores TypeScript
npm run lint         # 0 errores ESLint
npm run build        # build exitoso sin warnings críticos
npm test             # todos los tests unitarios pass
```

**Criterio de paso:** Todos los comandos con código de salida 0.

### SP-3-CLOSE-2 — Test E2E Local + WCAG 2.2 AA (2h 30min)

Playwright — flujos a cubrir:
1. **Flujo OAuth HubSpot completo:** `/admin/integraciones` → "Conectar HubSpot" → OAuth sandbox → callback → estado "Conectado" visible
2. **Flujo OAuth Zoho completo (EU):** `/admin/integraciones` → "Conectar Zoho" → seleccionar EU → OAuth sandbox → callback → estado "Conectado"
3. **Field mapping:** editar política de un campo → guardar → verificar persistido
4. **Historial de cambios:** push con `overwrite_with_audit` → verificar entrada en tabla audit log UI
5. **WCAG 2.2 AA:** focus traps en modales, aria-labels en botones de acción, contraste de colores

Prerrequisito: ngrok activo para OAuth callbacks en local.

### SP-3-CLOSE-3 — Test Manual del Dev (1h)

Guía para el desarrollador:
1. Abrir `/admin/integraciones` en browser
2. Conectar cuenta HubSpot sandbox → verificar "Conectado"
3. Conectar cuenta Zoho Developer Edition (EU) → verificar "Conectado"
4. Ir a un lead de prueba → disparar "Sincronizar con CRM" → verificar en HubSpot sandbox que el contact fue creado
5. Modificar un campo de `overwrite_with_audit` → verificar entrada en historial de cambios
6. Verificar que "Probar conexión" funciona para ambos CRMs
7. Verificar que desconectar limpia el estado

### SP-3-CLOSE-4 — Corrección de Bugs (variable)

Subtareas dinámicas creadas durante los tests anteriores.
- Priorizar bugs que bloqueen criterios de éxito del sprint
- Bugs cosméticos: documentar para Sprint 3 si no son bloqueantes

### SP-3-CLOSE-5 — PR + Bump versión (30min)

```bash
# 1. Asegurar rama actualizada
git checkout feature/sp-3-adapter-hubspot-zoho
git pull origin developer

# 2. Bump versión (patch → minor al cerrar sprint)
npm version minor   # v0.2.x → v0.3.0

# 3. Commit
git add package.json package-lock.json
git commit -m "chore: bump version to v0.3.0 — Sprint 2 complete"

# 4. Push y crear PR
git push origin feature/sp-3-adapter-hubspot-zoho
gh pr create --title "Sprint 2: Adapter HubSpot + Zoho MVP (v0.3.0)" \
  --body "..."
  --base developer

# 5. (Con autorización explícita del usuario) Merge PR a developer
# 6. Crear rama para Sprint 3
git checkout developer
git pull
git checkout -b feature/sp-4-hardening
```

**NOTA:** El merge a `developer` y la creación de rama Sprint 3 requieren autorización explícita del usuario antes de ejecutar.

## Checklist de cierre

- [ ] SP-3-CLOSE-1: typecheck + lint + build + tests pass
- [ ] SP-3-CLOSE-2: Playwright flujos OAuth + field mapping + audit log + WCAG
- [ ] SP-3-CLOSE-3: Test manual dev — ambos CRMs conectados y funcionales
- [ ] SP-3-CLOSE-4: Bugs críticos resueltos
- [ ] SP-3-CLOSE-5: PR creado a `developer` + versión `v0.3.0`

## Criterios globales de "DONE" Sprint 2

- [ ] `npm run build` sin errores
- [ ] Tenant puede conectar HubSpot via OAuth2 en UI
- [ ] Tenant puede conectar Zoho via OAuth2 (con selección de región) en UI
- [ ] `pushContact` respeta R-014 append-only verificado en sandbox
- [ ] `pushContact` con `overwrite_with_audit` genera entrada en `crm_write_audit`
- [ ] Webhook HubSpot valida `X-HubSpot-Signature-v3`
- [ ] Webhook Zoho valida token de canal
- [ ] Canal Zoho se renueva automáticamente antes de expirar
- [ ] RLS: tenant A no puede ver integraciones ni audit de tenant B
- [ ] Tests sandbox 3-07 todos pass
- [ ] PR a `developer` aprobado

## Estimación cierre

| Tarea | Estimación |
|-------|-----------|
| SP-3-CLOSE-1 Auto tests | 1h 30min |
| SP-3-CLOSE-2 Playwright + WCAG | 2h 30min |
| SP-3-CLOSE-3 Test manual | 1h |
| SP-3-CLOSE-4 Bugs (estimado) | variable (~4h buffer) |
| SP-3-CLOSE-5 PR + bump | 30min |
| **Total cierre** | **~10h** |

## Agentes Esden asignados

- `af-agents:testing` — SP-3-CLOSE-1 + SP-3-CLOSE-2
- Dev humano — SP-3-CLOSE-3 (test manual)
- `af-agents:code` — SP-3-CLOSE-4 bug fixes
- `af-agents:manager` — SP-3-CLOSE-5 PR + versión

## Next Steps

- Post-cierre: notificar al roadmap-keeper para actualizar `plans/RoadMap.md` Sprint 2 con estimaciones reales + estado "Completado"
- Sprint 3: Hardening (tests E2E, observabilidad, dashboards de costes)
