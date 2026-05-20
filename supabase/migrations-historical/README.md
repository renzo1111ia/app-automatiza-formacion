# Migraciones historicas (NO se aplican)

Estas son las 32 migraciones originales del proyecto, escritas para aplicacion manual en Supabase Studio del cliente Esden. No funcionan en aplicacion lineal con Supabase CLI por:

1. **Timestamps duplicados** (varios `20260404_*`, `20260413_*`) → ya renombrados al formato 14-digit `YYYYMMDDHHmmss_*`.
2. **Orden de FK roto**: algunas migraciones referencian tablas creadas en migraciones posteriores (ej. `chat_messages` antes que `create_multitenant_schema`).
3. **Tablas asumidas pre-existentes**: `voice_agents`, `voice_agent_variants` se modifican pero ningun archivo las crea — venian de un schema base no versionado.
4. **CREATE POLICY no idempotentes**: politicas RLS chocan al reaplicar.
5. **Logica duplicada**: `multitenant_v2.sql` repite policies/indices ya creados por `create_multitenant_schema.sql`.

## Que hacer

Estas migraciones se mantienen como **referencia historica** del esquema progresivo. **NO ejecutarlas con `supabase db reset`**.

El esquema actual del proyecto vive en una **migracion consolidada** en `supabase/migrations/` que se genera desde un `pg_dump --schema-only` contra la BD de produccion del cliente.

## Como regenerar el esquema consolidado

1. Acceder a Easypanel del cliente y obtener la URL de Postgres
2. Ejecutar:
   ```bash
   pg_dump "<DATABASE_URL_CLIENTE>" \
       --schema-only \
       --no-owner \
       --no-acl \
       --schema=public \
       > supabase/migrations/00000000000001_schema_consolidated.sql
   ```
3. Revisar el archivo generado y eliminar referencias a roles inexistentes en local (ej. `service_role` que ya existe en Supabase local).
4. `npm run db:reset` + `npm run db:seed-demo`.
