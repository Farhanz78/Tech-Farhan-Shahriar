import Link from 'next/link';
import HeaderShell from '@/components/anim/HeaderShell';

/**
 * The header's markup stays here, in a Server Component. Only the <header>
 * element itself becomes a client component (HeaderShell), because only the
 * element needs a ref -- for the entrance tween and for the compact-on-scroll
 * class.
 *
 * `site-header` owns the height, which shrinks once `is-scrolled` is added.
 * Both rules live in globals.css under "Sticky header". The nav is `h-full`
 * rather than a fixed `h-16` so its contents follow the header as it compacts.
 */
export function SiteHeader({ name }: { name: string }) {
  return (
    <HeaderShell className="site-header sticky top-0 z-50 border-b border-hairline bg-ink/80 backdrop-blur-md">
      <nav className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {name.split(' ')[0]}
          <span className="text-lime">.</span>
        </Link>
        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/#about" className="hidden px-3 py-2 text-muted transition-colors hover:text-text sm:block">
            About
          </Link>
          <Link href="/#services" className="hidden px-3 py-2 text-muted transition-colors hover:text-text sm:block">
            Services
          </Link>
          <Link href="/work" className="px-3 py-2 text-muted transition-colors hover:text-text">
            Work
          </Link>
          <Link
            href="/#contact"
            className="ml-1 rounded-lg bg-lime px-4 py-2 font-semibold text-ink transition-colors hover:bg-lime-dim"
          >
            Hire me
          </Link>
        </div>
      </nav>
    </HeaderShell>
  );
}

export function SiteFooter({ name }: { name: string }) {
  return (
    <footer className="mt-8 border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-subtle sm:flex-row">
        <p>
          © {new Date().getFullYear()} {name}
        </p>
        <div className="flex gap-5">
          <Link href="/work" className="transition-colors hover:text-text">
            Work
          </Link>
          <Link href="/#contact" className="transition-colors hover:text-text">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-lime">{eyebrow}</p>
      <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h2>
      {sub && <p className="mt-3 max-w-2xl text-muted">{sub}</p>}
    </div>
  );
}
