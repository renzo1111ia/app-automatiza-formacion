# Fase 01 — Datos: índice de canal + flags Whats/Voz + origen voz

## Context Links

- Plan: [plan.md](plan.md)
- Schema base: `supabase/migrations/20260101000001_base_schema.sql` (tablas `llamadas`, `chat_messages`, `conversaciones_whatsapp`, `lead`)
- Webhook poblador: `src/app/api/webhooks/retell/route.ts`
- Tipos: `src/types/database.ts`

## Overview

- **Prioridad**: Alta (base de las fases 02 y 04).
- **Status**: 🔘 Pendiente.
- **Descripción**: Preparar la capa de datos para el canal de voz: tabla índice opcional
  `conversaciones_voz`, derivación de flags `tiene_whatsapp` / `tiene_voz` por lead, y
  normalización de `origen='llamada_voz'` para leads entrados por voz.

## Key Insights

- El inbox real NO vive en `conversaciones_whatsapp` (tabla casi vacía: id, lead, opt_in, estado, fechas).
  Vive en `chat_messages`. La conversación de voz ya está en `chat_messages` (SYSTEM_LOG) + `llamadas`.
- Por tanto `conversaciones_voz` es **opcional**: sirve como índice de hilo por lead (simetría con WhatsApp)
  pero NO es imprescindible para mostrar la conversación. Decisión: crearla **mínima** para `estado`/`fecha_ultimo`
  y permitir filtrado eficiente, con backfill desde `llamadas`.
- Los flags Whats/Voz se derivan en consulta (`EXISTS`), NO se almacenan desnormalizados (evita drift).

## Requirements

**Funcionales**

- Existe forma eficiente de saber, por lead: ¿tiene al menos una conversación WhatsApp? ¿tiene al menos una llamada de voz?
- Leads cuyo primer contacto es una llamada de voz quedan con `origen='llamada_voz'` (si `origen` está vacío).

**No funcionales**

- RLS multi-tenant activo en `conversaciones_voz`.
- Migración idempotente (`IF NOT EXISTS`), aplicable en local y VPS.
- Sin desnormalización de flags (se calculan on-read).

## Architecture

```
lead ──┬── chat_messages   (whatsapp + system logs de voz)  → flag tiene_whatsapp = EXISTS(msg TEXT/TEMPLATE/IMAGE/DOC con metadata sin call_id)
       ├── llamadas        (detalle de cada llamada)          → flag tiene_voz      = EXISTS(llamadas por id_lead)
       └── conversaciones_voz (NUEVO índice opcional de hilo) → estado, fecha_ultimo_mensaje
```

Discriminación whatsapp vs voz dentro de `chat_messages`: un mensaje es "de voz" si `message_type='SYSTEM_LOG'`
y `metadata->>'call_id'` existe. El resto es WhatsApp. (Confirmar contra datos reales en implementación.)

## Related Code Files

**Crear**

- `supabase/migrations/20260610XXXXXX_create_conversaciones_voz.sql` — tabla + RLS + índices + backfill desde `llamadas`.
- (opcional) `src/lib/repositories/voice-conversations-repository.ts` — si el patrón Repository lo requiere (<200 líneas).

**Modificar**

- `src/types/database.ts` — añadir tipo `ConversacionVoz` + (si aplica) extender `InboxLead` con `tiene_whatsapp`/`tiene_voz`.
- `src/app/api/webhooks/retell/route.ts` — al insertar `llamadas`, hacer upsert del índice `conversaciones_voz`
  (estado='ACTIVA', fecha_ultimo_mensaje=now()) y, si el lead no tiene `origen`, set `origen='llamada_voz'`.

## Implementation Steps

1. Escribir migración `conversaciones_voz` (clon estructural de `conversaciones_whatsapp`):
   `id, tenant_id, id_lead, id_llamada_externa TEXT, estado TEXT DEFAULT 'ACTIVA',
fecha_ultimo_mensaje TIMESTAMPTZ, fecha_creacion TIMESTAMPTZ` + `ENABLE ROW LEVEL SECURITY`
   - política RLS por `tenant_id` + índices `(tenant_id)`, `(id_lead)`.
2. En la misma migración: backfill `INSERT ... SELECT DISTINCT` desde `llamadas` (un hilo por lead con su última fecha).
3. Aplicar migración en Supabase local; verificar tabla + RLS con `psql`/pg-meta.
4. Extender el webhook Retell: tras insertar en `llamadas`, upsert en `conversaciones_voz`
   y normalizar `lead.origen='llamada_voz'` cuando esté vacío. Mantener idempotencia.
5. Añadir tipo `ConversacionVoz` en `database.ts`.

## Todo List

- [ ] Migración `conversaciones_voz` (tabla + RLS + índices + backfill).
- [ ] Aplicar y verificar en local.
- [ ] Webhook Retell: upsert índice + normalizar origen.
- [ ] Tipo `ConversacionVoz` en `database.ts`.
- [ ] Consulta de derivación de flags `tiene_whatsapp`/`tiene_voz` lista para fase 04 (query EXISTS).

## Success Criteria

- Tabla `conversaciones_voz` existe con RLS y datos backfilled coherentes con `llamadas`.
- Nueva llamada vía webhook crea/actualiza su índice y marca origen voz si procede.
- Query de flags devuelve true/false correctos sobre datos reales de prueba.

## Risk Assessment

- **Discriminación whatsapp/voz en `chat_messages`**: si el criterio (`call_id` en metadata) no cubre todos los casos,
  los flags pueden fallar. Mitigación: validar contra datos reales; preferir `llamadas` como verdad para "voz".
- **Backfill duplicados**: usar `DISTINCT`/`ON CONFLICT` para no duplicar hilos.

## Security Considerations

- RLS obligatorio en `conversaciones_voz` (multi-tenant). Service-role solo en webhook server-side.
- ⚠️ **CORRECCIÓN tras review (RLS-001)**: la migración `conversaciones_voz` debe NACER con política RLS
  **filtrada por `tenant_id`** (`USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)` para `authenticated`),
  NO replicar el patrón permisivo `authenticated_read_* USING (true)` de `base_schema.sql:449-450`. Ese patrón
  permisivo es deuda PRE-EXISTENTE en chat_messages/lead/llamadas/conversaciones_whatsapp — en verificación VPS,
  fuera del alcance de este sprint, pero NO se propaga a la tabla nueva.
- Webhook ya valida HMAC (`verifyRetellWebhook`) — no se relaja.

## Hardening adicional detectado en review (incorporar a esta fase)

- ⚠️ **WEBHOOK-001 (idempotencia)**: añadir `UNIQUE (id_llamada_retell, tenant_id)` a `llamadas` y usar `upsert`
  con `onConflict` en el webhook. Hoy un retry de Retell duplica llamadas → infla el dashboard.
- ⚠️ **SCHEMA-004 (origen)**: el webhook NO escribe `lead.origen` hoy. Añadir `UPDATE lead SET origen='llamada_voz'
WHERE id=leadId AND (origen IS NULL OR origen='')` tras insertar la llamada.
- ⚠️ **SCHEMA-003 (discriminación)**: añadir índice en `chat_messages (message_type, (metadata->>'call_id'))`
  y una query de auditoría al cerrar la fase: `SELECT count(*) FROM chat_messages WHERE message_type='SYSTEM_LOG'
AND metadata->>'call_id' IS NULL`. Preferir `EXISTS(llamadas)` como verdad para el flag "Voz".
- ⚠️ **SCHEMA-001 (nota, no bloqueante)**: `chat_messages.tenant_id` es TEXT vs UUID del resto — documentar, no migrar aquí.

## Next Steps

- Fase 02 consume el índice y la discriminación de canal para el inbox de voz.
- Fase 04 consume la query de flags para las columnas Whats/Voz.
