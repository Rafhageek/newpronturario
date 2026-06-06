import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpila os pacotes do monorepo (source-only, sem build próprio).
  transpilePackages: ['@vidalog/core', '@vidalog/supabase', '@vidalog/ui-tokens'],
  experimental: {
    // Garante que o tracing de arquivos considere a raiz do monorepo.
    externalDir: true,
  },
};

export default nextConfig;
