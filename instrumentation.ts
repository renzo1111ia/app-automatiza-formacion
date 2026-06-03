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

    // Sprint 4 (BUG-4-03): arrancar el worker BullMQ de sheets-pull al boot.
    // El webhook de Drive encola jobs (enqueueSheetPull) pero sin un worker
    // consumiendo la cola los jobs quedan en `wait` para siempre. Lo
    // arrancamos aquí, en el runtime Node, una sola vez por proceso.
    try {
      const { startSheetsPullWorker } = await import("./src/lib/integrations/sheets/queue");
      startSheetsPullWorker();
    } catch (err) {
      // No tumbar el arranque del server si Redis no está disponible
      // (CI/tests). El worker es opcional para que la app sirva páginas.
      console.warn(
        "[instrumentation] No se pudo arrancar sheets-pull worker:",
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
