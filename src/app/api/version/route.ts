import packageJson from "../../../../package.json";

/**
 * GET /api/version
 *
 * Endpoint público sin auth para verificar qué build sirve el VPS.
 * Resuelve la fricción detectada en SP-3B-CLOSE-5: ETag de Next.js prerender
 * puede coincidir entre builds distintos, haciendo imposible verificar autodeploy
 * post-merge solo con curl -I.
 *
 * Devuelve metadata del build: version (package.json), commit SHA, branch, build timestamp,
 * Node runtime version. Sin secretos ni paths internos (fingerprinting safe).
 *
 * Node runtime (no Edge) porque process.version no es accesible en Edge runtime.
 * Latencia objetivo <100ms.
 *
 * SP-4-NEW-13 (Sprint 3 Hardening).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      version: packageJson.version,
      commit: process.env.GIT_COMMIT_SHA ?? "unknown",
      branch: process.env.GIT_BRANCH ?? "unknown",
      deployedAt: process.env.BUILD_TIMESTAMP ?? "unknown",
      nodeVersion: process.version,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
