// Sprint 5 — Helpers puros de subscription.ts (channel_id + token).
//
// Cubre BUG-5-05: el channel_id de la Notifications API se generaba con
// crypto.randomInt(0, 9e14), que excede el máximo admitido por randomInt
// (2^48-1 = 281474976710655) → "max - min out of range". El fix combina
// timestamp(segundos) + 6 dígitos aleatorios, siempre numérico y dentro del
// rango de un BIGINT que Zoho espera para channel_id.

import { describe, it, expect } from "vitest";

// Mockeamos las dependencias de I/O para poder importar el módulo sin tocar red
// ni Supabase (solo ejercitamos las funciones puras exportadas).
import { vi } from "vitest";

vi.mock("@/lib/integrations/crm/token-manager", () => ({
  getValidTokens: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { newChannelId, newSubscriptionToken } from "@/lib/integrations/zoho-pull/subscription";

describe("newChannelId (BUG-5-05)", () => {
  it("devuelve solo dígitos (channel_id numérico que Zoho exige)", () => {
    expect(newChannelId()).toMatch(/^\d+$/);
  });

  it("no excede el rango de un BIGINT de 64 bits", () => {
    const v = BigInt(newChannelId());
    const maxBigint = BigInt("9223372036854775807"); // max BIGINT (sin literal n)
    expect(v <= maxBigint).toBe(true);
    expect(v > BigInt(0)).toBe(true);
  });

  it("nunca lanza (regresión del out-of-range de crypto.randomInt)", () => {
    for (let i = 0; i < 50; i++) {
      expect(() => newChannelId()).not.toThrow();
      expect(newChannelId()).toMatch(/^\d+$/);
    }
  });

  it("tiene longitud plausible (timestamp ~10 + 6 dígitos = ~16)", () => {
    const id = newChannelId();
    expect(id.length).toBeGreaterThanOrEqual(15);
    expect(id.length).toBeLessThanOrEqual(17);
  });
});

describe("newSubscriptionToken", () => {
  it("genera token base64url por debajo del límite de 50 chars de Zoho", () => {
    const t = newSubscriptionToken();
    expect(t.length).toBeLessThanOrEqual(50);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/); // base64url: sin +, /, =
  });

  it("es aleatorio (dos llamadas no coinciden)", () => {
    expect(newSubscriptionToken()).not.toBe(newSubscriptionToken());
  });
});
