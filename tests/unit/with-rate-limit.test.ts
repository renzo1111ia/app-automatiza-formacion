/**
 * Tests del HOF `withRateLimit` (SP-4-08).
 *
 * Mockea `rateLimit` y valida que:
 * - Si allowed=true, llama a actionFn y retorna su resultado.
 * - Si allowed=false, retorna error sin invocar actionFn.
 * - Si identify lanza, usa 'unknown' + límite agresivo (1/min).
 * - Identidad vacía/falsy ("") activa el límite agresivo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rateLimitMock = vi.fn();
vi.mock("@/lib/rate-limiter", () => ({
  rateLimit: rateLimitMock,
}));

describe("withRateLimit", () => {
  beforeEach(() => {
    rateLimitMock.mockReset();
  });

  it("ejecuta la action si rate limit permite", async () => {
    rateLimitMock.mockResolvedValue({ allowed: true, remaining: 9, resetMs: 30_000, limit: 10 });
    const { withRateLimit } = await import("@/lib/api/with-rate-limit");

    const action = vi.fn(async (msg: string) => ({ success: true, msg }));
    const wrapped = withRateLimit(action, {
      key: "test",
      perMinute: 10,
      identify: async () => "tenant-a",
    });

    const res = await wrapped("hello");
    expect(res).toEqual({ success: true, msg: "hello" });
    expect(action).toHaveBeenCalledWith("hello");
    expect(rateLimitMock).toHaveBeenCalledWith("sa:test:tenant-a", 10, 60_000);
  });

  it("retorna rate_limit_exceeded sin invocar action si bloqueado", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetMs: 45_000, limit: 10 });
    const { withRateLimit } = await import("@/lib/api/with-rate-limit");

    const action = vi.fn(async () => ({ success: true }));
    const wrapped = withRateLimit(action, {
      key: "test",
      perMinute: 10,
      identify: async () => "tenant-b",
    });

    const res = await wrapped();
    expect(res).toMatchObject({
      success: false,
      error: "rate_limit_exceeded",
      remaining: 0,
      resetSec: 45,
    });
    expect(action).not.toHaveBeenCalled();
  });

  it("usa límite agresivo (1/min) si identify lanza", async () => {
    rateLimitMock.mockResolvedValue({ allowed: true, remaining: 0, resetMs: 60_000, limit: 1 });
    const { withRateLimit } = await import("@/lib/api/with-rate-limit");

    const action = vi.fn(async () => ({ success: true }));
    const wrapped = withRateLimit(action, {
      key: "preauth",
      perMinute: 10,
      identify: async () => {
        throw new Error("no session");
      },
    });

    await wrapped();
    expect(rateLimitMock).toHaveBeenCalledWith("sa:preauth:unknown", 1, 60_000);
  });

  it("usa límite agresivo si identify retorna cadena vacía", async () => {
    rateLimitMock.mockResolvedValue({ allowed: true, remaining: 0, resetMs: 60_000, limit: 1 });
    const { withRateLimit } = await import("@/lib/api/with-rate-limit");

    const action = vi.fn(async () => ({ success: true }));
    const wrapped = withRateLimit(action, {
      key: "preauth",
      perMinute: 50,
      identify: () => "",
    });

    await wrapped();
    expect(rateLimitMock).toHaveBeenCalledWith("sa:preauth:unknown", 1, 60_000);
  });
});
