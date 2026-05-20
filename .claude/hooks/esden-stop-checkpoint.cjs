#!/usr/bin/env node
/**
 * Stop Hook — Esden checkpoint reminder
 *
 * Purpose: before stopping, check git for uncommitted changes and suggest /checkpoint
 * if there's significant uncommitted work. Non-blocking, fail-open.
 *
 * Output: stdout JSON with `additionalContext`.
 */

try {
  const { execSync } = require('child_process');
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  let status = '';
  try {
    status = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf8', timeout: 5000 });
  } catch (_) {
    process.exit(0); // not a git repo or git fails — fail open
  }

  const changes = status.trim().split('\n').filter(l => l.length > 0);
  if (changes.length === 0) {
    process.exit(0); // clean tree, nothing to suggest
  }

  let branch = '';
  try {
    branch = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf8', timeout: 5000 }).trim();
  } catch (_) { branch = 'unknown'; }

  const protectedBranches = ['main', 'staging'];
  const onProtected = protectedBranches.includes(branch);

  const lines = [];
  lines.push('## Esden — Session ending with uncommitted changes');
  lines.push('');
  lines.push(`Branch: \`${branch}\``);
  lines.push(`Uncommitted/untracked files: **${changes.length}**`);
  lines.push('');

  if (onProtected) {
    lines.push(`⚠️ **PROTECTED BRANCH** (\`${branch}\`) — Do NOT push without explicit user authorization.`);
    lines.push('Recommend: branch off to \`feature/*\` before committing.');
  } else if (branch === 'developer') {
    lines.push('You are on `developer` (integration branch).');
    lines.push('Recommend: commit via conventional commit + PR review from a feature branch, not direct push.');
  } else {
    lines.push('Suggestion: run `/commit-actual` or invoke the `git-manager` subagent before stopping.');
    lines.push('Recall SemVer convention: sprint cerrado → v0.x.0, patch → v0.0.x.');
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: lines.join('\n')
    }
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
} catch (e) {
  process.exit(0);
}
