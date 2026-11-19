import type { NextConfig } from 'next';

const apiOrigin = new URL(process.env.API_URL ?? 'http://localhost:3333/api').origin;

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Imagens baixadas pela API: o navegador pede /media/... ao próprio site.
  async rewrites() {
    return [{ source: '/media/:path*', destination: `${apiOrigin}/media/:path*` }];
  },
};

export default config;
