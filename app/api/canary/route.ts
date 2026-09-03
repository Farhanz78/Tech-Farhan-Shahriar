/**
 * Honeypot endpoint.
 *
 * Nothing legitimate ever requests this path. It is linked once from the site
 * footer inside a hidden, aria-hidden, tabindex="-1" anchor -- invisible to a
 * reader, unreachable by keyboard, ignored by a screen reader, and skipped by
 * any crawler that respects the rules. What is left is software that follows
 * every href it can find.
 *
 * proxy.ts already answers this path with a 403 before routing gets here.
 * This route exists as the backstop: if the proxy matcher is ever narrowed
 * and stops covering /api, the trap must not quietly turn into a 404 that looks
 * like an ordinary missing page.
 *
 * No logging, no IP list, no database write. An edge function has no durable
 * storage, an in-memory ban list is erased on the next cold start, and storing
 * visitor IPs would be collecting personal data to no purpose. Blocking is
 * Cloudflare's job; this endpoint's job is to be a thing worth blocking.
 */

export const dynamic = 'force-dynamic';

function forbidden() {
  return new Response('Forbidden', {
    status: 403,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export const GET = forbidden;
export const HEAD = forbidden;
export const POST = forbidden;
export const PUT = forbidden;
export const PATCH = forbidden;
export const DELETE = forbidden;
export const OPTIONS = forbidden;
