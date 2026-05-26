import { expect, type APIRequestContext } from "@playwright/test";

/**
 * Helper E2E: verifica que el VPS sirve el commit esperado leyendo `/api/version`.
 *
 * Sprint 3 SP-4-NEW-13 — resuelve la fricción de SP-3B-CLOSE-5 donde ETag opaco
 * impedía saber si autodeploy había aplicado el último push.
 *
 * Uso:
 *
 * ```ts
 * test.beforeAll(async ({ request }) => {
 *   await expectVpsServingCommit(request, process.env.EXPECTED_COMMIT_SHA ?? "");
 * });
 * ```
 *
 * Si `expectedSha` está vacío (no se pasa env var), el helper solo verifica que
 * `/api/version` responda 200 con metadata válida — útil cuando no necesitas pinear
 * un commit concreto pero quieres confirmar que el VPS está vivo y respondiendo.
 */
export async function expectVpsServingCommit(
  request: APIRequestContext,
  expectedSha = ""
): Promise<{ commit: string; version: string; deployedAt: string }> {
  const res = await request.get("/api/version");
  expect(res.status(), "/api/version debería devolver 200").toBe(200);

  const body = (await res.json()) as {
    version: string;
    commit: string;
    branch: string;
    deployedAt: string;
    nodeVersion: string;
  };

  expect(body, "/api/version debe traer todos los campos").toMatchObject({
    version: expect.any(String),
    commit: expect.any(String),
    branch: expect.any(String),
    deployedAt: expect.any(String),
    nodeVersion: expect.any(String),
  });

  if (expectedSha && expectedSha !== "unknown") {
    const short = expectedSha.slice(0, 7);
    expect(
      body.commit.startsWith(short),
      `VPS sirve commit ${body.commit}, esperado ${short}. ¿Autodeploy aún no aplicado?`
    ).toBe(true);
  }

  return { commit: body.commit, version: body.version, deployedAt: body.deployedAt };
}

/**
 * Helper E2E para `/api/health`. Verifica liveness sin lock-in en versión concreta.
 */
export async function expectVpsHealthy(request: APIRequestContext): Promise<void> {
  const res = await request.get("/api/health");
  expect(res.status(), "/api/health debería devolver 200").toBe(200);

  const body = (await res.json()) as { status: string; timestamp: string };
  expect(body.status).toBe("ok");
  expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
}
