# 📘 Guía Maestra: AI CRM & Workflow Orchestrator v3.0

Esta documentación constituye el manual oficial de entrega para el propietario del sistema. Describe la arquitectura, lógica de gobernanza y manuales operativos del **AI CRM & Workflow Orchestrator v3.0**, un ecosistema diseñado para la escalabilidad masiva y la soberanía total de datos.

---

## 📑 Índice de Contenidos

1. [Visión Arquitectónica](#visión-arquitectónica)
2. [Gobernanza de Datos y Privacidad](#gobernanza-de-datos-y-privacidad)
3. [Manual de Operaciones](#manual-de-operaciones)
4. [Manual de Ingeniería](#manual-de-ingeniería)
5. [Diccionario Técnico y Variables](#diccionario-técnico-y-variables)
6. [Integraciones de Infraestructura](#integraciones-de-infraestructura)
7. [Protocolo de Despliegue en Supabase Externo](#protocolo-de-despliegue-en-supabase-externo)

---

## Visión Arquitectónica

El **AI CRM & Workflow Orchestrator v3.0** no es un simple gestor de contactos; es un motor de ejecución autónomo. El núcleo del sistema, denominado **Orchestrator Engine**, procesa leads en tiempo real mediante grafos de decisión lógicos, eliminando la latencia humana en la fase crítica de conversión.

### Pilares del Sistema

- **Multi-tenancy Nativo:** Aislamiento lógico de clientes dentro de un mismo ecosistema.
- **Soberanía de Datos:** Capacidad de delegar el almacenamiento a infraestructuras externas.
- **Omnicanalidad Sincrónica:** Coordinación perfecta de agentes de voz y mensajería.

---

## Gobernanza de Datos y Privacidad

Uno de los mayores valores del sistema v3.0 es su capacidad de **Blindaje de Información**. El propietario del sistema y sus clientes mantienen la soberanía absoluta sobre sus bases de datos mediante mecanismos críticos de seguridad.

### Service Role Keys y Aislamiento

Cuando el sistema se integra con un **Supabase Externo**, la conexión se realiza exclusivamente mediante **Service Role Keys** del cliente. Esto garantiza que:

1. El motor de ESDEN actúa como un operador de datos, pero nunca como dueño.
2. Los datos nunca residen en la infraestructura central si el cliente opta por el self-hosting.

### Row Level Security (RLS)

Todas las tablas (`lead`, `llamadas`, `agendamientos`) cuentan con políticas de **RLS activas**. Esto garantiza que:

- Solo las llaves autorizadas pueden interactuar con los registros.
- Existe un cortafuegos a nivel de base de datos que impide filtraciones entre diferentes Tenants.
- El acceso está blindado ante intentos de lectura externa no autorizada.

---

## Manual de Operaciones

El acceso para el cliente final está diseñado para la máxima claridad operativa.

- **Dashboard de Métricas:** Visualización de KPIs de negocio: costo por lead, tasa de agendamiento y efectividad de la IA.
- **Gestor de Calendario:** Interfaz unificada donde se reflejan las citas confirmadas por el motor de orquestación.
- **Historial de Interacción:** Trazabilidad completa de cada contacto realizado por voz o WhatsApp.

---

## Manual de Ingeniería

El administrador configura la "inteligencia" del sistema mediante el constructor de flujos.

### Conceptos Clave del Motor

- **Lead Trigger:** Nodo de entrada que activa la maquinaria de orquestación al detectar una señal de API.
- **Circuit Breaker:** Mecanismo de seguridad que monitoriza el gasto de APIs en tiempo real y detiene el flujo si se alcanzan los límites financieros del Tenant.
- **Bucle de Reintentos:** Lógica de persistencia inteligente que alterna canales (Llamada vs WhatsApp).

---

## Diccionario Técnico y Variables

El motor utiliza una sintaxis de mapeo dinámico para personalizar cada interacción.

| Variable | Origen de Datos | Función |
| :--- | :--- | :--- |
| `{{lead.nombre}}` | Tabla `lead` | Personalización de saludos y prompts. |
| `{{call.outcome}}` | Orchestrator Logic | Decide la rama del flujo (Cualificado/No contesta). |
| `{{course.name}}` | Metadata del Lead | Contexto semántico para el agente de voz. |
| `{{appointment.link}}` | Service Integration | URL única para la gestión de la cita. |

---

## Integraciones de Infraestructura

### Integración de Voz (Retell AI / Ultravox)

El sistema v3.0 se conecta vía API con proveedores de voz de latencia ultra-baja. El administrador define el **Voice Agent ID**, y el Orchestrator gestiona el inicio, la monitorización y la captura del resumen de la llamada de forma autónoma.

### Mensajería con Meta API

La integración con WhatsApp Business se realiza a nivel de servidor. El motor gestiona el envío de plantillas oficiales y la recepción de webhooks para procesar respuestas de leads en tiempo real.

---

## Protocolo de Despliegue en Supabase Externo

Para garantizar la soberanía, el administrador debe ejecutar el siguiente protocolo en la instancia del cliente:

1. **Habilitación de Extensiones:** `uuid-ossp`.
2. **Despliegue del Schema SQL:** Creación de las tablas e índices necesarios.
3. **Activación de Blindaje:** Ejecución de las políticas RLS.

```sql
-- Ejemplo de Blindaje RLS para el Cliente
ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_access_all" ON public.lead FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---
*Este documento es propiedad intelectual del propietario del sistema AI CRM & Workflow Orchestrator v3.0.*
