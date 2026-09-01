'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Magnetic hover: the wrapped element leans toward the pointer while the
 * pointer is near it, then springs back on leave.
 *
 * Written with direct style writes inside pointermove rather than React state
 * -- a setState per mouse move would re-render the subtree ~60 times a second
 * for a purely visual effect.
 *
 * Disabled entirely for coarse pointers (a phone has no hover, and the touch
 * handler would fight the tap) and for reduced-motion.
 */
export default function Magnetic({
  children,
  strength = 0.28,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const enabled = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <span
      ref={ref}
      className={`inline-block will-change-transform ${className}`}
      style={{ transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || !enabled()) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        // No transition while tracking, so it follows the cursor 1:1.
        el.style.transition = 'transform 80ms linear';
        el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (!el) return;
        // Longer, springy easing on the way back — that is what sells it.
        el.style.transition = 'transform 500ms cubic-bezier(0.34, 1.36, 0.64, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
      }}
    >
      {children}
    </span>
  );
}
