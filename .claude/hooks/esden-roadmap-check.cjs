#!/usr/bin/env node
/**
 * SessionStart Hook — Esden Roadmap Check
 *
 * Purpose: at session start, inject summary of audit findings, current phase status,
 * pending critical items, and recent plans into the assistant context.
 *
 * Reads (best-effort, fail-open):
 *   - docs/audit/findings-summary.md
 *   - docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md (header table only)
 *   - docs/roadmap/deep-improvement-backlog.md (head)
 *   - plans/ (most recent directory by mtime)
 *
 * Output: stdout JSON with `additionalContext` (Claude Code hook protocol).
 */

try {
  const fs = require('fs');
  const path = require('path');

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const lines = [];

  function safeRead(rel, maxLines) {
    try {
      const full = path.join(projectRoot, rel);
      if (!fs.existsSync(full)) return null;
      const content = fs.readFileSync(full, 'utf8');
      return maxLines ? content.split('\n').slice(0, maxLines).join('\n') : content;
    } catch (_) { return null; }
  }

  function safeLatestPlan() {
    try {
      const plansDir = path.join(projectRoot, 'plans');
      if (!fs.existsSync(plansDir)) return null;
      const entries = fs.readdirSync(plansDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => ({ name: d.name, mtime: fs.statSync(path.join(plansDir, d.name)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);
      return entries[0] ? entries[0].name : null;
    } catch (_) { return null; }
  }

  lines.push('## Esden Roadmap Snapshot (auto-injected)');
  lines.push('');

  const findings = safeRead('docs/audit/findings-summary.md', 6);
  if (findings) {
    lines.push('### Audit findings header');
    lines.push(findings.trim());
    lines.push('');
  }

  const decisions = safeRead('docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md', 70);
  if (decisions) {
    lines.push('### Decisions header (top 70 lines)');
    lines.push(decisions.trim());
    lines.push('');
  }

  const backlog = safeRead('docs/roadmap/deep-improvement-backlog.md', 30);
  if (backlog) {
    lines.push('### Deep improvement backlog (head)');
    lines.push(backlog.trim());
    lines.push('');
  }

  const latestPlan = safeLatestPlan();
  if (latestPlan) {
    lines.push(`### Latest active plan: \`plans/${latestPlan}/\``);
    lines.push('');
  }

  lines.push('### MVP scope reminder');
  lines.push('- Fase C MVP CRMs: **HubSpot + Zoho** (sin Sheets).');
  lines.push('- Sheets bidireccional + Salesforce/GHL/ActiveCampaign → Fase E post-release.');
  lines.push('- Stack: Next.js 16 + React 19 + Supabase (SIN ORM nuevo) + Zod + Repository pattern + Easypanel.');
  lines.push('');

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n')
    }
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
} catch (e) {
  process.exit(0); // fail-open
}
