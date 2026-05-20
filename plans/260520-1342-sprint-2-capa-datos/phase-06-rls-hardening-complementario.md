# Phase 06 — RLS Hardening Complementario

## Context Links

- RoadMap: `plans/RoadMap.md` §Bloque 2.6 (tareas 2-23..2-27)
- Plan RLS phase-03: `plans/20260519-1200-rls-multitenant-hardening/phase-03-politicas-rls-tablas-datos.md` — steps SQL para políticas RLS. REFERENCIAR.
- Audit findings: `docs/audit/findings-summary.md` (F-04-005, F-04-006, F-04-008, DA-3-006)
- Decisiones cerradas: `docs/audit/DECISIONES-AUDITOR-JAVIER-HP.md`

> **Solape con plan RLS:** `phase-03` del plan RLS cubre los fixes de políticas RLS (`ai_agents`, `web_widgets`, `programs`). Los steps SQL están allí. Esta fase los REFERENCIA y añade 2-26 (cifrado OAuth) que no estaba en el plan RLS original.

> **2-27 MOVIDA:** `next@16.1.6 → 16.2.6` fue movida a Sprint 1 como tarea 1-26 dado el CVSS 8.6 (SSRF via WebSocket) y 8.1 (middleware bypass) near-critical para sistema multi-tenant. Ver `plans/260520-1342-sprint-1-hotfixes-seguridad/`. Las 6h de su estimación se restan del total Sprint 2.

## Overview

- **Prioridad:** P1 (2-23..2-25), P2 (2-26)
- **Estado:** Pendiente — paralelizable con todo. No depende de Fases 01-05.
- **Descripción:** Corregir las 3 políticas RLS tautológicas/incompletas detectadas en audit (ai_agents, web_widgets, programs). Implementar cifrado de Google OAuth tokens (aplazado desde Sprint 1).

## Key Insights

- 2-23, 2-24, 2-25 son fixes de SQL puras — no tocan código TypeScript
- 2-26 (cifrado OAuth) es la tarea más compleja: requiere función PG para cifrar + migración de tokens existentes + update en código que lee/escribe tokens
- 2-27 está en Sprint 1 — NO incluir aquí. Marcar como referencia únicamente.
- Los fixes de RLS son reversibles (DROP POLICY + CREATE POLICY) — bajo riesgo de rollback

## Requirements

**Funcionales:**
- 2-23: RLS `ai_agents` y `ai_agent_variants` filtra correctamente por `tenant_id`
- 2-24: RLS `web_widgets` no devuelve registros de otros tenants
- 2-25: Función `getPrograms` (o la política RLS de `programs`) filtra por tenant
- 2-26: Tokens Google OAuth en JSONB cifrados con pgcrypto o vault de Supabase

**No-funcionales:**
- Cada fix de RLS verificado con test de fuga (query con JWT de tenant B no devuelve datos de tenant A)

## Architecture

```
Fixes RLS (2-23, 2-24, 2-25) — solo SQL:
  supabase/migrations/20260520_fix_rls_b23_ai_agents.sql
  supabase/migrations/20260520_fix_rls_b24_web_widgets.sql
  supabase/migrations/20260520_fix_rls_b25_programs.sql

Cifrado OAuth (2-26):
  supabase/migrations/20260520_encrypt_oauth_tokens.sql  ← función PG + migración datos
  src/lib/repositories/integrations-repository.ts        ← update lógica read/write tokens
  src/lib/services/google-oauth-service.ts               ← si existe, update
```

## Related Code Files

**Crear:**
- `supabase/migrations/20260520_fix_rls_b23_ai_agents.sql`
- `supabase/migrations/20260520_fix_rls_b24_web_widgets.sql`
- `supabase/migrations/20260520_fix_rls_b25_programs.sql`
- `supabase/migrations/20260520_encrypt_oauth_tokens.sql`

**Modificar:**
- Código que lee/escribe Google OAuth tokens (localizar con `grep -r "google.*token\|oauth.*token" src/`)

**Leer para contexto:**
- `plans/20260519-1200-rls-multitenant-hardening/phase-03-politicas-rls-tablas-datos.md`

## Implementation Steps

1. **2-23 — Fix RLS ai_agents tautológica (3h)**
   - Ver SQL exacto en `plans/20260519-1200-rls-multitenant-hardening/phase-03-politicas-rls-tablas-datos.md`
   - Finding F-04-005 / DA-2: la política actual no filtra por `tenant_id`
   - Fix: `USING (tenant_id = auth.jwt() -> 'tenant_id')`
   - Mismo fix para `ai_agent_variants` (hereda la vulnerabilidad)
   - Test: query con JWT de tenant B → 0 registros de tenant A

2. **2-24 — Fix RLS web_widgets (2h)**
   - Finding F-04-006: devuelve todos los tenants
   - Fix: añadir `tenant_id` a la política o verificar que la tabla lo tiene
   - Si `web_widgets` no tiene `tenant_id`: añadir columna + migración de datos + política

3. **2-25 — Fix getPrograms / RLS programs (2h)**
   - Finding F-04-008: expone programas de todos los clientes
   - Verificar si el problema es en la política RLS o en el query de `getPrograms` en código
   - Si es RLS: fix SQL en migración
   - Si es query: mover a `programsRepository.findByTenant()` (coordinación con Fase 03)

4. **2-26 — Cifrar Google OAuth tokens (12h)**
   - Finding DA-3-006: tokens OAuth almacenados en JSONB plano
   - Opciones de cifrado: (a) `pgcrypto` con clave simétrica o (b) Vault de Supabase
   - Recomendar (b) Supabase Vault si está disponible en self-hosted Easypanel; si no, (a) pgcrypto
   - Pasos: 1) Habilitar extensión de cifrado, 2) Función PG `encrypt_token(text)`, 3) Migración datos existentes, 4) Update código que lee/escribe tokens
   - Rollback: función `decrypt_token(text)` + migración inversa si falla

5. **2-27 — MOVIDA A SPRINT 1 (1-26)**
   - ✅ next@16.1.6 → 16.2.6 movida a Sprint 1 como 1-26 por CVSS 8.6/8.1 near-critical
   - Ver `plans/260520-1342-sprint-1-hotfixes-seguridad/phase-06-otros-criticos.md`
   - Estimación de 6h excluida del total Sprint 2

## Todo List

- [ ] 2-23: Migración SQL fix RLS ai_agents + ai_agent_variants
- [ ] 2-23: Test anti-fuga: query tenant B → 0 datos tenant A
- [ ] 2-24: Migración SQL fix RLS web_widgets
- [ ] 2-24: Test anti-fuga
- [ ] 2-25: Diagnóstico: ¿problema en RLS o en query getPrograms?
- [ ] 2-25: Fix correspondiente (migración SQL o move to repository)
- [ ] 2-26: Decisión cifrado: Supabase Vault vs pgcrypto
- [ ] 2-26: Migración SQL: extensión + función encrypt/decrypt + cifrado datos existentes
- [ ] 2-26: Update código TypeScript que lee/escribe tokens OAuth
- [ ] 2-26: Test: token en BD está cifrado; aplicación descifra correctamente

## Success Criteria

- `SELECT * FROM ai_agents` con JWT de tenant B retorna 0 filas de tenant A
- `SELECT * FROM web_widgets` con JWT de tenant B retorna 0 filas de tenant A
- `getPrograms()` con contexto de tenant B retorna solo programas de tenant B
- Tokens Google OAuth en JSONB no son legibles en plano (`SELECT google_oauth_token FROM integrations`)
- Aplicación puede leer/escribir tokens OAuth correctamente tras el cifrado

## Risk Assessment

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Fix RLS rompe funcionalidad legítima de ai_agents | Baja | Alto | Test funcional de AI agent antes y después del fix |
| 2-26 migración tokens falla en datos existentes | Media | Crítico | Backup tabla integrations antes; migración transaccional con rollback |
| pgcrypto no disponible en Easypanel self-hosted | Baja | Medio | Verificar extensiones disponibles con `SELECT * FROM pg_available_extensions` primero |

## Security Considerations

- Los fixes de RLS son medidas de seguridad críticas — deben verificarse con tests de fuga reales
- La clave de cifrado de tokens OAuth NUNCA en código fuente: debe estar en Easypanel env vars o Supabase Vault
- 2-26: implementar rotación de clave de cifrado como parte del diseño (aunque no se use en Sprint 2)

## Agente Esden

- **Responsable:** `esden-agents:database` (2-23..2-25) + `esden-agents:security` (2-26)
- **Revisión:** `esden-agents:security` (test anti-fuga todos los fixes)

## Rollback Plan

- 2-23..2-25: `DROP POLICY <policy_name> ON <table>; CREATE POLICY <old_policy>;` — invertible en < 5 min
- 2-26: migración inversa `decrypt → store plaintext` disponible como script antes de ejecutar forward migration

## Next Steps

- Esta fase puede ejecutarse en paralelo con todas las demás — no hay dependencias de código
- Fase 7 (testing) incluye tests anti-fuga que verifican los fixes de esta fase
- Plan RLS `phase-07-tests-anti-fuga.md` complementa los tests de esta fase
