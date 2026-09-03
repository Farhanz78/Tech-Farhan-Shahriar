import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Archivo } from 'next/font/google';
import { headers } from 'next/headers';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
   * THIS headers() CALL IS LOAD-BEARING. DO NOT REMOVE IT AS AN OPTIMISATION.
   *
   * It forces every route under this layout to be rendered per request, and
   * that is exactly what the CSP nonce requires.
   *
   * What happened without it: proxy.ts mints a fresh nonce for every request
   * and puts it in the Content-Security-Policy header. Next.js stamps that
   * nonce onto its <script> tags AT RENDER TIME. A statically prerendered page
   * is rendered at BUILD time, when no request and no nonce exist -- so its
   * scripts carry no matching nonce, and at runtime the browser blocks every
   * one of them against a policy that also says 'strict-dynamic' (which
   * disables the 'self' fallback).
   *
   * The result was /admin serving its HTML, blocking all fourteen of its
   * script chunks plus every inline bootstrap script, and spinning on its
   * loading indicator forever. /_not-found was in the same state. The pages
   * that already had `export const dynamic = 'force-dynamic'` -- /, /work,
   * /play/[id] -- were fine, which is precisely why the bug hid: the two
   * broken routes were the only statically rendered ones.
   *
   * An earlier version of this file argued that reading the nonce here bought
   * nothing because no component uses the value. That was wrong. The value is
   * not the point; the dynamic rendering it forces is.
   *
   * Cost: no static prerendering. On this site that is two routes, both of
   * which read from Supabase anyway.
   */
  await headers();

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
 * WHY THE NONCE IS NEVER READ INTO A VARIABLE HERE
 *
 * proxy.ts sets the per-request nonce on both the request and the response
 * Content-Security-Policy header. Next.js finds it on the REQUEST header by
 * itself and stamps it onto every script tag it emits -- no component has to
 * pass it anywhere. So `await headers()` above is called for its side effect
 * (forcing dynamic rendering, see the comment there), not for its return value.
 *
 * If a future change adds a hand-written inline <script>, read `x-nonce` in
 * that component and put it on the tag. Everything Next.js emits is already
 * handled.
 */
