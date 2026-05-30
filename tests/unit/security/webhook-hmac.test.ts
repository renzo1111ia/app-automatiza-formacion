/**
 * Tests del verificador HMAC genérico para webhooks (BUG-SEC-02 fix Sprint 3).
 */
import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyHmacSignature } from "@/lib/security/webhook-hmac";

const SECRET = "test-secret-bug-sec-02-superseguro-32chars-min";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyHmacSignature (BUG-SEC-02)", () => {
  it("acepta firma correcta sin prefijo sha256=", () => {
    const body = '{"telefono":"+34666","name":"Test"}';
    expect(verifyHmacSignature(body, SECRET, sign(body))).toBe(true);
  });

  it("acepta firma correcta con prefijo sha256=", () => {
    const body = '{"telefono":"+34666","name":"Test"}';
    expect(verifyHmacSignature(body, SECRET, `sha256=${sign(body)}`)).toBe(true);
  });

  it("acepta firma correcta case-insensitive (uppercase header)", () => {
    const body = "hello world";
    expect(verifyHmacSignature(body, SECRET, `SHA256=${sign(body)}`)).toBe(true);
  });

  it("rechaza firma con body modificado", () => {
    const original = '{"telefono":"+34666"}';
    const tampered = '{"telefono":"+34999"}';
    expect(verifyHmacSignature(tampered, SECRET, sign(original))).toBe(false);
  });

  it("rechaza firma generada con secret distinto", () => {
    const body = "payload";
    const otherSig = sign(body, "secret-distinto");
    expect(verifyHmacSignature(body, SECRET, otherSig)).toBe(false);
  });

  it("rechaza header null o undefined", () => {
    expect(verifyHmacSignature("body", SECRET, null)).toBe(false);
    expect(verifyHmacSignature("body", SECRET, undefined)).toBe(false);
    expect(verifyHmacSignature("body", SECRET, "")).toBe(false);
  });

  it("rechaza secret vacío (configuración inválida)", () => {
    const body = "x";
    expect(verifyHmacSignature(body, "", sign(body))).toBe(false);
  });

  it("rechaza header con caracteres no-hex", () => {
    expect(verifyHmacSignature("body", SECRET, "no-es-hex-zzzzzz")).toBe(false);
    expect(verifyHmacSignature("body", SECRET, "sha256=NoSonHex!!")).toBe(false);
  });

  it("rechaza header con longitud distinta a 64 hex chars", () => {
    // SHA-256 hex tiene 64 chars; cualquier otra longitud es rechazo automático.
    expect(verifyHmacSignature("body", SECRET, "abc123")).toBe(false);
    expect(verifyHmacSignature("body", SECRET, "a".repeat(63))).toBe(false);
    expect(verifyHmacSignature("body", SECRET, "a".repeat(65))).toBe(false);
  });

  it("verifica body vacío con firma de cadena vacía", () => {
    expect(verifyHmacSignature("", SECRET, sign(""))).toBe(true);
    expect(verifyHmacSignature("", SECRET, sign("a"))).toBe(false);
  });
});
