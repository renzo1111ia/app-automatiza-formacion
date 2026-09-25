# Phase 01 — Script generador `generate-readmes.cjs`

**Contexto:** [plan.md](plan.md) · [RoadMap.md](../RoadMap.md) · [roadmap-keeper.md](../../.claude/agents/roadmap-keeper.md)

**last_updated:** 2026-05-20

## Overview

- **Prioridad:** P1 — bloqueante de phase-06 (bootstrap)
- **Estado:** Pendiente
- **Estimación:** 2h
- **Archivo destino:** `scripts/generate-readmes.cjs`
- **Dependencias:** Ninguna (primer en ejecutarse)

## Key Insights

- Node built-ins únicamente: `fs`, `path`, `readline`. 0 dependencias nuevas.
- El RoadMap usa markdown puro + tablas GFM + frontmatter YAML. El parser debe ser ad-hoc (no usar `gray-matter` — requiere install).
- Los marcadores `{{VARIABLE}}` son template literals de Node — sin librería Mustache.
- La restricción de cross-platform (Windows/Linux/macOS) obliga a usar `path.join`, no strings con `/`.

## Arquitectura del script

### Módulos internos (funciones, no archivos separados)

```
generate-readmes.cjs
  ├── parseFrontmatter(text)          → {title, project_version, last_updated}
  ├── parseSprints(text)              → [{id, version, status, est, start, end_est, end_real}]
  ├── parsePhases(text)               → [{id, name, sprintId, sprints[], tasks[]}]
  ├── parseTasks(text)                → [{id, desc, est, status, notes, refs}]
  ├── buildRoadmapFull(phases)        → string markdown (developer)
  ├── buildRoadmapByPhaseAndSprint(phases) → string markdown (staging)
  ├── buildRoadmapBySprint(sprints)   → string markdown (main)
  ├── applyTemplate(templateText, vars) → string (reemplaza {{MARKERS}})
  ├── validateNoMarkers(text, filename) → void (lanza error si quedan {{...}})
  ├── writeIfChanged(filepath, content) → void (skip si identical)
  └── main()                          → orquesta todo
```

### Data flow

```
plans/RoadMap.md
      │
      ▼ parseFrontmatter()
  {project_version, last_updated}
      │
      ▼ parseSprints() + parsePhases() + parseTasks()
  {sprints[], phases[], tasks[]}
      │
      ├──▶ buildRoadmapFull()         → ROADMAP_FULL (developer)
      ├──▶ buildRoadmapByPhaseAndSprint() → ROADMAP_BY_PHASE_AND_SPRINT (staging)
      └──▶ buildRoadmapBySprint()     → ROADMAP_BY_SPRINT (main)
             │
             ▼ applyTemplate() × 3 templates
      {README.md, README.staging.md, README.main.md}
             │
             ▼ validateNoMarkers() × 3
      writeIfChanged() × 3
             │
             ▼
      Console: "Generated N files (M skipped — no changes)"
```

## Parsing strategy (ad-hoc, sin dependencias)

### Frontmatter YAML

Extraer bloque entre `---` y `---` al inicio del archivo. Parsear líneas `key: value` con regex simple.

```js
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
// Para cada línea: /^(\w[\w_]+):\s*(.+)$/
```

### Sprints (tablas de metadatos por fase)

Cada fase tiene una tabla con "Sprint ID", "Versión objetivo al cierre", "Estado del sprint", etc.

```js
// Detectar cabecera de fase: /^## Fase ([1-5]) — Sprint \d+: (.+)/
// Dentro de cada bloque de fase, extraer tabla de metadatos:
// | Sprint ID | SP-1 |  → {sprint_id: 'SP-1'}
// | Estado del sprint | 🔘 Pendiente | → {status: '🔘 Pendiente'}
```

### Tareas individuales

Tablas GFM con columnas: `| ID | Tarea | Estimación | Estado | ... |`

```js
// Detectar filas que empiezan con | 1-\d\d | o | 2-\d\d | etc.
// Regex: /^\| ([1-5]-\d+[a-z]?) \| (.+?) \| (.+?) \| (.+?) \|/
// Excluir filas de sumatorio: /^\| \*\*Subtotal/
```

### Estado de tarea (iconos Unicode)

El script mapea iconos a texto para los resúmenes:

```js
const STATUS_MAP = {
  '🔘': 'Pendiente',
  '🟡': 'En Desarrollo',
  '🟠': 'P. Subir GH',
  '🔵': 'Subida rama',
  '🟢': 'COMPLETADA',
  '✅': 'Reasignada'
};
```

### Porcentaje completado por sprint (para staging)

```js
// % = count(tareas 🟢) / count(tareas totales) × 100
// Excluir tareas marcadas ✅ Reasignada del denominador
```

## Flags CLI

| Flag | Comportamiento |
|------|---------------|
| (ninguno) | Genera los 3 archivos en raíz del repo |
| `--dry-run` | Imprime los 3 outputs en stdout, no escribe archivos |
| `--check` | Compara contenido actual vs generado; exit 1 si difieren (útil en CI) |
| `--branch developer` | Genera solo `README.md` |
| `--branch staging` | Genera solo `README.staging.md` |
| `--branch main` | Genera solo `README.main.md` |

Combinable: `--dry-run --branch staging`

## Validaciones internas

| Caso | Comportamiento |
|------|---------------|
| `plans/RoadMap.md` no existe | `console.error("ERROR: plans/RoadMap.md not found"); process.exit(1)` |
| Frontmatter no parsea `project_version` | `console.warn("WARNING: project_version not found, using 'v0.0.0'")` |
| Template no encontrado | `console.error("ERROR: template not found: ${path}"); process.exit(1)` |
| Marcadores sin resolver `{{ALGO}}` | `console.error("ERROR: unresolved markers in README.X.md: {{ALGO}}"); process.exit(1)` |
| 0 sprints extraídos | `console.error("ERROR: no sprints found in RoadMap.md — parsing failed"); process.exit(1)` |
| Tabla de tareas malformada | `console.warn("WARNING: skipping malformed row in phase X: <raw>")` |

## Rutas de archivos (todas relativas al repo root)

El script detecta el repo root como el directorio que contiene `package.json`. Se lanza con `node scripts/generate-readmes.cjs` desde la raíz.

```js
const REPO_ROOT = path.resolve(__dirname, '..');  // scripts/ está en repo_root/scripts/
const ROADMAP_PATH = path.join(REPO_ROOT, 'plans', 'RoadMap.md');
const TEMPLATE_DIR = path.join(REPO_ROOT, 'scripts', 'readme-templates');
const OUTPUT = {
  developer: path.join(REPO_ROOT, 'README.md'),
  staging:   path.join(REPO_ROOT, 'README.staging.md'),
  main:      path.join(REPO_ROOT, 'README.main.md'),
};
```

## Requirements

### Funcionales
- Parsear `plans/RoadMap.md` sin dependencias externas
- Generar 3 outputs con distinto nivel de detalle
- Soporte flags `--dry-run`, `--check`, `--branch`
- Mensajes de error accionables (indica qué falta, cómo se arregla)
- `writeIfChanged`: no reescribir si el contenido es idéntico (evita falsos dirty en git)

### No funcionales
- Cross-platform: Windows + Linux + macOS
- < 300 líneas (dividir en funciones si supera — KISS)
- Sin dependencias npm nuevas
- Tiempo de ejecución < 2s en cualquier máquina

## Todo list

- [ ] Diseñar estructura de funciones (ver Arquitectura)
- [ ] Implementar `parseFrontmatter()`
- [ ] Implementar `parseSprints()` + `parsePhases()` + `parseTasks()`
- [ ] Implementar `buildRoadmapFull()` (developer)
- [ ] Implementar `buildRoadmapByPhaseAndSprint()` (staging)
- [ ] Implementar `buildRoadmapBySprint()` (main)
- [ ] Implementar `applyTemplate()` + `validateNoMarkers()`
- [ ] Implementar CLI flag parsing (manual, sin minimist)
- [ ] Añadir validaciones de error
- [ ] Test manual: `node scripts/generate-readmes.cjs --dry-run`

## Scripts en `package.json` (3-1 — Decisión confirmada)

Añadir al bloque `"scripts"` de `package.json` las siguientes dos entradas:

```json
"generate-readmes": "node scripts/generate-readmes.cjs",
"generate-readmes:check": "node scripts/generate-readmes.cjs --check"
```

Uso esperado:
- `npm run generate-readmes` — genera / actualiza los 3 READMEs en raíz del repo
- `npm run generate-readmes:check` — comprueba si los READMEs están al día (exit 1 si no); lo llama el CI y el pre-commit hook

## Success criteria

- `npm run generate-readmes` produce los 3 outputs sin errores
- `npm run generate-readmes:check` retorna exit 0 cuando los archivos están al día
- `npm run generate-readmes:check` retorna exit 1 cuando RoadMap cambió y READMEs no se regeneraron
- Ejecuta en Windows PowerShell y Linux bash sin modificaciones
- 0 nuevas dependencias npm (solo los 2 scripts en `"scripts"`, no en `"dependencies"`)

## Risk Assessment

| Riesgo | Likelihood | Impact | Mitigación |
|--------|-----------|--------|-----------|
| Parser falla con nuevas secciones de RoadMap | Media | Alto | Diseñar parser tolerante — warnings en vez de errores para filas inesperadas |
| Iconos Unicode en tablas rompen regex en Windows | Media | Medio | Testear en Windows; usar `\uXXXX` si necesario |
| Script demasiado largo (>300 líneas) | Baja | Bajo | Extraer helpers en funciones, mantener 1 solo fichero (KISS) |
| `writeIfChanged` no detecta diferencias por CRLF | Media | Bajo | Normalizar line endings a `\n` antes de comparar |

## Security Considerations

- El script sólo lee `plans/RoadMap.md` y templates — no accede a red ni ejecuta código externo.
- Los outputs son archivos de documentación — no contienen secretos.
- No añadir paths de archivos configurables por usuario — hardcoded por diseño (KISS).

## Next Steps

Phase-02 (templates) puede ejecutarse en paralelo con esta fase.
Phase-06 (bootstrap) depende de que esta fase esté DONE.
