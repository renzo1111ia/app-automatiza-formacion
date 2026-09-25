---
title: "Gap Analysis - Spec Cliente vs Codigo"
date: 2026-05-18
status: final
phase: 6-consolidation
agent: Consolidator+GapAnalyst (Sonnet)
authority: docs/audit/00-client-spec-extraction.md (TOP)
---

# Gap Analysis - Spec Cliente vs Codigo

## Metodologia

Cada gap cruza la spec autoritaria (docs/audit/00-client-spec-extraction.md) con los findings
de las Fases 1-5. La spec de la cliente es la fuente de verdad. El codigo es lo auditado.

Severidad de gaps:

- CRITICO: el sistema produce resultados incorrectos o inaceptables para el negocio.
- ALTO: funcionalidad importante incompleta o divergente.
- MEDIO: comportamiento suboptimo o inconsistente.
- RESUELTO: gap identificado en spec preliminar pero descartado por auditoria de codigo.

---

## G-01: Flujo deseado (reunion-inicial-flujo.pdf vs codigo)

Fuente spec: docs/audit/00-client-spec-extraction.md seccion 1, docs/audit/02-orchestrator-findings.md

| Fase del flujo | Estado spec | Estado en codigo | Gap | Severidad |
|----------------|-------------|------------------|-----|-----------|
| Fase 1: Lead entra desde CRM en tiempo real | Requerido | ZohoPollingProcessor (cron 10min) + webhook WhatsApp | PARCIAL: polling no es tiempo real (10min lag). No hay webhook CRM nativo Zoho | ALTO |
| Fase 1: Deduplicacion por telefono/email | Requerido | upsert en pollers previene filas duplicadas en BD | CRITICO: handleNewLead se llama igualmente sin verificar secuencia activa (F-02-010) | CRITICO |
| Fase 2: Verificar hora local del lead (9am-9pm) | Requerido | buildComplianceDecision + resolveTimezone | OK - Implementado correctamente | OK |
| Fase 2: Si fuera de horario - WhatsApp plantilla | Requerido | executeWhatsAppStep como fallback compliance | OK - Implementado | OK |
| Fase 2: Si dentro de horario - llamada de voz | Requerido | executeCallStep via Retell o Ultravox | OK - Implementado con deteccion de proveedor | OK |
| Fase 2: Protocolo multi-dia configurable | Requerido | executeRetrySequenceStep implementado en orquestador | CRITICO: jobs reactivados no funcionan por F-02-001 (firma incorrecta en worker.js) | CRITICO |
| Fase 3: Cualificacion conversacional Virginia | Requerido | WhatsAppAIProcessor (WA) + Retell/Ultravox (voz) | PARCIAL: WA funcional; voz requiere QUALIFY_ANALYSIS que esta roto (F-02-005) | CRITICO |
| Fase 3.5: Arbol de decision Reglas A/B | Requerido | qualifier.ts (deterministico) + QualificationProcessor (LLM) | CRITICO: umbrales erroneos (F-02-006); QualificationProcessor roto (F-02-005) | CRITICO |
| Fase 4: Si apto - proponer agenda | Requerido | book_appointment tool en WhatsAppAIProcessor | OK para WA. Voz depende de webhook Retell | ALTO |
| Fase 4: Si no apto - descarte | Requerido | QualificationProcessor actualiza tipo_lead a DESCARTADO | ALTO: flujo de descarte no conectado al orchestrator principal | ALTO |
| Fase 5: Sync al CRM del cliente | Requerido | CRMExportProcessor via CRM_SYNC action | PARCIAL: agregar no sobrescribir no garantizado (F-02-015) | MEDIO |
| Fase 6: Estados informado/matriculado | Mencionado en spec | No implementado en orchestrator | ACEPTABLE si son gestionados por asesor humano manualmente (confirmado por spec) | BAJO |

Ultravox: gap adicional - no hay webhook post-llamada para Ultravox. Las llamadas son fire-and-forget
sin analisis post-llamada ni actualizacion de estado (F-03-XXX implicioto en audit LLM).

---

## G-02: Esquema BD Supabase (tablas esperadas vs migrations vs codigo)

Fuente spec: docs/audit/00-client-spec-extraction.md seccion 2, docs/audit/04-data-findings.md

| Tabla esperada por spec | En migrations | En codigo | Gap / Nota |
|------------------------|---------------|-----------|------------|
| tenants | SI (tenants.sql) | SI | OK |
| tenant_orchestrator_config | SI (orchestrator_v3.sql) | SI | OK - RLS deficiente (F-04-012) |
| lead | SI (multitenant_schema.sql) | SI | OK - falta filtro en fetchCalls (F-04-001) |
| lead_cualificacion | SI | SI | OK - columna anios_experiencia vs spec years_experience |
| lead_programas | SI | SI | OK |
| ai_agents | SI (ai_agents.sql) | SI | OK - RLS tautologica (F-04-005) |
| ai_agent_variants | SI | SI | OK - api_key sin cifrado (F-03-009) |
| voice_agents | SI | SI | OK |
| voice_agent_variants | PARCIAL (en config JSONB) | PARCIAL | Spec define tabla separada; codigo usa config JSONB en tenants |
| chat_summaries | SI | SI | OK - 1 fila por lead_id |
| chat_messages | SI | SI | tenant_id es TEXT no UUID - FK rota (F-04-013) |
| llamadas | SI | SI | OK |
| intentos_llamadas | SI | SI | Duplicacion con tabla intentos legacy |
| appointments / agendamientos | AMBAS existen (duplicadas) | Codigo usa ambas | MEDIO: duplicacion no resuelta - appointments usa scheduled_at; agendamientos usa fecha_agendada_cliente |
| availability_slots | SI | SI | OK |
| orchestration_graphs | SI | SI | OK |
| orchestration_rules | SI | SI | OK |
| workflows | SI | SI | OK |
| knowledge_base | SI | SI | RLS con app.current_tenant no seteado (F-04-004) |
| knowledge_base_embeddings | SI | SI | OK |
| programas | SI | SI | Sin filtro tenant en getPrograms (F-04-008) |

Tablas en codigo no en spec de cliente (adicionales):

- client_configs (routing avanzado)
- system_logs, ai_agent_logs, lead_events (logs internos)
- web_widgets (chatbot web, mencionado en menu lateral)
- campanas (mencionado en menu, no en spec BD)

---

## G-03: Nomenclatura variables de leads

Fuentes: D-004 a D-009 (00-known-divergences.md), F-01-006, F-01-007, F-04-XXX (data-findings)

| Variable oficial spec (A/B) | Prompt Virginia (C) | Columna BD | Campo en codigo | Gap / Severidad |
|-----------------------------|---------------------|-----------|-----------------|-----------------|
| {user_name} | {{user_name}} | nombre + apellido | lead.nombre, USER_NAME en metadata | BAJO - mapeo funcional, BD usa nombre/apellido separados |
| {id_lead} | {{id_lead}} | id, id_lead_externo | lead.id_lead_externo | OK |
| {user_country} | {{user_country}} | pais | lead.pais, USER_COUNTRY | BAJO - nombre columna difiere |
| {user_phone} | {{user_phone}} | telefono | lead.telefono | OK |
| {curse_name} (typo) | {{curse_name}} (typo) | No columna; en metadata.course_name | CURSE_NAME en ai-analysis, course_name en orchestrator | ALTO - typo corregido sin consenso (F-01-007) |
| {user_studies} | {{user_studies}} | nivel_estudios (lead_cualificacion) | USER_ESTUDIES en ai-analysis | MEDIO - triple discrepancia: spec user_studies, codigo USER_ESTUDIES, BD nivel_estudios |
| {user_profession} | {{user_profesion}} (sin s) | No columna; en metadata | USER_PROFESION en ai-analysis | CRITICO - spec profession, prompt profesion, codigo USER_PROFESION (F-03-005, D-004) |
| {year_experience} (singular) | {{years_experience}} (plural) | anios_experiencia (lead_cualificacion) | 4 variantes: years_experience, YEARS_EXPERIENCE, YEARS_EXPERIENCIE, YEARS_ EXPERIENCIE | CRITICO - 4 variantes en codigo, BD usa anios_experiencia (F-03-006, D-005) |
| {qualified} apto/no apto | {{qualified}} apto/no apto | cualificacion (lead_cualificacion) | si/no/anulado (ai-analysis) y cualificado/no cualificado (qualifier) | CRITICO - ninguno coincide con spec (F-01-003, F-03-002, F-04-010) |
| {estado} 7 valores | {{estado}} | No columna explicita; tipo_lead en lead | current_stage en lead o tipo_lead | ALTO - tipo_lead actua como estado con nombre semanticamente erroneo (F-01-006) |
| {motivo_descarte} | {{motivo_descarte}} | motivo_anulacion (lead_cualificacion) | MOTIVO_DESCARTE en extractor | MEDIO - mapeo implicito sin validacion enum (F-04-011) |
| {fecha_agenda} | {{fecha_agenda}} | fecha_agendada_cliente (agendamientos) y scheduled_at (appointments) | fecha_agendada_lead en codigo | MEDIO - duplicidad de tablas |
| {scheduled_call_confirmed} | {{scheduled_call_confirmed}} | confirmado (agendamientos) | scheduled_call_confirmed en ai-analysis | OK |
| {conversation_status} | {{conversation_status}} | No columna BD | conversation_status en fact-extractor | MEDIO - solo en metadata JSONB |
| {resumen_conversacion} | {{resumen_conversacion}} | chat_summaries.summary | summary en chat_summaries | OK funcional |
| book_appointment (tool) | book_appointmen (typo en C) | N/A | book_appointment en codigo (correcto) | ALTO - typo en prompt fuente; riesgo al actualizar BD desde doc (F-03-004) |

Aclaracion pendiente de cliente para nomenclatura canonica:

- user_profession vs user_profesion (D-004)
- year_experience vs years_experience (D-005)
- curse_name como nomenclatura oficial o corregir a course_name (C-004)

---

## G-04: Prompt Virginia

Fuente spec: docs/audit/00-client-spec-extraction.md seccion 4, docs/audit/03-llm-findings.md

| Aspecto | Spec (Promt-Virginia.md) | Codigo | Gap |
|---------|--------------------------|--------|-----|
| Valores qualified | apto / no apto / vacio | si/no/anulado (ai-analysis), SI/NO/PENDIENTE (fact-extractor) | CRITICO: F-03-002 - ninguno coincide (refs F-01-003, F-04-010) |
| Regla B umbral experiencia | years_experience >= 2 | years_experience >= 3 | CRITICO: F-03-003 - leads con 2 anios son rechazados incorrectamente |
| Regla C (sin estudios) | years_experience >= 2 (misma Regla B) | years_experience >= 5 (Regla C inventada) | CRITICO: F-01-005 - regla no documentada en spec |
| Exclusion perfiles manuales (fontanero, albanil) | Explicita en spec sec. 3.5 | No implementada en qualifier.ts | CRITICO: F-01-005 - leads invalidos pueden ser cualificados |
| Estado prematriculado | Aparece en prompt C (linea 73) | No manejado en extractores | MEDIO: F-03-010, D-007 - estado se pierde o va a metadata sin accion |
| book_appointment tool | book_appointmen (typo en prompt doc) | book_appointment (correcto en codigo) | ALTO: F-03-004 - riesgo al copiar prompt desde doc fuente a BD |
| user_profesion vs user_profession | prompt C usa user_profesion (sin s) | ai-analysis.ts usa USER_PROFESION (sin s) | ALTO: F-03-005 - inconsistente con spec oficial A/B |
| Prompts hardcodeados en codigo | No debe haber prompts hardcodeados | ai-analysis.ts, fact-extractor.ts, ai-rescue.ts tienen prompts hardcodeados | MEDIO: prompts de analisis no gestionados desde BD como el prompt de Virginia |
| Prompt de Virginia en BD | Si - cargado desde ai_agent_variants.prompt_text | Implementado en WhatsAppAIProcessor | OK - arquitectura correcta |

---

## G-05: Menu lateral

Fuente spec: docs/audit/00-client-spec-extraction.md seccion 5, docs/audit/01-structure-findings.md F-01-013

Divergencias encontradas entre spec y codigo (src/components/layout/Sidebar.tsx):

| Item | Spec | Codigo | Gap |
|------|------|--------|-----|
| Campanas | Dentro de seccion Leads como subitem | Seccion independiente al mismo nivel que Leads | MEDIO |
| Metricas > Campanas | Subitem de Metricas | No existe como subitem de Metricas | MEDIO |
| Pruebas y Logs > items | Simulador Playground (juntos) y Auditoria Logs | Simulador, Playground (separados) y Auditoria Logs | BAJO |
| Admin Panel | Dentro de seccion Negocio | Dentro de Negocio - correcto | OK |
| Docs | Dentro de Admin Panel | Item de primer nivel | BAJO |

---

## G-06: Agente voz + WhatsApp (latencia, fallback, webhooks)

Fuente spec: docs/audit/00-client-spec-extraction.md seccion 6, docs/audit/03-llm-findings.md

| Aspecto | Spec | Codigo | Gap |
|---------|------|--------|-----|
| Canal WhatsApp - cualificacion Virginia | Mismo flujo que voz | WhatsAppAIProcessor implementado | OK - funcional con tools book_appointment etc. |
| Canal Voz Retell - cualificacion | Virginia via Retell | Implementado: executeCallStep + webhook post-llamada | OK |
| Canal Voz Ultravox - post-llamada | Analisis tras llamada | NO HAY webhook Ultravox. Llamadas son fire-and-forget | CRITICO: las llamadas Ultravox no tienen analisis post-llamada ni actualizacion de estado |
| Latencia WhatsApp | No especificado (800ms mencionado en LLM doc) | No se mide. Arquitectura: 7 ops paralelas + embedding + GPT. Probable >800ms en P95 | MEDIO: F-03-011 |
| Fallback voz Retell -> Ultravox | Configurable por tenant | Mutuamente excluyentes por config - no hay fallback automatico | MEDIO |
| Protocolo multi-dia configurable | Requerido - secuencia llamadas + WA | executeRetrySequenceStep implementado pero roto por F-02-001 | CRITICO |
| Firma de webhook Retell | Validar origen | No hay validacion HMAC en webhook Retell | ALTO: F-05-SEC-005 - cualquier POST es procesado |

---

## G-07: Airtable vs Supabase - RESUELTA

Fuente spec: D-001 (00-known-divergences.md), docs/audit/04-data-findings.md seccion final

La divergencia D-001 (presencia de Airtable en diagrama PNG vs Supabase en spec) fue investigada
exhaustivamente por la Fase 4 (Audit-Data).

Resultado de la auditoria de codigo: 0 referencias a Airtable encontradas en todo el repositorio
(archivos .ts, .tsx, .js, .jsx, .json, .sql, .md, .env).

Interpretacion confirmada: La referencia a Airtable en el PNG Flujo-agent-ia-voz-whatsapp.png era
al CRM externo previo de Esden (antes de este proyecto). El codigo usa exclusivamente
@supabase/supabase-js. D-001 DESCARTADA.

---

## Resumen de Gaps por Severidad

| Severidad | Cantidad | Ejemplos clave |
|-----------|----------|----------------|
| CRITICO   | 7        | Flujo multi-dia roto, deduplicacion falla, arbol decision incorrecto, Ultravox sin post-llamada |
| ALTO      | 6        | Polling no tiempo real, descarte no conectado, webhook sin firma, nomenclatura curse_name |
| MEDIO     | 8        | Tablas duplicadas, prematriculado sin manejar, latencia no medida, menu sidebar |
| RESUELTO  | 1        | D-001 Airtable - confirmada ausencia en codigo |

---

## Preguntas para la Cliente

Derivadas de la spec (00-client-spec-extraction.md seccion 10) mas hallazgos del audit:

1. Nomenclatura canonica: user_profession o user_profesion? year_experience o years_experience?
   Impacto directo en datos de cualificacion en BD y sincronizacion con CRM.

2. curse_name es nomenclatura oficial (typo intencional) o corregir a course_name?
   Si se corrige, actualizar los 3 documentos de spec y el prompt en BD.

3. nivel_estudios: es columna separada en BD o va embebido en user_studies?
   Actualmente existe columna nivel_estudios en lead_cualificacion pero el agente no la rellena.

4. Estado prematriculado: es estado valido del sistema o vestigio del borrador del prompt?
   Si es valido: aniadir al enum en BD y definir accion que dispara.

5. Regla B del arbol de decision: el umbral es >= 2 anios (spec) o >= 3 anios (codigo)?
   El codigo diverge de la spec - requiere confirmacion antes de corregir.

6. Regla C (sin estudios con >= 5 anios): existe en los requisitos reales o es error de implementacion?
   La spec no la menciona. El codigo la implementa pero falta la exclusion de perfiles manuales.

7. Variables de agenda y RAG: la propia spec las marca como pendientes de definicion.
   Que nombres usar para slots disponibles, nombre del master, precio, fechas de inicio?

8. CRM externo actual: con que CRM se integra el sistema? Airtable era previo; actualmente Zoho?
   Via API REST, webhook, o ambos?

9. Estado informado y matriculado: los actualiza el asesor humano manualmente o hay automatizacion?
   Actualmente no implementados en el orquestador.

10. Protocolo multi-dia concreto: cuantas llamadas, cuantos WhatsApps, en que intervalos?
    El codigo tiene config flexible pero los valores por defecto pueden no coincidir con el negocio.

---

**Status:** DONE
**Summary:** 7 gaps criticos identificados cruzando spec con codigo. El mas urgente es el flujo
multi-dia completamente roto (G-01). D-001 (Airtable) resuelta: 0 referencias en codigo.
10 preguntas pendientes de aclaracion con la cliente para alinear nomenclatura y reglas de negocio.
