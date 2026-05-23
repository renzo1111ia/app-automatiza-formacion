import type { NextConfig } from "next";

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

export default nextConfig;
