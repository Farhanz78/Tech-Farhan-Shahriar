'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { Observer } from 'gsap/Observer';
import { useGSAP } from '@gsap/react';

/**
 * Registers the free GSAP plugins once, for the whole app.
 *
 * WHY A COMPONENT AND NOT A PLAIN MODULE
 * gsap.registerPlugin() must run in the browser, before any component builds a
 * ScrollTrigger. Putting it in a 'use client' component mounted from the root
 * layout guarantees both: the module is only ever evaluated client-side, and it
 * is evaluated as part of the first render pass rather than lazily on the first
 * animated section.
 *
 * PAID PLUGINS ARE NOT USED ANYWHERE IN THIS PROJECT.
 * ScrollTrigger, Flip, Observer, Draggable, MotionPathPlugin and CustomEase are
 * free. SplitText, MorphSVG, ScrollSmoother, DrawSVG and the rest are Club GSAP
 * and must never be imported here -- they are not in package.json, so an import
 * would fail the build rather than fail at runtime, which is the safer failure.
 *
 * Registering the same plugin twice is a no-op in GSAP, so a fast-refresh
 * remount during development cannot corrupt anything.
 */
// useGSAP is registered alongside the real plugins. It is not a plugin in the
// animating sense -- registering it is how @gsap/react opts into GSAP's own
// cleanup bookkeeping, and skipping it produces a console warning that would
// otherwise sit there looking like a real problem.
gsap.registerPlugin(useGSAP, ScrollTrigger, Flip, Observer);

/**
 * Nothing is rendered. ScrollTrigger's own markers and containers are created
 * on demand by the animations themselves.
 */
export default function GSAPInit() {
  return null;
}
