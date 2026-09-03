'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '@/hooks/useScrollReveal';

/**
 * Scroll behaviour for the 3D hero.
 *
 * As the reader scrolls from the hero toward Services, the icosahedron shrinks,
 * fades and drifts off to the top-right, so the second section arrives on a
 * clean background instead of over a still-spinning object.
 *
 * IMPORTANT: THIS DOES NOT TOUCH Hero3D.tsx OR HeroCanvas.tsx.
 * It animates a wrapper div around <HeroCanvas />. That separation is the point
 * -- Hero3D owns the WebGL context, its own render loop, its own visibility and
 * capability gating (shouldRender3D), and its own teardown. Reaching into it to
 * add scroll behaviour would couple the scroll story to the renderer's
 * lifecycle, and the renderer is the part that must not break: it is what a
 * visitor sees first.
 *
 * Because HeroCanvas already renders the gradient fallback when 3D is off, this
 * wrapper animates whatever is inside it. On a phone that is the gradient, and
 * having the gradient drift away as you scroll is the same story told cheaply.
 *
 * scrub: true ties progress to scroll position rather than to a clock, so the
 * motion tracks the reader's finger and reverses when they scroll back up.
 */
export default function HeroCanvasParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const root = ref.current;
      if (!root) return;

      // The trigger is the hero section (this wrapper's parent), not the
      // wrapper itself: the wrapper is absolutely positioned and inset-0, so
      // its own box is the right size but its scroll geometry is clearer read
      // from the section that contains it.
      const section = root.parentElement ?? root;

      // Softened once Hero3D grew its own scroll response. The scene already
      // dollies the camera in and raises the noise amplitude as this section
      // passes, so shrinking the whole canvas to 0.3 on top of that fought it:
      // two different things moving the same pixels in opposite directions.
      // The wrapper now only drifts and fades; the depth comes from the scene.
      gsap.to(root, {
        scale: 0.78,
        opacity: 0,
        xPercent: 16,
        yPercent: -20,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          // Finishes as the hero's bottom edge reaches the middle of the
          // screen, which is roughly when the Services heading arrives.
          end: 'bottom center',
          scrub: true,
          // Nothing is pinned and nothing changes layout height, so this
          // cannot push the page around as it plays.
          invalidateOnRefresh: true,
        },
      });
    },
    { scope: ref },
  );

  return (
    // NO `will-change: transform` here, and that is load-bearing.
    //
    // It was here originally as a performance hint. It promotes this wrapper to
    // its own compositor layer, and because the layer contains a WebGL canvas
    // the browser composited the whole thing ABOVE the hero copy -- the
    // headline, tagline, bio and buttons all disappeared behind the scene.
    //
    // Every DOM measurement said the text was fine: opacity 1, visibility
    // visible, correct colour, and elementsFromPoint returned the <h1> as the
    // topmost element at its own coordinates. It was only visible in a
    // screenshot. Measure AND look.
    //
    // GSAP sets will-change itself for the duration of a tween and clears it
    // afterwards, which is what a hint is for. A permanent one also holds a
    // compositor layer for the life of the page, which is a memory cost on a
    // phone for no gain once the animation has run.
    <div ref={ref} className="absolute inset-0 origin-top-right">
      {children}
    </div>
  );
}
