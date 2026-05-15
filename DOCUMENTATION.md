# Documentación Técnica: IA CRM & Orchestrator v3.0

Esta documentación describe el funcionamiento interno, las integraciones y la lógica de negocio del sistema de orquestación de leads basado en IA.

---

## 1. Arquitectura General
El sistema funciona como un motor de ejecución de grafos (Workflow Engine) que gestiona el ciclo de vida de un Lead desde su entrada hasta su cualificación o agendamiento.

- **Frontend**: Next.js 14 (App Router).
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions).
- **Motor de Orquestación**: `Orchestrator.ts` (Core Engine).
- **Canales**: WhatsApp (Meta Cloud API), Llamadas (Retell AI / Ultravox).

---

## 2. Ingesta de Leads (Webhook/API)
Para introducir leads al sistema desde fuentes externas (Zoho, Facebook, Formularios Web), se utiliza el endpoint universal de ingesta.

### Endpoint: `POST /api/leads/ingest`
**Headers:**
- `Content-Type: application/json`
- `x-api-key: [TU_TENANT_API_KEY]`

**Payload (Ejemplo):**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@example.com",
  "telefono": "+34600000000",
  "pais": "España",
  "origen": "Web Form",
  "campana": "Master_MBA",
  "extra": {
    "interes": "Finanzas",
    "id_externo": "ZOHO-12345"
  }
}
```

---

## 3. El Motor de Orquestación (The Engine)
Una vez el lead es ingerido, el motor lee la configuración del **Tenant** y comienza la secuencia definida en el constructor de flujos.

### Lógica de Ejecución:
1. **Gatekeeper**: Filtra leads por campaña u origen antes de empezar.
2. **Compliance Guard**: Verifica el huso horario del lead según su prefijo telefónico para asegurar que las llamadas/mensajes se realicen en horas hábiles.
3. **Pacing Control**: Controla el ritmo de salida para no saturar los canales.
4. **Circuit Breaker**: Detiene la orquestación si se alcanza el límite de gasto diario configurado.

---

## 4. Nodos del Workflow (Canvas)
El sistema utiliza un constructor visual con los siguientes nodos principales:

| Nodo | Función | Salidas |
| :--- | :--- | :--- |
| **Lead Trigger** | Punto de entrada del lead. | Única |
| **Time Condition** | Bifurca el flujo según si es horario laboral o no. | Horario ✓ / Fuera ✗ |
| **Bucle de Reintentos** | Motor de reintentos automáticos (Auto-Retry). | Llamada / WhatsApp |
| **Llamada IA** | Dispara una llamada con un agente de voz (Retell/Ultravox). | Única |
| **WhatsApp** | Envía una plantilla de WhatsApp (Meta API). | Única |
| **Condición (IF/ELSE)** | Evalúa variables (ej: `{{call.status}}`) para decidir camino. | Sí / No |
| **Espera (Wait)** | Pausa el flujo durante X horas. | Única |

---

## 5. Variables y Mapeo
El sistema permite usar variables dinámicas en prompts y mensajes usando la sintaxis `{{variable}}`.

### Variables Disponibles:
- `{{lead.nombre}}`: Nombre del lead.
- `{{lead.email}}`: Email del lead.
- `{{lead.telefono}}`: Teléfono con prefijo.
- `{{lead.metadata.X}}`: Cualquier campo extra enviado en la ingesta.
- `{{course.name}}`: Nombre del programa vinculado.
- `{{call.outcome}}`: Resultado de la última llamada (Cualificado, No Contesta, etc).

---

## 6. Base de Datos (Supabase)
Toda la persistencia se realiza en Supabase. Tablas clave:

- `tenants`: Configuración global de cada cliente (API Keys, Límites).
- `lead`: El registro central de cada persona.
- `appointments`: Citas agendadas por la IA.
- `orchestration_logs`: Historial detallado de cada paso ejecutado por el motor.
- `voice_agents`: Configuración de los agentes de voz (Prompts, IDs).

---

## 7. Guion para Video Explicativo (Propuesta)

### Bloque 1: Introducción (0:00 - 0:30)
*Visual: Dashboard principal con leads entrando en tiempo real.*
"Bienvenidos al nuevo ecosistema de orquestación IA. Hoy veremos cómo transformamos un lead frío en una cita agendada de forma 100% autónoma usando Supabase y agentes de voz de última generación."

### Bloque 2: Ingesta y Webhooks (0:30 - 1:15)
*Visual: Pantalla de Postman o código de API Ingest.*
"Todo comienza aquí. Nuestra API universal recibe leads de cualquier fuente. Al entrar, el sistema valida el API Key del tenant y aplica reglas de filtrado instantáneas."

### Bloque 3: El Constructor de Flujos (1:15 - 2:30)
*Visual: Canvas interactivo moviendo nodos.*
"Este es el cerebro. Aquí diseñamos la estrategia. Podemos arrastrar un **Bucle de Reintentos** para que el sistema insista de forma inteligente, o usar **Condiciones Horarias** para que la IA solo llame cuando el lead está despierto."

### Bloque 4: La Experiencia del Lead (2:30 - 3:30)
*Visual: Captura de pantalla de chat de WhatsApp y grabación de llamada IA.*
"La magia ocurre en la interacción. El sistema utiliza variables dinámicas para que cada mensaje sea personal. Si el lead no contesta la llamada, el motor detecta el fallo y salta automáticamente a WhatsApp."

### Bloque 5: Analítica y Cierre (3:30 - 4:00)
*Visual: Tabla de logs de orquestación y calendario de citas.*
"Todo queda registrado en Supabase para una trazabilidad total. Desde el gasto por llamada hasta el motivo exacto de la cualificación. Bienvenidos al futuro del CRM."
