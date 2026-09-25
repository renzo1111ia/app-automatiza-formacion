# Fase 01: Capa de datos y Setup

## Objetivo
Configurar las tablas, relaciones, triggers y políticas RLS necesarias en Supabase para soportar la persistencia del grafo de flujo (nodos y aristas/edges).

## Tareas
- [ ] **Esquema de Base de Datos**: Crear tabla `agent_flows` vinculada a `agents` y `tenants`.
- [ ] **Tablas Hijas**: Crear tablas `flow_nodes` y `flow_edges` para guardar la representación estructurada de React Flow.
- [ ] **Persistencia de Estados de Espera (Red Team)**: Diseñar tabla/campos en base de datos para almacenar el estado de ejecuciones en espera (`scheduled_resume_at`, `current_node_id`, `lead_id`).
- [ ] **Políticas RLS**: Aplicar aislamiento tenant (`USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()))`).
- [ ] **Esquema de Migraciones**: Escribir archivo de migración `20260615_001_sprint_5_5_flow_persistency.sql`.
- [ ] **Tipos TypeScript**: Definir los tipos Zod correspondientes para validar la estructura de nodos (`FlowNodeData`, `FlowEdgeData`).
