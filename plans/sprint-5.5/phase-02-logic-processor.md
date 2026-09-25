# Fase 02: Procesador de Flujos Backend

## Objetivo
Desarrollar el intérprete del grafo que ejecute las transiciones entre nodos basándose en las respuestas de los usuarios o disparadores del sistema.

## Tareas
- [ ] **Motor Core (`FlowInterpreter`)**: Crear la clase `FlowInterpreter` en `src/lib/core/flow/interpreter.ts`.
- [ ] **Resolución de Nodos**:
  - [ ] Implementar evaluación de condiciones (`flow_condition`) usando variables del contexto del lead.
  - [ ] Implementar ejecución de peticiones HTTP (`flow_http`) asíncronas con soporte para reintentos.
  - [ ] Implementar escritura e inserción en base de datos (`flow_db`).
  - [ ] Integrar el temporizador/espera (`flow_wait`) apoyándose en la cola de trabajos (`sweep-queue`).
- [ ] **Sincronización de Contexto**: Mantener y actualizar el objeto de contexto del lead (`lead.metadata`) a lo largo del recorrido.
- [ ] **Prevención de Bucles (Red Team)**: Implementar control de profundidad máxima (ej. `max_execution_depth = 50`) en `FlowInterpreter` y registrar nodos visitados para abortar ciclos infinitos sincrónicos.
