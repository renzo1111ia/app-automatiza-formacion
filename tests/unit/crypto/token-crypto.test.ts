import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_KEY = "5eea30325e460f88ff5cc7577326a91373860e161699d9188c349e61ce881bd0";
const ORIGINAL_ENV = process.env.ENCRYPTION_KEY;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = ORIGINAL_ENV;
  }
});

describe("token-crypto AES-256-GCM (2-26)", () => {
  it("roundtrip simple", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto/token-crypto");
    const ct = encryptToken("hello-world-token-abc123");
    expect(ct).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(decryptToken(ct)).toBe("hello-world-token-abc123");
  });

  it("genera IV distinto cada cifrado (no reuso)", async () => {
    const { encryptToken } = await import("@/lib/crypto/token-crypto");
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
    const ivA = a.split(":")[0];
    const ivB = b.split(":")[0];
    expect(ivA).not.toBe(ivB);
  });

  it("encryptJson + decryptJson roundtrip", async () => {
    const { encryptJson, decryptJson } = await import("@/lib/crypto/token-crypto");
    const obj = { access_token: "aaa", refresh_token: "bbb", expires_at: 1234 };
    const ct = encryptJson(obj);
    const back = decryptJson<typeof obj>(ct);
    expect(back.access_token).toBe("aaa");
    expect(back.refresh_token).toBe("bbb");
    expect(back.expires_at).toBe(1234);
  });

  it("isEncryptedPayload reconoce formato valido y descarta plano", async () => {
    const { encryptToken, isEncryptedPayload } = await import("@/lib/crypto/token-crypto");
    const ct = encryptToken("x");
    expect(isEncryptedPayload(ct)).toBe(true);
    expect(isEncryptedPayload("plain-text")).toBe(false);
    expect(isEncryptedPayload(null)).toBe(false);
    expect(isEncryptedPayload("")).toBe(false);
  });

  it("decryptToken falla con authTag manipulado (autenticacion GCM)", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto/token-crypto");
    const ct = encryptToken("secret");
    const parts = ct.split(":");
    // Flip 1 nibble del authTag — garantizado distinto al original.
    // (un replace fijo a "0" era no-op cuando el authTag ya empezaba por "0":
    //  test flaky ~1/16. XOR del primer nibble cambia siempre exactamente 1 byte.)
    const firstNibble = parseInt(parts[2][0], 16);
    const flipped = (firstNibble ^ 0x1).toString(16);
    const tampered = flipped + parts[2].slice(1);
    const badCt = `${parts[0]}:${parts[1]}:${tampered}`;
    expect(() => decryptToken(badCt)).toThrow();
  });

  it("decryptToken rechaza formato invalido", async () => {
    const { decryptToken } = await import("@/lib/crypto/token-crypto");
    expect(() => decryptToken("no-colons")).toThrow();
    expect(() => decryptToken("a:b")).toThrow();
  });

  it("encryptToken lanza si plaintext vacio", async () => {
    const { encryptToken } = await import("@/lib/crypto/token-crypto");
    expect(() => encryptToken("")).toThrow();
  });
});

describe("token-crypto sin ENCRYPTION_KEY", () => {
  it("lanza error claro si la clave no esta definida", async () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      const mod = await import("@/lib/crypto/token-crypto");
      expect(() => mod.encryptToken("foo")).toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });
});
