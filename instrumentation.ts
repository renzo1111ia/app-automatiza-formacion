/**
 * Next.js Instrumentation hook (App Router).
 *
 * Se ejecuta una vez al arrancar el servidor, en el runtime correspondiente.
 * Aquí registramos Sentry para Node runtime + Edge runtime separados.
 *
 * Sprint 3 phase-02 Observabilidad (4-03).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Arranca los workers BullMQ al boot. NOTA: en producción standalone con
    // Turbopack, instrumentation.ts NO se incluye en el bundle → register() no
    // se ejecuta y este arranque se pierde. Por eso el arranque REAL y garantizado
    // ocurre lazy en los entrypoints (ensureZohoLeadWorker/ensureSheetsPullWorker
    // en webhook + cron). Este bloque sigue siendo útil en dev (donde sí corre).
    //
    // Sprint 4 (BUG-4-03): worker sheets-pull. El webhook de Drive encola jobs
    // (enqueueSheetPull) pero sin worker consumiendo la cola quedan en `wait`.
    try {
      if (process.env.NODE_ENV !== "development" || process.env.REDIS_URL) {
        const { startSheetsPullWorker } = await import("./src/lib/integrations/sheets/queue");
        startSheetsPullWorker();
      }
    } catch (err) {
      console.warn(
        "[instrumentation] No se pudo arrancar sheets-pull worker:",
        err instanceof Error ? err.message : String(err)
      );
    }

    try {
      if (process.env.NODE_ENV !== "development" || process.env.REDIS_URL) {
        const { startZohoLeadWorker } = await import("./src/lib/integrations/zoho-pull/queue");
        startZohoLeadWorker();
      }
    } catch (err) {
      console.warn(
        "[instrumentation] No se pudo arrancar zoho-lead worker:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captura errores de React Server Components y server actions (Sentry v10 API).
export const onRequestError = Sentry.captureRequestError;
