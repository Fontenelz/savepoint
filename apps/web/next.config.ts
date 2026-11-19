import type { NextConfig } from 'next';

const apiOrigin = new URL(process.env.API_URL ?? 'http://localhost:3333/api').origin;

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Acesso ao servidor de dev por outros aparelhos da rede (ex.: celular): DEV_ORIGINS=10.10.40.5
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [],
  // Imagens baixadas pela API: o navegador pede /media/... ao próprio site.
  async rewrites() {
    return [{ source: '/media/:path*', destination: `${apiOrigin}/media/:path*` }];
  },
};

export default config;
