# ADR-022 — `write_policy` semantics: append_only default + overwrite_with_audit

- **Status:** Accepted
- **Date:** 2026-05-24
- **Sprint:** SP-3 (Sprint 2)
- **Deciders:** Bea (clienta) + Javi HP

## Contexto

Cuando el dashboard escribe en un CRM externo (HubSpot/Zoho), hay riesgo de pisar datos que el cliente final ha introducido manualmente en la UI del CRM (rep comercial editó el lead, o un workflow nativo del CRM cambió un campo). Necesitamos una política configurable por integración.

Regla cliente R-014 (memoria proyecto): "append-only por defecto, sobrescritura solo con audit trail explícito".

## Decisión

Cada row de `integrations` tiene `write_policy` con dos modos:

### `append_only` (default)

- Solo se escribe el campo si el CRM lo tiene `null`, `undefined`, o string vacío.
- No requiere audit (no hay overwrite a registrar).
- Operativamente: caller llama `provider.getLead()`, pasa `currentCRMFields` a `applyWritePolicy`, recibe el subset seguro, lo pasa a `provider.updateLead()`.

### `overwrite_with_audit`

- Permite sobrescribir SOLO campos listados en `integrations.override_fields[]` (whitelist).
- Cada cambio real (`old_value !== new_value`) inserta una row en `crm_write_audit` con `tenant_id`, `integration_id`, `provider`, `lead_id`, `field_name`, `old_value`, `new_value`, `write_policy`, `actor_id`, `created_at`.
- El audit es **append-only DB-level**: la tabla tiene RLS sin policies UPDATE/DELETE. Imposible tamper (incluso con bug en código).
- Insert audit es **fire-and-forget**: un fallo de DB no bloquea la escritura al CRM (se loguea error a `console.error`).

## Alternativas rechazadas

| Alternativa                               | Razón rechazo                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Overwrite siempre + audit siempre         | Cliente quiere safety net por defecto (no pisar datos accidentalmente). |
| Append-only sin opción de overwrite       | Rompe casos legítimos (corregir typo en email, p.ej.).                  |
| Audit como tabla normal con UPDATE/DELETE | Permite tampering. R-014 requiere inmutabilidad fuerte.                 |
| Audit síncrono (blocking)                 | Penaliza el camino crítico; un DB lento bloquearía sync CRM.            |

## Consecuencias

**Positivas:**

- Default safe — academia que no toca settings nunca pisa datos.
- Cliente avanzado puede activar overwrite por integración + campo, con audit trail completo.
- Audit DB-level garantiza inmutabilidad (compliance / GDPR right to access).

**Negativas / costes:**

- Caller DEBE llamar `getLead` antes de `applyWritePolicy` (no automático). Documentado en JSDoc.
- Fire-and-forget puede silenciar errores audit en prod → mitigación: Sprint 3 añade Sentry.
- Comparación naive (primitives only) — objetos anidados en `fields` se skippean en `append_only`. Documentado.

## Implementación

- `src/lib/integrations/crm/write-guard.ts` (`applyWritePolicy` standalone function).
- `src/lib/integrations/crm/audit-query.ts` (helper SELECT con RLS).
- Migración `supabase/migrations/20260524100000_integrations_oauth_and_audit.sql` (tabla + RLS).
- UI: `WritePolicyEditor` (select + textarea de override_fields) + `AuditLogViewer` (tabla viewer).

## Referencias

- Memoria R-014: "Append-only por defecto en sincronización CRM".
- Research: `plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md` §2, §3.
