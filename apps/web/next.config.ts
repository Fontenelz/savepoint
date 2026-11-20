import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // O deploy do Compute monta o serviço a partir do standalone do Next.
  output: 'standalone',
  // Os pacotes do Composer rodam do node_modules (a declaração do serviço é ESM puro).
  serverExternalPackages: ['@prisma/composer', '@prisma/composer-prisma-cloud'],
  // Acesso ao servidor de dev por outros aparelhos da rede (ex.: celular): DEV_ORIGINS=10.10.40.5
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [],
};

export default config;
