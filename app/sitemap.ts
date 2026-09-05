import type { MetadataRoute } from 'next';

const SITE = 'https://farhanshahriar.online';

/**
 * Served at /sitemap.xml.
 *
 * ONLY the two indexable pages are listed, and that is deliberate.
 *
 * An earlier version of this file also listed every /play/[id] project page.
 * That was a bug: app/play/[id]/page.tsx sets `robots: { index: false }` on
 * purpose, and a sitemap is a request to index. Submitting a noindex URL is a
 * contradiction Search Console reports as "Submitted URL marked noindex", and
 * repeated across every project it makes the whole sitemap look unreliable.
 *
 * The noindex on those pages is the right call and was left alone: a /play page
 * is a full-screen game iframe with almost no readable text, which is textbook
 * thin content. Everything worth indexing about a project — its title, its
 * description, its tech tags — already lives as real HTML on /work, which is
 * indexable and is what should rank.
 *
 * So: if a project page is ever given real written content of its own, drop the
 * noindex there FIRST, then add it back here. Not the other way round.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE}/work`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];
}
