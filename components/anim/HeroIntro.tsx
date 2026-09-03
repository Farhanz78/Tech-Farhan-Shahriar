'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion, guaranteeVisible } from '@/hooks/useScrollReveal';

/**
 * The hero's entrance.
 *
 * Replaces the `animate-rise` CSS class that used to sit on the hero text
 * wrapper. That class animated the whole block as one object; this animates the
 * six parts on their own delays, so the eye is led down the block -- pill,
 * name, tagline, bio, buttons, stats -- rather than being handed all of it at
 * once.
 *
 * HOW THE PARTS ARE ADDRESSED
 * Children opt in with `data-hero="pill"` and so on. A selector, not props,
 * because the markup lives in a Server Component: page.tsx cannot pass a ref
 * across the server/client boundary, but it can put an attribute on a div.
 *
 * TIMINGS come from the brief. Each part is its own tween rather than one
 * timeline with position parameters, because the delays overlap deliberately
 * (the h1 starts before the pill has finished) and independent tweens express
 * that without arithmetic.
 *
 * A missing selector is not an error. If a section is edited later and the
 * stats disappear, the remaining five still animate; gsap.utils.toArray simply
 * returns an empty array and the tween for that part is skipped.
 */

interface Part {
  sel: string;
  y: number;
  delay: number;
  duration: number;
  stagger?: number;
}

const PARTS: Part[] = [
  { sel: '[data-hero="pill"]', y: 20, delay: 0.1, duration: 0.6 },
  { sel: '[data-hero="h1"]', y: 30, delay: 0.25, duration: 0.8 },
  { sel: '[data-hero="tagline"]', y: 30, delay: 0.4, duration: 0.7 },
  { sel: '[data-hero="bio"]', y: 20, delay: 0.55, duration: 0.7 },
  { sel: '[data-hero="buttons"]', y: 20, delay: 0.7, duration: 0.6 },
  { sel: '[data-hero="stat"]', y: 20, delay: 0.85, duration: 0.6, stagger: 0.1 },
];

export default function HeroIntro({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Reduced motion: nothing is built, and nothing is ever set to opacity 0,
      // so the hero is simply there on load.
      if (prefersReducedMotion()) return;

      const root = ref.current;
      if (!root) return;

      const all: Element[] = [];

      for (const part of PARTS) {
        const nodes = gsap.utils.toArray<Element>(part.sel, root);
        if (nodes.length === 0) continue;
        all.push(...nodes);

        gsap.fromTo(
          nodes,
          { y: part.y, opacity: 0, willChange: 'transform, opacity' },
          {
            y: 0,
            opacity: 1,
            duration: part.duration,
            delay: part.delay,
            stagger: part.stagger ?? 0,
            ease: 'power3.out',
            clearProps: 'willChange',
          },
        );
      }

      // The hero is the single most important thing on the site to never lose.
      // It was caught at opacity 0.005 with the tab backgrounded during load --
      // built, from-state applied, then rAF suspended and the tween never
      // advanced. This wall-clock net finishes the job if that happens.
      // 1.45s is the longest part (0.85 delay + 0.6 duration); the helper adds
      // its own margin on top.
      if (all.length > 0) return guaranteeVisible(all, 2200);
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
