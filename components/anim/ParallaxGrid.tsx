'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '@/hooks/useScrollReveal';

/**
 * Faint lime grid that drifts behind the Services section at 0.6x scroll speed.
 *
 * WHY IT IS DRAWN WITH A GRADIENT AND NOT AN SVG OR AN IMAGE
 * Two repeating-linear-gradients cost nothing to download, scale to any
 * viewport, and are a single compositor layer. An SVG of the same grid is a
 * DOM node per line.
 *
 * It is `aria-hidden` and `pointer-events-none`: decoration only, invisible to
 * assistive technology, and it can never intercept a click meant for a card.
 *
 * The layer is taller than its container (top/bottom -20%) because it moves.
 * Without the overhang, translating it upward would drag its bottom edge into
 * view and show a hard line where the grid stops.
 *
 * 3% opacity is the brief's number. It reads as texture at 100% browser zoom on
 * an OLED phone and disappears entirely on a bright office monitor, which is
 * the correct behaviour for a background that must never compete with the
 * cards in front of it.
 */
export default function ParallaxGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const root = ref.current;
      if (!root) return;

      const section = root.parentElement ?? root;

      gsap.fromTo(
        root,
        { yPercent: -6 },
        {
          // 0.6x scroll speed: the grid travels less than the section does, so
          // it sits visibly behind the cards rather than moving with them.
          yPercent: 6,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-[20%] -bottom-[20%] -z-10"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to right, rgba(196,248,42,0.03) 0 1px, transparent 1px 88px),' +
          'repeating-linear-gradient(to bottom, rgba(196,248,42,0.03) 0 1px, transparent 1px 88px)',
        // Fades the grid out at the top and bottom edges so it never ends on a
        // visible seam against the flat page background.
        maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
      }}
    />
  );
}
