# Reporte — Sistema de 3 README.md por rama

**Planner:** planner (Sonnet)  
**Fecha:** 20-05-2026  
**Plan:** `plans/260520-1342-sistema-readmes-por-rama/`

---

## Resumen ejecutivo

Sistema diseñado para generar 3 README.md (developer / staging / main) desde `plans/RoadMap.md` como single source of truth. El script `generate-readmes.cjs` parsea el RoadMap con Node built-ins (0 dependencias nuevas), aplica 3 plantillas Mustache-like y produce outputs con nivel de detalle filtrado por audiencia.

---

## Archivos producidos en este plan

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `plans/260520-1342-sistema-readmes-por-rama/plan.md` | Plan overview | <80 líneas, deps entre fases, tabla de archivos tocados |
| `plans/260520-1342-sistema-readmes-por-rama/phase-01-script-generador.md` | Fase | Diseño completo de `scripts/generate-readmes.cjs` |
| `plans/260520-1342-sistema-readmes-por-rama/phase-02-plantillas-por-rama.md` | Fase | Diseño de marcadores + estructura de los 3 templates |
| `plans/260520-1342-sistema-readmes-por-rama/phase-03-ampliacion-roadmap-keeper.md` | Fase | Cambios mínimos al agente roadmap-keeper.md |
| `plans/260520-1342-sistema-readmes-por-rama/phase-04-integracion-promote-scripts.md` | Fase | Código exacto a insertar en promote.sh + promote.ps1 |
| `plans/260520-1342-sistema-readmes-por-rama/phase-05-actualizar-ci-purity-check.md` | Fase | Ampliación del workflow CI con job readme-sync-check |
| `plans/260520-1342-sistema-readmes-por-rama/phase-06-bootstrap-readmes-iniciales.md` | Fase | Pasos del bootstrap inicial + checklist de verificación |
| `plans/260520-1342-sistema-readmes-por-rama/templates/README.developer.template.md` | Template FINAL | Plantilla rama developer (full detail) |
| `plans/260520-1342-sistema-readmes-por-rama/templates/README.staging.template.md` | Template FINAL | Plantilla rama staging (fases+sprints) |
| `plans/260520-1342-sistema-readmes-por-rama/templates/README.main.template.md` | Template FINAL | Plantilla rama main (sprints solo) |
| `plans/reports/planner-sistema-readmes-20260520.md` | Reporte | Este archivo |

---

## Diagrama de flujo del sistema (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TRIGGER: cambio en plans/RoadMap.md (estado tarea, sprint, versión)    │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  roadmap-keeper agent │
              │  1. Edita RoadMap.md  │
              │  2. node scripts/     │
              │     generate-readmes  │
              │     .cjs              │
              └───────────┬───────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │  scripts/generate-readmes.cjs       │
         │                                    │
         │  parseFrontmatter()                │
         │  parseSprints() + parseTasks()     │
         │                                    │
         │  ┌──────────────────────────────┐  │
         │  │ scripts/readme-templates/    │  │
         │  │ README.developer.template.md │  │
         │  │ README.staging.template.md   │  │
         │  │ README.main.template.md      │  │
         │  └──────────────────────────────┘  │
         │                                    │
         │  applyTemplate() × 3              │
         │  validateNoMarkers() × 3          │
         │  writeIfChanged() × 3             │
         └────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    README.md      README.staging.md  README.main.md
    (developer,    (staging, resumen  (main, solo
    full detail)   fases+sprints)     sprints)
          │               │               │
          └───────────────┴───────────────┘
                          │
                          ▼
         git add RoadMap.md README.md README.staging.md README.main.md
         git commit  ← commit ATÓMICO (los 4 juntos)
                          │
          ┌───────────────┴──────────────┐
          │  scripts/promote.sh/.ps1     │
          │  (cuando se promueve)        │
          │                              │
          │  developer → staging:        │
          │    mv README.staging.md      │
          │       README.md              │
          │    rm README.main.md         │
          │                              │
          │  staging → main:             │
          │    mv README.main.md         │
          │       README.md              │
          │    rm README.staging.md      │
          └──────────────────────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │  CI — repo-purity-check.yml   │
          │                               │
          │  staging/main: NO deben       │
          │    tener README.staging.md    │
          │    ni README.main.md          │
          │                               │
          │  developer/feature: READMEs   │
          │    deben estar sincronizados  │
          │    (--check exit 0)           │
          └───────────────────────────────┘
```

---

## Decisiones tomadas

### Formato de marcadores: `{{VARIABLE}}`
Elegido sobre `<%= var %>` (ERB) o `{{ var }}` (Mustache) porque: compatible con template literals JS, legible en el archivo de plantilla, no requiere librería. La doble llave es suficientemente rara en markdown para no colisionar con contenido real.

### Parser ad-hoc vs librería (gray-matter, marked)
Se eligió parser ad-hoc con regex porque: 0 dependencias nuevas (restricción explícita del usuario), el RoadMap tiene estructura conocida y estable, las tablas GFM son predecibles. Trade-off: el parser es frágil ante cambios de formato radical en el RoadMap — mitigado con warnings en lugar de errores hard para filas inesperadas.

### Ubicación de templates: `scripts/readme-templates/`
No en `plans/` (se eliminaría al promover) ni en raíz (demasiado visible). En `scripts/` junto al script que los usa — coherente, sobrevive promote (scripts/promote.* se eliminan pero el contenido de scripts/ con el código del proyecto no).

Espera — revisión: los promote scripts también eliminan `scripts/promote.ps1` y `scripts/promote.sh` de la lista `PATHS_TO_REMOVE`. Pero NO eliminan todo `scripts/` — solo los archivos promote específicos. El script `generate-readmes.cjs` y su carpeta `readme-templates/` sobreviven el promote. Esto es correcto: no necesitas regenerar READMEs en staging/main (ya están generados), pero el script quedar en staging/main no causa daño (la carpeta `plans/` que necesita sí se elimina → el script fallaría si se ejecuta en staging/main, pero eso está documentado).

### Renombrar workflow CI: `staging-main-purity-check.yml` → `repo-purity-check.yml`
Decisión KISS: ampliar el mismo archivo en vez de crear un segundo workflow. El nombre actual ya no describe completamente el scope.

### `writeIfChanged` en el script
Evita reescribir archivos idénticos — no genera "ghost changes" en git status cuando el RoadMap no cambió de forma significativa. Compara contenido normalizado (LF).

### Commit atómico: RoadMap + 3 READMEs
Fundamental para consistencia. Si el RoadMap avanza sin los READMEs, el CI de developer fallará con `--check`. La regla se documenta en roadmap-keeper.md para que el agente la conozca.

---

## Preguntas abiertas

1. **¿El script `generate-readmes.cjs` debe añadirse al `package.json` como script npm?** (`"generate-readmes": "node scripts/generate-readmes.cjs"`). Facilita `npm run generate-readmes` y `npm run generate-readmes -- --check` en CI. Decisión pendiente del usuario.

2. **¿El job `readme-sync-check` debe ser bloqueante (required status check) o informativo?** Si es requerido, un dev no puede mergear a developer sin READMEs sincronizados. Si es informativo, puede mergear con `FAILED` — menos fricción, menos garantía. Recomendación: bloqueante, pero decidir con el usuario.

3. **¿`README.staging.md` y `README.main.md` deben añadirse al `.gitignore` de staging y main?** No aplica — `.gitignore` es por repo, no por rama. La purity check del CI es el mecanismo correcto. Sin acción necesaria.

4. **¿El RoadMap incluirá la tarea de "crear sistema README" en el propio roadmap?** Sería la tarea de documentación/scaffold de sprint 0. Si el usuario quiere trackearla como tarea B-30 (ya existe como "hook de productivity") o una tarea nueva de scaffold, el roadmap-keeper la añadiría. Pendiente decidir.

5. **¿Las plantillas en `plans/templates/` deben moverse a `scripts/readme-templates/` como parte de phase-06, o en implementación?** Este plan las crea en `plans/` (artefactos de diseño). En la implementación (phase-06) el implementador las copia a `scripts/readme-templates/`. Confirmar si el usuario quiere que el planner las cree directamente en `scripts/` para evitar duplicación.

---

**Status:** DONE  
**Summary:** Plan completo de 6 fases + 3 plantillas + reporte. Sistema diseñado sin dependencias nuevas, con commit atómico como garantía de consistencia y CI como red de seguridad.  
**Concerns/Blockers:** Ninguno — las preguntas abiertas son decisiones de configuración, no bloqueantes del diseño.
