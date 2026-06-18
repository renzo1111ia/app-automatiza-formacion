# Fase 03: UI de Configuración y Mapeo

## Objetivo
Desarrollar la interfaz gráfica en el panel de control para que el administrador pueda sincronizar plantillas de WhatsApp y mapear campos de lead.

## Tareas
- [ ] **Acciones de Servidor**: Crear server actions en `src/lib/actions/whatsapp.ts` para sincronizar plantillas manualmente e insertar logs.
- [ ] **Panel de Configuración**:
  - [ ] Crear la vista de administración de plantillas de WhatsApp.
  - [ ] Desarrollar el constructor de mapeos de variables de plantilla (ej. relacionar parámetro 1 con la variable `nombre` del lead).
- [ ] **Nodo MetaTemplateNode**:
  - [ ] Conectar la configuración del nodo `flow_meta_template` en `AgentFlowBuilder.tsx` para que liste las plantillas sincronizadas en la base de datos.
