import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/sentry-test
 *
 * Ruta TEMPORAL para validar el wireup de Sentry tras configurar SENTRY_DSN en Dokploy.
 * Lanza un error controlado para que aparezca en el dashboard Sentry del proyecto VPS.
 *
 * Uso:
 *   curl https://dev.automatizaformacion.com/api/sentry-test
 *
 * Esperado:
 *   - HTTP 500 con JSON {error, sentryEventId}
 *   - Evento visible en https://automatiza-formacinsl.sentry.io/issues/?project=4511455823986768
 *     en <30 segundos (título "Sentry test error from /api/sentry-test VPS").
 *
 * BORRAR este archivo tras verificar que Sentry recibe eventos del VPS (PR de borrado siguiente).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dsnConfigured = Boolean(process.env.SENTRY_DSN);

  try {
    throw new Error("Sentry test error from /api/sentry-test VPS — wireup validation 26-05-2026");
  } catch (err) {
    const eventId = Sentry.captureException(err);
    await Sentry.flush(2000);
    return Response.json(
      {
        ok: false,
        message: "Test error captured (expected). Check Sentry dashboard.",
        sentryEventId: eventId,
        dsnConfigured,
        environment: process.env.NODE_ENV ?? "unknown",
        dashboardUrl: "https://automatiza-formacinsl.sentry.io/issues/?project=4511455823986768",
      },
      { status: 500 }
    );
  }
}
