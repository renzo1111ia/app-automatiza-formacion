/**
 * Tests unitarios del rate-limiter (SP-4-06 + SP-4-08).
 *
 * Mockea ioredis para validar:
 * - Sliding window cuenta INCR + PEXPIRE pipeline.
 * - allowed=true cuando count <= limit.
 * - allowed=false cuando count > limit.
 * - Fail-open si Redis lanza (return allowed=true).
 * - extractClientIp prioriza X-Real-IP sobre X-Forwarded-For (BUG-SEC-01 fix).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Vitest 4: vi.hoisted() expone los mocks ANTES de que se ejecute vi.mock() top-level
// (que se hoistea automáticamente). El `state` mutable vive en el hoisted scope para que
// los tests puedan reescribir el resultado de `exec()` sin reconstruir el mock.
const { pipelineMock, redisMock, state } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: { result: any[] | null } = { result: [[null, 1]] };
  const pm = {
    incr: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn(async () => s.result),
  };
  const rm = {
    pipeline: vi.fn(() => pm),
    on: vi.fn(),
  };
  return { pipelineMock: pm, redisMock: rm, state: s };
});

function setPipelineResult(v: typeof state.result) {
  state.result = v;
}

describe("rate-limiter", () => {
  beforeEach(() => {
    // Reset module cache para que cada test obtenga su propio Redis singleton fresco.
    vi.resetModules();
    // Vitest 4: tras resetModules() el vi.mock() top-level se borra del registry —
    // hay que re-registrar el mock con vi.doMock() ANTES del import() dinámico.
    // Además, `vi.fn().mockImplementation(() => obj)` ya NO devuelve `obj` cuando se
    // invoca con `new`. Usar clase explícita que devuelva la instancia mock.
    vi.doMock("ioredis", () => ({
      Redis: class MockRedis {
        constructor() {
          return redisMock;
        }
      },
    }));
    setPipelineResult([[null, 1]]);
    pipelineMock.exec.mockClear();
    pipelineMock.incr.mockClear();
    pipelineMock.pexpire.mockClear();
    redisMock.pipeline.mockClear();
    // Limpiar el singleton global entre tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__af_rate_limiter_redis;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("permite request cuando count <= limit", async () => {
    setPipelineResult([[null, 1]]);
    const { rateLimit } = await import("@/lib/rate-limiter");
    const result = await rateLimit("test:1", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
    expect(pipelineMock.incr).toHaveBeenCalledTimes(1);
    expect(pipelineMock.pexpire).toHaveBeenCalledTimes(1);
  });

  it("bloquea request cuando count > limit", async () => {
    setPipelineResult([[null, 6]]);
    const { rateLimit } = await import("@/lib/rate-limiter");
    const result = await rateLimit("test:2", 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("permite la request exacta del límite (count === limit)", async () => {
    setPipelineResult([[null, 5]]);
    const { rateLimit } = await import("@/lib/rate-limiter");
    const result = await rateLimit("test:3", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("fail-open si Redis lanza error (no bloquea al usuario)", async () => {
    pipelineMock.exec.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { rateLimit } = await import("@/lib/rate-limiter");
    const result = await rateLimit("test:4", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it("usa key con bucket time-based (sliding window)", async () => {
    setPipelineResult([[null, 1]]);
    const { rateLimit } = await import("@/lib/rate-limiter");
    await rateLimit("user:abc", 10, 30_000);

    const incrCall = pipelineMock.incr.mock.calls[0]?.[0] as string;
    expect(incrCall).toMatch(/^rl:user:abc:\d+$/);
  });

  it("fail-open con timeout duro 100ms si Redis cuelga (BUG-RLM-01 /e2etotal 27-05-2026)", async () => {
    // Simula Redis colgado: pipe.exec() nunca resuelve (ioredis ECONNRESET reconnecting).
    // Sin timeout duro la auth quedaría bloqueada >1.5min (bug real detectado en local).
    pipelineMock.exec.mockImplementationOnce(
      () => new Promise(() => {}) // promise que nunca resuelve
    );

    const { rateLimit } = await import("@/lib/rate-limiter");
    const start = Date.now();
    const result = await rateLimit("test:hang", 5, 60_000);
    const elapsed = Date.now() - start;

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
    // Debe responder en ~100ms + epsilon, NUNCA > 500ms.
    expect(elapsed).toBeLessThan(500);
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });
});

describe("extractClientIp (BUG-SEC-01 — X-Real-IP priorizado)", () => {
  it("BUG-SEC-01 fix: prioriza X-Real-IP sobre X-Forwarded-For (anti-spoofing)", async () => {
    const { extractClientIp } = await import("@/lib/rate-limiter");
    // Cliente intenta falsificar XFF para evadir rate-limit. X-Real-IP es la IP real
    // de la conexión TCP inyectada por traefik. La función debe usar X-Real-IP.
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4", "x-real-ip": "203.0.113.99" },
    });
    expect(extractClientIp(req)).toBe("203.0.113.99");
  });

  it("usa X-Forwarded-For (primer IP de la lista) si NO hay X-Real-IP", async () => {
    const { extractClientIp } = await import("@/lib/rate-limiter");
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.5" },
    });
    expect(extractClientIp(req)).toBe("203.0.113.1");
  });

  it("usa X-Real-IP si solo está ese header", async () => {
    const { extractClientIp } = await import("@/lib/rate-limiter");
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "192.168.1.10" },
    });
    expect(extractClientIp(req)).toBe("192.168.1.10");
  });

  it("ignora X-Real-IP vacío y cae a X-Forwarded-For", async () => {
    const { extractClientIp } = await import("@/lib/rate-limiter");
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "   ", "x-forwarded-for": "10.0.0.7" },
    });
    expect(extractClientIp(req)).toBe("10.0.0.7");
  });

  it("retorna 'unknown' si no hay headers IP útiles", async () => {
    const { extractClientIp } = await import("@/lib/rate-limiter");
    const req = new Request("http://localhost");
    expect(extractClientIp(req)).toBe("unknown");
  });
});
