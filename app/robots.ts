import type { MetadataRoute } from 'next';

const SITE = 'https://farhanshahriar.online';

/**
 * Served at /robots.txt.
 *
 * Everything public is crawlable. Three areas are not:
 *
 *  /admin   private, and behind auth anyway. Keeping it out of the index means
 *           a login form never shows up in a search result for this name.
 *  /api/    no page content. /api/canary is the honeypot that marks
 *           indiscriminate crawlers, so inviting a well-behaved crawler into it
 *           would defeat the point.
 *  /g/      raw uploaded game bundles served as third-party HTML. Indexing them
 *           would put someone else's markup on this domain in search results,
 *           competing with the real /play/[id] pages that wrap them.
 *
 * Note this file is advisory, not access control. The 403 for scraper
 * User-Agents lives in proxy.ts; this only tells honest crawlers what to skip.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/g/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
