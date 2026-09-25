# Fase 04 — Integraciones CRM OAuth

- **Env**: vps
- **Estado**: 🟢 PASS (verificación endpoints + backend; flujo OAuth interactivo diferido)
- **Método**: probes curl de existencia/protección de rutas OAuth + cobertura backend Vitest (Fase 03).

## Probes endpoints OAuth

| HTTP | Endpoint                                  | Veredicto                     |
| ---- | ----------------------------------------- | ----------------------------- |
| 401  | `/api/integrations/hubspot/auth/start`    | 🟢 existe + auth-gated        |
| 401  | `/api/integrations/zoho/auth/start`       | 🟢 existe + auth-gated        |
| 302  | `/api/integrations/hubspot/auth/callback` | 🟢 existe, maneja redirect    |
| 302  | `/api/integrations/zoho/auth/callback`    | 🟢 existe, maneja redirect    |
| 400  | `/api/integrations/google/auth`           | 🟢 existe, rechaza sin params |

## Backend adapters (cubierto en Vitest Fase 03)

- HubSpot: mappers (lead→properties, truncado af_metadata_extra a 60k), 28 tests.
- Zoho: multi-DC (eu/com), 18 tests.
- Token manager: AES-256-GCM cifrado/descifrado (token-crypto 8 tests).

## Diferido (no ejecutable en este run)

Flujo OAuth E2E completo (start → ventana consent → callback con code real → token cifrado en `integrations` → healthcheck → write-policy toggle → disconnect) requiere:

- Sesión interactiva con browser (MCP ocupado por chat paralelo).
- Credenciales reales de cuenta HubSpot/Zoho del cliente.
- Mutación de datos en VPS producción (evitado por regla append-only + no destructivo).

→ Diferido a SP-4B / sesión interactiva con cuenta sandbox CRM. Idéntico criterio a runs previos.

## Resultado

🟢 **PASS** — 5/5 rutas OAuth existen y están protegidas. Backend adapters verde. Flujo interactivo OAuth documentado como diferido (no es fallo). 0 bugs.
