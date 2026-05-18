import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/dashboardadmin/:path*',
        destination: '/dashboard/:path*',
      },
    ];
  },
};

export default nextConfig;
