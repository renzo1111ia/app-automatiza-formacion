# supabase/scripts/

Scripts SQL de administración aplicables a la base de datos Postgres. Idempotentes — seguro ejecutarlos varias veces.

> Estos scripts **NO** son migraciones de schema. Para schema usar `supabase/migrations/`. Aquí van scripts de roles, permisos, mantenimiento y operaciones puntuales.

## Scripts disponibles

| Script                                       | Tarea           | Cuándo aplicar                                                                                                                |
| -------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [`create-app-user.sql`](create-app-user.sql) | Sprint 0 · 1-06 | Crear rol `app_user` con permisos DML limitados. Aplicar en local al setup + en producción pre-deploy (sesión con acceso VPS) |

## Aplicación contra Supabase local

```powershell
# Obtener la DB URL del Supabase local
$dbUrl = (npx supabase status -o env | Select-String "^DB_URL=").ToString() -replace '^DB_URL="', '' -replace '"$', ''

# Generar password fuerte (32 chars aleatorios)
$appPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

# Aplicar el script
psql $dbUrl -v app_password="'$appPassword'" -f supabase/scripts/create-app-user.sql

# Guarda el password generado en .env.local como APP_USER_PASSWORD
Add-Content .env.local "`nAPP_USER_PASSWORD=$appPassword"
```

## Aplicación contra Supabase producción (Easypanel)

**DIFERIDO Sprint 0** — requiere acceso al VPS del cliente. Cuando se obtenga:

```bash
# Desde el VPS Easypanel, conectado a la BD producción como supabase_admin
APP_PASSWORD="$(openssl rand -base64 32 | tr -d '/+= ' | cut -c1-32)"
psql "$DATABASE_URL_ADMIN" \
  -v app_password="'$APP_PASSWORD'" \
  -f supabase/scripts/create-app-user.sql

# Guardar APP_USER_PASSWORD como env var en Easypanel
# Actualizar DATABASE_URL para apuntar a app_user en lugar de postgres
```

## Verificación

Tras aplicar `create-app-user.sql`, las queries `A`, `B`, `C` al final del script confirman:

- **A**: el rol existe con los flags correctos (no superuser, no createdb, no createrole, no replication, no bypassrls, sí login).
- **B**: tiene SELECT/INSERT/UPDATE/DELETE en tablas de `public`.
- **C**: NO tiene permisos DDL (TRUNCATE, REFERENCES, TRIGGER).

## Política de uso

- `app_user` se usa para conexiones de aplicación (futuras), scripts admin que no requieran bypass RLS, y migraciones que toquen sólo DML.
- `service_role` (JWT, no DB role) se usa para bypass RLS en el código del backend cuando es estrictamente necesario.
- `postgres` (superuser) queda reservado para operaciones DDL (migraciones de schema, crear/borrar tablas, ALTER, etc.) y rotaciones de roles.
