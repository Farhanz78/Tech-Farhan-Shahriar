'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Maximize2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/utils/supabase/client';

/**
 * Full-screen game host.
 *
 * The old runner built a `blob:` URL from the stored HTML and iframed that with
 * `allow-scripts allow-same-origin`. A blob: URL inherits the origin of the page
 * that created it, so the frame ran as the portfolio itself: game code could
 * read `parent.localStorage` -- where the Supabase session and its refresh token
 * live -- and could strip the sandbox attribute off its own iframe.
 *
 * Now the document is served by /g/[id] as real text/html. `allow-same-origin`
 * is kept deliberately: it is what gives a game working localStorage and
 * IndexedDB for save data, without which most WebGL builds fail during startup
 * rather than merely losing progress. Set NEXT_PUBLIC_GAME_ORIGIN to a second
 * domain to put games on their own origin entirely, at which point "same origin"
 * means same as each other and never same as the portfolio.
 *
 * The previous build also injected a right-click/F12 blocker into every game.
 * That is gone: it blocked right-click, which many games use as an input; it was
 * appended after </html> where it could corrupt pages ending mid-tag; it
 * suppressed the game's own console output, hiding real load failures; and it
 * protected nothing, since browser menus, view-source and the network tab are
 * all untouched by it.
 */

interface GameFrameProps {
  id: string;
  src: string;
  title: string;
  thumbnail?: string | null;
}

const LOAD_TIMEOUT_MS = 40_000;

export default function GameFrame({ id, src, title, thumbnail }: GameFrameProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'timeout'>('loading');
  const [attempt, setAttempt] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.rpc('increment_play_count', { p_tool_id: id }).then(
      () => {},
      () => {},
    );
  }, [id]);

  useEffect(() => {
    if (status !== 'loading') return;
    const t = setTimeout(() => setStatus('timeout'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status, attempt]);

  const goFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const retry = () => {
    setStatus('loading');
    setAttempt((a) => a + 1);
  };

  return (
    <div ref={wrapRef} className="fixed inset-0 bg-ink overflow-hidden">
      <iframe
        key={attempt}
        src={src}
        className="w-full h-full border-0 block"
        title={title}
        onLoad={() => setStatus('ready')}
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-modals allow-downloads allow-popups"
        allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope; xr-spatial-tracking"
        referrerPolicy="no-referrer"
      />

      {status !== 'ready' && (
        <div className="absolute inset-0 bg-ink">
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-25"
            />
          )}

          <div className="relative h-full grid place-items-center px-6">
            {status === 'loading' ? (
              <div className="text-center max-w-sm">
                <h1 className="font-display text-2xl font-bold text-text">{title}</h1>
                {/* Indeterminate on purpose: the assets stream from the CDN
                    straight into the iframe, so this page genuinely cannot
                    measure their progress. A fake percentage that stalls at 90
                    is worse than an honest bar. */}
                <div className="mt-6 mx-auto h-1 w-56 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full w-1/3 rounded-full bg-lime animate-indeterminate" />
                </div>
                <p className="mt-5 text-sm text-muted">Loading…</p>
                <p className="mt-1.5 text-xs text-subtle">
                  Large game — the first load takes a moment. It&apos;s faster next time.
                </p>
              </div>
            ) : (
              <div className="text-center max-w-md" role="alert">
                <AlertTriangle className="w-8 h-8 text-amber mx-auto" aria-hidden />
                <h1 className="mt-4 text-xl font-bold text-text">This game didn&apos;t load</h1>
                <p className="mt-2 text-sm text-muted">
                  It may be too large for this connection, or something went wrong while
                  fetching it.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={retry}
                    className="px-5 py-2.5 rounded-xl bg-lime text-ink font-semibold hover:bg-lime-dim transition-colors"
                  >
                    Try again
                  </button>
                  <Link
                    href="/#games"
                    className="px-5 py-2.5 rounded-xl border border-hairline text-text hover:border-lime/40 transition-colors"
                  >
                    Back to games
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-3 opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Link
          href="/#games"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink/80 backdrop-blur-sm border border-hairline text-sm text-text hover:border-lime/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Back to games
        </Link>
        <button
          onClick={goFullscreen}
          aria-label="Toggle fullscreen"
          className="p-2 rounded-lg bg-ink/80 backdrop-blur-sm border border-hairline text-text hover:border-lime/40 transition-colors"
        >
          <Maximize2 className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
