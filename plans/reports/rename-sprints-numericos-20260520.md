# Informe: Renombrado Sprint Letras → Números

**Fecha:** 20-05-2026  
**Autor:** rename-agent  
**Estado:** COMPLETADO

---

## Resumen ejecutivo

Renombrado completo de todas las referencias Sprint 0/B/C/D/E → Sprint 0/2/3/4/5 en 38+ archivos `.md`. Cero cambios en código de la aplicación.

---

## Mapeo aplicado

| Letra | Número | Versión cierre |
|-------|--------|----------------|
| Sprint 0 | Sprint 0 | v0.1.0 |
| Sprint 1 | Sprint 1 | v0.2.0 |
| Sprint 2 | Sprint 2 | v0.3.0 |
| Sprint 3 | Sprint 3 | v0.4.0 (MVP) |
| Sprint 4 | Sprint 4 | v0.5.0+ |

---

## Archivos modificados

### plans/260520-1342-sprint-0-hotfixes-seguridad/

- `phase-03-endpoints-sin-auth.md` — A-26, A-20/A-21 → 1-26, 1-20/1-21
- `phase-05-privilege-escalation-rls.md` — Sprint 0→1, Sprint 1→2, A-26→1-26
- `phase-06-otros-criticos.md` — A-07/A-08/A-11/A-16/A-17 → 1-07/1-08/1-11/1-16/1-17

### plans/260520-1342-sprint-1-capa-datos/

- `phase-04-refactor-queries.md` — A-01/Sprint 0 → 1-01/Sprint 0
- `phase-06-rls-hardening-complementario.md` — Sprint 0→1, A-26→1-26

### plans/260520-1342-sprint-2-adapter-hubspot-zoho/

- `phase-01-integration-adapter-interface.md` — 1-18→2-18, 1-11→2-11, Sprint 1→2
- `phase-02-adapter-hubspot.md` — sprint-c→sprint-3, sprint-b→sprint-2, 1-26/18/11→2-26/18/11, Sprint 2→3
- `phase-03-adapter-zoho.md` — mismos cambios que phase-02
- `phase-04-field-mapping-write-policy.md` — sprint-c→sprint-3, sprint-b→sprint-2, 1-11→2-11
- `phase-06-write-audit-y-visualizacion.md` — sprint-c→sprint-3
- `phase-07-tests-sandbox.md` — sprint-c→sprint-3, 2-07.1/2→3-07.1/2, Cierre Sprint 2→3
- `phase-08-cierre-sprint.md` — SP-C-CLOSE→SP-3-CLOSE, Sprint 2→3, Sprint 1→2, Sprint 3→4, feature/sp-c/d→feature/sp-3/4

### plans/260520-1342-sprint-3-hardening/

- `plan.md` — Sprint 2→3, Sprint 4→5
- `phase-01-e2e-tests-playwright.md` — Sprint 0 Ph7→Sprint 0 Ph7
- `phase-02-observabilidad-logging-metricas.md` — sprint: D→4, Sprint 0→1
- `phase-03-dashboard-costes-llm.md` — sprint: D→4
- `phase-04-wcag-22-aa.md` — sprint: D→4, v1.0.0→v0.4.0, Sprint 3→4, Sprint 4→5
- `phase-05-hardening-headers-rate-limits.md` — sprint: D→4, Sprint 0→1
- `phase-06-documentacion-release-v1.md` — sprint: D→4, v1.0.0→v0.4.0, Sprint 0/2/3/4, Sprint 4→5
- `phase-07-cierre-sprint.md` — sprint: D→4, SP-D-CLOSE→SP-4-CLOSE, v1.0.0→v0.4.0, Sprint 3→4, feature/sp-d→feature/sp-4, sprint-d→sprint-4

### plans/260520-1342-sprint-4-post-mvp-crms/

- `plan.md` — ya estaba actualizado por el agente previo
- `phase-01-google-sheets-bidireccional.md` — 4-01→5-01, Sprint 4→5, Sprint 2→3, feature/sp-e-01→feature/sp-5-01, v1.1.0→v0.5.0, enlace sprint-c→sprint-3
- `phase-02-salesforce-adapter.md` — 4-02→5-02, Sprint 4→5, Sprint 2→3, feature→sp-5-02, v1.2.0→v0.5.1, 4-01/03/04/05→5-xx, enlace sprint-c→sprint-3
- `phase-03-gohighlevel-adapter.md` — 4-03→5-03, Sprint 4→5, Sprint 2→3, feature→sp-5-03, v1.3.0→v0.5.2, enlace sprint-c→sprint-3
- `phase-04-activecampaign-adapter.md` — 4-04→5-04, Sprint 4→5, Sprint 2→3, feature→sp-5-04, v1.4.0→v0.5.3, enlace sprint-c→sprint-3
- `phase-05-adapter-pattern-generalization.md` — 4-05→5-05, Sprint 4→5, Sprint 2→3, feature→sp-5-05, 4-01..4-06→5-01..5-06, enlace sprint-c→sprint-3
- `phase-06-tier2-on-demand.md` — 4-06→5-06, Sprint 4→5, 4-05→5-05, v1.x.0→v0.5.x, feature/sp-e-06→feature/sp-5-06, plans path sprint-e→sprint-5
- `phase-07-cierre-sprint.md` — SP-E-CLOSE→SP-5-CLOSE, SP-A/B/C/D-CLOSE→SP-1/2/3/4-CLOSE, 4-01..4-05→5-01..5-05, v1.1.0→v0.5.0, v1.4.0→v0.5.3, v1.5.0→v0.5.4, feature/sp-e→feature/sp-5

### .claude/agents/

- `productivity.md` — ejemplos A-01→1-01, sprint-a→sprint-1, sprint_id "a"→"1", feature/sp-a-fix→feature/sp-1-fix
- `roadmap-keeper.md` — ejemplos A-03→1-03, Sprint 0→1, feature/sp-a→feature/sp-1
- `manager.md` — tabla Plan vigente Fase 0/B/C/D/E→1/2/3/4/5, Fase 0→E→1→5 en referencias, ejemplo Fase 2→3
- `deployment.md` — MVP Fase 3→4, v1.0.0→v0.4.0, SP-A/B→SP-1/2
- `git.md` — feature/sp-{a|b|c|d|e}→{1|2|3|4|5}, Sprint 0→1, v1.0.0→v0.4.0, ejemplos 2-02→3-02, A-03→1-03
- `adr.md` — Fase 2→3, Fase 4→5
- `help-docs-keeper.md` — Sprint Fase 2→Sprint Fase 2 (ejemplo)
- `team-knowledge-keeper.md` — Fase 4→5, Fase 0/B/C/D/E→1/2/3/4/5

### plans/260520-1342-sistema-logs-tiempo-sprints/

- `phase-01-estructura-carpetas.md` — sprint-a→sprint-1, estructura de directorios y tabla
- `phase-03-hook-integration.md` — task_id A-01→1-01, sprint_id "a"→"1", branch feature/sp-a→sp-1, Sprint 0→1, Sprint 1→2
- `phase-04-formato-logs.md` — A-01→1-01, A-09/A-23/A-24→1-09/1-23/1-24, Sprint 0→1
- `templates/TASK-ID.log.template.md` — SPRINT-LETRA→SPRINT-NUMERO
- `templates/_sprint-X.master.log.template.md` — SPRINT-LETRA→SPRINT-NUMERO, SPRINT-LETRA-MAYUSCULA→SPRINT-NUMERO, {LETRA}→{NUMERO}

### plans/260520-1342-sistema-readmes-por-rama/

- `plan.md` — 1-35 en Sprint 1→2-35 en Sprint 1
- `phase-01-script-generador.md` — regex `([A-E]-\d+)`→`([1-5]-\d+)`, `Fase ([A-E])`→`Fase ([1-5])`, SP-A→SP-1, A-01/02→1-01/02
- `phase-02-plantillas-por-rama.md` — Fase 0→1, A-01/02→1-01/02, Sprint 0/B/C/D/E→1/2/3/4/5, SP-A/B/C/D/E→SP-1/2/3/4/5, v1.0.0→v0.4.0, v1.x.0→v0.5.0+
- `phase-06-bootstrap-readmes-iniciales.md` — A-01..A-26, 1-01..1-34→1-01..1-26, 2-01..2-34, fases A/B/C/D/E→1/2/3/4/5

### CLAUDE.md (raíz del proyecto)

- Tabla "Plan vigente" — Fase 0/B/C/D/E→1/2/3/4/5
- MVP completo v1.0.0→v0.4.0
- "MVP Fase 2 = HubSpot + Zoho" → "MVP Fase 2 = HubSpot + Zoho"

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
