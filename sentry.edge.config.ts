/**
 * Sentry edge runtime config (middleware, Edge route handlers).
 *
 * Nota: el proyecto NO usa Edge runtime para routes críticas (Pino solo Node).
 * Este archivo existe para satisfacer Sentry SDK requirements y captura errores
 * en `middleware.ts` (proxy a Supabase Kong) si los hubiera.
 *
 * Sprint 3 phase-02 Observabilidad (4-03).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,

    beforeSend(event) {
      if (dsn.includes("localhost") || dsn.includes("127.0.0.1")) return null;
      return event;
    },
  });
}
