'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '@/hooks/useScrollReveal';

/**
 * =============================================================================
 *  SPEECH BUBBLES OVER THE PHOTO CAROUSEL
 * =============================================================================
 *
 * When a particular photo reaches the front of the carousel, a short line flies
 * in from the side and sits on top of it. When that photo leaves, the line goes.
 *
 * THIS FILE DOES NOT TOUCH PhotoCarousel.tsx, AND THAT IS THE POINT.
 * That component is under a standing "not one character" rule, so everything
 * here works from the outside by READING the accessibility attributes the
 * carousel already publishes:
 *
 *   - each dot button carries `aria-current="true"` when its slide is active
 *   - the active slide's wrapper carries `aria-hidden="false"`
 *
 * Those are part of its public behaviour rather than styling details, so they
 * are far less likely to shift under us than a class name would be. A
 * MutationObserver watches exactly those two attributes and nothing else.
 *
 * CAPTIONS ARE MATCHED BY IMAGE URL, NOT BY SLIDE NUMBER.
 * The owner reorders his gallery from /admin. Keyed on position, "Hello!" would
 * silently jump to whatever photo happened to land in slot 1 -- including his
 * own portrait, which must never get a caption. Keyed on the image itself, each
 * line stays with its own picture no matter how the gallery is arranged.
 *
 * TO CHANGE THE LINES: edit CAPTIONS below. `match` is any distinctive part of
 * the image URL (the filename is ideal). A photo with no entry simply gets no
 * caption, which is the default and is what the portrait relies on.
 */

type Caption = {
  /** Substring of the photo's URL. Filename is the reliable choice. */
  match: string;
  text: string;
  /** Side it flies in from. */
  from: 'left' | 'right';
};

const CAPTIONS: Caption[] = [
  // The cat in the suit.
  { match: '305efb54-28d5-4830-8230-8ea57e0ceba4', text: 'Hello!', from: 'left' },
  // The cat in the ice-cream hat.
  { match: 'ec1183da-a3c5-45c4-982b-a67de87d7628', text: 'What do you want?', from: 'right' },
  // Deliberately no entry for the owner's own portrait.
];

type Placement = { left: number; top: number; width: number; height: number };

export default function CarouselCaptions({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  const [caption, setCaption] = useState<Caption | null>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  // Bumped on every arrival so the same caption re-animates when the reader
  // cycles back around to it.
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let lastKey = '';

    const read = () => {
      // The active slide is the one the carousel has un-hidden.
      const slide = wrap.querySelector<HTMLElement>('[aria-hidden="false"]');
      const img = slide?.querySelector('img') ?? null;

      // Measure the slide's PARENT -- the fixed-size stack container -- not the
      // card itself. `aria-hidden` flips at the START of the carousel's slide
      // transition, so the card is still travelling and still scaled when this
      // runs; measuring it put the bubble out at the card's right edge. The
      // container never moves and its box is exactly where the active card
      // comes to rest.
      const stack = slide?.parentElement ?? null;

      if (!slide || !img || !stack) {
        setCaption(null);
        return;
      }

      const src = img.getAttribute('src') ?? '';
      const found = CAPTIONS.find((c) => src.includes(c.match)) ?? null;

      // Position over the visible card, measured relative to this wrapper so it
      // survives any layout the carousel chooses at any breakpoint.
      const wr = wrap.getBoundingClientRect();
      const cr = stack.getBoundingClientRect();
      if (cr.width > 0) {
        setPlace({
          left: cr.left - wr.left,
          top: cr.top - wr.top,
          width: cr.width,
          height: cr.height,
        });
      }

      const key = found ? `${found.match}` : '';
      if (key !== lastKey) {
        lastKey = key;
        setCaption(found);
        if (found) setBeat((b) => b + 1);
      }
    };

    read();

    // Only these two attributes. Watching the whole subtree for everything
    // would fire on each frame of the carousel's own transitions.
    const mo = new MutationObserver(read);
    mo.observe(wrap, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current', 'aria-hidden'],
    });

    // The card moves and resizes with the viewport; re-measure when it does.
    const ro = new ResizeObserver(read);
    ro.observe(wrap);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  useGSAP(
    () => {
      const el = bubbleRef.current;
      if (!el || !caption) return;

      if (prefersReducedMotion()) {
        // Present, but it does not fly. Set explicitly rather than relying on a
        // skipped animation, so it can never be left mid-flight off-screen.
        gsap.set(el, { x: 0, y: 0, rotate: -3, opacity: 1, scale: 1 });
        return;
      }

      gsap.fromTo(
        el,
        {
          // Starts beyond the card's own edge, so it reads as arriving from
          // outside the photo rather than growing inside it.
          x: caption.from === 'left' ? -170 : 170,
          y: 14,
          rotate: caption.from === 'left' ? -14 : 14,
          opacity: 0,
          scale: 0.86,
        },
        {
          x: 0,
          y: 0,
          rotate: -3,
          opacity: 1,
          scale: 1,
          duration: 0.62,
          // A little overshoot so it lands with some weight instead of easing
          // politely into place.
          ease: 'back.out(1.7)',
          clearProps: 'willChange',
        },
      );
    },
    { dependencies: [beat, caption?.match], scope: wrapRef },
  );

  return (
    <div ref={wrapRef} className="relative">
      {children}

      {caption && place && (
        <div
          // pointer-events-none throughout: the carousel's arrows, dots and
          // swipe handling must keep working underneath this layer.
          //
          // No overflow-hidden here on purpose -- the bubble is meant to hang
          // slightly past the photo's right edge. The carousel's own
          // `overflow-x-clip` wrapper still contains it, so the overhang can
          // never widen the page.
          className="pointer-events-none absolute z-20"
          style={{
            left: place.left,
            top: place.top,
            width: place.width,
            height: place.height,
          }}
        >
          <span
            key={`${caption.match}-${beat}`}
            ref={bubbleRef}
            // Sits at the photo's top-RIGHT and hangs a little past the edge,
            // which is the placement the owner picked. Centred read as a label
            // stuck on the picture; tucked into the corner it reads as the cat
            // actually saying it.
            className="absolute right-0 top-[13%] translate-x-[16%] whitespace-nowrap rounded-2xl bg-lime px-4 py-2 text-base font-extrabold text-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.75)] sm:px-5 sm:py-2.5 sm:text-lg"
          >
            {caption.text}
          </span>
        </div>
      )}
    </div>
  );
}
