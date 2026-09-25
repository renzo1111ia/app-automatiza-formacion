---
type: status-report
date: 2026-05-21
status: parcial — esperando pg_dump del cliente
owner: Renzo
---

# Estado setup local — listo para conectar pg_dump

## Lo que esta funcionando AHORA

```
✅ Supabase CLI local (npx supabase start)
   - Project URL: http://127.0.0.1:54321
   - Studio:      http://127.0.0.1:54323
   - DB:          postgresql://postgres:postgres@127.0.0.1:54322/postgres

✅ .env.local creado con todos los keys (NEXT_PUBLIC_SUPABASE_*, SERVICE_ROLE, NEXTAUTH_SECRET, REDIS_URL)
✅ Tabla public.tenants aplicada (via migration 20260101000000_initial_tenants.sql)
✅ Usuario demo creado en auth: demo@af.local / DemoPassword123!
✅ Tenant demo 'Academia AF Demo' insertado (id: 96a63e00-f952-42db-a4cf-b78b055b82e4)
✅ Next.js dev server arranca y responde:
     - GET /          -> 307 (redirect a /login, normal sin sesion)
     - GET /login     -> 200 (pantalla de login carga)
✅ npm scripts listos: db:up/down/status/reset, db:seed-demo, redis:up/down, local:setup/teardown
```

## Lo que falta — manana cuando tengas acceso a Easypanel

### 1. Hacer pg_dump del cliente

```bash
# Conectarte al Postgres del cliente desde Easypanel y exportar SOLO el esquema:
pg_dump "<DATABASE_URL_DEL_CLIENTE>" \
    --schema-only \
    --no-owner \
    --no-acl \
    --schema=public \
    > supabase/migrations/00000000000001_schema_consolidated.sql
```

**Importante**:
- `--schema-only` -> sin datos del cliente (PII)
- `--no-owner --no-acl` -> sin referencias a roles que no existen en local
- `--schema=public` -> solo schema public (no auth, storage, etc, esas las gestiona Supabase CLI)

### 2. Revisar el archivo y limpiar referencias problematicas

Antes de aplicarlo, abre `supabase/migrations/00000000000001_schema_consolidated.sql` y:
- Elimina o comenta `GRANT/REVOKE` que referencien roles del cliente
- Elimina cualquier `ALTER SCHEMA public OWNER TO ...`
- Si hay `CREATE EXTENSION` para extensiones no estandar, verifica que Supabase local las soporta

### 3. Aplicar y arrancar

```powershell
# Reset BD: aplica initial_tenants + consolidated en una pasada limpia
npm run db:reset

# Crear datos demo
npm run db:seed-demo

# Arrancar dev (en otra terminal Redis ya esta levantado)
npm run redis:up    # si no esta arriba
npm run dev
```

### 4. Smoke test

- Abre http://localhost:3000 (o :3001 si el 3000 esta ocupado por otro proceso)
- Login con `demo@af.local` / `DemoPassword123!`
- Deberias ver el dashboard con 15 leads, 3 programas, 8 llamadas, 2 campanas

## Lo que NO funcionara hasta que rellenes API keys

Estas features fallan al usarse pero la app navega sin romperse:
- **LLMs** (Anthropic/OpenAI/Bedrock): chat con leads, qualification, agent variants
- **Voice** (Retell/Ultravox): llamadas IA
- **CRMs** (HubSpot/Zoho): sync con CRMs externos (Fase 2)

Rellena en `.env.local` cuando vayas a probar esas features.

## Si algo falla manana

### El pg_dump trae errores al aplicar
Probablemente referencias a roles inexistentes o extensiones. Revisa el output de `npm run db:reset`. Comenta las lineas problematicas en el archivo consolidado.

### El seed-demo.ts falla en algunas tablas
El script asume nombres de tablas y columnas. Si el pg_dump renombra algo (ej. `agendamientos` -> `appointments`), edita el seed para usar el nombre correcto.

### La app rompe en login o en dashboard
Revisar consola del navegador y `npm run dev` terminal. Likely missing tables que requiere la app. Iterar.

## Estado en remoto

Rama `developer` actualizada con:
- `dc0b8c2` chore(db): move broken migrations to migrations-historical/  (yo)
- `42ba022` feat(dev): supabase local CLI setup (otra sesion paralela)
- `222167c` chore(audit): move bundle output
- `5c167bb` refactor: rebrand esden->af + unify sprint nomenclature

## Procesos corriendo en tu maquina

```
Supabase CLI local stack (containers: postgres, gotrue, kong, postgrest, studio, mailpit, etc)
Redis dev (af-redis-dev container)
Next.js dev server en puerto 3001 (porque 3000 esta ocupado por proceso 7200)
```

Si quieres apagarlos:
```powershell
npm run local:teardown        # apaga supabase + redis
# Y Ctrl+C en la terminal de npm run dev
```
