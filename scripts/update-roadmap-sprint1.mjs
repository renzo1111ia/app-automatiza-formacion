// One-shot script Sprint 1 cierre: actualiza estados en RoadMap.md
import { readFileSync, writeFileSync } from "node:fs";
const file = "plans/RoadMap.md";
let content = readFileSync(file, "utf-8");

const updates = {
  "2-04": ["🟢 Completada", "src/lib/schemas/_base.ts + barrel"],
  "2-05": ["🟢 Completada", "src/lib/schemas/leads.ts"],
  "2-06": ["🟢 Completada", "src/lib/schemas/tenants.ts"],
  "2-07": ["🟢 Completada", "src/lib/schemas/programs.ts"],
  "2-08": ["🟢 Completada", "src/lib/schemas/appointments.ts"],
  "2-09": ["🟢 Completada", "src/lib/schemas/ai-agents.ts (ModelNameSchema 2-35)"],
  "2-10": ["🟢 Completada", "src/lib/schemas/knowledge-base.ts"],
  "2-11": ["🟢 Completada", "src/lib/schemas/integrations.ts (prep Fase 2)"],
  "2-35": ["🟢 Completada", "ModelNameSchema enforced. Parche widget.ts eliminado. Migración SQL aplicada"],
  "2-12": ["🟢 Completada", "src/lib/repositories/_base-repository.ts"],
  "2-13": ["🟢 Completada", "leads-repository.ts con findByExternalId + softDelete"],
  "2-14": ["🟢 Completada", "tenants-repository.ts"],
  "2-15": ["🟢 Completada", "appointments + Calls + Attempts repos"],
  "2-16": ["🟢 Completada", "ai-agents + variants + voice repos"],
  "2-17": ["🟢 Completada", "knowledge-base + embeddings + chat-messages repos"],
  "2-18": ["🟢 Completada", "integrations + field-mapping + write-audit + webhooks"],
  "2-19": ["🟢 Diferida", "ADR-019 migración incremental. Código nuevo usa repos"],
  "2-20": ["🟢 Diferida", "ADR-019. 57 queries en actions/ a migrar incrementalmente"],
  "2-21": ["🟢 Diferida", "ADR-019. Worker + processors a migrar incrementalmente"],
  "2-36": ["🟢 Diferida", "MOVIDA a Sprint Costes-LLM post-MVP"],
  "2-22": ["🟢 Diferida", "ADR-019. 426 as any baseline. Sprint v0.5.4 candidate"],
  "2-37": ["🟢 Completada", "src/lib/utils/logger.ts scrubbing PII. widget.ts migrado"],
  "2-23": ["🟢 Completada", "Migración 20260522220000 ai_agents RLS owner_or_admin"],
  "2-24": ["🟢 Completada", "Migración 20260522220001 web_widgets RLS owner_or_admin"],
  "2-25": ["🟢 Completada", "Migración 20260522220002 programas RLS owner_or_admin"],
  "2-26": ["🟢 Completada", "AES-256-GCM token-crypto.ts + tabla integrations + ENCRYPTION_KEY. ADR-017"],
  "2-28": ["🟢 Completada parcial", "Vitest + 58 unit tests + 4 integration skip-by-env. E2E SP-4B"],
  "2-29": ["🟢 Completada", "docs/architecture/data-layer.md sección 6 + SP-2-CLOSE-summary.md"],
  "2-30": ["🟢 Completada", "Spike Path B + af-productivity-logger.cjs híbrido + hooks.json"],
  "2-31": ["🟢 Diferida", "ADR-018 post-MVP v0.6.x"],
  "2-32": ["🟢 Diferida", "ADR-018 post-MVP v0.6.x (shadcn 4 requiere Tailwind 4)"],
  "2-33": ["🟢 Completada", "@types/node ^20 -> ^24.12.4"],
  "2-34": ["🟢 Diferida", "ADR-018 research-only. Bloqueado por eslint-config-next"],
  "SP-2-CLOSE-1": ["🟢 Completada", "typecheck OK / lint baseline / build 41 rutas / 58 tests OK"],
  "SP-2-CLOSE-2": ["🟢 Completada parcial", "Smoke tests crypto + hook OK. E2E SP-4B"],
  "SP-2-CLOSE-4": ["🟢 Completada", "Lint fixes aplicados (commit 9f1fbca + ccd6a50)"],
  "SP-2-CLOSE-5": ["🟢 Completada", "Hand-off phase-02 rellenado. PR a developer pendiente orden usuario"],
};

let updated = 0;
const notFound = [];
function escapeRegex(s) {
  return s.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
for (const [taskId, [status, note]] of Object.entries(updates)) {
  const safeId = escapeRegex(taskId);
  const pattern = new RegExp(
    `^(\\| ${safeId}\\s+\\|[^|\\n]+\\|[^|\\n]+\\|)\\s*🔘\\s*Pendiente\\s*\\|[^\\n]*`,
    "m"
  );
  const newContent = content.replace(pattern, `$1 ${status} | ${note} |`);
  if (newContent !== content) {
    content = newContent;
    updated++;
  } else {
    notFound.push(taskId);
  }
}

writeFileSync(file, content, "utf-8");
console.log(`Updated ${updated} rows. Not found: ${notFound.join(", ") || "(none)"}`);
