# Fase 03: UI Flow Builder Sync

## Objetivo
Conectar el componente frontend `AgentFlowBuilder.tsx` con las APIs de backend para cargar, modificar y guardar flujos.

## Tareas
- [ ] **Acciones de Servidor**: Crear server actions (`src/lib/actions/flows.ts`) para `getAgentFlow`, `saveAgentFlow`, y `deleteAgentFlow`.
- [ ] **Persistencia en React Flow**:
  - [ ] Sincronizar el estado local de nodos (`nodes`) y aristas (`edges`) con la base de datos al hacer clic en "Publicar Cambios".
  - [ ] Implementar control de versiones básicas o auto-guardado en borrador.
- [ ] **Manejo de Errores e Indicadores**:
  - [ ] Añadir feedback visual en la UI de cargando/guardando.
  - [ ] Validar que el flujo tenga al menos un disparador (`flow_trigger`) de inicio y no tenga nodos sueltos/huérfanos sin salida antes de permitir guardar.
  - [ ] **Validación de Ciclos (Red Team)**: Implementar detección de ciclos (ej. algoritmo DFS) en `AgentFlowBuilder.tsx` para advertir al usuario si crea ciclos infinitos de ejecución sincrónica inmediata.
