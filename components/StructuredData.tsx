/**
 * JSON-LD structured data. Renders nothing visible — it is a data block search
 * engines read to understand *who* this site is about, rather than inferring it
 * from prose.
 *
 * Why it earns its place:
 *  - Person tells Google this domain is the authoritative entity for the name,
 *    which is what makes a Knowledge Panel and sitelinks possible later.
 *  - knowsAbout is how a "hire a Three.js developer" style query connects to
 *    this page without stuffing those words into visible copy.
 *  - WebSite carries the site name used in the blue breadcrumb line above a
 *    search result.
 *
 * Every claim here must be true and checkable. `sameAs` in particular: a URL
 * that 404s is worse than no sameAs at all, because it weakens the entity link
 * it was meant to prove. github.com/Farhanz78 was verified 200 before adding.
 *
 * `type="application/ld+json"` is not executable JavaScript, but it is still a
 * <script> element, so it takes the CSP nonce like any other. In practice
 * browsers treat it as a data block and do not enforce script-src on it, but
 * the nonce costs one attribute and removes the question entirely.
 *
 * suppressHydrationWarning is required BECAUSE of that nonce, and is not
 * papering over a real bug: after parsing, browsers blank the nonce *attribute*
 * (keeping the value only on the .nonce IDL property) so that scripts cannot
 * read each other's nonces out of the DOM. React therefore compares the
 * server's `nonce="abc"` against the client's `nonce=""` and reports a
 * mismatch. The server HTML is kept, so the block is correct either way.
 */
const SITE = 'https://farhanshahriar.online';
const NAME = 'Farhan Shahriar';

export default function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${SITE}/#person`,
        name: NAME,
        url: SITE,
        image: `${SITE}/og.jpg`,
        jobTitle: 'Full-Stack Developer',
        description:
          'Full-stack developer building web applications, Android apps and ' +
          '3D browser games end to end — frontend, backend, database and deployment.',
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'BD',
        },
        // Only the country is asserted. A city is not claimed anywhere here
        // because none has been confirmed, and a wrong locality is worse than
        // no locality: it competes for the wrong local results.
        homeLocation: {
          '@type': 'Country',
          name: 'Bangladesh',
        },
        // hasOccupation is what lets a search engine connect "full-stack
        // developer" + "Bangladesh" as one fact rather than two loose words.
        hasOccupation: {
          '@type': 'Occupation',
          name: 'Full-Stack Developer',
          occupationLocation: { '@type': 'Country', name: 'Bangladesh' },
          skills:
            'Next.js, React, TypeScript, Three.js, WebGL, GSAP, Tailwind CSS, ' +
            'Supabase, PostgreSQL, Android development',
        },
        sameAs: ['https://github.com/Farhanz78'],
        knowsAbout: [
          'Full-stack web development',
          'Next.js',
          'React',
          'TypeScript',
          'Three.js',
          'WebGL',
          'GSAP',
          'Tailwind CSS',
          'Supabase',
          'PostgreSQL',
          'Android app development',
          '3D browser games',
          'HTML5 game development',
          'Web performance optimisation',
          'Web application security',
          // Location-qualified phrases. Deliberately specific: "web developer"
          // alone is contested by Upwork, Fiverr and LinkedIn and is not
          // winnable; "Three.js developer Bangladesh" is.
          'Full-stack development in Bangladesh',
          'Freelance web developer in Bangladesh',
          'Three.js developer in Bangladesh',
          'Next.js developer in Bangladesh',
          'Android app development in Bangladesh',
        ],
        knowsLanguage: ['en', 'bn'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: SITE,
        name: `${NAME} — Portfolio`,
        description:
          'Portfolio of Farhan Shahriar — web applications, Android apps, 3D browser ' +
          'games and developer tools, most of them playable in the browser.',
        inLanguage: 'en',
        publisher: { '@id': `${SITE}/#person` },
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${SITE}/#services`,
        name: `${NAME} — Freelance Development`,
        url: SITE,
        image: `${SITE}/og.jpg`,
        description:
          'Freelance development of websites, web applications, Android apps and ' +
          '3D browser experiences, delivered end to end with source code.',
        provider: { '@id': `${SITE}/#person` },
        areaServed: [
          { '@type': 'Country', name: 'Bangladesh' },
          { '@type': 'Place', name: 'Worldwide' },
        ],
        availableLanguage: ['English', 'Bengali'],
        // An explicit catalogue beats a keyword list: each entry is a thing a
        // buyer can search for and a thing that has actually been shipped.
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Development services',
          itemListElement: [
            'Full-stack web application development',
            '3D and WebGL website development',
            'Next.js and React website development',
            'Android app development',
            'HTML5 and browser game development',
          ].map((name) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name },
          })),
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Content is a literal object defined above, never user input, so there is
      // nothing here for a visitor to inject into.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
