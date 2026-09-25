#!/usr/bin/env node
/**
 * Sprint 1 — Bloque 2.8 (tarea 2-30.2) Path B híbrido.
 *
 * Hook PostToolUse que detecta cambios de estado de tareas en `plans/RoadMap.md`
 * cuando el agente edita ese fichero (Edit / Write / MultiEdit). Emite contexto
 * estructurado vía `additionalContext` (stdout JSON) para que el agente principal
 * decida si invocar productivity + roadmap-keeper.
 *
 * NO invoca subagentes directamente — el SDK no lo permite desde un hook
 * (ver `plans/reports/spike-hook-postooluse-feasibility-20260522.md`).
 *
 * Activación: solo si tool_input.file_path incluye `plans/RoadMap.md`.
 * Bajo coste: regex puro sobre old_string/new_string, sin IO disco extra.
 *
 * Falla silenciosa: cualquier excepción se loguea a stderr y devuelve exit 0
 * para NO bloquear el flujo del agente.
 */

"use strict";

const STATE_EMOJIS = ["🔘", "🟡", "🟠", "🔵", "🟢"];
const STATE_NAMES = {
  "🔘": "Pendiente",
  "🟡": "En Desarrollo",
  "🟠": "Bloqueada",
  "🔵": "Subida rama",
  "🟢": "Completada",
};

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

// Extrae transiciones de estado leyendo old_string y new_string buscando
// líneas tipo "| 2-13 | ... | 🔘 Pendiente |".
function detectStateTransitions(oldString, newString) {
  if (!oldString || !newString) return [];
  // Estructura del RoadMap: | task_id | descripcion | estim | emoji_estado | notas |
  // Detectamos cualquier emoji de la columna estado tras 3 separadores.
  const lineRegex = /\|\s*([1-5]-\d+(?:\.[A-Za-z0-9]+)?)\s*\|[^|]*\|[^|]*\|\s*(🔘|🟡|🟠|🔵|🟢)/g;
  const oldStates = new Map();
  const newStates = new Map();
  let m;
  while ((m = lineRegex.exec(oldString)) !== null) {
    oldStates.set(m[1], m[2]);
  }
  lineRegex.lastIndex = 0;
  while ((m = lineRegex.exec(newString)) !== null) {
    newStates.set(m[1], m[2]);
  }
  const transitions = [];
  for (const [taskId, newEmoji] of newStates) {
    const oldEmoji = oldStates.get(taskId);
    if (oldEmoji && oldEmoji !== newEmoji) {
      transitions.push({
        task_id: taskId,
        from_status: oldEmoji,
        from_status_name: STATE_NAMES[oldEmoji],
        to_status: newEmoji,
        to_status_name: STATE_NAMES[newEmoji],
      });
    }
  }
  return transitions;
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) return process.exit(0);
    const payload = JSON.parse(raw);
    const toolInput = payload.tool_input || {};
    const filePath = String(toolInput.file_path || toolInput.path || "");
    if (!filePath.replace(/\\/g, "/").endsWith("plans/RoadMap.md")) {
      return process.exit(0);
    }

    let oldString = toolInput.old_string || "";
    let newString = toolInput.new_string || toolInput.content || "";
    // MultiEdit: array of edits, juntar todos
    if (Array.isArray(toolInput.edits)) {
      oldString = toolInput.edits.map((e) => e.old_string || "").join("\n");
      newString = toolInput.edits.map((e) => e.new_string || "").join("\n");
    }

    const transitions = detectStateTransitions(oldString, newString);
    if (transitions.length === 0) return process.exit(0);

    const timestamp = new Date().toISOString();
    const lines = [
      `## RoadMap state change detected (af-productivity-logger)`,
      `Timestamp: ${timestamp}`,
      `Transitions:`,
    ];
    for (const t of transitions) {
      lines.push(
        `  - ${t.task_id}: ${t.from_status} ${t.from_status_name} -> ${t.to_status} ${t.to_status_name}`
      );
    }
    lines.push(
      `Acción sugerida: invocar af-agents:roadmap-keeper + af-agents:productivity` +
        ` para registrar tiempo real en logs/sprint y validar coherencia.`
    );

    const output = {
      additionalContext: lines.join("\n"),
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  } catch (e) {
    process.stderr.write(`[af-productivity-logger] ${e.message || e}\n`);
    process.exit(0); // never block
  }
}

main();
