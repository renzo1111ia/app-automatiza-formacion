# Fase 09 — Fix bugs Renzo + reqs Bea (Bloque 2.9 nuevo)

## Context Links

- [plan.md](plan.md) — overview Sprint 1
- [Reporte análisis cruzado docs Bea+Renzo](../reports/sp-1-close-3-analisis-docs-clienta-renzo-20260522.md) — origen de estas 4 tareas
- [Doc Renzo V1](../../docs/Informes%20de%20programacion/documentacion%20sistema%20%20automatiza%20formacion%20V1.pdf)
- [Correcciones Bea V1](../../docs/Docs-entrega-clienta/Correcciones_aclaraciones%20Bea%20documentacion%20sistema%20%20automatiza%20formacion%20V1.pdf)

## Overview

- **Prioridad**: P1 — bloquea funcionalidad core (orquestador) y modelo de datos (oportunidades).
- **Estado**: 🔘 Pendiente.
- **Estimación**: **28h** (NEW-01: 8h + NEW-02: 6h + NEW-06: 10h + NEW-13: 4h).
- **Agentes sugeridos**: `af-agents:code` (NEW-01, NEW-13) + `af-agents:database` (NEW-02, NEW-06 schema) + `af-agents:adr` (NEW-06 política dedup).

Cuatro tareas que cierran bugs críticos del informe Renzo V1 y satisfacen requisitos funcionales explícitos de la clienta (Bea, correcciones V1). Añadidas al Sprint 1 el 22-05-2026 tras análisis cruzado.

## Tareas

| ID     | Tarea                                                                                                                                          | Estim | Estado       | Dependencias                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------ | ----------------------------------------- |
| NEW-01 | Fix `saveOrchestratorConfig` (guarda `config` de nodos) + consolidación tabla `tenant_orchestrator_config` → `workflows`/`orchestration_rules` | 8h    | 🔘 Pendiente | Independiente (puede arrancar día 1)      |
| NEW-02 | Enum unificado estados lead/cualificación + propagación a Supabase + Zoho + dashboard                                                          | 6h    | 🔘 Pendiente | Requiere 2.2 Zod schemas básicos (día 4+) |
| NEW-06 | Modelo oportunidades múltiples (un lead, N solicitudes con fechas) + dedup mismo día / días sucesivos                                          | 10h   | 🔘 Pendiente | Requiere 2.3 Repository pattern (día 10+) |
| NEW-13 | Política handoff unificada — número inválido → tipificar "ilocalizable" + reintentos configurables + NO pasar a CRM cliente                    | 4h    | 🔘 Pendiente | Independiente (puede arrancar día 1)      |

## NEW-01 — Fix `saveOrchestratorConfig` + consolidación tablas (8h → 3h Sprint 1 + diferido)

**Estado tras Sprint 1**:

- ✅ **Paso 1-2 (diagnóstico + fix inmediato)** — Cerrados en commit `837e12f`. El bug crítico de "config perdida" está resuelto.
- ⚠️ **Paso 3 (consolidación tablas legacy → workflows + orchestration_rules)** — **DIFERIDO** a sprint dedicado post-MVP. Documentado en `docs/adr/ADR-015-orchestrator-doble-personalidad.md` con plan completo de 5 fases (~24h reales, no las 4h estim originales).

Razón del diferimiento: la "doble personalidad" identificada por Renzo NO es "tabla vieja vs tabla nueva" sino dos motores coexistiendo (Motor 1 legacy single-config para auto-trigger de leads, Motor 2 multi-workflow para trigger explícito). Consolidar requiere refactor arquitectónico mayor (16-24h) que toca webhooks de ingesta + UI builder + migración datos. NO es viable en Sprint 1 sin riesgo alto de regresión.

Sprint 1 absorbe solo 3h de las 8h estim originales (paso 1+2). 5h liberadas → no se pierden, simplemente el paso 3 va a su sprint dedicado v0.5.3 post-MVP.

**Origen**: Renzo V1 sección "Módulo del Orquestador" — error crítico identificado.

**Bug**:

> Al presionar el botón de "Guardar Configuración" en el orquestador, el sistema solo guarda el dibujo (las flechas y cajitas) pero olvida guardar las configuraciones de los nodos y del sistema en la base de datos (se obvia el objeto `config` en la función de guardado).
>
> El sistema intenta leer de una tabla nueva (`workflows`), pero el lienzo visual guarda en una tabla vieja (`tenant_orchestrator_config`). Hasta que no se unifiquen, el orquestador visual y el motor real de llamadas no van a coincidir.

**Plan**:

1. **Diagnóstico (1h)**: leer `src/lib/actions/orchestrator-config.ts` (o equivalente) y verificar exactamente qué pierde `saveOrchestratorConfig`. Identificar todos los call sites.
2. **Fix immediato (2h)**: en `saveOrchestratorConfig`, incluir el objeto `config` de cada nodo en el payload de guardado. Validar con Zod (depende de 2.2 si ya está; si no, validación inline ad-hoc).
3. **Consolidación de tablas (4h)**:
   - Migración SQL: copiar datos relevantes de `tenant_orchestrator_config` → `workflows` + `orchestration_rules` (DRY-RUN primero, verificar deltas).
   - Marcar `tenant_orchestrator_config` como deprecated (no borrar todavía).
   - Refactor: cualquier `SELECT FROM tenant_orchestrator_config` → query a `workflows` + `orchestration_rules`.
   - Refactor: cualquier `INSERT/UPDATE tenant_orchestrator_config` → escribir en ambas tablas durante transición.
4. **Tests (1h)**: E2E Playwright cargando orquestador visual, modificando un nodo config, guardando, recargando, verificando que persiste.

**Aceptación**:

- Guardar orquestador con configs en nodos → `psql -c "SELECT config FROM workflows WHERE id = ..."` muestra el JSON completo.
- Recargar la página → la UI muestra los configs idénticos.
- `tenant_orchestrator_config` queda como tabla de compatibilidad (no es la fuente de verdad).

## NEW-02 — Enum unificado estados lead/cualificación (6h)

**Origen**: Renzo V1 sección "Lógica de Negocio" — "Inconsistencia de Estados".

**Bug**:

> A lo largo del código, el estado se guarda de diferentes formas. En Supabase usa `current_stage: "SCHEDULING"`, en los metadatos usa `qualified: true`, y en Zoho usa la etiqueta `Cualificado_Virginia`. No hay un Enum estricto en TypeScript que obligue a usar un solo formato estándar, lo que provoca la desincronización mencionada en el informe.

**Plan**:

1. **Diagnóstico (1h)**: grep de TODOS los estados usados en código. Catalogar: Supabase columns, Zoho tags, blueprint actions, dashboard labels.
2. **Diseño enum (1h)**: definir en `src/types/lead-status.ts`:
   - `LeadStage`: `NEW | CONTACTED | QUALIFIED | SCHEDULING | BOOKED | DROPPED | UNREACHABLE`
   - `LeadQualification`: `PENDING | QUALIFIED | UNQUALIFIED | EXCLUDED`
   - Zod schema asociado (depende de 2.2 ya hecho).
3. **Mapper Zoho ↔ interno (1h)**: `mapZohoTagToStage()` y `mapStageToZohoTag()` para no romper integración existente.
4. **Refactor (2h)**: reemplazar TODOS los strings literales por el enum. Lugares clave: `handleLeadQualification`, `triggerOrchestratorForLead`, dashboard queries `current_stage = 'SCHEDULING'`.
5. **Migración SQL (1h)**: opcional — `CHECK constraint` en `lead.current_stage` para que la BD valide el enum (puede romper datos legacy, evaluar).

**Aceptación**:

- 0 strings literales de estado en código (`grep -E "'SCHEDULING'|'QUALIFIED'"` retorna sólo `src/types/lead-status.ts`).
- Test integración: crear lead → cualificarlo → verificar columna `current_stage` + metadata + etiqueta Zoho coherentes.

## NEW-06 — Modelo oportunidades múltiples + dedup (10h)

**Origen**: Bea correcciones V1 punto "Reporte Detallado: Módulo de Resumen de Leads".

**Requisito**:

> Un mismo lead podrá tener diferentes solicitudes de información (del mismo curso o de otros, en periodos de tiempo diferentes). En este sentido en el lead se deberá ver, con fechas de solicitud, lo que pasó en cada una de las solicitudes.
>
> Con respecto a esto hay que tener en cuenta posibles duplicidades. Si un mismo lead solicita información el mismo dia o en días sucesivos (dia 1 y día 2) esto en realidad es un duplicado y no debería tomarse como 2 solicitudes, sino como 1 solicitud, considerando la segunda como un duplicado.

**Plan**:

1. **Diseño schema (2h)**:
   - Nueva tabla `lead_opportunities` (`id`, `lead_id` FK, `programa_id` FK, `fecha_solicitud`, `estado_oportunidad`, `metadata`, `is_duplicate_of` nullable FK self).
   - El `lead` deja de "ser la oportunidad" y pasa a "ser la persona". Las solicitudes se acumulan en `lead_opportunities`.
2. **Lógica dedup (2h)**: helper `detectDuplicateOpportunity(lead_id, programa_id, fecha)` que:
   - Busca oportunidades del mismo lead+programa en las últimas 48h.
   - Si existe → marca la nueva como `is_duplicate_of = <id>` y devuelve la original.
   - Si no existe → inserta como nueva oportunidad.
3. **Migración datos legacy (2h)**: SQL que para cada `lead` existente crea 1 `lead_opportunities` con `fecha_solicitud = lead.fecha_ingreso_crm`. Mantener `is_duplicate_of = NULL` para todos los legacy (no se intenta detectar duplicados retroactivos).
4. **Repository (2h)**: `LeadOpportunitiesRepository` con métodos `findByLead`, `createWithDedup`, `markAsDuplicate`. Depende de 2.3 (patron Repository) ya implementado.
5. **Server actions (1h)**: actualizar `createLead` y webhooks de ingesta para llamar `createWithDedup`.
6. **UI Historial (1h)**: en `LeadTraceabilitySidebar`, mostrar la lista de oportunidades con fechas + tag "DUPLICADO" si aplica.

**Aceptación**:

- Crear 2 leads con mismo email + curso, segundo dentro de 24h → segundo se inserta con `is_duplicate_of` apuntando al primero.
- Crear 2 leads mismo email pero distinto curso → ambos son oportunidades independientes (no duplicado).
- Lead con 3 oportunidades en 6 meses → Historial muestra timeline con 3 entradas + estado de cada una.

## NEW-13 — Política handoff unificada (4h)

**Origen**: Bea correcciones V1 punto "Escalado a Humanos (Handoff)".

**Requisito**:

> Este escalado no debe ser así por sistema. No tendría sentido para el cliente que si una llamada falla o si el teléfono está mal, que se lo pasásemos para que sus asesores "pierdan" tiempo en esto. Por llamada fallida o lead con número no válido no se pasa a cliente para que ellos continúen en seguimiento. Si número no válido, se tipifica en CRM del cliente y en base de datos interna como tal, si es llamada fallida se harán reintentos por whatsapp y llamada hasta completar número de intentos establecido, y si no se consigue contacto se descartará lead y se tipificará como "ilocalizable".

**Plan**:

1. **Diagnóstico (1h)**: identificar todos los puntos del código que hoy hacen "handoff humano". Foco: blueprint Zoho actual "Anulado automáticamente por IA - Número Inválido" + flujo `handoff_on_qualified_not_booked`.
2. **Política unificada (1h)**: documentar en `docs/adr/0014-politica-handoff-humano.md`:
   - Nº inválido → tipificar `lead.status = UNREACHABLE` + `lead.unreachable_reason = 'invalid_phone'`. NO pasar a CRM cliente.
   - Llamada fallida (timeout, no contesta) → incrementar `lead.contact_attempts`. Si `< max_attempts` (config tenant, default 5) → reintento por canal alternativo (WhatsApp si llamada falló, viceversa). Si `>= max_attempts` → `lead.status = UNREACHABLE`, `lead.unreachable_reason = 'no_response'`.
   - Cualificado pero no agenda (3h sin agendar) → SÍ pasa a CRM cliente (handoff_on_qualified_not_booked se mantiene activo).
3. **Implementación (2h)**:
   - Función `handleUnreachable(leadId, reason)` que actualiza el estado + log estructurado.
   - Refactor del blueprint Zoho actual: en lugar de marcar como "anulado", marca como "UNREACHABLE" y NO crea tarea para asesor humano.
   - Config tenant: `tenant.config.max_contact_attempts` (default 5) y `tenant.config.handoff_qualified_not_booked_hours` (default 3).
4. **Tests (1h opcional)**: simulación con número inválido → verifica que `UNREACHABLE` se setea sin crear tarea en Zoho.

**Aceptación**:

- Lead con tel inválido → status `UNREACHABLE`, sin tarea en Zoho, sin notificación al asesor.
- Lead con 5 intentos sin contacto → status `UNREACHABLE` automático tras último intento.
- Lead cualificado pero sin agendar 3h → SÍ se pasa a Zoho con tarea para asesor (regla pre-existente conservada).

## Estado del bloque

| Tarea  | Estado       | Notas                                 |
| ------ | ------------ | ------------------------------------- |
| NEW-01 | 🔘 Pendiente | Independiente, puede arrancar día 1   |
| NEW-02 | 🔘 Pendiente | Tras 2.2 Zod schemas (día 4+)         |
| NEW-06 | 🔘 Pendiente | Tras 2.3 Repository pattern (día 10+) |
| NEW-13 | 🔘 Pendiente | Independiente, puede arrancar día 1   |

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| NEW-01 consolidación tablas rompe orquestadores en producción                    | Migración con DRY-RUN + período de doble escritura (escribir en ambas) hasta validar                   |
| NEW-02 enum estricto rompe rows legacy con estados raros                         | Mapper de compatibilidad + log de strings no mapeados durante 1 semana antes de hacer CHECK constraint |
| NEW-06 cambio de modelo afecta dashboards (KPIs cuentan leads, no oportunidades) | Decisión arquitectónica al arrancar: ¿KPIs por lead o por oportunidad? Documentar en ADR               |
| NEW-13 cambia comportamiento Zoho existente                                      | Coordinar con CRM Adapter Sprint 2 — no romper integraciones actuales                                  |

## Hand-off a SP-4B phase-02 (Renzo)

Al completar este bloque, documentar en `plans/260522-1700-sprint-validacion-pre-mvp/phase-02-validacion-sprint-1.md`:

- Cómo verificar manualmente que `saveOrchestratorConfig` persiste todo (NEW-01).
- Casos de prueba para el enum unificado (NEW-02): crear lead → cualificar → verificar 3 sitios.
- Test funcional oportunidades múltiples (NEW-06): scripts de seed con 3 escenarios duplicado/no-duplicado.
- Verificación tipo "ilocalizable" en Zoho (NEW-13) con número inválido de prueba.
