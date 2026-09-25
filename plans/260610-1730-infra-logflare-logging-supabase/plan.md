---
title: "Infra — Logging real de Supabase (Logflare + Vector) en VPS Dokploy"
plan_id: 260610-1730-infra-logflare-logging-supabase
status: PLANNED
version_target: infra (sin bump SemVer de app)
owner: Renzo (sugerido — Sprint 7 Refinamiento) / Javi HP
estimate_realistic: 1h 30min-2h 30min
created: 2026-06-10
blockedBy: []
blocks: []
relates_to:
  - 260522-1830-sprint-refinamiento-herramientas-post-mvp # candidato a absorber esta tarea
---

# Infra — Logging real de Supabase (Logflare + Vector)

> Montar el pipeline de logs centralizados del stack Supabase self-hosted en el VPS Dokploy:
> **Vector** (recolecta logs de los contenedores) → **Logflare** (ingesta/indexa) → **Studio Log Explorer** (consulta).
> Hoy `supabase-vector` es un placeholder (`blackhole`, tira los logs) y `supabase-analytics` (Logflare 1.39.1)
> está definido pero **desactivado** (`profiles: ["analytics"]`, `LOGFLARE_API_KEY: changeme`).

## Por qué este plan existe (contexto 10-06-2026)

- El VPS se cayó (Supabase down → REST/auth/pg-meta 500). Causa raíz: `supabase-vector` unhealthy arrastraba
  el stack vía `depends_on` de `supabase-db`. **Fix inmediato YA aplicado** (10-06): `start_period: 30s` +
  retries en el healthcheck de Vector para que deje de tumbar el deploy (`infra/supabase-vps/docker-compose.yml`).
- El usuario (Javi HP) quiere **logging real de Supabase** (Logflare), no solo el placeholder. Esto es trabajo de
  infra que el Sprint 3 dejó aplazado. Se planifica aquí para ejecutarlo con calma y rollback, NO a pelo sobre
  un VPS recién recuperado.

## Decisiones de diseño

1. **No tocar el VPS hasta tener ventana de mantenimiento** acordada — es producción del cliente.
2. **Generar 3 secretos** de 32+ chars (`crypto.randomBytes`): `LOGFLARE_PUBLIC_ACCESS_TOKEN`,
   `LOGFLARE_PRIVATE_ACCESS_TOKEN`, `LOGFLARE_API_KEY`. Viven en el vault VPS (`infra/supabase-vps/.vault/`),
   NUNCA en git ni en el compose en claro (usar `${VAR}` + env de Dokploy).
3. **Base de datos de Logflare**: usa `_supabase` / esquema `_analytics`. La imagen `supabase/postgres:17.6`
   moderna ya crea `_supabase`; verificar y crear `_analytics` si falta (migración idempotente).
4. **Reescribir `vector.yml`**: de `blackhole` placeholder a config real (source = logs de contenedores Docker
   vía `docker_logs`; transform = parseo; sink = `http` a Logflare con el token). Basarse en el `vector.yml`
   oficial de Supabase self-hosting, adaptado a los nombres de contenedor de este compose.
5. **Quitar `profiles: ["analytics"]`** de `supabase-analytics` para que arranque por defecto, y completar su env
   con los tokens reales. Vector pasa a depender de Logflare healthy.
6. **Rollback claro**: si el redeploy degrada el stack, revertir el compose al commit previo y redeploy. La BD
   no se toca de forma destructiva (solo se añade esquema `_analytics`).

## Fases

| Fase | Nombre                                                               | Estim.            | Status | Archivo                                                                |
| ---- | -------------------------------------------------------------------- | ----------------- | ------ | ---------------------------------------------------------------------- |
| 01   | Logflare + Vector real: config, secretos, BD, redeploy, verificación | 1h 30min-2h 30min | 🔘     | [phase-01-logflare-vector-setup.md](phase-01-logflare-vector-setup.md) |

## Riesgos transversales

- **RAM**: la doc oficial avisa que Logflare+Vector suben el consumo "significativamente por encima de 4GB base".
  Verificar `free -h` / métricas del VPS Hetzner ANTES de activar. Si va justo, no activar o ampliar VPS.
- **Downtime**: redeploy del stack Supabase = breve corte de BD para la app. Hacer en ventana acordada.
- **Producción del cliente**: cualquier cambio sobre `infra/supabase-vps/` requiere orden explícita + ventana.
- **Acceso VPS**: SSH histórico inestable (memorias). Operar vía panel Dokploy + pg-meta REST como hasta ahora.

## Definición de "hecho"

- [ ] `supabase-vector` healthy con config real (lee logs de contenedores).
- [ ] `supabase-analytics` (Logflare) healthy, arranca por defecto, con tokens reales (no `changeme`).
- [ ] Esquema `_analytics` existe en BD.
- [ ] Studio Log Explorer muestra logs reales de los servicios Supabase.
- [ ] Secretos en vault, NO en git. Compose usa `${VAR}`.
- [ ] Rollback probado/documentado.
- [ ] Consumo RAM del VPS dentro de margen tras activar.
