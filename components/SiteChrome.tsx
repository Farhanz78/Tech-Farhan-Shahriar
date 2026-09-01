import Link from 'next/link';

export function SiteHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-ink/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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
    </header>
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
    <div className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-lime">{eyebrow}</p>
      <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h2>
      {sub && <p className="mt-3 max-w-2xl text-muted">{sub}</p>}
    </div>
  );
}
