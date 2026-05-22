# ADR-017 — Cifrado AES-256-GCM de tokens OAuth en `integrations`

- **Fecha:** 22-05-2026
- **Estado:** Aceptado
- **Sprint:** 1 (Capa de datos)
- **Tareas:** 2-26
- **Autor:** Javi HP (orquestador AI)

## Contexto

Las integraciones CRM (HubSpot, Zoho, Google Sheets, etc.) persisten credenciales OAuth (`access_token`, `refresh_token`, `expires_at`) en `public.integrations`. Sin cifrado, cualquier acceso a la BD (backup, dump, snapshot) expone tokens reusables que permiten suplantar al cliente contra su propio CRM.

Finding del audit (`docs/audit/findings-summary.md` DA-3-006): "tokens OAuth almacenados en JSONB plano".

## Decisión

Cifrado **AES-256-GCM** ejecutado en Node.js (crypto built-in), NO en Postgres (`pgcrypto`).

### Por qué AES-256-GCM

- Cifrado autenticado (integridad + confidencialidad) — detecta tampering del ciphertext.
- 256 bits de clave: alineado con la política global de criptografía moderna.
- IV de 12 bytes random por cifrado (no reuso).
- AuthTag de 16 bytes (estándar GCM).
- Disponible en Node sin dependencias externas (`crypto.createCipheriv`).

### Por qué NO `pgcrypto`

- Requiere manejar la clave dentro de SQL (riesgo de log/EXPLAIN/audit logs).
- El backend es el único punto que cifra/descifra (NO el navegador), así que mantenerlo en Node simplifica rotación.
- Easypanel self-hosted puede no tener `pgcrypto` habilitado (depende del build).
- Mover la clave a Postgres GUC (Group Configuration) implica reiniciar el servicio para rotar — fricción alta.

## Formato persistido

```
<iv_hex>:<ciphertext_hex>:<auth_tag_hex>
```

Ejemplo:

```
9f9526880f773a40060cbe00:adca474e0ae7440c752a17fec9e6f8850054e17789a3f7adf3291ca68820:471c665bf6ff02e26dcb2f3e643b0641
```

Tres componentes separados por `:`:

- **iv_hex**: 12 bytes (24 hex chars) — IV random único por cifrado.
- **ciphertext_hex**: variable — el texto cifrado.
- **auth_tag_hex**: 16 bytes (32 hex chars) — tag de autenticación GCM.

La clave NO va en el payload (se lee de `process.env.ENCRYPTION_KEY`).

## Implementación

**Módulo:** `src/lib/crypto/token-crypto.ts`

Funciones:

- `encryptToken(plaintext: string): string` — devuelve el formato `iv:ct:tag` hex.
- `decryptToken(payload: string): string` — verifica auth tag, devuelve plaintext.
- `encryptJson<T>(obj: T): string` — wrapper que serializa con JSON.stringify primero.
- `decryptJson<T>(payload: string): T` — wrapper que parsea con JSON.parse.
- `isEncryptedPayload(value: string): boolean` — heurística para detectar valores ya cifrados.

**Clave:** `process.env.ENCRYPTION_KEY` — 32 bytes en hex (64 chars).

Generar:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Si falta o tiene longitud incorrecta, los helpers lanzan Error explícito al primer uso (fail-fast, NO fallback silencioso).

**Tabla:** `public.integrations` con columna `credentials_cipher TEXT` (creada en migración `20260522220003_integrations_table.sql`). La columna `credentials_iv` queda en el schema Zod por compat pero NO se usa (el IV va dentro del payload).

## Rotación de clave

NO incluida en Sprint 1. El formato actual NO versiona la clave. Para rotar en el futuro:

1. Añadir prefijo `v2:` al ciphertext nuevo.
2. Mantener `ENCRYPTION_KEY_V1` + `ENCRYPTION_KEY_V2` durante la migración.
3. Recifrar todos los `credentials_cipher` (job batch).
4. Eliminar `ENCRYPTION_KEY_V1` al terminar.

Tarea pendiente para sprint v0.5.x (post-MVP).

## RLS

La tabla `integrations` tiene RLS owner_or_admin (igual patrón que `knowledge_base`):

- `authenticated` solo lee/escribe filas de su propio `tenant_id`.
- `service_role` mantiene bypass para webhooks/jobs internos.

Sin RLS la fuga sería trivial incluso con tokens cifrados (cualquier user authenticated leería filas de otros tenants y vería el ciphertext, aunque no podría descifrarlo sin la clave).

## Tests

Smoke test manual: `scripts/test-crypto.ts` valida roundtrip + json + isEncryptedPayload.

Unit tests Vitest: añadidos en Bloque 2.7 (tarea 2-28).

## Alternativas consideradas

| Alternativa                  | Por qué descartada                                                   |
| ---------------------------- | -------------------------------------------------------------------- |
| `pgcrypto`                   | Clave dentro de SQL (riesgo audit/log), Easypanel sin garantía       |
| Supabase Vault               | Vault completo NO disponible en self-hosted                          |
| Cifrado en cliente (browser) | El cliente no debería tener la clave; solo el backend orquesta OAuth |
| Sin cifrar (status quo)      | Vulnerabilidad activa del audit DA-3-006                             |

## Riesgos residuales

- Si `ENCRYPTION_KEY` se commitea por error → tokens descifrables por cualquiera. Mitigación: `.env*` en `.gitignore` + hook `af-deps-guard.cjs` + revisión PR.
- Si `ENCRYPTION_KEY` se pierde → tokens irrecuperables. Mitigación: backup de la clave en gestor de secretos del cliente.
- AES-GCM nonce-reuse fatal: NO reusar IVs. El módulo genera IV random por cada `encryptToken`. Riesgo en colisión: ~1 en 2^48 cifrados → improbable durante la vida del producto.

## Referencias

- `src/lib/crypto/token-crypto.ts`
- `supabase/migrations/20260522220003_integrations_table.sql`
- `src/lib/schemas/integrations.ts` (IntegrationSchema)
- `.env.example` (ENCRYPTION_KEY)
- NIST SP 800-38D — GCM mode
- Finding original: `docs/audit/findings-summary.md` DA-3-006
