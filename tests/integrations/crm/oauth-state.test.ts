/**
 * Tests para `oauth-state.ts` — HMAC sign/verify del state OAuth.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  generateOAuthState,
  verifyOAuthState,
  extractTenantId,
} from "@/lib/integrations/crm/oauth/oauth-state";

const SECRET_FIXTURE = "test_oauth_state_secret_32_chars_minimum_xx";
const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

describe("oauth-state", () => {
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env.OAUTH_STATE_SECRET;
    process.env.OAUTH_STATE_SECRET = SECRET_FIXTURE;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.OAUTH_STATE_SECRET;
    else process.env.OAUTH_STATE_SECRET = originalSecret;
  });

  describe("generateOAuthState", () => {
    it("produces state with 3 colon-separated parts", () => {
      const state = generateOAuthState(TENANT_A);
      const parts = state.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(TENANT_A);
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // nonce 16 bytes hex
      expect(parts[2]).toMatch(/^[0-9a-f]{64}$/); // sig sha256 hex
    });

    it("produces different state on each call (random nonce)", () => {
      const s1 = generateOAuthState(TENANT_A);
      const s2 = generateOAuthState(TENANT_A);
      expect(s1).not.toBe(s2);
    });

    it("throws if tenantId vacío", () => {
      expect(() => generateOAuthState("")).toThrow(/tenantId/);
    });
  });

  describe("verifyOAuthState", () => {
    it("returns true para state válido con tenantId correcto", () => {
      const state = generateOAuthState(TENANT_A);
      expect(verifyOAuthState(state, TENANT_A)).toBe(true);
    });

    it("returns false si tenantId no coincide", () => {
      const state = generateOAuthState(TENANT_A);
      expect(verifyOAuthState(state, TENANT_B)).toBe(false);
    });

    it("returns false si state está modificado (tamper en nonce)", () => {
      const state = generateOAuthState(TENANT_A);
      const parts = state.split(":");
      // modificar primer byte del nonce
      const tamperedNonce = (parts[1][0] === "a" ? "b" : "a") + parts[1].slice(1);
      const tampered = `${parts[0]}:${tamperedNonce}:${parts[2]}`;
      expect(verifyOAuthState(tampered, TENANT_A)).toBe(false);
    });

    it("returns false si signature está modificada", () => {
      const state = generateOAuthState(TENANT_A);
      const parts = state.split(":");
      const badSig = "0".repeat(64);
      const tampered = `${parts[0]}:${parts[1]}:${badSig}`;
      expect(verifyOAuthState(tampered, TENANT_A)).toBe(false);
    });

    it("returns false si state malformado (1 parte)", () => {
      expect(verifyOAuthState("not-a-valid-state", TENANT_A)).toBe(false);
    });

    it("returns false si state malformado (4 partes)", () => {
      expect(verifyOAuthState("a:b:c:d", TENANT_A)).toBe(false);
    });

    it("returns false si state vacío", () => {
      expect(verifyOAuthState("", TENANT_A)).toBe(false);
    });

    it("returns false si expectedTenantId vacío", () => {
      const state = generateOAuthState(TENANT_A);
      expect(verifyOAuthState(state, "")).toBe(false);
    });

    it("returns false si sig contiene caracteres no-hex", () => {
      const state = generateOAuthState(TENANT_A);
      const parts = state.split(":");
      const badHex = "z".repeat(64);
      expect(verifyOAuthState(`${parts[0]}:${parts[1]}:${badHex}`, TENANT_A)).toBe(false);
    });
  });

  describe("extractTenantId", () => {
    it("extrae tenantId de state válido", () => {
      const state = generateOAuthState(TENANT_A);
      expect(extractTenantId(state)).toBe(TENANT_A);
    });

    it("returns null si state malformado", () => {
      expect(extractTenantId("invalid")).toBeNull();
    });
  });

  describe("secret enforcement", () => {
    it("throws si OAUTH_STATE_SECRET no presente", () => {
      const saved = process.env.OAUTH_STATE_SECRET;
      delete process.env.OAUTH_STATE_SECRET;
      try {
        expect(() => generateOAuthState(TENANT_A)).toThrow(/OAUTH_STATE_SECRET/);
      } finally {
        process.env.OAUTH_STATE_SECRET = saved;
      }
    });

    it("throws si OAUTH_STATE_SECRET muy corto (<32 chars)", () => {
      const saved = process.env.OAUTH_STATE_SECRET;
      process.env.OAUTH_STATE_SECRET = "too-short";
      try {
        expect(() => generateOAuthState(TENANT_A)).toThrow(/OAUTH_STATE_SECRET/);
      } finally {
        process.env.OAUTH_STATE_SECRET = saved;
      }
    });
  });
});
