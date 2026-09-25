---
title: "Sprint 5.5 — Constructor y lógica"
description: "Desarrollo e implementación de la lógica central del chatbot y la integración del Flow Builder (Constructor de Flujos) con el motor del backend."
status: completed
priority: P1
effort: 20-30h
version_target: v0.5.50
branch: sprint-5.5
sprint_id: SP-5.5-CONSTR
tags: [chatbot, flow-builder, constructor, logic, database]
created: "2026-06-15"
blockedBy: []
blocks: [sprint-5.7]
---

# Plan — Sprint 5.5: Constructor y lógica

> **Fuente de verdad de la planificación:** `plans/RoadMap.md` § "Fase 5.5 — Sprint 5.5".
> **Componente UI de referencia:** `src/components/orchestrator/AgentFlowBuilder.tsx`.
> **Procesador backend de referencia:** `src/lib/core/processors/QualificationProcessor.ts`.

## Objetivo

El objetivo de este sprint es consolidar el **Constructor de Flujos (Flow Builder)** visual (`AgentFlowBuilder.tsx`) conectándolo directamente con la persistencia en base de datos (Supabase) y desarrollando el motor/intérprete del backend capaz de ejecutar la secuencia lógica de nodos (disparadores, respuestas de agentes, condiciones IF, HTTP requests, base de datos, etc.) en tiempo real cuando llega un evento.

## Fases

| #   | Fase                                                                             | Archivo                                             | Estim. | Estado       |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ------ | ------------ |
| 01  | **Capa de datos y Setup** (Migraciones SQL para flujos, nodos y conexiones)       | [phase-01](phase-01-setup-db.md)                     | 3-4h   | ✅ Completado |
| 02  | **Procesador de Flujos Backend** (Motor ejecutor del grafo de nodos)             | [phase-02](phase-02-logic-processor.md)             | 6-8h   | ✅ Completado |
| 03  | **UI Flow Builder Sync** (Guardar y cargar flujos desde Supabase a React Flow)   | [phase-03](phase-03-ui-builder.md)                  | 5-7h   | ✅ Completado |
| 04  | **Pruebas y Cierre** (Tests unitarios, validación RLS y QA de flujos)            | [phase-04](phase-04-tests-cierre.md)                | 4-5h   | ✅ Completado |

**Total estimado:** 18-24h dev + cierre.

## Criterios de éxito (cierre OK cuando)

- El usuario puede guardar y cargar configuraciones completas de flujos del agente desde la UI de administración.
- El motor del backend recorre de forma secuencial y asíncrona el grafo de nodos (por ejemplo, al recibir un mensaje por webhook).
- Las bifurcaciones del nodo `flow_condition` (IF/ELSE) evalúan correctamente las variables del contexto recopiladas.
- RLS tenant-only aplicado estrictamente en las nuevas tablas de esquemas de flujos.
- Cobertura de tests unitarios/integración en verde sin regresiones.
