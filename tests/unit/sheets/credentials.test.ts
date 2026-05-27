// Sprint 4 - credentials encryption smoke test.
//
// Verifica que el ciclo encriptar / desencriptar de Client ID + Secret usa
// token-crypto correctamente y el formato resultante es valido.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptToken, decryptToken, isEncryptedPayload } from "@/lib/crypto/token-crypto";

const TEST_KEY = "5eea30325e460f88ff5cc7577326a91373860e161699d9188c349e61ce881bd0";
const ORIGINAL = process.env.ENCRYPTION_KEY;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = ORIGINAL;
});

describe("Sheets credentials cipher (token-crypto reutilizado)", () => {
  it("Client ID round-trip", () => {
    const clientId = "123456789-abcdefghijklmn.apps.googleusercontent.com";
    const cipher = encryptToken(clientId);
    expect(isEncryptedPayload(cipher)).toBe(true);
    expect(decryptToken(cipher)).toBe(clientId);
  });

  it("Client Secret round-trip", () => {
    const secret = "GOCSPX-thisIsAFakeSecretValueForTesting123";
    const cipher = encryptToken(secret);
    expect(isEncryptedPayload(cipher)).toBe(true);
    expect(decryptToken(cipher)).toBe(secret);
  });

  it("Ciphertexts distintos para mismo plaintext (IV random)", () => {
    const plain = "GOCSPX-mismaPassword";
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plain);
    expect(decryptToken(b)).toBe(plain);
  });
});
