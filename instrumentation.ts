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
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captura errores de React Server Components y server actions (Sentry v10 API).
export const onRequestError = Sentry.captureRequestError;
