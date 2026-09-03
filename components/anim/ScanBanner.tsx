'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '@/hooks/useScrollReveal';

/**
 * The Work CTA banner: rises and stretches into place, then a single lime scan
 * line sweeps across it once.
 *
 * The sweep runs ONCE, on entry, and is never repeated. A looping scan line on
 * a call-to-action is a distraction that pulls the eye back every few seconds
 * while the reader is trying to read the rest of the page.
 *
 * The line is rendered here rather than in page.tsx because it only exists to
 * be animated -- with reduced motion on, it is never created, so a visitor who
 * asked for stillness does not get a stray gradient bar sitting across the
 * banner.
 *
 * `overflow-hidden` on the wrapper is what keeps the line inside the rounded
 * corners; without it the sweep visibly runs past the banner's edges.
 */
export default function ScanBanner({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const root = ref.current;
      if (!root) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top 85%',
          toggleActions: 'play none none none',
          once: true,
        },
      });

      tl.fromTo(
        root,
        { y: 50, scaleY: 0.96, opacity: 0, willChange: 'transform, opacity' },
        {
          y: 0,
          scaleY: 1,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          clearProps: 'willChange',
        },
      );

      const line = lineRef.current;
      if (line) {
        tl.fromTo(
          line,
          { xPercent: -100, opacity: 0 },
          {
            xPercent: 110,
            opacity: 1,
            duration: 0.8,
            ease: 'power2.inOut',
            // Fades itself out at the end of its own travel so the banner is
            // left clean, with no element parked off to the right holding a
            // compositor layer. `line` is captured, not re-read from the ref:
            // by the time this fires the component may have unmounted, and
            // gsap.set(null) is a warning nobody would ever see.
            onComplete: () => gsap.set(line, { opacity: 0 }),
          },
          // Starts as the banner is settling, not after it has stopped.
          '-=0.35',
        );
      }
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`relative overflow-hidden rounded-3xl ${className ?? ''}`}>
      {children}
      <span
        ref={lineRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-0"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(196,248,42,0.16), rgba(196,248,42,0.32), rgba(196,248,42,0.16), transparent)',
        }}
      />
    </div>
  );
}
