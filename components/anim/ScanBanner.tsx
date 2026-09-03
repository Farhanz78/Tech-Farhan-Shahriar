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
        // TRAVEL AND FADE ARE SEPARATE TWEENS, and that matters.
        //
        // Originally both were one fromTo, so opacity ramped 0 -> 1 across the
        // whole 1.5s crossing. Measured on the running page: the line was at
        // opacity 0.19 a third of the way over, 0.53 at the midpoint, and only
        // reached 0.99 as it left the frame -- brightest exactly where nobody
        // was looking, then cut to nothing. It read as a dim smudge.
        //
        // Now: a fast fade in, full brightness for the crossing, a fade out as
        // it exits. The travel below owns position only.
        //
        // EVERY TWEEN IS POSITIONED AGAINST THE 'sweep' LABEL, not against the
        // previous tween. The first attempt used '>-0.5' for the fade-out,
        // which GSAP resolves against the tween immediately before it -- the
        // 0.3s fade-IN -- not against the 1.5s travel. The two opacity tweens
        // then overlapped, the fade-in finished last and won, and the line was
        // left parked off-screen at full opacity. Measured: endsInvisible = 1.
        // An absolute label removes the ambiguity entirely.
        tl.addLabel(
          'sweep',
          // Was '-=0.35', which started the sweep while the banner was still
          // rising and scaling. Two things moving at once read as one blurred
          // event. '-=0.1' lets the banner arrive first, then the light crosses
          // it -- the same two beats, in an order the eye can follow.
          '-=0.1',
        );

        tl.fromTo(
          line,
          { xPercent: -110, opacity: 0 },
          {
            // 330, not 110 -- and the difference is arithmetic, not taste.
            //
            // xPercent is a percentage of THE ELEMENT'S OWN width, and this line
            // is one third of the banner. So the old value moved it
            // 1.10 x (W/3) = 0.367W, putting its trailing edge at just 0.70W:
            // the sweep died about two thirds across and never reached the
            // right side at all.
            //
            // To cross a container three times its own width and exit, it has
            // to travel 330% of itself. -110 -> 330 enters fully off the left
            // edge and leaves fully off the right.
            xPercent: 330,
            // 1.5s, not 0.8. Covering three times the distance in the old
            // duration would have made it nearly five times faster -- a flash,
            // not a sweep. This is the speed at which the eye can follow it.
            duration: 1.5,
            // power2.inOut spends most of its time at high speed in the middle,
            // which is exactly where a long travel should be readable.
            // power1.inOut holds a steadier pace across the whole width.
            ease: 'power1.inOut',
          },
          'sweep',
        )
          // Up to full brightness in the first fifth of the crossing.
          .to(line, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 'sweep')
          // ...and back down over the final half second, so it leaves rather
          // than being switched off, and nothing is parked visible off-screen.
          .to(line, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 'sweep+=1.0');
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
