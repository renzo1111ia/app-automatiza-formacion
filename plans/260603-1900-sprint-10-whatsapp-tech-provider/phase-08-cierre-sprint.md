# Fase 08 — Cierre Sprint 10 (CLOSE-1..5 + protocolo estándar)

## Context Links

- Plan: [plan.md](plan.md)
- Protocolo de cierre: ver CLAUDE.md § "Phase/Sprint Completion Protocol"

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente
- **Descripción:** Cierre del sprint siguiendo el protocolo estándar del proyecto. Sprint post-MVP → CLOSE-3 estándar (no diferido a SP-4B); paso 7 E2E VPS condicional; paso 8 hand-off SP-4B N/A.

## Subtareas de cierre (SP-11-CLOSE-1..5)

| Subtarea        | Descripción                                                    | Ejecutor                         | Estim      |
| --------------- | -------------------------------------------------------------- | -------------------------------- | ---------- |
| SP-11-CLOSE-1   | Auto test (typecheck + lint + build + unit + integration)      | `af-agents:testing`              | 1h 30min   |
| SP-11-CLOSE-1.5 | Security delta (OWASP 2021) sobre diff del sprint              | `af-agents:security`             | 1h         |
| SP-11-CLOSE-2   | E2C local + WCAG 2.2 AA en rutas nuevas (pantalla de conexión) | `af-agents:testing` + Playwright | 2h 30min   |
| SP-11-CLOSE-3   | Test manual del dev (post-MVP → estándar, NO diferido)         | Dev                              | 1h         |
| SP-11-CLOSE-4   | Corrección de bugs detectados                                  | Claude orquestador               | (variable) |
| SP-11-CLOSE-5   | Push + PR a `developer` + bump `v0.11.0` (sin merge sin orden) | `af-agents:git`                  | 30min      |

**Subtotal cierre:** ~6h 30min + bugs.

## Key Insights

- Security delta es especialmente relevante aquí: tocamos OAuth (Embedded Signup), un token central de alto privilegio y CSP. Atención a A01 (control de acceso), A02 (fallos criptográficos — token central), A07 (auth).
- El paso 7 (E2E VPS) solo aplica si el VPS está desplegado y la clienta lo confirma; si no, se difiere.

## Requirements

- Verde en CLOSE-1, 1.5 y 2 antes de push.
- ADR-025 en estado `Accepted` y enlazado.
- `.env.example` con las 4 vars nuevas (placeholders).
- Migración SQL (si la hubo en fase 2) aplicada en local y documentada para VPS.

## Implementation Steps

1. CLOSE-1: `npm run typecheck && lint && build && test`. Verde obligatorio.
2. CLOSE-1.5: security delta sobre `git diff developer..HEAD`. Críticos bloquean.
3. CLOSE-2: E2C local con Playwright sobre la pantalla de conexión + WCAG.
4. CLOSE-3: test manual del dev (conectar/desconectar/enviar).
5. CLOSE-4: corregir bugs y re-correr el paso afectado.
6. CLOSE-5: push de `feature/sprint-10-whatsapp-tech-provider` + PR a `developer` (NO merge sin orden) + bump SemVer `v0.11.0`.
7. Informe final al usuario (tests + findings + diff + invitación a probar).

## Todo List

- [ ] CLOSE-1 verde
- [ ] CLOSE-1.5 sin críticos
- [ ] CLOSE-2 E2C + WCAG verde
- [ ] CLOSE-3 manual OK
- [ ] CLOSE-4 bugs corregidos
- [ ] CLOSE-5 push + PR + bump v0.11.0
- [ ] Informe final

## Success Criteria

- Todos los CLOSE en verde.
- PR a `developer` abierto (pendiente de merge por el usuario).
- RoadMap + README + memorias actualizados en el mismo ciclo.

## Risk Assessment

| Riesgo                                                          | Mitigación                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Security delta encuentra crítico en el manejo del token central | Bloquear cierre; abrir BUG-X; fix antes de PR                                     |
| App Review aún no aprobado al cerrar                            | Cerrar el sprint de código igualmente; marcar "producción full pendiente de Meta" |

## Security Considerations

- Revisión específica del flujo OAuth + almacenamiento/uso del System User token central.

## Next Steps

- Tras merge (orden del usuario): release notes `v0.11.0` profesional + actualización de la guía de tenant.
- Migración de tenants reales (fase 5) continúa post-merge según disponibilidad de Business Verification.
