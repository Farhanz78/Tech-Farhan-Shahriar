'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 3D stacked photo carousel.
 *
 * All photos occupy the same absolutely-positioned slot; only their transform
 * differs. The card at the active index sits square-on and in focus, its two
 * neighbours are pushed aside, tilted, scaled down, dimmed and blurred, and
 * everything further away is parked off-stage at zero opacity.
 *
 * Animating transform/opacity/filter on a fixed stack (rather than moving a
 * long track) means the work stays constant no matter how many photos there
 * are, and each card springs to its new slot independently — which is what
 * gives the rotation its depth.
 */

type Slot = {
  x: string;
  rotate: number;
  scale: number;
  opacity: number;
  filter: string;
  zIndex: number;
};

const CENTER: Slot = {
  x: '0%',
  rotate: 0,
  scale: 1,
  opacity: 1,
  filter: 'blur(0px)',
  zIndex: 20,
};

const LEFT: Slot = {
  x: '-52%',
  rotate: -8,
  scale: 0.9,
  opacity: 0.5,
  filter: 'blur(1px)',
  zIndex: 10,
};

const RIGHT: Slot = {
  x: '52%',
  rotate: 8,
  scale: 0.9,
  opacity: 0.5,
  filter: 'blur(1px)',
  zIndex: 10,
};

/** Off-stage: still mounted so the spring has somewhere to travel from. */
const hidden = (side: -1 | 1): Slot => ({
  x: `${side * 78}%`,
  rotate: side * 12,
  scale: 0.8,
  opacity: 0,
  filter: 'blur(3px)',
  zIndex: 0,
});

export default function PhotoCarousel({ photos, alt }: { photos: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const count = photos.length;
  const go = useCallback((n: number) => setActive(((n % count) + count) % count), [count]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(active - 1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(active + 1);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [active, go, count]);

  if (!count) return null;
  const single = count === 1;

  /** Shortest signed distance from active to idx, so the stack wraps around. */
  function offsetOf(idx: number) {
    let d = idx - active;
    if (d > count / 2) d -= count;
    if (d < -count / 2) d += count;
    return d;
  }

  function slotFor(d: number): Slot {
    if (d === 0) return CENTER;
    if (d === -1) return LEFT;
    if (d === 1) return RIGHT;
    return hidden(d < 0 ? -1 : 1);
  }

  return (
    <div
      ref={rootRef}
      tabIndex={single ? -1 : 0}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${alt} — photos`}
      className="flex items-center justify-center gap-2 outline-none sm:gap-5"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) go(dx < 0 ? active + 1 : active - 1);
        touchX.current = null;
      }}
    >
      {!single && <Arrow dir="left" onClick={() => go(active - 1)} />}

      {/* overflow-x-clip, not overflow-hidden: the flanking cards are pushed
          ±52% of their own width and would otherwise widen the page and add a
          horizontal scrollbar. `clip` on one axis leaves the other visible, so
          the card shadows are not cut off vertically. */}
      <div className="min-w-0 flex-1 overflow-x-clip" style={{ perspective: 1200 }}>
        {/* Fixed-height stage. The cards are absolute inside it, so the section
            below never shifts as they move. */}
        <div className="relative mx-auto h-[340px] w-full max-w-[240px] sm:h-[400px] sm:max-w-[290px]">
          {photos.map((src, idx) => {
            const d = offsetOf(idx);
            const slot = slotFor(d);
            const isActive = d === 0;

            return (
              <motion.div
                key={src + idx}
                className="absolute inset-0"
                initial={false}
                animate={slot}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }
                }
                style={{ transformStyle: 'preserve-3d' }}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                <div
                  className={`h-full w-full overflow-hidden rounded-2xl border bg-surface ${
                    isActive
                      ? 'border-hairline-strong shadow-[0_28px_60px_-24px_rgba(0,0,0,0.95)]'
                      : 'border-hairline'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={isActive ? `${alt} — photo ${idx + 1} of ${count}` : ''}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {!single && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {photos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => go(idx)}
                aria-label={`Go to photo ${idx + 1}`}
                aria-current={idx === active}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === active ? 'w-6 bg-lime' : 'w-1.5 bg-hairline-strong hover:bg-muted'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {!single && <Arrow dir="right" onClick={() => go(active + 1)} />}
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Previous photo' : 'Next photo'}
      className="z-30 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-surface/90 text-muted backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:border-lime/60 hover:text-lime active:scale-95 sm:h-12 sm:w-12 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
