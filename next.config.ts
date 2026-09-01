import type { NextConfig } from 'next';

/**
 * Security headers.
 *
 * Deliberately NOT a full Content-Security-Policy. Games are arbitrary
 * third-party-ish bundles (Unity/Emscripten output, engine templates) whose
 * network and script behaviour is not knowable in advance; a CSP tight enough
 * to be worth having would break games silently and intermittently, and
 * diagnosing that is not something the site owner can be expected to do. The
 * headers below are the ones that carry real value with no such risk.
 */
const baseHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything except the game documents, which are meant to be framed.
        source: '/((?!g/).*)',
        headers: baseHeaders,
      },
      {
        // The admin panel must never be framed by anyone.
        source: '/admin',
        headers: [...baseHeaders, { key: 'X-Frame-Options', value: 'DENY' }],
      },
      {
        source: '/g/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
