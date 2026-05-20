#!/usr/bin/env node
/**
 * PreToolUse Hook (Bash) — Esden Dependency Guard
 *
 * Purpose: if a Bash command tries to install a NEW production dependency
 * (npm/pnpm/yarn install <pkg>, npm/pnpm add <pkg>), block the call and require
 * routing through the `esden-agents:adr` subagent for compatibility check + ADR.
 *
 * Allowed silently:
 *   - bare `npm install`, `npm ci`, `pnpm install`, `yarn install` (lockfile install)
 *   - `--save-dev` / `-D` installs (devDependencies don't need ADR)
 *   - `npm audit`, `npm outdated`, `npm ls`, `npm info`
 *
 * Output: stdout JSON with `permissionDecision: deny` + reason if blocking.
 */

try {
  const fs = require('fs');
  let payload = {};
  try {
    const raw = fs.readFileSync(0, 'utf8');
    payload = raw ? JSON.parse(raw) : {};
  } catch (_) { process.exit(0); }

  const cmd = ((payload.tool_input || {}).command || '').trim();
  if (!cmd) { process.exit(0); }

  // Patterns that install a NEW production dependency
  const installPatterns = [
    /\bnpm\s+install\s+(?!--?\s)(?!-D\b)(?!--save-dev\b)\S+/,
    /\bnpm\s+i\s+(?!-D\b)(?!--save-dev\b)\S+/,
    /\bnpm\s+add\s+(?!-D\b)(?!--save-dev\b)\S+/,
    /\bpnpm\s+add\s+(?!-D\b)(?!--save-dev\b)\S+/,
    /\bpnpm\s+install\s+(?!--?\s)\S+/,
    /\byarn\s+add\s+(?!-D\b)(?!--dev\b)\S+/
  ];

  // Quick allowlist: bare install / ci / audit / outdated / info / ls
  const bareAllowed = [
    /^npm\s+install\s*$/,
    /^npm\s+i\s*$/,
    /^npm\s+ci\b/,
    /^pnpm\s+install\s*$/,
    /^pnpm\s+i\s*$/,
    /^yarn\s+install\s*$/,
    /^yarn\s*$/,
    /\bnpm\s+(audit|outdated|info|ls|view|list)\b/,
    /\bpnpm\s+(audit|outdated|info|ls|view|list|why)\b/
  ];

  if (bareAllowed.some(p => p.test(cmd))) { process.exit(0); }

  const isInstall = installPatterns.some(p => p.test(cmd));
  if (!isInstall) { process.exit(0); }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Esden Dependency Guard: detected install of a new production dependency. Route through `esden-agents:adr` subagent first to (1) verify compatibility with stack (Next.js 16 + React 19 + Supabase + Zod + BullMQ + LangChain + Easypanel — SIN ORM nuevo), (2) check peer deps, (3) check CVEs via `npm audit`, (4) document in `docs/adr/NNNN-titulo.md`, (5) request explicit user authorization. Once ADR is approved, re-run the install command.'
    }
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
} catch (e) {
  process.exit(0);
}
