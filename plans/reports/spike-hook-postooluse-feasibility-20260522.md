# Spike — Feasibility hook PostToolUse invocar subagentes

- **Fecha:** 22-05-2026
- **Sprint:** 1 (Bloque 2.8, tarea 2-30.1)
- **Autor:** Javi HP (orquestador AI)
- **Tiempo invertido:** 30min

## Pregunta

¿Puede un hook `PostToolUse` invocar directamente a subagentes (productivity + roadmap-keeper) cuando detecta una edición en `plans/RoadMap.md`?

## Conclusión: **NO directamente** — Path B híbrido

Un hook `PostToolUse` se ejecuta en un proceso hijo aislado (Node con stdin/stdout JSON IPC). NO tiene acceso al runtime de Claude Code que despacha agentes. Los hooks pueden:

- Leer `tool_input` / `tool_output` del tool que se acaba de ejecutar.
- Devolver JSON con `additionalContext` (texto inyectado en la siguiente vuelta del agente principal).
- Devolver `exit code != 0` o `decision: "block"` para bloquear el flujo.

NO pueden:

- Llamar al tool `Task` para spawnear subagentes (ese tool solo está disponible al agente principal en la sesión activa).
- Invocar `SendMessage` ni el plugin runtime de Claude Code.
- Ejecutar código asíncrono que pinche resultados después de devolver.

**Evidencia técnica:**

- Inspección de `.claude/hooks/hooks.json`: la API de hooks es entrada estática (stdin JSON) → salida estática (stdout JSON o exit code).
- Doc Claude Code (https://docs.claude.com/.../hooks): "Hooks emit context or block tool execution; they do not orchestrate agents."
- Hook existente `af-task-tracker.cjs` (vacío en este repo) y resto del catálogo: todos siguen patrón stdin/stdout pure-function.

## Path elegido: B híbrido

**Combinación de A + B**: hook PostToolUse pasivo que emite `additionalContext` estructurado cuando detecta edición en `plans/RoadMap.md`, dejando que el agente principal (manager / orquestador en la sesión) **decida** si invocar productivity + roadmap-keeper.

Razones:

1. Mantiene la automatización del trigger (detección automática del cambio).
2. NO requiere ejecución manual (el agente principal recibe el contexto inmediatamente tras la edición).
3. Mantiene el control del agente sobre la decisión de invocar subagentes (puede decidir batch vs realtime).
4. Compatible con la API actual del SDK.
5. Bajo coste de mantenimiento (parser puro, sin estado).

## Implementación 2-30.2

Ver siguiente commit: `.claude/hooks/af-productivity-logger.cjs` + registro en `hooks.json`.

## Alternativas descartadas

| Alternativa                                      | Por qué descartada                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Path A puro (hook llama a Task)                  | API no lo permite; rompería ejecución                                |
| Path B puro (script manual `invoke-manager.cjs`) | Requiere que el dev recuerde ejecutarlo                              |
| Polling externo (cron que mira git diff)         | Latencia + complejidad infra                                         |
| Git hook (pre-commit)                            | Se ejecuta fuera de la sesión Claude; el contexto no llega al agente |

## Próximos pasos

1. Implementar `af-productivity-logger.cjs` con detección regex de cambios de estado en RoadMap.md.
2. Registrar en `.claude/hooks/hooks.json` como PostToolUse Edit/Write.
3. Smoke test: editar manualmente una línea de estado en RoadMap.md → ver `additionalContext` en la siguiente vuelta del agente.
