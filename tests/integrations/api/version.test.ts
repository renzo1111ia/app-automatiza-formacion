/**
 * Tests del endpoint GET /api/version (SP-4-NEW-13).
 *
 * Verifica:
 *  - Status 200
 *  - Body con version (= package.json), commit, branch, deployedAt, nodeVersion
 *  - Header Cache-Control no-store
 *  - Fallback "unknown" cuando env vars no inyectadas
 */
import { describe, it, expect, afterEach } from "vitest";
import { GET } from "@/app/api/version/route";
import packageJson from "../../../package.json";

const ORIGINAL_ENV = {
  GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA,
  GIT_BRANCH: process.env.GIT_BRANCH,
  BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP,
};

describe("GET /api/version", () => {
  afterEach(() => {
    process.env.GIT_COMMIT_SHA = ORIGINAL_ENV.GIT_COMMIT_SHA;
    process.env.GIT_BRANCH = ORIGINAL_ENV.GIT_BRANCH;
    process.env.BUILD_TIMESTAMP = ORIGINAL_ENV.BUILD_TIMESTAMP;
  });

  it("retorna 200 con version sincronizada con package.json", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe(packageJson.version);
  });

  it("expone metadata de build con todos los campos", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("commit");
    expect(body).toHaveProperty("branch");
    expect(body).toHaveProperty("deployedAt");
    expect(body).toHaveProperty("nodeVersion");
    expect(body.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("usa env vars cuando están inyectadas (build args Dokploy)", async () => {
    process.env.GIT_COMMIT_SHA = "abc1234567";
    process.env.GIT_BRANCH = "developer";
    process.env.BUILD_TIMESTAMP = "2026-05-25T15:00:00Z";

    const res = await GET();
    const body = await res.json();
    expect(body.commit).toBe("abc1234567");
    expect(body.branch).toBe("developer");
    expect(body.deployedAt).toBe("2026-05-25T15:00:00Z");
  });

  it("hace fallback a 'unknown' si build args no inyectadas", async () => {
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.GIT_BRANCH;
    delete process.env.BUILD_TIMESTAMP;

    const res = await GET();
    const body = await res.json();
    expect(body.commit).toBe("unknown");
    expect(body.branch).toBe("unknown");
    expect(body.deployedAt).toBe("unknown");
  });

  it("incluye Cache-Control no-store", async () => {
    const res = await GET();
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toContain("no-store");
  });
});
