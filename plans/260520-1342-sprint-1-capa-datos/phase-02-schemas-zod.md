# Phase 02 — Schemas Zod

## Context Links

- RoadMap: `plans/RoadMap.md` §Bloque 2.2 (tareas 2-04..2-11)
- Plan RLS phase-05: `plans/20260519-1200-rls-multitenant-hardening/phase-05-repository-pattern-zod.md` (contiene notas Zod relevantes)
- Nomenclatura oficial: `docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx`
- ADR: `plans/reports/adr-auditoria-dependencias-20260520.md` (zod@4.3.6 OK, sin upgrade requerido)

## Overview

- **Prioridad:** P1 — bloqueante para 2.3 (Repository pattern)
- **Estado:** Pendiente
- **Descripción:** Crear la capa completa de schemas Zod en `src/lib/schemas/` para todas las entidades del dominio. Los tipos derivados (`z.infer`) reemplazarán los `as any` del codebase. Paralelizable con 2.1 desde día 1.

## Key Insights

- `zod@4.3.6` está instalado y actualizado — sin upgrade necesario
- La nomenclatura de campos DEBE coincidir con `VARIABLES DEFINIDAS` de la cliente. Cualquier discrepancia es un finding
- Los schemas de `leads` son los más críticos (mayor volumen de uso y mayor riesgo de naming incorrecto)
- `crm_field_mapping` y `crm_write_audit` en 2-11 son prep para Fase 2 — diseñar pensando en la interfaz del adapter

## Requirements

**Funcionales:**
- Un schema Zod por entidad principal del dominio
- Helpers de validación reutilizables (uuid, timestamps, enums comunes)
- Tipos exportados via `z.infer<typeof Schema>` — no declarar tipos TS manuales que repliquen el schema

**No-funcionales:**
- Cada schema < 80 líneas (si crece, split en sub-schemas)
- Exportaciones nombradas consistentes: `LeadSchema`, `CreateLeadSchema`, `UpdateLeadSchema`

## Architecture

```
src/lib/schemas/
├── _base.ts              # uuid, timestamps, enums comunes, helpers
├── leads.ts              # 2-05 — schema principal + variantes
├── tenants.ts            # 2-06 — tenants + tenant_members
├── programs.ts           # 2-07 — programs + courses
├── appointments.ts       # 2-08 — appointments + calls + estados
├── ai-agents.ts          # 2-09 — ai_agents + variants + prompts
├── knowledge-base.ts     # 2-10 — knowledge_base + chat_memory + chat_summary
└── integrations.ts       # 2-11 — integrations + webhooks + crm_field_mapping + crm_write_audit
```

## Related Code Files

**Crear:**
- `src/lib/schemas/_base.ts`
- `src/lib/schemas/leads.ts`
- `src/lib/schemas/tenants.ts`
- `src/lib/schemas/programs.ts`
- `src/lib/schemas/appointments.ts`
- `src/lib/schemas/ai-agents.ts`
- `src/lib/schemas/knowledge-base.ts`
- `src/lib/schemas/integrations.ts`

**Leer para contexto:**
- `docs/Docs-entrega-clienta/Estructura/VARIABLES DEFINIDAS- TODO EL PROCESO ok.docx` — nomenclatura obligatoria
- `plans/20260519-1200-rls-multitenant-hardening/phase-05-repository-pattern-zod.md`

## Implementation Steps

1. **2-04 — Base helpers (4h)**
   - Crear `src/lib/schemas/_base.ts`
   - Helpers: `uuidSchema`, `timestampSchema`, `tenantIdSchema`
   - Enums comunes: estados de lead, estados de llamada, roles de tenant member
   - Convención de naming documentada en comentario del archivo

2. **2-05 — Schema leads (4h)**
   - Cruzar TODAS las columnas contra `VARIABLES DEFINIDAS` — campo a campo
   - Si hay discrepancia nombre BD vs doc cliente → anotar como finding, usar nombre doc cliente
   - Variantes: `LeadSchema` (full), `CreateLeadSchema` (omit id/timestamps), `UpdateLeadSchema` (partial)

3. **2-06 — Tenants + tenant_members (2h)**
   - `TenantSchema`, `TenantMemberSchema`
   - Enum roles: `admin | member | viewer` (verificar con BD real)

4. **2-07 — Programs + courses (2h)**
   - `ProgramSchema`, `CourseSchema`
   - Relación program → courses (array de IDs o nested)

5. **2-08 — Appointments + calls (3h)**
   - Estados explícitos: `agendada | realizada | cancelada | reagendada`
   - `AppointmentSchema`, `CallSchema`
   - Campos de auditoría: `created_by`, `updated_by`

6. **2-09 — AI agents (3h)**
   - `AiAgentSchema`, `AiAgentVariantSchema`, `PromptSchema`
   - Campos LLM: `model`, `temperature`, `max_tokens`, `system_prompt`

7. **2-10 — Knowledge base + chat (2h)**
   - `KnowledgeBaseSchema`, `ChatMemorySchema`, `ChatSummarySchema`
   - Campos vector: confirmar si hay `embedding` (vector type) — manejar como `z.string()` si es base64

8. **2-11 — Integrations + CRM (3h)**
   - `IntegrationSchema`, `WebhookSchema`
   - `CrmFieldMappingSchema` — diseñar pensando en Fase 2: `{ crm_type, crm_field, local_field, transform? }`
   - `CrmWriteAuditSchema` — append-only, campos: `crm_type`, `operation`, `payload_hash`, `result`, `timestamp`

## Todo List

- [ ] 2-04: `src/lib/schemas/_base.ts` con helpers y enums
- [ ] 2-05: `src/lib/schemas/leads.ts` — cruzado con VARIABLES DEFINIDAS
- [ ] 2-06: `src/lib/schemas/tenants.ts`
- [ ] 2-07: `src/lib/schemas/programs.ts`
- [ ] 2-08: `src/lib/schemas/appointments.ts`
- [ ] 2-09: `src/lib/schemas/ai-agents.ts`
- [ ] 2-10: `src/lib/schemas/knowledge-base.ts`
- [ ] 2-11: `src/lib/schemas/integrations.ts` (prep Fase 2)
- [ ] npm run typecheck sin errores tras cada schema

## Success Criteria

- 8 archivos de schema creados, todos compilando sin error
- `z.infer<typeof LeadSchema>` exportado y usable en repositorios
- Nomenclatura de `leads.ts` validada contra `VARIABLES DEFINIDAS` (0 discrepancias o findings documentados)
- Ningún schema supera 80 líneas

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Nomenclatura discrepante BD vs doc cliente | Alta | Medio | Cruzar campo a campo antes de escribir schema; si discrepancia, documentar finding |
| Campos vector/jsonb difíciles de tipar | Baja | Bajo | Usar `z.string()` o `z.record()` como fallback temporal; anotar TODO |
| Schema leads crece >80 líneas | Media | Bajo | Split: LeadSchema.base + LeadSchema.crm + LeadSchema.audit |

## Security Considerations

- `tenant_id` obligatorio en todo schema de entidad tenant-scoped — no opcional
- Schemas de integración NO deben incluir campos de tokens OAuth directamente (cifrados aparte, 2-26)

## Agente Esden

- **Responsable:** `af-agents:database`
- **Revisión:** `af-agents:code` (verificar naming contra VARIABLES DEFINIDAS)

## Next Steps

- Completar antes de iniciar Fase 2 (Repository pattern depende de los tipos Zod)
- Los tipos de `integrations.ts` los usará Fase 2 (adapter layer HubSpot/Zoho)

---

## Tarea adicional 2-35 — Zod whitelist `ai_agent_variants.model_name` (informe Renzo)

**Origen:** [Informe Renzo Módulo Chatbot Web V1](../../docs/Informes%20de%20programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf) §3 💡

**Problema:** El Agent Builder permite guardar `model_name = "gpt-4.1"` (modelo inexistente en OpenAI). El widget aplica un parche en runtime (`src/lib/actions/widget.ts:150`: `if (modelName === "gpt-4.1") modelName = "gpt-4o";`) pero el resto de consumidores (`WhatsAppAIProcessor`, `RescueWorker`, `FactExtractor`) NO lo aplican → silenciosamente fallan o caen a fallback distinto.

**Fix correcto en boundary (Zod):**

1. Definir `ModelNameSchema = z.enum(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', ...])` en `src/lib/schemas/ai-agent-variants.ts` (junto con 2-09). Lista debe coincidir con los modelos realmente soportados por `AgentFactory` (LangChain) + `openai` directo. **Coordinar con `af-agents:adr`** para mantener la lista actualizada (cada vez que OpenAI/Anthropic publican un modelo, ADR + update de la whitelist).
2. Aplicar el schema al guardar `ai_agent_variants` (Server Action o API route que crea/actualiza variantes).
3. Migración de limpieza SQL: `UPDATE ai_agent_variants SET model_name = 'gpt-4o' WHERE model_name = 'gpt-4.1';` (o el modelo más cercano según política producto).
4. **Eliminar el parche manual** de `src/lib/actions/widget.ts:150` — el guard Zod ya garantiza que no entran modelos inválidos.
5. Tests: intento de guardar `model_name = 'gpt-99'` → Zod error 400.

**Estimación:** 2h (incluida en subtotal Sprint 1).

**Cross-refs:**
- 2-09 (Zod schemas `ai_agents` / `ai_agent_variants`) — la whitelist va aquí.
- 2-36 (token_usage, phase-04) y 2-37 (logger, phase-05): complementan el cleanup del widget.
