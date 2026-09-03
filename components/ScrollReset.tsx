'use client';

import { useEffect } from 'react';

/**
 * Start every fresh page load at the top.
 *
 * THE PROBLEM THIS FIXES
 * Browsers restore the previous scroll position on reload. Scroll to the bottom
 * of the homepage, press refresh, and you land at the bottom again -- every
 * time, however often you reload. On a page whose whole job is to open with a
 * hero, that reads as the site being broken: the visitor never sees the top
 * unless they scroll back up by hand.
 *
 * It also wasted the hero's entrance animation, which plays on mount whether or
 * not anyone is looking at it.
 *
 * WHY `manual` AND NOT A scrollTo AFTER LOAD
 * Letting the browser restore and then jumping to the top is visible as a
 * flinch. Turning restoration off means it never happens in the first place.
 *
 * A HASH IS STILL HONOURED. `/#contact` has to keep working -- it is what the
 * header's own links use -- so a URL that names a section still scrolls to that
 * section. Only a plain reload with no target starts at the top.
 */
export default function ScrollReset() {
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    window.history.scrollRestoration = 'manual';

    // A URL that names a section is left ENTIRELY alone. Turning scroll
    // restoration off does not affect hash scrolling -- the browser still jumps
    // to #contact by itself, and it does it after layout has settled, which is
    // something this effect cannot reliably do.
    //
    // The first version tried to be helpful here and called scrollIntoView()
    // on the target. It ran before the page had reached its final height and
    // left the reader at scrollY 0 on /#contact -- measured: the section was
    // still 5035px below the fold. Doing nothing is strictly better.
    if (window.location.hash.length > 1) return;

    window.scrollTo(0, 0);
  }, []);

  return null;
}
