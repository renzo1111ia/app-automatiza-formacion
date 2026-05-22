// Sprint 1 — Bloque 2.6 (tarea 2-26) Cifrado AES-256-GCM de tokens OAuth.
//
// Estrategia:
//   - Algoritmo: AES-256-GCM (autenticado, integridad + confidencialidad).
//   - Clave: 32 bytes (256 bits) leida de ENCRYPTION_KEY (env), formato hex.
//   - IV: 12 bytes random por cifrado, persistido junto al ciphertext.
//   - AuthTag: 16 bytes, persistido junto al ciphertext.
//   - Formato persistido en BD: `<iv_hex>:<ciphertext_hex>:<auth_tag_hex>`.
//
// Por que NO pgcrypto:
//   - Necesitariamos manejar la clave dentro de SQL (riesgo de log/EXPLAIN).
//   - El backend ya es el unico punto que cifra/descifra (NO lo hace el navegador).
//   - Mantenerlo en Node simplifica rotacion (cambiar env var + reproceso).
//
// Generar la clave (dev):
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Rotacion futura: el formato persiste el IV junto, pero no la version de clave.
// Si en el futuro rotamos clave, anadir prefijo "v2:" al ciphertext. (TODO).

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_HEX_LENGTH = 64; // 32 bytes en hex

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY no definida. Genera con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (raw.length !== KEY_HEX_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY debe ser hex de 32 bytes (${KEY_HEX_LENGTH} chars). Recibido: ${raw.length} chars.`
    );
  }
  return Buffer.from(raw, "hex");
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error("encryptToken: plaintext vacio");
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}`;
}

export function decryptToken(payload: string): string {
  if (!payload) throw new Error("decryptToken: payload vacio");
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("decryptToken: formato invalido, esperaba 'iv:ciphertext:authTag'");
  }
  const [ivHex, ctHex, tagHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  if (iv.length !== IV_LENGTH) throw new Error(`decryptToken: IV invalido (${iv.length} bytes)`);
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`decryptToken: authTag invalido (${authTag.length} bytes)`);
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}

// Helper para cifrar un objeto JSON entero (e.g. credentials con refresh_token + access_token).
export function encryptJson<T extends Record<string, unknown>>(obj: T): string {
  return encryptToken(JSON.stringify(obj));
}

export function decryptJson<T = Record<string, unknown>>(payload: string): T {
  return JSON.parse(decryptToken(payload)) as T;
}

// Verifica si una cadena tiene el formato de un payload cifrado (sin descifrar).
export function isEncryptedPayload(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[2]);
}
