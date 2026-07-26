import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpila os pacotes do monorepo (source-only, sem build próprio).
  transpilePackages: ['@hubpatients/core', '@hubpatients/supabase', '@hubpatients/ui-tokens'],
  experimental: {
    // Garante que o tracing de arquivos considere a raiz do monorepo.
    externalDir: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // As respostas da API podem conter metadados clínicos e tokens. Nunca
        // devem ser armazenadas por navegador, CDN ou proxy intermediário.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
