# Fase 05 — Migración de tenants vivos sin downtime (estrategia dual-mode)

## Context Links

- Plan: [plan.md](plan.md)
- Resolver de credenciales: [phase-02](phase-02-refactor-credenciales-token-central.md)

## Overview

- **Prioridad:** P1
- **Estado:** Pendiente
- **Descripción:** Migrar los tenants que hoy usan WhatsApp en modo manual al modelo tech_provider, uno a uno, sin interrumpir el servicio. La clave es que el sistema ya soporta ambos modos a la vez (`connection_mode`), así que la migración es por tenant y reversible.

## Key Insights

- **No es un big-bang.** Gracias al `connection_mode` de la fase 2, manual y tech_provider coexisten. Un tenant migra cuando vuelve a conectar vía Embedded Signup.
- Cada tenant migrado deja de depender de su token (que caducaba) y pasa al token central → mejora neta.
- La migración es **reversible**: si algo falla, se puede volver a `manual` mientras el tenant tenga su token.

## Requirements

**Funcionales**

- Procedimiento de migración por tenant: reconectar vía Embedded Signup → `connection_mode` pasa a `tech_provider`.
- Verificación post-migración: envío de prueba + recepción de prueba.
- Plan de rollback por tenant.

**No funcionales**

- Cero downtime de mensajería durante la migración.
- Orden: primero tenant interno/de pruebas, luego academias reales escalonadas.

## Architecture

```
Estado inicial: todos los tenants connection_mode = manual (default fase 2)
        │
        ▼  por cada tenant, cuando se decida migrar:
1. Tenant pulsa "Conectar WhatsApp" (Embedded Signup) → connection_mode = tech_provider
2. WABA suscrita al webhook de la app (fase 4)
3. Verificación: enviar plantilla de prueba + recibir mensaje de prueba
4. (opcional) revocar el token manual antiguo del tenant
        │
        ▼  si falla:
Rollback: connection_mode = manual (el token antiguo sigue válido hasta revocarlo)
```

## Related Code Files

- **Reusar:** resolver `whatsapp-credentials.ts` (fase 2) — ya decide por modo
- **Reusar:** Embedded Signup + suscripción (fases 3-4)
- **Crear:** `docs/integrations/whatsapp-tenant-migration-runbook.md` (runbook de migración + rollback)
- **Posible script:** `src/scripts/check_whatsapp_connection_mode.ts` (auditar qué tenants están en cada modo)

## Implementation Steps

1. Redactar el runbook de migración por tenant (pasos + verificación + rollback).
2. Migrar primero un tenant de prueba interno; validar envío + recepción E2E.
3. Documentar resultado y ajustar el runbook si surgen fricciones.
4. Migrar academias reales escalonadamente (respetar límite 10/7d hasta Business Verification).
5. Script de auditoría: listar `connection_mode` por tenant para seguimiento.
6. Tras confirmar estabilidad, revocar tokens manuales antiguos (limpieza).

## Todo List

- [ ] Runbook de migración + rollback redactado
- [ ] Tenant de prueba migrado y verificado E2E
- [ ] Script de auditoría de modos
- [ ] Academias reales migradas escalonadas
- [ ] Tokens manuales antiguos revocados (post-estabilidad)

## Success Criteria

- Tenant migrado envía/recibe con token central.
- Ningún corte de mensajería durante la migración.
- Rollback probado al menos una vez.

## Risk Assessment

| Riesgo                                            | Mitigación                                                    |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Mensajes perdidos en la ventana de cambio         | Migrar fuera de horario punta; verificación inmediata         |
| Límite 10/7d antes de Business Verification       | Escalonar; priorizar Business Verification de la clienta      |
| Rollback no funciona porque ya se revocó el token | No revocar el token manual hasta confirmar estabilidad (días) |

## Security Considerations

- Auditar en el log/`crm_write_audit` cada cambio de `connection_mode`.
- No revocar credenciales antiguas hasta tener confirmación de estabilidad.

## Next Steps

- Desbloquea fase 7 (tests E2E del flujo completo, ya con tenants reales en tech_provider).
