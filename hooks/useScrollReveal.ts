'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

/**
 * The one place scroll-reveal animation is defined for this site.
 *
 * THREE THINGS THIS HOOK EXISTS TO GUARANTEE
 *
 * 1. CLEANUP. useGSAP() from @gsap/react collects every tween and ScrollTrigger
 *    created inside its callback into a gsap.context() and reverts them on
 *    unmount. Without that, navigating between /, /work and /admin leaks a
 *    ScrollTrigger per section per visit; they keep listening to scroll and
 *    keep holding a reference to a detached DOM node.
 *
 * 2. REDUCED MOTION IS HONOURED, AND HONOURED SAFELY. When a visitor asks for
 *    reduced motion the animation is not built at all -- but the element is
 *    also never put into its "from" state, so it is simply visible where it
 *    belongs. Skipping the animation must never be able to leave content at
 *    opacity 0.
 *
 * 3. NO-JS AND FAILED-JS STAY VISIBLE. Every animation here is a fromTo, and
 *    the "from" half is applied by JavaScript at animation time, not by a CSS
 *    class in the server-rendered HTML. If the bundle fails to load, if GSAP
 *    throws, if the browser is ancient -- the markup renders in its natural,
 *    visible state. The failure mode is "no animation", never "no content".
 *    This is the same rule the CSS in globals.css follows with `forwards`
 *    instead of `both`, and it is here for the same reason: the site owner
 *    cannot debug an invisible page.
 *
 * useGSAP runs in a layout effect, so the "from" state lands before the browser
 * paints and there is no flash of the final position first.
 */

export interface ScrollRevealOptions {
  /** Vertical travel in px. Positive = rises into place. Default 40. */
  y?: number;
  /** Horizontal travel in px. Negative = enters from the left. Default 0. */
  x?: number;
  /** Start opacity. Default 0. */
  opacity?: number;
  /** Seconds. Default 0.7. */
  duration?: number;
  /** Seconds between children when `stagger` targets are used. Default 0. */
  stagger?: number;
  /** Seconds to wait after the trigger fires. Default 0. */
  delay?: number;
  /** GSAP ease. Default 'power3.out' -- decelerating, no overshoot. */
  ease?: string;
  /**
   * ScrollTrigger start. The house default is 'top 85%': the element begins
   * animating when its top edge reaches 85% down the viewport, i.e. just as it
   * comes into view rather than after the reader has already looked at it.
   */
  start?: string;
  /**
   * CSS selector for the elements to animate, resolved inside the container.
   * Omit to animate the container itself.
   */
  targets?: string;
  /**
   * Run on page load instead of on scroll. Used by the hero and the header,
   * which are above the fold and would otherwise animate before they are seen.
   */
  onLoad?: boolean;
}

/**
 * True when the visitor has asked the operating system for reduced motion.
 * Guarded for SSR, where `window` does not exist.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * THE SAFETY NET. Every animation in this project goes through it.
 *
 * WHAT IT IS FOR, measured rather than imagined:
 * the hero was found at `opacity: 0.005` -- the entrance tween had been built,
 * had applied its "from" state, and had then stopped advancing. GSAP drives
 * tweens from requestAnimationFrame, and a browser throttles or suspends rAF in
 * a background tab. So a visitor who opens the site in a background tab, or
 * whose machine stalls during load, can arrive at a hero that is present in the
 * DOM, fully "visible" by every computed style except opacity, and blank on
 * screen.
 *
 * `fromTo` alone does not cover this. It protects against the animation never
 * being BUILT (no JS, an exception, reduced motion). It cannot protect against
 * one that is built and then never finishes -- at that point the from-state is
 * already on the element.
 *
 * So: a wall-clock timer, not a rAF one. setTimeout still fires in a throttled
 * tab (late, but it fires, and it fires immediately on refocus), whereas the
 * animation frame that would have finished the tween may never come. If the
 * deadline passes and anything is still transparent, it is snapped to its
 * final state. A visitor loses an animation they were not watching; they never
 * lose the content.
 */
export function guaranteeVisible(nodes: Element[], afterMs: number): () => void {
  const id = window.setTimeout(() => {
    const stranded = nodes.filter(
      (n) => Number(getComputedStyle(n).opacity) < 0.99,
    );
    if (stranded.length === 0) return;

    console.warn(
      `[reveal] ${stranded.length} element(s) were still transparent after ${afterMs}ms — ` +
        'forcing final state. The tab was probably backgrounded during load.',
    );
    gsap.set(stranded, { opacity: 1, x: 0, y: 0, clearProps: 'willChange' });
  }, afterMs);

  return () => window.clearTimeout(id);
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {},
) {
  const ref = useRef<T>(null);

  const {
    y = 40,
    x = 0,
    opacity = 0,
    duration = 0.7,
    stagger = 0,
    delay = 0,
    ease = 'power3.out',
    start = 'top 85%',
    targets,
    onLoad = false,
  } = options;

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const root = ref.current;
      if (!root) return;

      // Horizontal reveals are dropped on narrow screens, and this is a
      // correctness fix rather than a taste one.
      //
      // A fromTo holds its "from" state until the ScrollTrigger fires, so a
      // block below the fold sits translated by `x` for as long as the reader
      // has not reached it. On a phone the content column is already the full
      // width of the screen, so a +40px offset pushes it past the right edge
      // and the DOCUMENT grows: measured at 375px, scrollWidth went to 391
      // against a 375 client width.
      //
      // The effect is also pointless there -- on a single-column layout there
      // is no left half and right half to bring together, which is the only
      // reason the horizontal direction was chosen. So on narrow screens these
      // become plain vertical rises.
      // 1200, not 768. The first attempt used 768 and a phone in LANDSCAPE
      // (812x375) still scrolled sideways by exactly the 16px the transform
      // pushed out: measured scrollWidth 813 against a 797 client width, and
      // window.scrollTo(80,0) really moved the page.
      //
      // The reason is the page container. It is max-w-6xl (1152px) with 24px of
      // padding, so it only gains slack at the sides once the viewport passes
      // ~1200px. Below that the content column is as wide as the screen allows
      // and ANY horizontal offset leaves the viewport, at 800px just as much as
      // at 375px. The breakpoint has to follow the container, not the phone.
      const noRoomForX = typeof window !== 'undefined' && window.innerWidth < 1200;
      const dx = noRoomForX ? 0 : x;
      const dy = noRoomForX && x !== 0 && y === 0 ? 24 : y;

      // gsap.utils.toArray is scoped to `root`, so two instances of the same
      // component on one page never animate each other's children.
      const nodes: Element[] = targets
        ? gsap.utils.toArray<Element>(targets, root)
        : [root];

      // Nothing matched the selector. Bail rather than hand GSAP an empty
      // array, which would build a ScrollTrigger that can never fire and would
      // sit in the cleanup list for the life of the page.
      if (nodes.length === 0) return;

      // How long the whole thing can legitimately take, plus a margin.
      const runtimeMs = (delay + duration + stagger * nodes.length) * 1000 + 600;
      let cancelNet: (() => void) | undefined;

      gsap.fromTo(
        nodes,
        { y: dy, x: dx, opacity, willChange: 'transform, opacity' },
        {
          y: 0,
          x: 0,
          opacity: 1,
          duration,
          delay,
          ease,
          stagger,
          // Dropping the hint once the tween is done releases the compositor
          // layer. Leaving will-change on permanently is a memory cost on
          // phones for no benefit after the animation has run.
          clearProps: 'willChange',
          ...(onLoad
            ? {}
            : {
                scrollTrigger: {
                  trigger: root,
                  start,
                  // Play once. Re-animating on every scroll past is a fidget,
                  // not a reveal, and it fights the reader on the way back up.
                  toggleActions: 'play none none none',
                  once: true,
                  // Arm the net when the tween actually begins, not at mount --
                  // a section the reader never reaches has not failed at
                  // anything and must not be snapped to visible early.
                  onEnter: () => {
                    cancelNet = guaranteeVisible(nodes, runtimeMs);
                  },
                },
              }),
        },
      );

      // Load-time reveals start immediately whether or not anyone is looking,
      // so their net is armed immediately too.
      if (onLoad) cancelNet = guaranteeVisible(nodes, runtimeMs);

      return () => cancelNet?.();
    },
    { scope: ref },
  );

  return ref;
}
