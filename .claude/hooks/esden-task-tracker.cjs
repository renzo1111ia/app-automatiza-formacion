#!/usr/bin/env node
/**
 * PostToolUse Hook (Edit|Write|MultiEdit) — Esden task tracker
 *
 * Purpose: when a file is edited under src/ or supabase/, hint the assistant to
 * verify whether the edit completes a roadmap/plan task (so it can be marked
 * via TodoWrite). Silent for edits to docs/, plans/, .claude/ themselves.
 *
 * Output: stdout JSON with `additionalContext` (or empty/exit-0 if not relevant).
 */

try {
  const fs = require('fs');
  const path = require('path');
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  let payload = {};
  try {
    const raw = fs.readFileSync(0, 'utf8');
    payload = raw ? JSON.parse(raw) : {};
  } catch (_) { /* no stdin */ }

  const toolInput = payload.tool_input || {};
  const filePath = toolInput.file_path || toolInput.path || '';

  if (!filePath) { process.exit(0); }

  const rel = path.relative(projectRoot, filePath).replace(/\\/g, '/');

  // Silent if edit is to meta files (docs, plans, .claude, .claude-plugin)
  const silentPrefixes = ['docs/', 'plans/', '.claude/', '.claude-plugin/', 'node_modules/', '.next/', 'dist/'];
  if (silentPrefixes.some(p => rel.startsWith(p))) {
    process.exit(0);
  }

  // Only signal for code-relevant edits
  const codePrefixes = ['src/', 'supabase/', 'app/', 'lib/', 'components/', 'worker.js', 'package.json'];
  const isRelevant = codePrefixes.some(p => rel.startsWith(p) || rel === p);
  if (!isRelevant) { process.exit(0); }

  const lines = [];
  lines.push('## Esden — Code edit detected');
  lines.push('');
  lines.push(`Edited: \`${rel}\``);
  lines.push('');
  lines.push('Consider:');
  lines.push('- **Estado en RoadMap**: la tarea afectada debe estar en 🟡 En Desarrollo en `plans/RoadMap.md`. Si está en 🔘 Pendiente → invoca `esden-agents:roadmap-keeper` para registrar el arranque ANTES de seguir editando.');
  lines.push('- Does this complete a task in the current `plans/*/phase-*.md` or RoadMap? Pídelo a `roadmap-keeper` (no edites el roadmap manualmente).');
  lines.push('- If this introduces a new dependency: route through `esden-agents:adr` (Dependency Guard).');
  lines.push('- If RLS/auth code changed: delegate verification to `esden-agents:security`.');
  lines.push('- If LLM/voice code changed: keep cross-provider abstraction (`VoiceProvider` for Retell/Ultravox — R-016).');

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: lines.join('\n')
    }
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
} catch (e) {
  process.exit(0);
}
