import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Path-prefix proxy a Supabase Kong para evitar subdominios dedicados.
 *
 * - Browser hace fetch a `${NEXT_PUBLIC_APP_URL}/supabase/...`
 * - Next.js reescribe a la URL real del Kong (interno en VPS, localhost:8100 en local)
 * - Beneficio: same-origin (cero CORS), cookies compartidas SSR↔client, una sola DNS + cert
 *
 * En VPS la reescritura la hace traefik via labels (no este rewrite — este es solo para LOCAL).
 * En LOCAL Next.js es el único proxy posible, así que aquí lo definimos.
 */
const SUPABASE_KONG_INTERNAL = process.env.SUPABASE_KONG_INTERNAL_URL ?? "http://127.0.0.1:8100";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pino y su transitive `thread-stream` usan worker_threads / process.stdout: deben quedar
  // como external en server bundles (no pasar por webpack chunking) para evitar runtime errors.
  // Sprint 3 phase-02 Observabilidad (4-03).
  serverExternalPackages: ["pino", "pino-pretty"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/dashboardadmin/:path*",
        destination: "/dashboard/:path*",
      },
      {
        source: "/supabase/:path*",
        destination: `${SUPABASE_KONG_INTERNAL}/:path*`,
      },
    ];
  },
};

// Sentry wrap: solo aplica integración real si SENTRY_DSN está configurado.
// Si no, withSentryConfig pasa la config por defecto sin overhead.
// Sprint 3 phase-02 Observabilidad (4-03).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Source maps: solo upload si SENTRY_AUTH_TOKEN presente (CI/Dokploy build).
  // Sin token: source maps se generan pero no se suben (errores Sentry mostrarán código minificado).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
  disableLogger: true,
});
