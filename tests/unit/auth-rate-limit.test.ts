/**
 * Tests del rate-limit aplicado a `loginAction` y `resetPasswordAction`
 * (SP-4-AUTH-RATELIMIT — Sprint 3 phase-09).
 *
 * Cierra OWASP A07:2021 (Identification & Authentication Failures —
 * brute-force / credential stuffing / email-bomb).
 *
 * Estrategia de mocking:
 * - `rateLimit` (en `@/lib/rate-limiter`) → mock para controlar allowed/denied por test.
 * - `next/headers` → mock retorna IP via x-forwarded-for.
 * - `@supabase/ssr` → mock createServerClient → signInWithPassword stub.
 * - `next/navigation` → mock redirect (lanza para simular Next.js).
 * - `./tenant` → mock para no tocar BD real.
 *
 * Aislamos así el comportamiento del rate-limit independientemente de
 * la lógica de Supabase o BD.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// auth-config.ts valida env vars al cargar el módulo. Setear antes de cualquier import dinámico.
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.ENCRYPTION_KEY ??= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const rateLimitMock = vi.fn();
const headersMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const getTenantByUserIdMock = vi.fn();
const setTenantCookiesMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  // Next.js redirect lanza para abortar la ejecución
  const err = new Error("NEXT_REDIRECT");
  // marcar como redirect para que el catch interno de auth.ts lo re-lance
  (err as Error & { url?: string }).url = url;
  throw err;
});

vi.mock("@/lib/rate-limiter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limiter")>("@/lib/rate-limiter");
  return {
    ...actual,
    rateLimit: rateLimitMock,
  };
});

vi.mock("next/headers", () => ({
  headers: headersMock,
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      signOut: vi.fn(),
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  })),
}));

vi.mock("@/lib/actions/tenant", () => ({
  getTenantByUserId: getTenantByUserIdMock,
  setTenantCookies: setTenantCookiesMock,
}));

function makeHeaders(ip = "10.0.0.1") {
  return {
    entries() {
      return [
        ["x-forwarded-for", ip],
        ["host", "localhost:8500"],
        ["origin", "http://localhost:8500"],
      ][Symbol.iterator]();
    },
    get(name: string) {
      if (name === "x-forwarded-for") return ip;
      if (name === "host") return "localhost:8500";
      if (name === "origin") return "http://localhost:8500";
      return null;
    },
  };
}

describe("loginAction rate-limit (SP-4-AUTH-RATELIMIT)", () => {
  beforeEach(() => {
    rateLimitMock.mockReset();
    headersMock.mockReset();
    signInWithPasswordMock.mockReset();
    getTenantByUserIdMock.mockReset();
    setTenantCookiesMock.mockReset();
    redirectMock.mockClear();
    headersMock.mockResolvedValue(makeHeaders("10.0.0.1"));
  });

  it("bloquea el 6º intento con bucket ip:emailHash (5/min)", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetMs: 42_000,
      limit: 5,
    });

    const { loginAction } = await import("@/lib/actions/auth");
    const res = await loginAction("admin@example.com", "wrong-pass");

    expect(res).toEqual({
      error: "Demasiados intentos. Inténtalo de nuevo en 42s.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();

    // Verifica que el bucket es ip:emailHash (sha256-8b)
    const callArgs = rateLimitMock.mock.calls[0];
    expect(callArgs[0]).toMatch(/^sa:auth-login:10\.0\.0\.1:[a-f0-9]{16}$/);
    expect(callArgs[1]).toBe(5); // perMinute
    expect(callArgs[2]).toBe(60_000); // windowMs
  });

  it("permite el intento si el rate-limit lo allow (allowed=true) y delega a supabase", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: true,
      remaining: 4,
      resetMs: 60_000,
      limit: 5,
    });
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null }, // sin user → no redirect, retorna { success: true } al final
      error: { message: "Invalid credentials" },
    });

    const { loginAction } = await import("@/lib/actions/auth");
    const res = await loginAction("admin@example.com", "wrong-pass");

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "wrong-pass",
    });
    expect(res).toEqual({ error: "Invalid credentials" });
  });

  it("buckets IP-distintas no se cruzan (IP-A bloqueada NO afecta IP-B)", async () => {
    // Primer call: IP-A bloqueada
    headersMock.mockResolvedValueOnce(makeHeaders("10.0.0.1"));
    rateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetMs: 30_000,
      limit: 5,
    });

    const { loginAction } = await import("@/lib/actions/auth");
    const res1 = await loginAction("admin@example.com", "x");
    expect(res1).toEqual({
      error: "Demasiados intentos. Inténtalo de nuevo en 30s.",
    });
    const bucketA = rateLimitMock.mock.calls[0][0];

    // Segundo call: IP-B distinta, allow=true → llega a supabase
    headersMock.mockResolvedValueOnce(makeHeaders("10.0.0.99"));
    rateLimitMock.mockResolvedValueOnce({
      allowed: true,
      remaining: 4,
      resetMs: 60_000,
      limit: 5,
    });
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid credentials" },
    });
    const res2 = await loginAction("admin@example.com", "x");
    expect(res2).toEqual({ error: "Invalid credentials" });

    const bucketB = rateLimitMock.mock.calls[1][0];
    expect(bucketA).not.toBe(bucketB);
    expect(bucketA).toContain("10.0.0.1:");
    expect(bucketB).toContain("10.0.0.99:");
  });

  it("emailHash es estable para mismo email (mismo bucket en intentos repetidos)", async () => {
    rateLimitMock
      .mockResolvedValueOnce({ allowed: true, remaining: 4, resetMs: 60_000, limit: 5 })
      .mockResolvedValueOnce({ allowed: true, remaining: 3, resetMs: 60_000, limit: 5 });
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid" },
    });

    const { loginAction } = await import("@/lib/actions/auth");
    await loginAction("admin@example.com", "x");
    await loginAction("ADMIN@example.com", "y"); // mayúsculas → normalize lowercase

    const bucket1 = rateLimitMock.mock.calls[0][0];
    const bucket2 = rateLimitMock.mock.calls[1][0];
    expect(bucket1).toBe(bucket2); // email case-insensitive hashes idéntico
  });
});

describe("resetPasswordAction rate-limit (SP-4-AUTH-RATELIMIT)", () => {
  beforeEach(() => {
    rateLimitMock.mockReset();
    headersMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    headersMock.mockResolvedValue(makeHeaders("10.0.0.5"));
  });

  it("bloquea el 4º intento con perMinute=3 (anti email-bomb)", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetMs: 55_000,
      limit: 3,
    });

    const { resetPasswordAction } = await import("@/lib/actions/auth");
    const res = await resetPasswordAction("user@example.com");

    expect(res).toEqual({
      error: "Demasiados intentos. Inténtalo de nuevo en 55s.",
    });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();

    const callArgs = rateLimitMock.mock.calls[0];
    expect(callArgs[0]).toMatch(/^sa:auth-reset:10\.0\.0\.5:[a-f0-9]{16}$/);
    expect(callArgs[1]).toBe(3);
    expect(callArgs[2]).toBe(60_000);
  });

  it("permite el intento si rate-limit allow=true", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: true,
      remaining: 2,
      resetMs: 60_000,
      limit: 3,
    });
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });

    const { resetPasswordAction } = await import("@/lib/actions/auth");
    const res = await resetPasswordAction("user@example.com");

    expect(resetPasswordForEmailMock).toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });
});

describe("auth rate-limit fail-open behavior", () => {
  beforeEach(() => {
    rateLimitMock.mockReset();
    headersMock.mockReset();
    signInWithPasswordMock.mockReset();
    headersMock.mockResolvedValue(makeHeaders("10.0.0.1"));
  });

  it("si rateLimit retorna allowed=true por fail-open (Redis caído), la action procede", async () => {
    // rate-limiter.ts retorna { allowed: true, remaining: limit, resetMs: windowMs, limit } cuando Redis cae
    rateLimitMock.mockResolvedValueOnce({
      allowed: true,
      remaining: 5,
      resetMs: 60_000,
      limit: 5,
    });
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid credentials" },
    });

    const { loginAction } = await import("@/lib/actions/auth");
    const res = await loginAction("admin@example.com", "wrong");

    // Fail-open: el rate-limit NO bloquea, llega a supabase y devuelve su error
    expect(signInWithPasswordMock).toHaveBeenCalled();
    expect(res).toEqual({ error: "Invalid credentials" });
  });
});
