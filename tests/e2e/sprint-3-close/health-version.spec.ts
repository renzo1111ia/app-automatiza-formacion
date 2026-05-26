import { expect, test } from "@playwright/test";
import { expectVpsHealthy, expectVpsServingCommit } from "../utils/vps-version";

/**
 * SP-4-CLOSE-2 — E2E Sprint 3: endpoints health/version (SP-4-NEW-13).
 *
 * Verifica:
 *  - /api/health responde 200 sin auth con status=ok + timestamp ISO8601.
 *  - /api/version responde 200 sin auth con metadata del build.
 *  - Ambos tienen Cache-Control no-store.
 *  - El helper expectVpsServingCommit funciona contra el endpoint local.
 */

test.describe("Sprint 3 — Health + Version endpoints", () => {
  test("GET /api/health responde 200 + status ok", async ({ request }) => {
    await expectVpsHealthy(request);
  });

  test("GET /api/version responde 200 + metadata build", async ({ request }) => {
    const { commit, version, deployedAt } = await expectVpsServingCommit(request);
    expect(version).toBeTruthy();
    expect(commit).toBeTruthy(); // puede ser "unknown" en local sin Dokploy build args
    expect(deployedAt).toBeTruthy();
  });

  test("/api/health no se cachea (Cache-Control no-store)", async ({ request }) => {
    const res = await request.get("/api/health");
    const cc = res.headers()["cache-control"];
    expect(cc).toContain("no-store");
  });

  test("/api/version no se cachea (Cache-Control no-store)", async ({ request }) => {
    const res = await request.get("/api/version");
    const cc = res.headers()["cache-control"];
    expect(cc).toContain("no-store");
  });

  test("/api/health no requiere auth (publicly accessible)", async ({ request }) => {
    // Mismo request sin cookies → debe responder 200.
    const res = await request.get("/api/health", {
      headers: { cookie: "" },
    });
    expect(res.status()).toBe(200);
  });

  test("/api/version no requiere auth (publicly accessible)", async ({ request }) => {
    const res = await request.get("/api/version", {
      headers: { cookie: "" },
    });
    expect(res.status()).toBe(200);
  });
});
