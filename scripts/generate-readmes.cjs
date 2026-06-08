#!/usr/bin/env node
/**
 * generate-readmes.cjs — Generates README.md / README.staging.md / README.main.md
 * from plans/RoadMap.md (single source of truth) + scripts/readme-templates/.
 *
 * Usage:
 *   node scripts/generate-readmes.cjs                  Write the 3 files in repo root
 *   node scripts/generate-readmes.cjs --dry-run        Print to stdout, no writes
 *   node scripts/generate-readmes.cjs --check          Exit 1 if files are stale
 *   node scripts/generate-readmes.cjs --branch <name>  Only build one (developer|staging|main)
 *
 * 0 npm deps. Built-ins only (fs, path).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROADMAP_PATH = path.join(REPO_ROOT, 'plans', 'RoadMap.md');
const TEMPLATE_DIR = path.join(REPO_ROOT, 'scripts', 'readme-templates');
const OUTPUT = {
  developer: path.join(REPO_ROOT, 'README.md'),
  staging: path.join(REPO_ROOT, 'README.staging.md'),
  main: path.join(REPO_ROOT, 'README.main.md'),
};
const TEMPLATES = {
  developer: path.join(TEMPLATE_DIR, 'README.developer.template.md'),
  staging: path.join(TEMPLATE_DIR, 'README.staging.template.md'),
  main: path.join(TEMPLATE_DIR, 'README.main.template.md'),
};

const STATUS_TEXT = {
  '🔘': 'Pendiente',
  '🟡': 'En Desarrollo',
  '🟠': 'P. Subir GH',
  '🔵': 'Subida rama',
  '🟢': 'COMPLETADA',
  '✅': 'Reasignada',
};

// ---------- parsing ----------

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.+?)\s*$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

function splitTableRow(line) {
  // Trim leading "|" and trailing "|", then split on "|".
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isTableSeparator(line) {
  return /^\|?\s*:?-{2,}/.test(line.trim()) && /\|/.test(line);
}

function parsePhaseMetaTable(lines, startIdx) {
  // Look for the metadata block right after the phase header.
  // Table rows like "| **Sprint ID** | `SP-1` |"
  const meta = {};
  let i = startIdx;
  while (i < lines.length && !lines[i].trim().startsWith('|')) i++;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) break;
    if (isTableSeparator(line)) continue;
    const cells = splitTableRow(line);
    if (cells.length < 2) continue;
    const key = cells[0].replace(/\*\*/g, '').trim();
    const val = cells[1].replace(/`/g, '').trim();
    if (key.toLowerCase() === 'campo' && val.toLowerCase() === 'valor') continue;
    meta[key] = val;
  }
  return meta;
}

function parseStatus(cell) {
  for (const icon of Object.keys(STATUS_TEXT)) {
    if (cell.includes(icon)) return { icon, text: STATUS_TEXT[icon] };
  }
  return { icon: '', text: cell.trim() };
}

function parseRoadmap(text) {
  const normalized = normalizeLineEndings(text);
  const fm = parseFrontmatter(normalized);
  const lines = normalized.split('\n');

  const phases = [];
  let current = null;
  let currentBlock = null;
  let mode = null; // 'dev' | 'close' | null

  const phaseHeaderRe = /^##\s+Fase\s+(\d+)\s+—\s+Sprint\s+(\d+):\s+(.+?)\s*$/;
  const blockHeaderRe = /^####\s+Bloque\s+([\d.]+)\s+—\s+(.+?)\s*$/;
  const devSectionRe = /^###\s+Tareas\s+de\s+desarrollo/;
  const closeSectionRe = /^###\s+Tareas\s+de\s+cierre/;
  const taskRowRe = /^\|\s*(\d+-\d+[a-z]?|SP-\d+-CLOSE-\d+(?:\.\.\d+)?)\s*\|/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const ph = line.match(phaseHeaderRe);
    if (ph) {
      current = {
        phaseNum: ph[1],
        sprintNum: ph[2],
        title: ph[3].trim(),
        meta: parsePhaseMetaTable(lines, i + 1),
        blocks: [],
        devTasks: [],
        closeTasks: [],
      };
      phases.push(current);
      currentBlock = null;
      mode = null;
      continue;
    }
    if (!current) continue;

    if (devSectionRe.test(line)) {
      mode = 'dev';
      currentBlock = null;
      continue;
    }
    if (closeSectionRe.test(line)) {
      mode = 'close';
      currentBlock = null;
      continue;
    }

    const bh = line.match(blockHeaderRe);
    if (bh && mode === 'dev') {
      currentBlock = { id: bh[1], title: bh[2].trim(), tasks: [] };
      current.blocks.push(currentBlock);
      continue;
    }

    const tr = line.match(taskRowRe);
    if (tr) {
      const cells = splitTableRow(line);
      // Skip subtotal rows (already filtered by ID regex, but defensive).
      if (cells[0].toLowerCase().includes('subtotal')) continue;
      const id = cells[0].replace(/\*\*/g, '').trim();
      const desc = (cells[1] || '').replace(/^~~|~~$/g, '').trim();
      const est = (cells[2] || '').replace(/~~/g, '').replace(/\*\*/g, '').trim();
      const statusCell = (cells[3] || '').trim();
      const status = parseStatus(statusCell);
      const task = { id, desc, est, statusIcon: status.icon, statusText: status.text };

      if (mode === 'close') {
        current.closeTasks.push(task);
      } else if (mode === 'dev') {
        current.devTasks.push(task);
        if (currentBlock) currentBlock.tasks.push(task);
      }
    }
  }

  if (phases.length === 0) {
    console.error('ERROR: no phases found in RoadMap.md — parsing failed');
    process.exit(1);
  }

  return { frontmatter: fm, phases };
}

// ---------- builders ----------

function phaseStats(phase) {
  const real = phase.devTasks.filter((t) => t.statusIcon !== '✅');
  const done = real.filter((t) => t.statusIcon === '🟢').length;
  const total = real.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

function phaseSprintStatus(phase) {
  return phase.meta['Estado del sprint'] || '🔘 Pendiente';
}

function phaseVersion(phase) {
  return phase.meta['Versión objetivo al cierre'] || '—';
}

function phaseEstTotal(phase) {
  return phase.meta['Estimación total'] || '—';
}

function phaseStart(phase) {
  return phase.meta['Inicio'] || '—';
}

function phaseEndEst(phase) {
  return phase.meta['Fin Est.'] || '—';
}

function buildRoadmapFull(parsed) {
  const updated = parsed.frontmatter.last_updated || '';
  const out = [];
  out.push(`> Fuente: \`plans/RoadMap.md\` · Actualizado: ${updated}`);
  out.push('');

  for (const ph of parsed.phases) {
    out.push(`### Fase ${ph.phaseNum} — Sprint ${ph.sprintNum}: ${ph.title}`);
    out.push('');
    out.push('| Campo | Valor |');
    out.push('|-------|-------|');
    out.push(`| Sprint ID | ${ph.meta['Sprint ID'] || '—'} |`);
    out.push(`| Versión objetivo | ${phaseVersion(ph)} |`);
    out.push(`| Estado | ${phaseSprintStatus(ph)} |`);
    out.push(`| Estimación total | ${phaseEstTotal(ph)} |`);
    out.push(`| Rama sugerida | ${ph.meta['Rama de trabajo sugerida'] || '—'} |`);
    out.push('');

    if (ph.blocks.length > 0) {
      for (const b of ph.blocks) {
        out.push(`#### Bloque ${b.id} — ${b.title}`);
        out.push('');
        out.push('| ID | Tarea | Est. | Estado |');
        out.push('|----|-------|------|--------|');
        for (const t of b.tasks) {
          out.push(`| ${t.id} | ${escapeCell(t.desc)} | ${t.est} | ${t.statusIcon} ${t.statusText} |`);
        }
        out.push('');
      }
    } else if (ph.devTasks.length > 0) {
      out.push('| ID | Tarea | Est. | Estado |');
      out.push('|----|-------|------|--------|');
      for (const t of ph.devTasks) {
        out.push(`| ${t.id} | ${escapeCell(t.desc)} | ${t.est} | ${t.statusIcon} ${t.statusText} |`);
      }
      out.push('');
    }

    if (ph.closeTasks.length > 0) {
      out.push(`##### Tareas de cierre — Sprint ${ph.sprintNum}`);
      out.push('');
      out.push('| ID | Tarea | Est. | Estado |');
      out.push('|----|-------|------|--------|');
      for (const t of ph.closeTasks) {
        out.push(`| ${t.id} | ${escapeCell(t.desc)} | ${t.est} | ${t.statusIcon} ${t.statusText} |`);
      }
      out.push('');
    }
  }

  out.push('### Resumen por sprint');
  out.push('');
  out.push('| Sprint | Versión | Estado | Tareas dev | % Completado | Est. dev |');
  out.push('|--------|---------|--------|-----------|-------------|---------|');
  for (const ph of parsed.phases) {
    const s = phaseStats(ph);
    out.push(
      `| ${ph.sprintNum} | ${phaseVersion(ph)} | ${phaseSprintStatus(ph)} | ${s.total} | ${s.pct}% | ${phaseEstTotal(ph)} |`,
    );
  }
  out.push('');
  return out.join('\n');
}

function buildRoadmapByPhaseAndSprint(parsed) {
  const updated = parsed.frontmatter.last_updated || '';
  const out = [];
  out.push(`> Actualizado: ${updated}`);
  out.push('');
  out.push('| Sprint | Fase | Versión | Estado | % Completado | Est. total | Inicio | Fin Est. |');
  out.push('|--------|------|---------|--------|-------------|-----------|--------|---------|');
  for (const ph of parsed.phases) {
    const s = phaseStats(ph);
    const sprintId = ph.meta['Sprint ID'] || `SP-${ph.sprintNum}`;
    out.push(
      `| ${sprintId} | ${escapeCell(ph.title)} | ${phaseVersion(ph)} | ${phaseSprintStatus(ph)} | ${s.pct}% | ${phaseEstTotal(ph)} | ${phaseStart(ph)} | ${phaseEndEst(ph)} |`,
    );
  }
  out.push('');
  return out.join('\n');
}

function buildRoadmapBySprint(parsed) {
  const out = [];
  out.push('| Sprint | Versión | Estado | Release date |');
  out.push('|--------|---------|--------|-------------|');
  for (const ph of parsed.phases) {
    const sprintId = ph.meta['Sprint ID'] || `SP-${ph.sprintNum}`;
    const finReal = ph.meta['Fin Real'] || '—';
    out.push(`| ${sprintId} | ${phaseVersion(ph)} | ${phaseSprintStatus(ph)} | ${finReal} |`);
  }
  out.push('');
  out.push('> "Release date" se rellena cuando el sprint pasa a 🟢 COMPLETADA (`Fin Real` del RoadMap).');
  return out.join('\n');
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

// ---------- template engine ----------

function applyTemplate(text, vars) {
  return text.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m,
  );
}

function validateNoMarkers(text, filename) {
  const left = text.match(/\{\{[A-Z_][A-Z0-9_]*\}\}/g);
  if (left && left.length > 0) {
    console.error(`ERROR: unresolved markers in ${filename}: ${[...new Set(left)].join(', ')}`);
    process.exit(1);
  }
}

function readTemplate(branch) {
  const p = TEMPLATES[branch];
  if (!fs.existsSync(p)) {
    console.error(`ERROR: template not found: ${p}`);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

// ---------- io ----------

function writeIfChanged(filepath, content) {
  const next = normalizeLineEndings(content);
  if (fs.existsSync(filepath)) {
    const current = normalizeLineEndings(fs.readFileSync(filepath, 'utf8'));
    if (current === next) return { written: false, path: filepath };
  }
  fs.writeFileSync(filepath, next, 'utf8');
  return { written: true, path: filepath };
}

function isStale(filepath, content) {
  const next = normalizeLineEndings(content);
  if (!fs.existsSync(filepath)) return true;
  const current = normalizeLineEndings(fs.readFileSync(filepath, 'utf8'));
  return current !== next;
}

// ---------- cli ----------

function parseArgs(argv) {
  const args = { dryRun: false, check: false, branch: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--check') args.check = true;
    else if (a === '--branch') {
      args.branch = argv[++i];
      if (!OUTPUT[args.branch]) {
        console.error(`ERROR: --branch must be one of: ${Object.keys(OUTPUT).join(', ')}`);
        process.exit(1);
      }
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/generate-readmes.cjs [--dry-run|--check] [--branch <developer|staging|main>]');
      process.exit(0);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(ROADMAP_PATH)) {
    console.error(`ERROR: plans/RoadMap.md not found at ${ROADMAP_PATH}`);
    process.exit(1);
  }

  const roadmapText = fs.readFileSync(ROADMAP_PATH, 'utf8');
  const parsed = parseRoadmap(roadmapText);

  if (!parsed.frontmatter.project_version) {
    console.warn("WARNING: project_version not found in frontmatter, using 'v0.0.0'");
  }

  const vars = {
    PROJECT_VERSION: parsed.frontmatter.project_version || 'v0.0.0',
    LAST_UPDATED: parsed.frontmatter.last_updated || '',
    ROADMAP_FULL: buildRoadmapFull(parsed),
    ROADMAP_BY_PHASE_AND_SPRINT: buildRoadmapByPhaseAndSprint(parsed),
    ROADMAP_BY_SPRINT: buildRoadmapBySprint(parsed),
  };

  const branches = args.branch ? [args.branch] : ['developer', 'staging', 'main'];
  const results = [];
  let staleCount = 0;

  for (const branch of branches) {
    const tpl = readTemplate(branch);
    const rendered = applyTemplate(tpl, vars);
    validateNoMarkers(rendered, `README ${branch}`);
    const outPath = OUTPUT[branch];

    if (args.check) {
      const stale = isStale(outPath, rendered);
      if (stale) {
        staleCount++;
        console.error(`STALE: ${path.relative(REPO_ROOT, outPath)} is out of date with RoadMap.md`);
      } else {
        console.log(`OK:    ${path.relative(REPO_ROOT, outPath)}`);
      }
    } else if (args.dryRun) {
      console.log(`\n===== ${branch} → ${path.relative(REPO_ROOT, outPath)} =====\n`);
      console.log(rendered);
    } else {
      const r = writeIfChanged(outPath, rendered);
      results.push(r);
      console.log(`${r.written ? 'WROTE' : 'SKIP '} ${path.relative(REPO_ROOT, r.path)}`);
    }
  }

  if (args.check) {
    if (staleCount > 0) {
      console.error(`\n${staleCount} file(s) stale. Run \`npm run generate-readmes\` to update.`);
      process.exit(1);
    }
    console.log('\nAll READMEs in sync with plans/RoadMap.md.');
  } else if (!args.dryRun) {
    const written = results.filter((r) => r.written).length;
    const skipped = results.length - written;
    console.log(`\nGenerated ${written} file(s) (${skipped} skipped — no changes).`);
  }
}

main();
