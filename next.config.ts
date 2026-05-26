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

/**
 * Security headers — Sprint 3 phase-05 Hardening (4-06).
 *
 * CSP `unsafe-inline` styles aceptado por Tailwind v4 en MVP (alternativa hash-based
 * en Sprint 4). `connect-src` enumera explícitamente todos los endpoints LLM/Supabase/Sentry
 * que el cliente puede contactar — bloquea exfiltration accidental.
 *
 * HSTS preload requiere HTTPS funcional en Dokploy ANTES de activarlo.
 * `frame-ancestors 'none'` previene clickjacking en todas las rutas EXCEPTO `/widget/*`
 * que se sobrescribe abajo (los clientes embeben el widget en sus sitios).
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'", // Next.js inyecta inline scripts (hidratación). strict-dynamic en Sprint 4.
      "img-src 'self' data: blob: https:",
      [
        "connect-src 'self'",
        "https://*.supabase.co wss://*.supabase.co",
        "https://api.anthropic.com",
        "https://api.openai.com",
        "https://generativelanguage.googleapis.com",
        "https://bedrock.*.amazonaws.com",
        "https://*.ingest.sentry.io",
        "https://*.ingest.us.sentry.io",
        "https://api.retellai.com",
        "https://api.ultravox.ai",
        "https://api.hubapi.com",
        "https://accounts.zoho.com https://*.zohoapis.com https://*.zohoapis.eu",
        "https://graph.facebook.com",
        "https://api.sepay.vn",
      ].join(" "),
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Widget embed: los clientes embeben en sus dominios -> frame-ancestors permisivo
      // pero seguimos validando el origin en server-side (1-27 Sprint 0).
      {
        source: "/widget/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
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
