---
title: "Divergencias conocidas spec-cliente — input para auditores Fases 1-5"
date: 2026-05-18
status: preliminary
source: docs/Docs-entrega-clienta/ (solo spec — sin lectura de código)
agent: Client-Spec-Extractor (Sonnet)
---

# Divergencias conocidas: spec-cliente vs código

Este documento lista divergencias detectables **solo leyendo la spec de la cliente**, antes de auditar el código. Las Fases 1-5 deben verificar cada una en código para confirmar/refutar.

Clasificación de severidad preliminar (sin ver código):
- **Critical**: divergencia que rompe funcionalidad o seguridad si no está implementada como la spec manda.
- **High**: divergencia que produce comportamiento incorrecto o inconsistente.
- **Medium**: divergencia que puede causar bugs puntuales o deuda técnica.
- **Low**: divergencia cosmética o de baja probabilidad de impacto.

---

### D-001: Airtable vs Supabase como base de datos

- **Fuente cliente**: `Flujo-agent-ia-voz-whatsapp.png` — el diagrama PNG menciona "Airtable" en el nodo de datos/CRM.
- **Spec autoritaria**: `reunion-incial-flujo-deseado.docx` — la reunión documenta explícitamente que el sistema debe usar Supabase y que el desarrollador debe dejar de usar SQL directo sin ORM.
- **Estado preliminar**: **Critical** — divergencia con spec confirmada.
- **Contexto adicional**: La reunión identifica que Renzo estaba construyendo sin ORM (llamadas SQL directas en lugar de Prisma u otro ORM), lo que se menciona como riesgo de seguridad explícito.
- **Notas para auditores Fase 1-5**:
  - Buscar en código cualquier referencia a `airtable`, `AIRTABLE_API_KEY`, `airtableBase`, o librerías `airtable` en `package.json`.
  - Verificar que todas las queries van a Supabase (cliente `@supabase/supabase-js` o `supabase-js`).
  - Confirmar que se usa ORM (Prisma o similar) o query builder, NO SQL raw strings directos en el código de aplicación.
  - Verificar que no existen credenciales de Airtable hardcodeadas en el código.

---

### D-002: Fallo de multi-tenancy — datos hardcodeados de un tenant visible para otro

- **Fuente cliente**: `reunion-incial-flujo-deseado.docx`, sección "Riesgo crítico" — Javi observó datos de clientes codificados que aparecen en la interfaz para el cliente equivocado.
- **Estado preliminar**: **Critical** — vulnerabilidad de seguridad documentada por la propia cliente.
- **Notas para auditores Fase 1-5**:
  - Buscar en código valores de `tenant_id` hardcodeados como strings/UUIDs literales (ej: `'abc-123-...'`).
  - Verificar que TODAS las queries a Supabase incluyen filtro `WHERE tenant_id = $current_tenant`.
  - Revisar Row Level Security (RLS) de Supabase — ¿está activado en todas las tablas con `tenant_id`?
  - Buscar middlewares o contextos que propaguen el `tenant_id` del usuario autenticado a todas las capas.
  - Verificar endpoints API: ¿todos validan que el recurso solicitado pertenece al tenant del usuario autenticado?

---

### D-003: SQL directo sin ORM — riesgo de seguridad e inyección

- **Fuente cliente**: `reunion-incial-flujo-deseado.docx`, sección "Sin ORM: Renzo está usando llamadas SQL directas en lugar de un mapeador objeto-relacional (ORM como Prisma), lo cual es menos seguro y más propenso a errores".
- **Estado preliminar**: **Critical** — riesgo de SQL injection y errores de integridad referencial.
- **Notas para auditores Fase 1-5**:
  - Buscar patrones de template literals con SQL: `` `SELECT * FROM leads WHERE id = ${userId}` `` o similares.
  - Verificar si `prisma` está en `package.json`. Si no está, documentar qué abstracción se usa.
  - Buscar llamadas directas a `supabase.rpc()` con SQL embebido sin parámetros.
  - Si existe Prisma: verificar que el schema de Prisma coincide con el schema de Supabase esperado por la cliente.

---

### D-004: Discrepancia de nomenclatura `user_profession` vs `user_profesion`

- **Fuente cliente**:
  - Spec A/B (`VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx`): `{user_profession}` (con doble 's')
  - Prompt activo C (`Promt-Virginia.md`): `{{user_profesion}}` (sin 's')
- **Estado preliminar**: **High** — si código usa el nombre del A/B y el agente envía el del C (o viceversa), los datos de profesión no mapean al campo correcto en BD.
- **Notas para auditores Fase 1-5**:
  - Buscar en código ambas variantes: `user_profession` y `user_profesion`.
  - Verificar la columna en Supabase: ¿es `user_profession` o `user_profesion`?
  - Buscar en la lógica de parsing de la respuesta del agente IA cuál nombre se usa para extraer el dato.

---

### D-005: Discrepancia de nomenclatura `year_experience` vs `years_experience`

- **Fuente cliente**:
  - Spec A/B: `{year_experience}` (singular)
  - Prompt activo C: `{{years_experience}}` (plural)
- **Estado preliminar**: **High** — misma consecuencia que D-004. Años de experiencia es variable crítica para el árbol de decisión de cualificación.
- **Notas para auditores Fase 1-5**:
  - Buscar ambas variantes en código y en schema de BD.
  - Verificar que el valor que llega del agente se parsea correctamente como número (no string).
  - La regla de negocio crítica: `years_experience >= 2` para Regla B. Si el campo es string o no existe, la cualificación automática falla silenciosamente.

---

### D-006: Typo en tool name del agente — `book_appointmen` vs `book_appointment`

- **Fuente cliente**:
  - Spec A/B: `book_appointment` (correcto)
  - Prompt activo C (`Promt-Virginia.md`, línea 135): `book_appointmen` (sin 't' final)
- **Estado preliminar**: **High** — si el sistema registra la herramienta como `book_appointment` pero el prompt llama a `book_appointmen`, el tool call del agente IA falla silenciosamente o con error.
- **Notas para auditores Fase 1-5**:
  - Buscar el nombre exacto con el que se registra la tool en el código del agente (Retell/Ultravox/LangChain).
  - Comparar con el nombre que usa el prompt de Virginia.

---

### D-007: Estado `"prematriculado"` en prompt Virginia no documentado en spec de variables

- **Fuente cliente**:
  - Prompt activo C (`Promt-Virginia.md`, línea 73): `"prematriculado"` como valor de `{estado}`.
  - Spec A/B: `"prematriculado"` NO aparece en la lista de valores válidos de `{estado}`.
- **Estado preliminar**: **Medium** — si el agente produce este estado pero la BD o el código no lo reconocen, el estado se pierde o causa error.
- **Notas para auditores Fase 1-5**:
  - Verificar si existe columna `estado` en la tabla `lead` o `lead_cualificacion` de Supabase.
  - Verificar si `"prematriculado"` está en el enum/check constraint de esa columna.
  - Si no existe: el agente puede intentar escribir un valor inválido → datos corruptos o error silencioso.

---

### D-008: Variable `{nivel_estudios}` en spec A/B pero ausente en prompt C

- **Fuente cliente**:
  - Spec A/B: `{nivel_estudios}` definida como variable separada con enum: Postgrado/master, universitario, técnico, preuniversitario, básico, sin estudios.
  - Prompt C: no existe `{nivel_estudios}`; el nivel va embebido textualmente en `{user_studies}`.
- **Estado preliminar**: **Medium** — si existe columna `nivel_estudios` en BD, puede estar vacía siempre porque el agente nunca la rellena explícitamente.
- **Notas para auditores Fase 1-5**:
  - Verificar si la tabla `lead_cualificacion` tiene columna `nivel_estudios`.
  - Si existe: ¿hay lógica en código que parsea `user_studies` y extrae el nivel para rellenar `nivel_estudios`? ¿O está siempre NULL?

---

### D-009: Valores de `{qa_topic}` divergen entre spec A/B y prompt activo C

- **Fuente cliente**:
  - Spec A/B: `"precio"`, `"modalidad"`, `"temario"`, `"duración"`, `"Fechas inicio/fin"`, `"Validez/homologación"`, `"Oficialidad"`, `"Otras"`
  - Prompt C: `"precio"`, `"becas"`, `"requisitos"`, `"duracion"`, `"metodologia"`, `"salidas profesionales"`, `"agenda"`, `"otros"`
- **Estado preliminar**: **Medium** — el agente produce valores del conjunto C, pero si la BD o dashboards esperan valores del conjunto A/B, los filtros/métricas de "tema de preguntas" están rotos.
- **Notas para auditores Fase 1-5**:
  - Verificar si `qa_topic` es un enum en BD o texto libre.
  - Buscar en dashboards/métricas si se filtra por valores de `qa_topic` — ¿cuáles valores se esperan?

---

### D-010: Variables de agenda y RAG marcadas como "faltantes" en spec de la cliente

- **Fuente cliente**: `VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx`, nota explícita:
  > "Faltan variables de agenda (días, horas, slot, ventanas, etc disponibles). ¿Hacen falta?"
  > "Faltan también variables de RAG (fecha inicio, hora, beneficios, nombre master, descripción, precio, modalidad). ¿Esto debe tener variables?"
- **Estado preliminar**: **Medium** — la cliente dejó explícitamente estas variables sin definir. Si el código las usa con nombres inventados, hay riesgo de inconsistencia.
- **Notas para auditores Fase 1-5**:
  - Identificar qué nombres usa el código para estas variables (nombre del máster, precio, fechas de inicio, disponibilidad de slots).
  - Documentar para presentar a la cliente y obtener nomenclatura oficial.

---

### D-011: Desarrollo de features nuevos antes de corregir bugs centrales

- **Fuente cliente**: `reunion-incial-flujo-deseado.docx`, sección "Desarrollo sin estructura: Renzo construye nuevas funciones (p. ej., un generador de flujos de trabajo) antes de corregir errores centrales, creando una base inestable."
- **Estado preliminar**: **High** — síntoma estructural. Indica que puede haber funcionalidades parcialmente implementadas o con estados inconsistentes.
- **Notas para auditores Fase 1-5**:
  - Identificar qué features están "en construcción" o parcialmente implementados.
  - En particular, el "generador de flujos de trabajo" (Flow Builder) mencionado — verificar estado actual.
  - Buscar código comentado, flags `// TODO`, funciones no conectadas, o rutas sin implementar.

---

### D-012: Documentación existente incompleta con variables inventadas

- **Fuente cliente**: `reunion-incial-flujo-deseado.docx` — "Documentación deficiente: La documentación existente está incompleta y contiene información inexacta (p. ej., variables inventadas)."
- **Estado preliminar**: **High** — cualquier doc en `docs/` fuera de `Docs-entrega-clienta/` debe tratarse con sospecha hasta ser verificado contra la spec de la cliente.
- **Notas para auditores Fase 1-5**:
  - Al encontrar variables en código que no aparecen en la spec A/B/C de la cliente, marcarlas como "posiblemente inventadas" y documentarlas.
  - No asumir que READMEs o docs internas del proyecto son correctos — la spec de la cliente manda.

---

### D-013: Detección de duplicados — implementación requerida vs estado real

- **Fuente cliente**: `reunion-incial-flujo-deseado.docx` — "El sistema evita procesar leads duplicados al hacer coincidir por teléfono o correo electrónico."
- **Estado preliminar**: **Pendiente verificar en código**.
- **Notas para auditores Fase 1-5**:
  - Buscar lógica de deduplicación de leads (matching por phone/email antes de crear un nuevo lead o iniciar flujo).
  - Verificar que existen índices UNIQUE en `telefono` y `email` en la tabla `lead` (posiblemente a nivel de tenant: UNIQUE(tenant_id, telefono)).

---

### D-014: Conflictos de datos — "agregar, no sobrescribir" en CRM

- **Fuente cliente**: `reunion-incial-flujo-deseado.docx` — "Los datos nuevos del agente de IA se agregan al CRM, no se sobrescriben."
- **Estado preliminar**: **High** — si el código hace un UPDATE o UPSERT que sobreescribe todos los campos en lugar de hacer merge selectivo, datos del CRM del cliente se pierden.
- **Notas para auditores Fase 1-5**:
  - Buscar el mecanismo de sincronización de vuelta al CRM del cliente (webhook, API call).
  - Verificar si es UPDATE completo (sobrescribe) o PATCH/merge (solo campos nuevos del agente).

---

**Status:** DONE
**Summary:** 14 divergencias preliminares identificadas solo desde la lectura de la spec de la cliente. Las más críticas son: presencia de Airtable en diagrama vs Supabase como destino (D-001), fallo de multi-tenancy documentado (D-002), SQL directo sin ORM (D-003), y 5 discrepancias de nomenclatura de variables entre los propios documentos de la cliente (D-004 a D-009).
**Concerns/Blockers:** Ninguno bloqueante. El tablero Miro y la grabación Fathom no se consultaron (requieren acceso externo) — si los auditores de Fases 1-5 necesitan más detalle del flujo, deben solicitar acceso.
