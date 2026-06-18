# Fase 02: Cliente API de Envío

## Objetivo
Implementar el cliente HTTP para conectar con la API de WhatsApp Business de Meta, permitiendo el envío de mensajes de plantilla y textos libres.

## Tareas
- [ ] **WhatsApp API Client**:
  - [ ] Implementar `MetaWhatsAppClient` en `src/lib/integrations/whatsapp/client.ts`.
  - [ ] Añadir métodos para recuperar y sincronizar plantillas desde Meta Cloud API.
  - [ ] Añadir métodos para realizar el POST de envío (`/messages`).
- [ ] **Mapeador Dinámico**:
  - [ ] Crear el formateador de variables que reemplace placeholders (ej. `{{nombre}}`) con los datos reales del lead de la base de datos antes de enviar.
- [ ] **Manejo de Errores**: Capturar códigos de error de Meta API y reflejarlos en logs.
- [ ] **Outbox Processor y Rate Limiting (Red Team)**: Implementar procesador de cola (`whatsapp_message_outbox`) con limitador de concurrencia para mitigar cuotas de Meta (errores 429).
- [ ] **Middleware de Opt-Out (Red Team)**: Comprobar blacklist antes de realizar la llamada REST de envío, cancelando la petición si el número del lead solicitó baja.
- [ ] **Validación de Firma del Webhook (Red Team)**: Crear el middleware de validación de firma HMAC de Meta utilizando la clave configurada para evitar suplantaciones en el endpoint.

