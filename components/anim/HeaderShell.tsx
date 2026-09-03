'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion, guaranteeVisible } from '@/hooks/useScrollReveal';

/**
 * The sticky header's shell: entrance animation plus the compact-on-scroll
 * state.
 *
 * TWO DIFFERENT MECHANISMS ON PURPOSE.
 *
 * The entrance is GSAP, because it is a one-off piece of choreography timed
 * against the hero.
 *
 * The compact state is a CSS class toggle, and the padding change is a CSS
 * transition -- not a GSAP tween. A tween would have to own the header's
 * padding for the life of the page and fight the stylesheet for it; a class
 * lets the design stay in globals.css where it can be read and changed, and it
 * costs one class write per crossing instead of a tween per scroll event.
 *
 * The class toggle is NOT gated on reduced motion. It is a state change, not
 * an animation, and globals.css already collapses every transition to 0.01ms
 * under prefers-reduced-motion -- so a visitor who asked for stillness gets the
 * compact header instantly instead of not at all.
 */
export default function HeaderShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;

      let cancelNet: (() => void) | undefined;

      if (!prefersReducedMotion()) {
        gsap.fromTo(
          root,
          { y: -60, opacity: 0 },
          { y: 0, opacity: 1, delay: 0.5, duration: 0.5, ease: 'power3.out' },
        );
        // Same wall-clock net as the hero. A header stuck at opacity 0 takes the
        // whole navigation with it, on every page that renders one.
        cancelNet = guaranteeVisible([root], 1600);
      }

      // start: 80px down the page. Anything smaller and the header flickers
      // between states during the rubber-band scroll on iOS.
      ScrollTrigger.create({
        start: 'top -80',
        onToggle: (self) => root.classList.toggle('is-scrolled', self.isActive),
      });

      return () => cancelNet?.();
    },
    { scope: ref },
  );

  return (
    <header ref={ref} className={className}>
      {children}
    </header>
  );
}
