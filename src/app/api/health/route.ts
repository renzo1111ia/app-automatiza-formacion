/**
 * GET /api/health
 *
 * Endpoint público sin auth para uptime monitoring (UptimeRobot, BetterStack, Pingdom).
 * Devuelve `{ status, timestamp }` con headers no-cache.
 *
 * Node runtime (no Edge) por consistencia con /api/version que usa logger Pino.
 * Latencia objetivo <50ms.
 *
 * SP-4-NEW-13 (Sprint 3 Hardening).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
