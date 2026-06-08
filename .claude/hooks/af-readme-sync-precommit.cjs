#!/usr/bin/env node
/**
 * af-readme-sync-precommit.cjs
 *
 * Pre-commit hook (defense in depth). Verifies that the 3 branch-specific
 * READMEs (README.md / README.staging.md / README.main.md) are in sync with
 * plans/RoadMap.md before allowing a commit on `developer` or `feature/*`.
 *
 * Wired into .husky/pre-commit. Runs as: node .claude/hooks/af-readme-sync-precommit.cjs
 *
 * Behavior:
 *   - On staging / main / detached HEAD / branches without plans/RoadMap.md:
 *     exits 0 silently (the hook does not apply there).
 *   - On developer / feature/*: runs `node scripts/generate-readmes.cjs --check`.
 *     Exits 0 if synced, exits 1 with an actionable message otherwise.
 *
 * Exit codes:
 *   0 — OK, commit can proceed.
 *   1 — Stale READMEs, commit aborted.
 */
'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ROADMAP_PATH = path.join(REPO_ROOT, 'plans', 'RoadMap.md');
const GENERATOR_PATH = path.join(REPO_ROOT, 'scripts', 'generate-readmes.cjs');

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function main() {
  if (!fs.existsSync(ROADMAP_PATH)) {
    // No RoadMap on this branch (e.g. staging, main, fresh worktree) — not our job.
    process.exit(0);
  }

  if (!fs.existsSync(GENERATOR_PATH)) {
    // Generator missing — don't block the commit; surface as a warning.
    console.warn('[af-readme-sync] WARNING: scripts/generate-readmes.cjs not found, skipping check.');
    process.exit(0);
  }

  const branch = currentBranch();
  const applies =
    branch === 'developer' ||
    branch === 'auditoria' ||
    branch.startsWith('feature/');

  if (!applies) {
    // staging, main, HEAD detached, release branches — skip.
    process.exit(0);
  }

  const result = spawnSync('node', [GENERATOR_PATH, '--check'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.status === 0) {
    // Synced — let the commit through silently.
    process.exit(0);
  }

  console.error('');
  console.error('[af-readme-sync] ERROR: los README.md no están sincronizados con plans/RoadMap.md.');
  if (result.stdout) console.error(result.stdout.trim());
  if (result.stderr) console.error(result.stderr.trim());
  console.error('');
  console.error('Solución:');
  console.error('  1. npm run generate-readmes');
  console.error('  2. git add README.md README.staging.md README.main.md');
  console.error('  3. git commit (reintenta)');
  console.error('');
  process.exit(1);
}

main();
