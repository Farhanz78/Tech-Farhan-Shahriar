import type { NextConfig } from 'next';
import { assertNoPublicSecrets, assertRequiredEnv } from './lib/env';

// Runs on `next dev`, `next build` and in CI -- before anything reaches a
// visitor. assertNoPublicSecrets throws, which fails the build on purpose: a
// service-role key on a NEXT_PUBLIC_ variable would be compiled into the
// browser bundle and handed to everyone who loads the site.
assertNoPublicSecrets();
assertRequiredEnv();

/**
 * =============================================================================
 *  SECURITY HEADERS
 * =============================================================================
 *
 * The Content-Security-Policy is NOT here -- it needs a fresh nonce per request,
 * which a static config cannot produce. It lives in proxy.ts. Everything in
 * this file is a constant that is the same on every response.
 *
 * The brief asked for these to go in `next.config.mjs`. This project's config is
 * TypeScript (`next.config.ts`, supported natively since Next 15), so they went
 * here instead. Creating a second `.mjs` config alongside it would mean two
 * config files and Next.js silently loading only one of them.
 *
 * The note this file used to carry -- that a CSP would break arbitrary uploaded
 * game bundles -- was correct and still applies. It has moved to proxy.ts,
 * where /g/ is excluded from the policy for exactly that reason.
 */

/** Applied to every route. */
const baseHeaders = [
  {
    // Two years, subdomains included, eligible for the browser preload list.
    // Vercel serves HTTPS only, so there is no HTTP origin left to break.
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    // DEVIATION FROM THE BRIEF, and the reason is the game player.
    //
    // The brief asked for X-Frame-Options: DENY on all routes. DENY forbids ALL
    // framing, including same-origin framing -- and /play/[id] works by putting
    // /g/[id] in an iframe. DENY everywhere means every game on this site
    // renders as an empty black box, with the reason visible only in the
    // browser console.
    //
    // SAMEORIGIN blocks every other site on the internet from framing this one,
    // which is the clickjacking protection X-Frame-Options exists to provide,
    // while leaving the site's own iframe working. /admin keeps DENY below.
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
];

const nextConfig: NextConfig = {
  // Removes the `X-Powered-By: Next.js` response header. It tells an attacker
  // which framework and therefore which CVE list to work through, and it is of
  // no use to anyone else.
  poweredByHeader: false,

  // No source maps in the production bundle. Without this the entire unminified
  // client source -- component names, comments, internal logic -- is
  // downloadable from the live site.
  productionBrowserSourceMaps: false,

  async headers() {
    return [
      {
        // Everything except the game documents.
        source: '/((?!g/).*)',
        headers: [
          ...baseHeaders,
          // Cross-Origin-Resource-Policy is deliberately NOT applied to /g/.
          // Game bundles pull their assets from the Supabase Storage CDN, and
          // locking the game document's CORP down buys nothing here while
          // risking a failure that is very hard to diagnose from a screenshot.
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      {
        // The admin panel must never be framed by anyone, including itself.
        // A later entry for the same path wins in Next.js, so this overrides
        // the SAMEORIGIN above.
        source: '/admin',
        headers: [...baseHeaders, { key: 'X-Frame-Options', value: 'DENY' }],
      },
      {
        // Game documents: no CSP (see proxy.ts), no CORP, and no referrer
        // leaked to whatever ad or analytics host the bundle talks to. Kept
        // minimal on purpose -- these are arbitrary uploaded bundles.
        source: '/g/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
