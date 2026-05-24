#!/usr/bin/env node
/**
 * af-docs-watcher — PostToolUse(Edit|Write|MultiEdit) hook.
 *
 * Detecta cambios en componentes UI del dashboard (rutas `src/app/dashboard/**`
 * o componentes compartidos bajo `src/components/**`) y emite una pista para
 * que el orquestador delegue a `af-agents:help-docs-keeper` la regeneración
 * de la sección de documentación afectada (en `help_sections`, scopes admin
 * y/o clientes según mapping).
 *
 * Diseño: el hook es no-bloqueante (siempre exit 0). Loggea cada disparo a
 * `.claude/logs/af-docs-watcher.log` para auditoría y emite un reminder a
 * stdout sólo cuando hay un cambio relevante. El orquestador decide si invoca
 * al agente; el hook nunca llama tools por sí mismo.
 */

const fs = require("fs");
const path = require("path");

function safeReadInput() {
  try {
    const raw = fs.readFileSync(0, "utf-8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function logLine(line) {
  try {
    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const dir = path.join(root, ".claude", "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "af-docs-watcher.log"), line + "\n");
  } catch {
    // logging is best-effort; never crash the hook
  }
}

function mapSlugFromPath(filePath) {
  // dashboard page edits → slug from first segment under /dashboard/
  const dashboard = filePath.match(/src[\\/]app[\\/]dashboard[\\/]([^\\/]+)/);
  if (dashboard) return { slug: dashboard[1], origin: "dashboard-route" };

  // shared dashboard components — mapping table (extend over time)
  const componentMap = [
    { re: /AIAgentInbox/, slug: "conversaciones" },
    { re: /WorkflowSidebar|SequenceCanvas/, slug: "onboarding" },
    { re: /HistorialTable|HistorialColumnManager/, slug: "historial" },
    { re: /SummaryManager|ChartManager|DashboardCharts/, slug: "metricas" },
    { re: /IntegrationsManager/, slug: "settings" },
    { re: /CampanasCharts/, slug: "campanas" },
    { re: /MinutosCharts/, slug: "minutos" },
    { re: /WhatsappCharts/, slug: "whatsapp" },
    { re: /LeadProfileModal|CreateLeadDialog/, slug: "historial" },
    { re: /RetellConfigModal/, slug: "voice-agents" },
  ];
  for (const m of componentMap) {
    if (m.re.test(filePath)) return { slug: m.slug, origin: "component-map" };
  }
  return null;
}

function main() {
  const input = safeReadInput();
  const filePath =
    input?.tool_input?.file_path ||
    input?.tool_input?.notebook_path ||
    "";

  if (!filePath) {
    process.exit(0);
  }

  const isUIChange =
    /src[\\/](app[\\/]dashboard|components)[\\/].*\.(tsx?|jsx?)$/.test(filePath);
  if (!isUIChange) {
    process.exit(0);
  }

  const mapping = mapSlugFromPath(filePath);
  if (!mapping) {
    process.exit(0);
  }

  const ts = new Date().toISOString();
  logLine(
    `${ts} [docs_update_needed] slug=${mapping.slug} origin=${mapping.origin} file=${filePath}`,
  );

  // Suggestion to the model — non-blocking advisory. The orchestrator may
  // batch these across many edits and only invoke help-docs-keeper once.
  const advisory = {
    type: "docs_update_needed",
    slug: mapping.slug,
    changed_file: filePath,
    timestamp: ts,
    instruction:
      `help-docs-keeper: regenera la sección '${mapping.slug}' en help_sections ` +
      `(scopes admin Y clientes si aplica). Antes de cualquier screenshot invoca ` +
      `af-agents:uxui para WCAG 2.2 AA. Marca status='provisional'. Si el cambio ` +
      `es backend silencioso, deja status como está y añade nota "Re-verificado ${ts}".`,
  };

  process.stdout.write(JSON.stringify(advisory) + "\n");
  process.exit(0);
}

main();
