import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@career-os/core', '@career-os/db'],
  serverExternalPackages: ['pg'],
  // never bundle the vendored career-ops tree or private data into serverless functions
  outputFileTracingExcludes: { '*': ['../../upstream/**', '../../private/**', '../../supabase/**'] },
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default config;
