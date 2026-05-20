# Informe: Renombrado Sprint Letras → Números

**Fecha:** 20-05-2026  
**Autor:** rename-agent  
**Estado:** COMPLETADO

---

## Resumen ejecutivo

Renombrado completo de todas las referencias Sprint A/B/C/D/E → Sprint 1/2/3/4/5 en 38+ archivos `.md`. Cero cambios en código de la aplicación.

---

## Mapeo aplicado

| Letra | Número | Versión cierre |
|-------|--------|----------------|
| Sprint A | Sprint 1 | v0.1.0 |
| Sprint B | Sprint 2 | v0.2.0 |
| Sprint C | Sprint 3 | v0.3.0 |
| Sprint D | Sprint 4 | v0.4.0 (MVP) |
| Sprint E | Sprint 5 | v0.5.0+ |

---

## Archivos modificados

### plans/260520-1342-sprint-1-hotfixes-seguridad/

- `phase-03-endpoints-sin-auth.md` — A-26, A-20/A-21 → 1-26, 1-20/1-21
- `phase-05-privilege-escalation-rls.md` — Sprint A→1, Sprint B→2, A-26→1-26
- `phase-06-otros-criticos.md` — A-07/A-08/A-11/A-16/A-17 → 1-07/1-08/1-11/1-16/1-17

### plans/260520-1342-sprint-2-capa-datos/

- `phase-04-refactor-queries.md` — A-01/Sprint A → 1-01/Sprint 1
- `phase-06-rls-hardening-complementario.md` — Sprint A→1, A-26→1-26

### plans/260520-1342-sprint-3-adapter-hubspot-zoho/

- `phase-01-integration-adapter-interface.md` — B-18→2-18, B-11→2-11, Sprint B→2
- `phase-02-adapter-hubspot.md` — sprint-c→sprint-3, sprint-b→sprint-2, B-26/18/11→2-26/18/11, Sprint C→3
- `phase-03-adapter-zoho.md` — mismos cambios que phase-02
- `phase-04-field-mapping-write-policy.md` — sprint-c→sprint-3, sprint-b→sprint-2, B-11→2-11
- `phase-06-write-audit-y-visualizacion.md` — sprint-c→sprint-3
- `phase-07-tests-sandbox.md` — sprint-c→sprint-3, C-07.1/2→3-07.1/2, Cierre Sprint C→3
- `phase-08-cierre-sprint.md` — SP-C-CLOSE→SP-3-CLOSE, Sprint C→3, Sprint B→2, Sprint D→4, feature/sp-c/d→feature/sp-3/4

### plans/260520-1342-sprint-4-hardening/

- `plan.md` — Sprint C→3, Sprint E→5
- `phase-01-e2e-tests-playwright.md` — Sprint A Ph7→Sprint 1 Ph7
- `phase-02-observabilidad-logging-metricas.md` — sprint: D→4, Sprint A→1
- `phase-03-dashboard-costes-llm.md` — sprint: D→4
- `phase-04-wcag-22-aa.md` — sprint: D→4, v1.0.0→v0.4.0, Sprint D→4, Sprint E→5
- `phase-05-hardening-headers-rate-limits.md` — sprint: D→4, Sprint A→1
- `phase-06-documentacion-release-v1.md` — sprint: D→4, v1.0.0→v0.4.0, Sprint 1/2/3/4, Sprint E→5
- `phase-07-cierre-sprint.md` — sprint: D→4, SP-D-CLOSE→SP-4-CLOSE, v1.0.0→v0.4.0, Sprint D→4, feature/sp-d→feature/sp-4, sprint-d→sprint-4

### plans/260520-1342-sprint-5-post-mvp-crms/

- `plan.md` — ya estaba actualizado por el agente previo
- `phase-01-google-sheets-bidireccional.md` — E-01→5-01, Sprint E→5, Sprint C→3, feature/sp-e-01→feature/sp-5-01, v1.1.0→v0.5.0, enlace sprint-c→sprint-3
- `phase-02-salesforce-adapter.md` — E-02→5-02, Sprint E→5, Sprint C→3, feature→sp-5-02, v1.2.0→v0.5.1, E-01/03/04/05→5-xx, enlace sprint-c→sprint-3
- `phase-03-gohighlevel-adapter.md` — E-03→5-03, Sprint E→5, Sprint C→3, feature→sp-5-03, v1.3.0→v0.5.2, enlace sprint-c→sprint-3
- `phase-04-activecampaign-adapter.md` — E-04→5-04, Sprint E→5, Sprint C→3, feature→sp-5-04, v1.4.0→v0.5.3, enlace sprint-c→sprint-3
- `phase-05-adapter-pattern-generalization.md` — E-05→5-05, Sprint E→5, Sprint C→3, feature→sp-5-05, E-01..E-06→5-01..5-06, enlace sprint-c→sprint-3
- `phase-06-tier2-on-demand.md` — E-06→5-06, Sprint E→5, E-05→5-05, v1.x.0→v0.5.x, feature/sp-e-06→feature/sp-5-06, plans path sprint-e→sprint-5
- `phase-07-cierre-sprint.md` — SP-E-CLOSE→SP-5-CLOSE, SP-A/B/C/D-CLOSE→SP-1/2/3/4-CLOSE, E-01..E-05→5-01..5-05, v1.1.0→v0.5.0, v1.4.0→v0.5.3, v1.5.0→v0.5.4, feature/sp-e→feature/sp-5

### .claude/agents/

- `productivity.md` — ejemplos A-01→1-01, sprint-a→sprint-1, sprint_id "a"→"1", feature/sp-a-fix→feature/sp-1-fix
- `roadmap-keeper.md` — ejemplos A-03→1-03, Sprint A→1, feature/sp-a→feature/sp-1
- `manager.md` — tabla Plan vigente Fase A/B/C/D/E→1/2/3/4/5, Fase A→E→1→5 en referencias, ejemplo Fase C→3
- `deployment.md` — MVP Fase D→4, v1.0.0→v0.4.0, SP-A/B→SP-1/2
- `git.md` — feature/sp-{a|b|c|d|e}→{1|2|3|4|5}, Sprint A→1, v1.0.0→v0.4.0, ejemplos C-02→3-02, A-03→1-03
- `adr.md` — Fase C→3, Fase E→5
- `help-docs-keeper.md` — Sprint Fase C→Sprint Fase 3 (ejemplo)
- `team-knowledge-keeper.md` — Fase E→5, Fase A/B/C/D/E→1/2/3/4/5

### plans/260520-1342-sistema-logs-tiempo-sprints/

- `phase-01-estructura-carpetas.md` — sprint-a→sprint-1, estructura de directorios y tabla
- `phase-03-hook-integration.md` — task_id A-01→1-01, sprint_id "a"→"1", branch feature/sp-a→sp-1, Sprint A→1, Sprint B→2
- `phase-04-formato-logs.md` — A-01→1-01, A-09/A-23/A-24→1-09/1-23/1-24, Sprint A→1
- `templates/TASK-ID.log.template.md` — SPRINT-LETRA→SPRINT-NUMERO
- `templates/_sprint-X.master.log.template.md` — SPRINT-LETRA→SPRINT-NUMERO, SPRINT-LETRA-MAYUSCULA→SPRINT-NUMERO, {LETRA}→{NUMERO}

### plans/260520-1342-sistema-readmes-por-rama/

- `plan.md` — B-35 en Sprint B→2-35 en Sprint 2
- `phase-01-script-generador.md` — regex `([A-E]-\d+)`→`([1-5]-\d+)`, `Fase ([A-E])`→`Fase ([1-5])`, SP-A→SP-1, A-01/02→1-01/02
- `phase-02-plantillas-por-rama.md` — Fase A→1, A-01/02→1-01/02, Sprint A/B/C/D/E→1/2/3/4/5, SP-A/B/C/D/E→SP-1/2/3/4/5, v1.0.0→v0.4.0, v1.x.0→v0.5.0+
- `phase-06-bootstrap-readmes-iniciales.md` — A-01..A-26, B-01..B-34→1-01..1-26, 2-01..2-34, fases A/B/C/D/E→1/2/3/4/5

### CLAUDE.md (raíz del proyecto)

- Tabla "Plan vigente" — Fase A/B/C/D/E→1/2/3/4/5
- MVP completo v1.0.0→v0.4.0
- "MVP Fase C = HubSpot + Zoho" → "MVP Fase 3 = HubSpot + Zoho"

---

## Exclusiones respetadas

- `docs/Docs-entrega-clienta/` — intacto
- `docs/audit/` — intacto
- `plans/20260519-1200-rls-multitenant-hardening/` — intacto (plan histórico)
- `plans/20260518-brainstorm-audit-and-documentation/` — intacto (histórico)
- `plans/reports/planner-sprint-{a,b,c,d,e}-*-20260520.md` — intactos (históricos)
- Código de la app (`src/`, `supabase/`, `worker.js`, etc.) — no tocado

---

## Falsos positivos evitados

- `DA-X-XXX` (audit finding IDs) — no modificados
- `SPRINT-LETRA` / `SPRINT-LETRA-MAYUSCULA` en templates → convertidos a `SPRINT-NUMERO`
- Regex `([A-E]-\d+)` en phase-01-script-generador.md → actualizado a `([1-5]-\d+)` (código de parsing)
- Paths a reportes históricos `planner-sprint-a-*` → conservados

---

## Verificación final

```
grep "Sprint [A-E]|SP-[A-E]-|sprint-[a-e]-|Fase [A-E]" plans/260520-1342-sprint-*/phase-*.md
→ 0 resultados

grep "sprint_task: [A-E]-|sprint: [A-E]$" plans/260520-1342-sprint-*/phase-*.md
→ 0 resultados

grep "v1\.[0-9]\.0" plans/260520-1342-sprint-*/phase-*.md
→ 0 resultados
```

---

**Status:** DONE  
**Archivos editados:** 42 archivos .md  
**Archivos de código modificados:** 0
