'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { shouldRender3D } from './Hero3D';

/**
 * Gate + lazy loader for the 3D hero.
 *
 * ssr:false because three.js touches window/document at module scope. The
 * import only happens after shouldRender3D() has said yes, so a phone or a
 * reduced-motion visitor never downloads the three.js chunk at all.
 */
const Hero3D = dynamic(() => import('./Hero3D'), { ssr: false });

export default function HeroCanvas() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(shouldRender3D());
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Always-present gradient. It IS the fallback on phones and reduced-motion,
          and it sits behind the canvas everywhere else so the hero never flashes
          empty while the 3D chunk loads. */}
      <div className="absolute left-1/2 top-1/4 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-lime/[0.07] blur-[130px]" />
      <div className="absolute right-[12%] top-[55%] h-[22rem] w-[22rem] rounded-full bg-amber/[0.05] blur-[110px]" />
      {enabled && <Hero3D />}
    </div>
  );
}
