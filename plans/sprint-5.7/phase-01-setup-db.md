# Fase 01: Capa de datos y Configuración

## Objetivo
Crear los esquemas y tablas necesarias en Supabase para almacenar las plantillas de WhatsApp sincronizadas desde Meta, las configuraciones de WABA y el registro de logs de mensajes enviados.

## Tareas
- [ ] **Esquema de Base de Datos**:
  - [ ] Crear la tabla `waba_configurations` vinculada a `tenants`.
  - [ ] Crear la tabla `whatsapp_templates` (estructura, parámetros, categoría, idioma, estado).
  - [ ] Crear la tabla `whatsapp_message_logs` (lead_id, template_id, status, error_message, message_sid).
  - [ ] **Outbox y Opt-Out (Red Team)**: Crear la tabla `whatsapp_message_outbox` para encolar envíos y un campo/tabla para almacenar el blacklist de números con "Opt-Out".
- [ ] **Políticas RLS**: Configurar el aislamiento por tenant en todas las tablas nuevas.
- [ ] **Migraciones SQL**: Crear script de migración `20260615_002_sprint_5_7_waba_integration.sql`.
