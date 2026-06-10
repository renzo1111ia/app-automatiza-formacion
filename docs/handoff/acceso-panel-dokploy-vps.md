# Acceso al panel Dokploy (VPS) — fuente de verdad

> **Documento canónico.** Si hay duda sobre cómo acceder al panel Dokploy o a los
> servicios del VPS, esta es la referencia. Cualquier otro doc que diga lo contrario
> está desactualizado → corregir contra este.
>
> Última actualización: 10-06-2026 (tras hardening VPS).

---

## ✅ URL correcta del panel

```
https://panel.automatizaformacion.com/
```

- **Sin puerto.** Acceso vía HTTPS a través de Traefik (reverse proxy con TLS).
- Usuario: `hola@automatizaformacion.com`
- Contraseña: en vault `infra/supabase-vps/.vault/dokploy-panel.env` (gitignored).

---

## ❌ URL ANTIGUA — ya NO funciona desde internet

```
http://panel.automatizaformacion.com:3000     ← BLOQUEADA al exterior
https://panel.automatizaformacion.com:3000     ← BLOQUEADA al exterior
```

**Qué cambió (10-06-2026):** durante el hardening del VPS se detectó que el puerto
`:3000` exponía el panel Dokploy **sin TLS** y que los puertos de Docker Swarm
(`2377/7946/4789`) estaban abiertos a internet (Docker/Swarm hace bypass de UFW).

Se aplicó un bloqueo en `iptables -t raw PREROUTING` desde la interfaz `eth0`,
gestionado por el servicio systemd `af-docker-user-rules.service`. El acceso al panel
quedó **solo vía `panel.automatizaformacion.com` (HTTPS/Traefik)**.

Detalle completo del hardening: `plans/reports/security-hardening-vps-20260610.md`
(finding F2) y memoria `project-hardening-vps-100626`.

---

## 🔧 Acceso al puerto :3000 cuando lo necesites (solo túnel SSH)

El puerto `:3000` sigue vivo **dentro** del VPS (Dokploy escucha ahí internamente).
Para alcanzarlo desde tu máquina, abre un túnel SSH local — **nunca** se expone a
internet directamente:

```bash
# Túnel local: localhost:3000 (tu máquina) → :3000 (VPS)
ssh -L 3000:localhost:3000 -i ~/.ssh/af_vps_recovery root@46.62.193.169

# Luego en el navegador de tu máquina:
#   http://localhost:3000
```

Esto es útil solo en escenarios de emergencia (Traefik caído y el panel HTTPS no
responde). En operación normal, usa siempre la URL HTTPS.

---

## 🔑 Datos de acceso al VPS

| Recurso              | Valor                                                           |
| -------------------- | --------------------------------------------------------------- |
| Host                 | `root@46.62.193.169` (Hetzner)                                  |
| SSH key (funcional)  | `~/.ssh/af_vps_recovery`                                        |
| SSH key (vault, ❌)  | `dashboard-af-vps-key` — **rechazada por el servidor**, no usar |
| Panel Dokploy        | `https://panel.automatizaformacion.com/`                        |
| Pass panel (vault)   | `infra/supabase-vps/.vault/dokploy-panel.env`                   |
| Env vars VPS (vault) | `infra/supabase-vps/.vault/dokploy-env-vps.env` (en el VPS)     |

---

## 🌐 Dominios de los entornos

| Entorno    | Dominio                                                      | Rama        | Proyecto Dokploy          |
| ---------- | ------------------------------------------------------------ | ----------- | ------------------------- |
| Developer  | `https://dev.automatizaformacion.com`                        | `developer` | dev automatiza formacion  |
| Staging    | `https://test.automatizaformacion.com`                       | `staging`   | test automatiza formacion |
| Production | `https://app.automatizaformacion.com`                        | `main`      | prod automatiza formacion |
| Supabase   | `https://dev.automatizaformacion.com/supabase` (path-prefix) | —           | dev automatiza formacion  |

---

## 📌 Regla para futuras sesiones / docs

Cuando un documento, script o memoria mencione el panel Dokploy:

- ✅ Usar `https://panel.automatizaformacion.com/`
- ❌ NUNCA `:3000` como URL de acceso externo
- Si encuentras `:3000` en docs de acceso al panel → corregir y apuntar a este archivo.
