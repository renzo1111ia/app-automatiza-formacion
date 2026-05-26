/**
 * Sentry server-side config (Node runtime).
 *
 * Captura errores en API Routes, Server Actions, Server Components, Workers BullMQ.
 * Complementa los logs Pino: Pino para observabilidad rutinaria, Sentry para errores
 * críticos con stack trace + breadcrumbs.
 *
 * Sprint 3 phase-02 Observabilidad (4-03).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.npm_package_version,

    // MVP free plan: 5K errores/mes. Sin tracing ni profiling para no consumir.
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // Ignorar errores conocidos del orchestrator legacy que se loguean intencionalmente.
    ignoreErrors: [
      // 401/403 de auth checks que ya logueamos como warn en Pino.
      /^Unauthorized$/,
      /^Forbidden$/,
    ],

    beforeSend(event) {
      // No enviar si DSN apunta a localhost.
      if (dsn.includes("localhost") || dsn.includes("127.0.0.1")) return null;

      // Scrub headers sensibles antes de enviar (Authorization, cookies).
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        for (const k of Object.keys(headers)) {
          if (/auth|cookie|token|secret|api[-_]?key/i.test(k)) {
            headers[k] = "[REDACTED]";
          }
        }
      }
      return event;
    },
  });
}
