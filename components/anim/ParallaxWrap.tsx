'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '@/hooks/useScrollReveal';

/**
 * Scrubbed vertical parallax for a block of content.
 *
 * Used around the photo carousel in the About section, where it gives the
 * foreground the small amount of extra travel that makes the section read as
 * having depth.
 *
 * THE CAROUSEL ITSELF IS NOT TOUCHED. This wraps it from the outside and
 * animates only its own wrapper div. components/PhotoCarousel.tsx is not
 * imported here, not read here, and not modified anywhere in this change --
 * it owns its own transforms and its own timers, and a second animation system
 * writing to the same element's transform is exactly how two working
 * animations become one broken one.
 *
 * The travel is deliberately small (-20px by default). Parallax on a portrait
 * that a reader is looking at directly becomes seasickness very quickly; the
 * effect should be felt rather than noticed.
 */
export default function ParallaxWrap({
  children,
  className,
  distance = -20,
}: {
  children: React.ReactNode;
  className?: string;
  /** Total vertical travel in px across the section's scroll. Negative = up. */
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const root = ref.current;
      if (!root) return;

      gsap.fromTo(
        root,
        { y: 0 },
        {
          y: distance,
          ease: 'none',
          scrollTrigger: {
            trigger: root,
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
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
