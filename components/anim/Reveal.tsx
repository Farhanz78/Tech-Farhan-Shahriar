'use client';

import { useScrollReveal, type ScrollRevealOptions } from '@/hooks/useScrollReveal';

/**
 * Generic scroll-reveal wrapper.
 *
 * Wraps server-rendered markup without turning that markup into client
 * components: app/page.tsx stays an async Server Component and only this thin
 * shell ships to the browser. That is deliberate -- the page fetches the
 * profile and the project count on the server, and making it 'use client' to
 * get animation would mean moving that fetch into the browser.
 *
 * `as` keeps the document outline intact. A reveal around list items has to
 * render a <ul>/<ol>, not a <div>, or the list stops being a list for a screen
 * reader.
 */
export default function Reveal({
  children,
  className,
  as: Tag = 'div',
  ...options
}: ScrollRevealOptions & {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'ol' | 'li' | 'span';
}) {
  const ref = useScrollReveal<HTMLDivElement>(options);

  // The cast is needed because `Tag` is a union of intrinsic elements whose ref
  // types differ; every member is an HTMLElement, which is all the hook needs.
  const Component = Tag as 'div';

  return (
    <Component ref={ref} className={className}>
      {children}
    </Component>
  );
}
