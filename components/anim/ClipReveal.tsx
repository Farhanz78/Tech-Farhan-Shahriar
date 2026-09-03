'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '@/hooks/useScrollReveal';

/**
 * The Process box: the panel wipes upward into view, then its steps stagger in.
 *
 * clip-path rather than height or scale, because clipping does not reflow. The
 * box occupies its final size in layout from the first frame, so nothing below
 * it on the page moves while the reveal plays -- which matters here, since the
 * Work CTA sits directly underneath and is being revealed at almost the same
 * moment.
 *
 * The two halves share one timeline so the steps can be scheduled relative to
 * the wipe ("-=0.2") instead of by a hand-computed delay that would need
 * updating if the wipe duration ever changes.
 *
 * If the step selector matches nothing the wipe still plays on its own; the
 * timeline just has one child instead of two.
 */
export default function ClipReveal({
  children,
  className,
  stepSelector = '[data-step]',
}: {
  children: React.ReactNode;
  className?: string;
  stepSelector?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

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
        { clipPath: 'inset(100% 0 0 0)' },
        {
          clipPath: 'inset(0% 0 0 0)',
          duration: 0.8,
          ease: 'power3.out',
          // clip-path is left in place rather than cleared: inset(0) is a
          // no-op visually, and removing it mid-scroll caused a one-frame
          // repaint on Safari during testing of the same pattern elsewhere.
        },
      );

      const steps = gsap.utils.toArray<Element>(stepSelector, root);
      if (steps.length > 0) {
        tl.fromTo(
          steps,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power3.out',
            clearProps: 'willChange',
          },
          // Overlaps the last fifth of the wipe. The first step is already
          // rising as the panel finishes opening, which reads as one movement
          // rather than two.
          '-=0.2',
        );
      }
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
