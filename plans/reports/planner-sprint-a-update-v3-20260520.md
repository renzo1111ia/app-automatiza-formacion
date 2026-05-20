# Planner Report — Sprint A Update v3

**Agente:** planner
**Fecha:** 20-05-2026
**Scope:** Incorporación de A-25 (crypto deprecated) y A-26 (next@16.2.6) al plan Sprint A

---

## Cambios aplicados

### `plans/260520-1342-sprint-a-hotfixes-seguridad/plan.md`

- Frontmatter: `description` actualizado ("24 → 26 vulnerabilidades"), `effort` actualizado a `105h 30min base / 106h 30min max`
- Tabla de fases: Phase 6 — tareas `A-22, A-23, A-24` → `A-22, A-23, A-24, A-25, A-26`; estimación `16h` → `23h`
- Totales: `~94h base / ~99h 30min` → `~101h base / ~106h 30min`
- Nuevo párrafo "Desglose delta v3 (ADR audit)" con +3h A-25 y +4h A-26
- Sección dependencias ampliada: A-26 bloquea A-07, A-08, A-16, A-17 (justificado por middleware bypass CVE)
- Orden óptimo de ejecución reescrito: A-26 como tarea inicial obligatoria
- Top-3 riesgos → Top-5 riesgos: añadidos "regresión next@16.2.6" y "crypto import no encontrado"
- Nueva sección "Dependencias críticas entre tareas (v3)" con nota sobre B-27 movida a A-26

### `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-06-otros-criticos.md`

- Título del Context Links: "A-22, A-23, A-24" → "A-22..A-26"
- Añadidas refs: `adr-auditoria-dependencias-20260520.md` (DEP-001, CVE-002)
- Overview: estimación `16h` → `23h`, agentes ampliados, descripción de los 5 vectores
- Orden de ejecución documentado (A-26 primero, A-24/A-25 paralelo, A-22/A-23 último)
- Key Insights: añadidos DEP-001 (crypto npm vacío) y DA-3-CVE-002 (next 19 CVEs, contexto del middleware bypass)
- Requirements: añadidos A-25 y A-26 en funcionales y no funcionales
- Architecture: añadidos bloques A-25 (proceso de migración node:crypto) y A-26 (proceso update next con rollback)
- Related Code Files: añadidos archivos afectados por A-25 (package.json + imports) y A-26 (package.json + ADR-002)
- Implementation Steps: añadidos A-25 (7 pasos) y A-26 (7 pasos con rollback explícito)
- Todo List: 11 ítems nuevos para A-25 y A-26
- Success Criteria: 4 criterios nuevos (grep crypto 0, npm list crypto, npm list next@16.2.6, smoke test bypass)
- Risk Assessment: 3 riesgos nuevos (import crypto no encontrado, regresión next, Ph3/Ph5 antes de A-26)
- Security Considerations: notas añadidas para A-25 (supply chain seguro) y A-26 (detalle CVEs y coordinación con Ph3/Ph5)

### `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-03-endpoints-sin-auth.md`

- Añadida nota de pre-requisito bloqueante en Overview: A-26 debe completarse antes de iniciar Ph3, con justificación técnica del CVE GHSA-492v-c6pp-mqqv

### `plans/260520-1342-sprint-a-hotfixes-seguridad/phase-05-privilege-escalation-rls.md`

- Añadida nota de pre-requisito bloqueante en Overview: A-26 debe completarse antes de A-16 y A-17, con justificación técnica (middleware bypass invalida la protección de is_admin en middleware.ts)

---

## Nueva estimación total

| Concepto | Antes (v2) | Después (v3) | Delta |
|----------|-----------|-------------|-------|
| Phase 6 | 16h | 23h | +7h |
| Total desarrollo base | ~94h | ~101h | +7h |
| Total desarrollo max (A-06 pg) | ~95h | ~102h | +7h |
| Total con cierre Sprint | ~99h 30min | ~106h 30min | +7h |
| Tareas Sprint A | 24 | 26 | +2 |

---

## Dependencias entre tareas — mapa actualizado

```
A-26 (Ph6, DÍA 1) → [desbloquea] A-07, A-08 (Ph3)
A-26 (Ph6, DÍA 1) → [desbloquea] A-16, A-17 (Ph5)
A-25 (Ph6, DÍA 1) → paralelizable con cualquier tarea (sin conflictos de archivos con Ph1-Ph5)
A-24 (Ph6, DÍA 1) → paralelizable con A-25 (mismo package.json — hacer en mismo commit o consecutivo)

Cadena obligatoria 1 dev:
  Ph6-A-26 → Ph2 → Ph1 → Ph3 → Ph4 → Ph5 → Ph6-A22/A23/A24/A25 → Ph7

Ph7 (cierre): requiere A-26 en 🔵 para poder validar que middleware no es bypasseable
```

**B-27 en Sprint B:** La tarea B-27 del plan Sprint B (update next, 6h estimadas) queda marcada como "MOVIDA A A-26 — completada en Sprint A". La estimación bajó de 6h a 4h porque se confirmó que es minor (no major) y no requiere upgrade de dependencias adicionales.

---

**Status:** DONE
**Summary:** Plan Sprint A actualizado a v3. Incorporadas A-25 (crypto deprecated, 3h) y A-26 (next@16.2.6, 4h) con dependencias completas, justificación técnica de CVEs, rollback plan explícito para A-26, y notas de pre-requisito en Ph3 y Ph5. Estimación total: ~106h 30min.
**Concerns:** Ninguno. A-26 como bloqueante de Ph3/Ph5 es la decisión correcta dado el CVSS 8.1 del middleware bypass.
