/**
 * Sentry client-side config (browser).
 *
 * Captura errores no manejados en el navegador (React error boundaries,
 * promesas rechazadas, eventos onerror). Solo activo si SENTRY_DSN configurado.
 *
 * Sprint 3 phase-02 Observabilidad (4-03).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_APP_VERSION,

    // Performance monitoring desactivado en MVP (no necesario, traces de Sentry consumen quota
    // del plan free de 5K errores/mes). Activar en post-MVP si quieres real-user-monitoring.
    tracesSampleRate: 0,

    // Session replay desactivado (consume mucha cuota + privacidad).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Filtrar ruido típico del browser (extensions, third-party scripts).
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /^chrome-extension:/,
      /^moz-extension:/,
    ],

    beforeSend(event) {
      // No enviar a Sentry si DSN apunta a localhost (dev local sin sentry real).
      if (dsn.includes("localhost") || dsn.includes("127.0.0.1")) return null;
      return event;
    },
  });
}
