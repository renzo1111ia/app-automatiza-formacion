import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "@/lib/utils/logger";

describe("logger (2-37)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("emite info a stdout con JSON estructurado", () => {
    const log = createLogger("test-scope");
    log.info("hello", { foo: "bar" });
    expect(stdoutSpy).toHaveBeenCalled();
    const written = String(stdoutSpy.mock.calls[0]?.[0] ?? "");
    const parsed = JSON.parse(written.trim());
    expect(parsed.level).toBe("info");
    expect(parsed.scope).toBe("test-scope");
    expect(parsed.msg).toBe("hello");
    expect(parsed.meta).toEqual({ foo: "bar" });
  });

  it("emite error a stderr", () => {
    const log = createLogger("scope-x");
    log.error("boom");
    expect(stderrSpy).toHaveBeenCalled();
  });

  it("scrub redacta claves sensibles", () => {
    const log = createLogger("scope");
    log.info("auth", {
      api_key: "sk-secret",
      access_token: "tok",
      password: "pw",
      credentials_cipher: "iv:ct:tag",
      normal_field: "visible",
    });
    const written = String(stdoutSpy.mock.calls[0]?.[0] ?? "");
    const parsed = JSON.parse(written.trim());
    expect(parsed.meta.api_key).toBe("[REDACTED]");
    expect(parsed.meta.access_token).toBe("[REDACTED]");
    expect(parsed.meta.password).toBe("[REDACTED]");
    expect(parsed.meta.credentials_cipher).toBe("[REDACTED]");
    expect(parsed.meta.normal_field).toBe("visible");
  });

  it("scrub recursivo en objetos anidados", () => {
    const log = createLogger("scope");
    log.info("nested", {
      outer: {
        api_key: "secret",
        inner: { token: "t", safe: "ok" },
      },
    });
    const written = String(stdoutSpy.mock.calls[0]?.[0] ?? "");
    const parsed = JSON.parse(written.trim());
    expect(parsed.meta.outer.api_key).toBe("[REDACTED]");
    expect(parsed.meta.outer.inner.token).toBe("[REDACTED]");
    expect(parsed.meta.outer.inner.safe).toBe("ok");
  });
});
