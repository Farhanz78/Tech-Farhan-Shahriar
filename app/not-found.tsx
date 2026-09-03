import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink text-text grid place-items-center px-6">
      <div className="text-center max-w-md">
        <p className="font-display text-7xl md:text-8xl font-extrabold text-lime/20 leading-none">
          404
        </p>
        <h1 className="mt-6 text-2xl md:text-3xl font-bold">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-muted">
          The link may be old, or the project may have been taken down.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            href="/work"
            className="px-5 py-2.5 rounded-xl bg-lime text-ink font-semibold hover:bg-lime-dim transition-colors"
          >
            Browse games
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-hairline hover:border-lime/40 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
