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
      {/* Always-present gradient. It IS the fallback on phones, on Data Saver,
          and on any device where shouldRender3D() says no -- and it sits behind
          the canvas everywhere else, so the hero never flashes empty while the
          3D chunk loads, or if the scene fails to build at all.

          Recoloured to match the scene: a cold teal mass where the particle
          field sits, one lime bloom for the accent, one deep cyan for depth.
          The old lime/amber pair read as a different site from the canvas in
          front of it. */}
      <div className="absolute left-1/2 top-1/4 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#12b2a4]/[0.10] blur-[150px]" />
      <div className="absolute right-[10%] top-[46%] h-[26rem] w-[26rem] rounded-full bg-lime/[0.06] blur-[120px]" />
      <div className="absolute left-[6%] top-[62%] h-[24rem] w-[24rem] rounded-full bg-[#0e7f7a]/[0.09] blur-[130px]" />
      {enabled && <Hero3D />}

      {/* Scrim, ON TOP of the canvas.

          The headline has to stay readable no matter what the scene does behind
          it, and a WebGL scene is the one thing on this page whose exact
          brightness at a given pixel cannot be predicted -- it depends on how
          many additive particles happen to overlap there. Tuning the shader
          until the text "looks fine" is a fix that lasts until the next tweak.
          A scrim is the guarantee.

          Left-to-right, because the copy is left-aligned and the scene is
          offset right; the second layer lifts the bottom edge where the stats
          row sits. Both stop well short of the right side, so the brightest
          part of the field is untouched. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(11,12,14,0.92) 0%, rgba(11,12,14,0.72) 34%, rgba(11,12,14,0.18) 62%, rgba(11,12,14,0) 82%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to top, rgba(11,12,14,0.85), rgba(11,12,14,0))' }}
      />
    </div>
  );
}
