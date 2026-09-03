import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Archivo } from 'next/font/google';
import { preconnect } from 'react-dom';
import GSAPInit from '@/components/GSAPInit';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

/**
 * Display face for headings only. Geist alone reads as a Next.js starter to
 * anyone in the industry, which is the "generic template" look this redesign is
 * trying to escape. Archivo is the same grotesque skeleton at a heavier, wider
 * setting, so the pair reads as one voice at two volumes.
 * `axes` must not include 'wght' -- next/font always loads the weight axis for
 * a variable font and errors if it is listed.
 */
const archivo = Archivo({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
});

const SITE = 'https://farhanshahriar.online';
const NAME = 'Farhan Shahriar';
const TAGLINE = 'Full-Stack Developer';
const DESCRIPTION =
  'Farhan Shahriar builds complete products end to end — web applications, Android apps, ' +
  '3D browser games and the tools around them. Available for freelance projects.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${NAME} — ${TAGLINE}`,
    template: `%s — ${NAME}`,
  },
  description: DESCRIPTION,
  applicationName: `${NAME} Portfolio`,
  authors: [{ name: NAME, url: SITE }],
  creator: NAME,
  publisher: NAME,
  keywords: [
    'full stack developer',
    'freelance developer',
    'web developer',
    'react developer',
    'next.js developer',
    'android app developer',
    'game developer',
    'html5 games',
    'webgl games',
    '3d browser games',
    'Farhan Shahriar',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: `${NAME} — Portfolio`,
    title: `${NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  // No `icons` entry: Next serves app/favicon.ico automatically. Declaring
  // '/favicon.ico' here instead pointed at public/, where no such file exists,
  // and produced a 404 on every page load.
  //
  // Stops iOS Safari auto-linking stray numbers (scores, sizes) with its own styling.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0B0C0E',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolves DNS + TLS to the asset CDN during render instead of after the game
  // iframe mounts, which measurably shortens first play. Uses React 19's
  // resource API rather than a raw <head> element, which the App Router owns
  // and which causes a hydration mismatch when hand-written.
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseOrigin) preconnect(supabaseOrigin, { crossOrigin: 'anonymous' });

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased`}
      >
        {/* Registers the free GSAP plugins once for the whole app. Renders
            nothing. Must be inside <body>, and must be here rather than in a
            page, so a client navigation cannot land on a section whose
            ScrollTrigger has no plugin registered yet. */}
        <GSAPInit />

        {children}

        {/* Honeypot. See app/api/canary/route.ts for what happens on a hit and
            why nothing is logged. Hidden from sight, from the keyboard and from
            assistive technology, so the only visitor that can reach it is one
            following every href on the page indiscriminately. */}
        <a href="/api/canary" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1}>
          canary
        </a>
      </body>
    </html>
  );
}

/*
 * A NOTE ON THE CSP NONCE, because its absence from this file is deliberate.
 *
 * proxy.ts generates a nonce per request and sets it on BOTH the request
 * and the response Content-Security-Policy header, plus an `x-nonce` request
 * header. Next.js reads the nonce out of the request's CSP header itself and
 * stamps it onto every script tag it renders. Nothing in this layout renders an
 * inline <script>, so there is nothing here that needs the value.
 *
 * Calling headers() to read `x-nonce` anyway would opt the ENTIRE app out of
 * static rendering -- every route under this layout, permanently -- in exchange
 * for a variable nothing would use. If a future change does add an inline
 * script, read it then, in that component, not here.
 */
