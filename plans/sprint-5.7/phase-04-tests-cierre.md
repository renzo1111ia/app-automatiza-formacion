# Fase 04: Pruebas y Cierre

## Objetivo
Asegurar el correcto envío de notificaciones y la sincronización, garantizando la calidad del software.

## Tareas
- [ ] **Tests Unitarios**:
  - [ ] Crear tests para el formateador de variables de plantillas de WhatsApp.
  - [ ] Mockear respuestas de la API de Meta para verificar el correcto flujo de envío del cliente.
- [ ] **Tests de Integración**:
  - [ ] Simular webhooks de entrega/lectura de Meta y verificar la actualización en `whatsapp_message_logs`.
  - [ ] **Tests de Red Team (Seguridad y Rate Limiting)**:
    - [ ] Verificar que el endpoint de webhook rechaza payloads firmados con un secreto de webhook inválido.
    - [ ] Testear que el middleware de Opt-Out cancela el envío a números en la blacklist.
    - [ ] Validar que el rate limiter de la outbox respeta las cuotas de Meta bajo carga masiva.
- [ ] **Control de Calidad**:
  - [ ] Ejecutar `npm run build` y `npm run lint`.
  - [ ] Validar seguridad RLS en las nuevas tablas.
