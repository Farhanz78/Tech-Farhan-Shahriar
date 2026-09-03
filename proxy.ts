import { NextResponse, type NextRequest } from 'next/server';

/**
 * =============================================================================
 *  EDGE PROXY: bot blocking, honeypot, and a per-request CSP nonce.
 * =============================================================================
 *
 * THIS FILE IS THE OLD `middleware.ts`. Next.js 16 renamed the convention: the
 * file is now `proxy.ts` and the export is `proxy` instead of `middleware`.
 * Building with the old name still worked but printed a deprecation warning,
 * and a deprecated convention in a project whose owner cannot debug is a
 * failure scheduled for whenever Next.js is next upgraded. Behaviour, `config`
 * and the matcher are unchanged by the rename.
 *
 * Runs on every request that the `matcher` at the bottom lets through. Three
 * jobs, in order of how cheaply they can reject a request.
 *
 * READ THE DEVIATIONS SECTION BEFORE CHANGING THE POLICY. Several directives
 * here differ from the obvious "maximum strictness" version, and every one of
 * those differences is load-bearing -- tightening it back breaks a working
 * feature of this site, usually silently.
 */

/* ---------------------------------------------------------------- 1. BOTS */

/**
 * Mirroring and scraping tools, matched case-insensitively against the
 * User-Agent.
 *
 * This stops the lazy half of the problem: `wget -r`, HTTrack, a copied
 * requests script. It does NOT stop anyone who sets a browser User-Agent, and
 * it is not meant to -- User-Agent is client-controlled and always will be.
 * Cloudflare's Bot Fight Mode and the WAF rules are the layer that deals with
 * a determined scraper; this is the free 403 for the ones that announce
 * themselves.
 *
 * "curl" is matched as a whole word. A bare `.includes('curl')` also matches
 * any UA containing the substring, and there are real browser extensions that
 * put things like "SecurlyBrowser" in there.
 */
const BLOCKED_AGENTS: RegExp[] = [
  /httrack/i,
  /\bwget\b/i,
  /\bcurl\b/i,
  /libwww-perl/i,
  /python-requests/i,
  /python-urllib/i,
  /\bscrapy\b/i,
  /aiohttp/i,
  /\bnikto\b/i,
  /sqlmap/i,
  /\bnmap\b/i,
  /masscan/i,
  /zgrab/i,
];

function isBlockedAgent(ua: string): boolean {
  if (!ua) return false;
  return BLOCKED_AGENTS.some((re) => re.test(ua));
}

/* ------------------------------------------------------------- 2. HONEYPOT */

/**
 * A path no human and no legitimate crawler ever requests. It is linked once,
 * invisibly, from the site footer (see app/layout.tsx), so the only way to
 * arrive here is to have followed every href on the page indiscriminately.
 *
 * The response is a flat 403. Nothing is logged to a database and no IP is
 * stored: this middleware runs on the edge with no session and no client, and
 * an IP-ban list that lives in edge memory would be wiped on every cold start
 * while quietly holding personal data. Banning is Cloudflare's job -- the
 * canary hit is what its rules can be pointed at.
 */
const HONEYPOT_PATH = '/api/canary';

/* ------------------------------------------------------------------ 3. CSP */

const isDev = process.env.NODE_ENV === 'development';

/**
 * Routes that must NOT receive the strict CSP.
 *
 * /g/[id] serves uploaded game documents. Those are arbitrary third-party
 * bundles -- Unity and Emscripten output, engine templates, ad SDKs loaded from
 * networks that were not known when this file was written. A CSP tight enough
 * to be worth having would break them silently and intermittently, which is the
 * single worst failure mode for a site whose owner cannot debug it. The games
 * are already isolated by being in an iframe and, if NEXT_PUBLIC_GAME_ORIGIN is
 * set, on a separate origin.
 *
 * This is the same reasoning the previous next.config.ts recorded for not
 * shipping a CSP at all. The difference now is that the reasoning is scoped to
 * the game route instead of applied to the whole site.
 */
function isGameDocument(pathname: string): boolean {
  return pathname.startsWith('/g/');
}

function buildCsp(nonce: string): string {
  const directives: string[] = [
    `default-src 'self'`,

    // 'strict-dynamic' means the nonce is what grants trust, and any script a
    // trusted script inserts is trusted too. Host allowlists in this directive
    // are IGNORED by browsers that understand strict-dynamic -- which is why
    // challenges.cloudflare.com is not listed here. Turnstile works because
    // @marsidev/react-turnstile injects its <script> from the already-trusted
    // React bundle. Listing the host as well is harmless and helps very old
    // browsers that ignore strict-dynamic instead.
    //
    // 'unsafe-eval' in development only: Next.js's hot reloader evaluates
    // modules with eval, and without it the dev server at :3007 shows a blank
    // page and a console full of CSP violations.
    [
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com`,
      isDev ? `'unsafe-eval'` : '',
    ]
      .filter(Boolean)
      .join(' '),

    // DEVIATION FROM THE BRIEF -- read before "fixing" this.
    // The brief asked for `style-src 'self' 'nonce-{nonce}' 'unsafe-inline'`.
    // In CSP Level 3, 'unsafe-inline' is IGNORED whenever a nonce or hash is
    // present in the same directive. So that policy is really
    // `style-src 'self' 'nonce-...'`, and a nonce cannot authorise a style
    // ATTRIBUTE -- nonces only apply to <style> elements. This site
    // server-renders inline style attributes (the service-card light sweep in
    // app/page.tsx, the parallax grid, the scan line), and React writes more of
    // them at runtime. With a nonce in this directive those all get blocked.
    //
    // Styles are also not the XSS vector that scripts are: the dangerous
    // primitives (url(javascript:), expression()) are gone from every engine
    // this site supports. Keeping 'unsafe-inline' for styles while scripts stay
    // nonce-locked is the standard Next.js posture and is what every official
    // Next.js CSP example does.
    `style-src 'self' 'unsafe-inline'`,

    `img-src 'self' blob: data: https:`,
    `font-src 'self' https: data:`,

    // Supabase for data + realtime; Cloudflare for Turnstile verification.
    // ws:/wss: to localhost in development is Next.js's hot-reload socket.
    [
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://api.web3forms.com`,
      isDev ? 'ws://localhost:* http://localhost:*' : '',
    ]
      .filter(Boolean)
      .join(' '),

    // DEVIATION: 'self' is required here and its absence would break the site.
    // /play/[id] renders the game inside an iframe pointing at /g/[id] on this
    // same origin. The brief listed only challenges.cloudflare.com, which would
    // have made every game on the site fail to load with an empty frame.
    `frame-src 'self' https://challenges.cloudflare.com`,

    // DEVIATION: 'self', not 'none', for exactly the same reason. frame-ancestors
    // 'none' forbids ALL framing including same-origin, so /g/[id] would refuse
    // to be embedded by /play/[id] and every game would show a blank box.
    // 'self' still blocks every other site on the internet from framing this
    // one, which is the clickjacking protection that matters.
    `frame-ancestors 'self'`,

    // fflate's unzip() runs in a Web Worker created from a blob: URL. The admin
    // panel's .zip upload path depends on it; without blob: here, uploading a
    // game silently fails at the "reading archive" step.
    `worker-src 'self' blob:`,
    `child-src 'self' blob:`,

    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `manifest-src 'self'`,
  ];

  // upgrade-insecure-requests would rewrite http://localhost to https:// during
  // development and break every asset. Production only.
  if (!isDev) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

/* ----------------------------------------------------------------- PROXY */

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isBlockedAgent(request.headers.get('user-agent') ?? '')) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (pathname === HONEYPOT_PATH) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Game documents pass through untouched. See isGameDocument().
  if (isGameDocument(pathname)) return NextResponse.next();

  // crypto.randomUUID() is available in the edge runtime. Base64 of a UUID is
  // 128 bits of randomness per request, which is well past what CSP needs, and
  // it contains no characters that need escaping inside a CSP header.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  // Next.js reads the nonce out of the Content-Security-Policy header on the
  // REQUEST and stamps it onto every script tag it renders. Setting it only on
  // the response is the classic mistake: the policy is enforced, but Next's own
  // bootstrap scripts have no nonce and the page never hydrates.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);

  return response;
}

/**
 * Static assets and the image optimiser are skipped: they are not documents, so
 * a CSP on them does nothing, and running the proxy on every image is pure
 * latency. Everything else -- pages, route handlers, /admin, /api -- goes
 * through.
 *
 * favicon.ico and the public/ files are matched by the negative lookahead on
 * file extensions rather than by name, so adding a new static file later does
 * not require editing this line.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|txt|xml|webmanifest|woff|woff2|ttf|otf|mp4|webm|mp3|glb|gltf)$).*)',
  ],
};
