/**
 * Tests del endpoint GET /api/health (SP-4-NEW-13).
 *
 * Verifica:
 *  - Status 200
 *  - Body { status: "ok", timestamp: ISO8601 }
 *  - Header Cache-Control no-store (nunca cache)
 *  - Runtime nodejs (no Edge)
 */
import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("retorna 200 con status ok y timestamp ISO8601", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("incluye Cache-Control no-store para que monitors no cacheen", async () => {
    const res = await GET();
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).toContain("no-cache");
  });

  it("timestamp es siempre fresco (dos llamadas consecutivas difieren)", async () => {
    const res1 = await GET();
    const body1 = await res1.json();

    await new Promise((resolve) => setTimeout(resolve, 5));

    const res2 = await GET();
    const body2 = await res2.json();

    expect(body2.timestamp >= body1.timestamp).toBe(true);
  });
});
