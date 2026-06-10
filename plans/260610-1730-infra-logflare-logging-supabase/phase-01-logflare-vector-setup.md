# Fase 01 — Logflare + Vector real: config, secretos, BD, redeploy, verificación

## Context Links

- Plan: [plan.md](plan.md)
- Compose: `infra/supabase-vps/docker-compose.yml` (servicios `supabase-vector` líneas ~78, `supabase-analytics` ~342)
- Vector config: `infra/supabase-vps/vector.yml` (hoy placeholder `blackhole`)
- Vault VPS: `infra/supabase-vps/.vault/` (gitignored)
- Ref oficial: https://supabase.com/docs/guides/self-hosting/docker (sección logging: `run.sh config add logs`)

## Overview

- **Prioridad**: Media (mejora de observabilidad, no bloquea features).
- **Status**: 🔘 Pendiente.
- **Descripción**: Activar el pipeline real de logs Vector → Logflare → Studio en el VPS.

## Key Insights

- El servicio `supabase-analytics` (Logflare 1.39.1) YA está en el compose, solo desactivado por perfil y con
  config incompleta (`LOGFLARE_API_KEY: changeme`, faltan los 2 access tokens).
- `vector.yml` actual es un placeholder que descarta logs (`blackhole`). Hay que reescribirlo para leer los logs
  de los contenedores y mandarlos a Logflare.
- Postgres es `supabase/postgres:17.6` — versiones modernas crean `_supabase`; verificar/crear `_analytics`.
- El fix del healthcheck de Vector (start_period) ya está aplicado (10-06) — esta fase lo sustituye por config real.

## Requirements

**Funcionales**

- Vector recolecta logs de los contenedores Supabase y los envía a Logflare.
- Logflare arranca por defecto (sin `--profile`), healthy, con tokens reales.
- Studio > Logs muestra logs consultables de auth/rest/db/kong/storage.

**No funcionales**

- Secretos (3 tokens) generados con `crypto.randomBytes(32+)`, en vault, NUNCA en git.
- Cambios idempotentes; rollback al commit previo del compose si falla.
- Consumo RAM verificado dentro de margen del VPS.

## Architecture

```
contenedores Supabase ──(docker_logs source)──▶ Vector ──(http sink + token)──▶ Logflare ──▶ Studio Log Explorer
                                                                                    │
                                                                          BD _supabase / esquema _analytics
```

## Related Code Files

**Modificar**

- `infra/supabase-vps/vector.yml` — reescribir: source `docker_logs` (o `file`/`journald` según runtime),
  transforms de parseo por servicio, sink `http` a `http://supabase-analytics:4000/api/logs` con
  `x-api-key: ${LOGFLARE_PUBLIC_ACCESS_TOKEN}`. Basarse en el `vector.yaml` oficial de Supabase self-host.
- `infra/supabase-vps/docker-compose.yml`:
  - `supabase-analytics`: quitar `profiles: ["analytics"]`; añadir `LOGFLARE_PUBLIC_ACCESS_TOKEN`,
    `LOGFLARE_PRIVATE_ACCESS_TOKEN`, `LOGFLARE_API_KEY` reales (vía `${VAR}`); `depends_on: supabase-db healthy`.
  - `supabase-vector`: montar el nuevo `vector.yml`; `depends_on: supabase-analytics` (started); healthcheck real.
  - `supabase-studio`: ya tiene `depends_on supabase-analytics required:false` — confirmar que apunta a Logflare.

**Crear**

- `supabase/migrations/` o script one-off: `CREATE SCHEMA IF NOT EXISTS _analytics;` en BD `_supabase`
  (solo si la imagen no lo trae). Verificar primero con pg-meta.
- Entradas en vault: los 3 tokens + en env de Dokploy del stack supabase.

## Implementation Steps

1. **Pre-check RAM**: `free -h` en VPS (vía panel Dokploy o SSH). Si margen < ~1.5GB libre, NO activar; avisar.
2. **Generar secretos**: 3× `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
   Guardar en `infra/supabase-vps/.vault/logflare.env` (gitignored) + pegarlos en env del stack en Dokploy.
3. **BD**: vía pg-meta, `SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('_supabase','_analytics');`
   Crear `_analytics` (y `_supabase` si falta) idempotente.
4. **vector.yml real**: adaptar el oficial de Supabase a los `container_name` de este compose
   (supabase-db, supabase-auth, supabase-rest, supabase-kong, supabase-storage, supabase-realtime, supabase-meta).
5. **Compose**: quitar perfil de analytics, cablear tokens, ajustar depends_on y healthchecks.
6. **Redeploy** del stack `supabase` en Dokploy (ventana acordada). Observar el log del deploy.
7. **Verificar**: Logflare `/health` 200; Vector healthy; Studio > Logs muestra eventos reales; app sigue 200
   (`/api/health`, REST, pg-meta).
8. **Rollback si falla**: revertir compose al commit previo + redeploy. Documentar en report.

## Todo List

- [ ] Pre-check RAM VPS.
- [ ] 3 secretos generados + en vault + en Dokploy env.
- [ ] Esquema `_analytics` verificado/creado.
- [ ] `vector.yml` real escrito.
- [ ] Compose: analytics sin perfil + tokens + depends_on.
- [ ] Redeploy en ventana.
- [ ] Verificación end-to-end (Logflare health + Studio Logs + app OK).
- [ ] Rollback documentado.

## Success Criteria

- Studio Log Explorer muestra logs reales de los servicios Supabase, consultables.
- Stack estable tras redeploy (app + BD + REST + pg-meta 200). RAM dentro de margen.

## Risk Assessment

- **RAM insuficiente** → OOM kills. Mitigación: pre-check; si justo, ampliar VPS antes o no activar.
- **Redeploy degrada stack** (como el incidente 10-06). Mitigación: ventana + rollback al commit previo listo.
- **Tokens mal cableados** → Logflare rechaza ingesta de Vector (401). Mitigación: verificar `/health` + un log de prueba.

## Security Considerations

- 3 tokens en vault gitignored + env Dokploy. NUNCA en git/compose en claro/logs.
- Logflare en `LOGFLARE_SINGLE_TENANT=true` + `SUPABASE_MODE=true` — no exponer su puerto 4000 a internet
  (solo red interna `supabase-net`; Studio lo consume internamente).

## Next Steps

- Asignar a Renzo dentro del Sprint 7 Refinamiento, o ejecutar Javi HP en ventana de mantenimiento.
- Tras éxito: actualizar `infra/supabase-vps/README` (si existe) con cómo consultar logs.
