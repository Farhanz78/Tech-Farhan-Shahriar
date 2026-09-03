'use client';

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/hooks/useScrollReveal';

/**
 * =============================================================================
 *  THE NAME, BUILT OUT OF PARTICLES
 * =============================================================================
 *
 * The headline is not text with an effect on it. The letterforms themselves are
 * a cloud of a few thousand tiny dots -- with a scattering of 0s and 1s mixed
 * in -- that fly in from random positions, settle into the shape of the name,
 * and then drift and rotate in real perspective.
 *
 * HOW THE SHAPE IS OBTAINED
 * The real <h1> text is drawn once into an offscreen canvas using the element's
 * OWN computed font, size, weight and wrapping. Every pixel with enough alpha
 * becomes a particle target. That is why the particle name matches the layout
 * exactly at any breakpoint, including where the name wraps onto two lines on a
 * phone: the DOM decides the layout, the sampler just follows it.
 *
 * WHY 2D CANVAS AND NOT WebGL
 * The hero already owns a WebGL context (Hero3D). A second one is a real cost
 * and another thing to lose on a driver error, and a few thousand fillRect
 * calls per frame is comfortably within budget. Depth is done honestly --
 * each particle has a z, the cloud rotates around its own centre, and points
 * are projected through a perspective divide -- so it reads as 3D without a
 * 3D engine.
 *
 * THE NAME CAN NEVER GO MISSING
 * The <h1> holds the real text and the real characters at all times:
 *   - Server-rendered HTML contains the name, so with no JavaScript it simply
 *     renders as an ordinary heading.
 *   - The text is only made transparent AFTER the particle system has
 *     successfully sampled and started. Failure at any step -- no canvas
 *     context, fonts never resolving, zero sampled points -- leaves the plain
 *     heading on screen.
 *   - `aria-label` carries the name for assistive technology, and the visible
 *     span is aria-hidden so it is never announced twice.
 *
 * The layout box also still comes from the real text, so nothing about the
 * page's sizing depends on the canvas working.
 */

/** Sampling step in CSS px. Smaller = denser cloud = more particles. */
const STEP = 2.2;

/*
 * THE TWO NUMBERS THAT DECIDE WHETHER THE NAME IS READABLE.
 *
 * First attempt used FOV 320 with Z_SPREAD 46, and the headline came out as an
 * unreadable smear. The arithmetic says why: perspective scale is FOV/(FOV+z),
 * so that pair swings each particle's scale between 0.87 and 1.17 depending on
 * its depth. Two dots that belong to the same stroke of the same letter get
 * pushed apart RADIALLY by up to 15% of their distance from the centre -- about
 * 45px at the ends of a 600px-wide name. The letterforms dissolve.
 *
 * A long lens and a shallow depth fix it: 900/14 keeps the scale within about
 * 1.5%, so depth costs at most a pixel or two of displacement.
 *
 * The 3D is not lost, it just moved: depth is now carried by COLOUR, SIZE and
 * OPACITY (see the render loop), which cost no legibility at all. Position is
 * the one channel a letterform cannot spare.
 */
const FOV = 900;
const Z_SPREAD = 14;
/** Extra canvas margin so particles flying in are not clipped at the edges. */
const PAD = 48;
/** Fraction of particles drawn as a 0 or 1 instead of a dot. */
const GLYPH_RATIO = 0.07;

type P = {
  /** target position, in canvas px */
  tx: number;
  ty: number;
  tz: number;
  /** current position */
  x: number;
  y: number;
  /** per-particle easing and idle motion */
  ease: number;
  phase: number;
  amp: number;
  glyph: string | null;
  /** 0..1, decides colour and dot size */
  tone: number;
  /** Ambient drifter: belongs to no letter, so it may wander freely. */
  free: boolean;
  vx: number;
  vy: number;
};

export default function HackerName({
  name,
  className = '',
}: {
  name: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!hostRef.current || !textRef.current || !canvasRef.current) return;

    // Annotated with the non-null types on purpose. TypeScript drops a
    // narrowing when the value is read inside a nested function declaration,
    // and every helper below is one, so the guard above alone is not enough.
    const host: HTMLHeadingElement = hostRef.current;
    const text: HTMLSpanElement = textRef.current;
    const canvas: HTMLCanvasElement = canvasRef.current;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    const still = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let particles: P[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let disposed = false;
    let startedAt = 0;

    // Pointer, in canvas coordinates. Drives both the cloud's rotation and a
    // local push, so the name reacts to the cursor rather than just spinning.
    const pointer = { x: -9999, y: -9999, active: false };
    let rotY = 0;
    let rotYTarget = 0;
    let rotX = 0;
    let rotXTarget = 0;

    /* ------------------------------------------------ sample the letters */

    /** Wraps words to `maxWidth` exactly the way the DOM heading does. */
    function layoutLines(c: CanvasRenderingContext2D, maxWidth: number): string[] {
      const words = name.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (current && c.measureText(next).width > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    function build(): boolean {
      const box = text.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return false;

      w = Math.round(box.width + PAD * 2);
      h = Math.round(box.height + PAD * 2);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.left = `${-PAD}px`;
      canvas.style.top = `${-PAD}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw the heading into an offscreen buffer using the element's own type
      // settings, so the particle shape is the shape the browser would paint.
      const cs = getComputedStyle(text);
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const octx = off.getContext('2d', { willReadFrequently: true });
      if (!octx) return false;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fontSize = parseFloat(cs.fontSize) || 48;
      const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.05;
      octx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
      octx.textBaseline = 'top';
      octx.fillStyle = '#fff';

      // letter-spacing is NOT part of the canvas `font` shorthand and has to be
      // set separately. The heading uses `tracking-tight` (-0.025em), so without
      // this the canvas measures the name WIDER than the browser draws it, and
      // the sampler wrapped "Shahriar" onto a second line while the DOM kept it
      // on one -- the particles then overprinted the tagline underneath.
      type SpacedCtx = CanvasRenderingContext2D & { letterSpacing?: string };
      if ('letterSpacing' in octx) {
        (octx as SpacedCtx).letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      }

      // Belt and braces for engines without ctx.letterSpacing: the DOM's own box
      // height says how many lines the browser actually used. If the sampler
      // wants more than that, widen its wrap width until the counts agree, so
      // the canvas can never draw a line the heading has not reserved space for.
      const domLines = Math.max(1, Math.round(box.height / lineHeight));
      let wrapWidth = box.width + 1;
      let lines = layoutLines(octx, wrapWidth);
      for (let guard = 0; lines.length > domLines && guard < 12; guard++) {
        wrapWidth *= 1.08;
        lines = layoutLines(octx, wrapWidth);
      }
      lines.forEach((line, i) => {
        // (PAD, PAD) puts the text where the real heading sits, since the canvas
        // is offset by -PAD on both axes.
        octx.fillText(line, PAD, PAD + i * lineHeight);
      });

      const img = octx.getImageData(0, 0, off.width, off.height).data;
      const next: P[] = [];
      const stepPx = Math.max(2, Math.round(STEP * dpr));

      for (let py = 0; py < off.height; py += stepPx) {
        for (let px = 0; px < off.width; px += stepPx) {
          const alpha = img[(py * off.width + px) * 4 + 3];
          if (alpha < 130) continue;

          const tx = px / dpr;
          const ty = py / dpr;
          const isGlyph = Math.random() < GLYPH_RATIO;

          next.push({
            tx,
            ty,
            tz: (Math.random() * 2 - 1) * Z_SPREAD,
            // Start scattered across the whole canvas so the name assembles out
            // of noise rather than sliding in from one side.
            x: Math.random() * w,
            y: Math.random() * h,
            ease: 0.045 + Math.random() * 0.05,
            phase: Math.random() * Math.PI * 2,
            // Idle wander stays well under one stroke width. At 1.9px the
            // letters visibly frayed at the edges; at 0.7 the name breathes
            // without softening.
            amp: 0.2 + Math.random() * 0.5,
            glyph: isGlyph ? (Math.random() < 0.5 ? '0' : '1') : null,
            tone: Math.random(),
            free: false,
            vx: 0,
            vy: 0,
          });
        }
      }

      if (!next.length) return false;

      // Ambient drifters around the name. Roughly one for every eight letter
      // particles, mostly 0s and 1s, moving slowly and independently. They are
      // what make the headline feel like a live system rather than a picture,
      // and because they belong to no glyph they can move as much as they like.
      const ambient = Math.round(next.length * 0.12);
      for (let i = 0; i < ambient; i++) {
        next.push({
          tx: 0,
          ty: 0,
          tz: (Math.random() * 2 - 1) * Z_SPREAD * 1.6,
          x: Math.random() * w,
          y: Math.random() * h,
          ease: 0,
          phase: Math.random() * Math.PI * 2,
          amp: 0,
          glyph: Math.random() < 0.55 ? (Math.random() < 0.5 ? '0' : '1') : null,
          tone: Math.random(),
          free: true,
          vx: (Math.random() * 2 - 1) * 0.24,
          vy: -0.12 - Math.random() * 0.3,
        });
      }

      particles = next;
      return true;
    }

    /* ------------------------------------------------------------ render */

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;

      const t = (now - startedAt) / 1000;
      ctx.clearRect(0, 0, w, h);

      // Small angles only. 0.42 rad is 24 degrees, which shears the name into
      // illegibility; 0.10 is about 6 degrees, which reads as a living object
      // and still leaves every letter square enough to read.
      rotYTarget = pointer.active ? ((pointer.x / w) * 2 - 1) * 0.10 : 0;
      rotXTarget = pointer.active ? ((pointer.y / h) * 2 - 1) * -0.06 : 0;
      rotY += (rotYTarget + Math.sin(t * 0.22) * 0.035 - rotY) * 0.045;
      rotX += (rotXTarget - rotX) * 0.045;

      const cx = w / 2;
      const cy = h / 2;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const glyphSize = Math.max(7, Math.min(11, w / 90));
      ctx.font = `${glyphSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Ambient particles are not part of any letter, so they are free to
        // drift as far as they like. They carry most of the "alive" feeling at
        // zero cost to legibility.
        if (p.free) {
          p.x += p.vx;
          p.y += p.vy + Math.sin(t * 0.8 + p.phase) * 0.14;
          if (p.x < -20) p.x = w + 20;
          else if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20;
          else if (p.y > h + 20) p.y = -20;
        } else {
          // COHERENT FLOW, not per-particle jitter -- this is the whole trick.
          // The offset is a function of the particle's OWN TARGET POSITION, so
          // two dots in the same stroke get almost the same offset and move
          // together. The name undulates as one surface and every edge stays
          // sharp. Random jitter of this amplitude frayed the glyphs, which is
          // why the first readable version had to be so nearly still.
          const flowX =
            Math.sin(p.ty * 0.03 + t * 1.15) * 2.6 + Math.sin(p.tx * 0.013 - t * 0.75) * 1.5;
          const flowY =
            Math.cos(p.tx * 0.024 + t * 0.95) * 2.1 + Math.cos(p.ty * 0.018 + t * 1.35) * 1.1;
          // A whisper of genuine randomness so it never looks mechanical.
          const grit = Math.sin(t * 2.1 + p.phase) * p.amp;

          p.x += (p.tx + flowX + grit - p.x) * p.ease;
          p.y += (p.ty + flowY - p.y) * p.ease;
        }

        let dx = p.x - cx;
        let dy = p.y - cy;
        // Depth breathes in a wave too. Because depth is drawn as colour and
        // size rather than position, this reads as light moving THROUGH the
        // letters without shifting a single dot out of place.
        let dz = p.tz + Math.sin(p.tx * 0.02 + t * 1.4) * 7;

        // Pointer push: nearby particles are shouldered aside, then pulled back
        // by the same easing that assembled them.
        if (pointer.active) {
          const rx = p.x - pointer.x;
          const ry = p.y - pointer.y;
          const d2 = rx * rx + ry * ry;
          if (d2 < 5200 && d2 > 0.01) {
            const f = (5200 - d2) / 5200;
            const d = Math.sqrt(d2);
            // Tight radius, small push: enough to feel alive under the cursor,
            // not enough to tear a letter open.
            dx += (rx / d) * f * 13;
            dy += (ry / d) * f * 13;
          }
        }

        // Rotate around Y, then X, then project.
        const x1 = dx * cosY + dz * sinY;
        const z1 = -dx * sinY + dz * cosY;
        const y1 = dy * cosX - z1 * sinX;
        const z2 = dy * sinX + z1 * cosX;

        const scale = FOV / (FOV + z2);
        const sx = cx + x1 * scale;
        const sy = cy + y1 * scale;

        // Depth decides colour and size: far particles are cold teal and small,
        // near ones warm to lime and grow. That gradient is what sells the 3D.
        const depth = Math.max(0, Math.min(1, (z2 + Z_SPREAD) / (Z_SPREAD * 2)));
        const near = 1 - depth;

        // A band of light sweeping left to right across the name, on a loop.
        // Pure brightness, no displacement, so it costs nothing in legibility.
        const sweep = (p.tx / Math.max(w, 1) - ((t * 0.30) % 1.7) + 1.7) % 1.7;
        const shimmer = !p.free && sweep < 0.15 ? 1 - sweep / 0.15 : 0;

        // Depth lives entirely here. `near` runs 0 (far) to 1 (close) and drives
        // brightness, warmth and dot size -- never position.
        if (p.glyph) {
          const a = (p.free ? 0.16 + near * 0.2 : 0.4 + near * 0.4) + shimmer * 0.4;
          ctx.fillStyle =
            near > 0.62 || shimmer > 0.4
              ? `rgba(196,248,42,${Math.min(1, a + 0.15)})`
              : `rgba(46,230,197,${Math.min(1, a)})`;
          ctx.fillText(p.glyph, sx, sy);
        } else {
          // Minimum 1.15px: below that the dots stop touching and the strokes
          // read as dotted outlines instead of letters.
          const size = p.free
            ? Math.max(0.8, 1.1 * scale)
            : Math.max(1.15, (1.25 + p.tone * 1.1) * scale);

          if (p.free) {
            ctx.fillStyle = `rgba(46,230,197,${0.14 + near * 0.22})`;
          } else if (shimmer > 0.05) {
            ctx.fillStyle = `rgba(215,255,120,${Math.min(1, 0.8 + shimmer * 0.2)})`;
          } else {
            ctx.fillStyle =
              near > 0.72
                ? `rgba(196,248,42,${0.78 + near * 0.22})`
                : near > 0.42
                  ? `rgba(150,240,140,${0.68 + near * 0.3})`
                  : `rgba(46,230,197,${0.58 + near * 0.32})`;
          }
          ctx.fillRect(sx, sy, size, size);
        }
      }
    }

    /** One settled frame, no motion, for prefers-reduced-motion. */
    function drawStill() {
      ctx.clearRect(0, 0, w, h);
      ctx.font = `9px ui-monospace, monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (const p of particles) {
        if (p.free) continue; // no drifters in the still frame
        const depth = Math.max(0, Math.min(1, (p.tz + Z_SPREAD) / (Z_SPREAD * 2)));
        const near = 1 - depth;
        if (p.glyph) {
          ctx.fillStyle = `rgba(46,230,197,${0.35 + near * 0.35})`;
          ctx.fillText(p.glyph, p.tx, p.ty);
        } else {
          ctx.fillStyle =
            near > 0.7 ? `rgba(196,248,42,0.95)` : `rgba(46,230,197,${0.65 + near * 0.3})`;
          ctx.fillRect(p.tx, p.ty, 1.5, 1.5);
        }
      }
    }

    /* ------------------------------------------------------------- start */

    const startOrFail = () => {
      if (disposed) return;
      try {
        if (!build()) return; // leaves the plain heading visible
        setLive(true);
        if (still) {
          // Particles are already at their targets in this branch.
          for (const p of particles) {
            p.x = p.tx;
            p.y = p.ty;
          }
          drawStill();
        } else {
          startedAt = performance.now();
          raf = requestAnimationFrame(frame);
        }
      } catch (err) {
        // Sampling can throw on a tainted or oversized canvas. The heading is
        // still on screen; log once for whoever reads a console.
        console.warn('[name] particle build failed, showing plain text:', err);
        setLive(false);
      }
    };

    // Fonts must be resolved first, or the shape is sampled from the fallback
    // face and the particle name does not match the heading.
    if (document.fonts?.ready) {
      document.fonts.ready.then(startOrFail).catch(startOrFail);
    } else {
      startOrFail();
    }

    /* ------------------------------------------------------- interaction */

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      // A generous margin so the cloud responds as the cursor approaches,
      // not only once it is inside the letters.
      pointer.active = x > -160 && x < w + 160 && y > -160 && y < h + 160;
      pointer.x = x;
      pointer.y = y;
    };
    const onLeave = () => {
      pointer.active = false;
    };

    const fine = window.matchMedia('(pointer: fine)').matches;
    if (fine && !still) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave);
    }

    // Re-sample when the heading's box changes: a resize, a font swap, or the
    // name wrapping onto a second line.
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        cancelAnimationFrame(raf);
        startOrFail();
      }, 180);
    });
    ro.observe(text);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [name]);

  return (
    <h1 ref={hostRef} data-hero="h1" aria-label={name} className={`relative ${className}`}>
      {/* Absolutely positioned and sized in JS so it can overhang the heading
          box; particles fly in from outside the letters. */}
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute z-10" />

      {/* The real text. It defines the layout box and the shape to sample, and
          it is the fallback whenever the particle system does not start. Only
          made transparent once `live` proves the cloud is running. */}
      <span
        ref={textRef}
        aria-hidden
        className="relative inline-block transition-colors duration-500"
        style={live ? { color: 'transparent' } : undefined}
      >
        {name}
      </span>
    </h1>
  );
}
