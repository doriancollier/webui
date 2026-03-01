'use client';

/**
 * Logo05 — Brutalist slab "DORK" built entirely from rectangles.
 * Every stroke is a filled rect. No curves, no diagonals, no paths.
 * Heavy, raw, concrete weight.
 */
export function Logo05() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 140"
      fill="#000"
      role="img"
      aria-label="DORK"
    >
      {/*
        D — x: 0..108
        Vertical left slab + top/bottom horizontals + right vertical cap.
        Inner void punched out.
      */}
      {/* D: left vertical slab */}
      <rect x="0" y="0" width="22" height="140" />
      {/* D: top horizontal slab */}
      <rect x="0" y="0" width="86" height="22" />
      {/* D: bottom horizontal slab */}
      <rect x="0" y="118" width="86" height="22" />
      {/* D: right vertical cap */}
      <rect x="86" y="0" width="22" height="140" />
      {/* D: inner void — rectangular cutout gives the bowl */}
      <rect x="22" y="22" width="64" height="96" fill="white" />
      {/* D: right-side inner bevel — thicken the curve illusion with a narrower inner rect */}
      {/* Keep it pure-rect: simply leave the white rect slightly narrower on right */}
      {/* D total width: 108 */}

      {/*
        O — x: 122..230
        Thick rectangular ring. No rounded corners — pure slab rectangle frame.
      */}
      {/* O: full outer block */}
      <rect x="122" y="0" width="108" height="140" />
      {/* O: inner void */}
      <rect x="148" y="26" width="56" height="88" fill="white" />

      {/*
        R — x: 244..352
        Left vertical slab.
        Top horizontal bar + right cap forming the top counter.
        Middle horizontal bar.
        Bottom-right leg: a vertical rectangle in the lower-right quadrant.
      */}
      {/* R: left vertical slab */}
      <rect x="244" y="0" width="22" height="140" />
      {/* R: top horizontal slab */}
      <rect x="244" y="0" width="86" height="22" />
      {/* R: middle horizontal slab */}
      <rect x="244" y="64" width="86" height="22" />
      {/* R: right cap — top counter bowl */}
      <rect x="308" y="0" width="22" height="86" />
      {/* R: upper inner void (bowl) */}
      <rect x="266" y="22" width="42" height="42" fill="white" />
      {/* R: leg — a thick vertical rectangle from mid-bar down, shifted right */}
      <rect x="298" y="86" width="36" height="54" />

      {/*
        K — x: 366..498
        Left vertical slab.
        Upper arm: two stacked horizontal rects stepping from mid toward top-right.
        Lower arm: two stacked horizontal rects stepping from mid toward bottom-right.
        Pure staircase — no diagonals at all.
      */}
      {/* K: left vertical slab */}
      <rect x="366" y="0" width="22" height="140" />

      {/* K: upper arm — staircase of two horizontal rects */}
      {/* Step 1: wide, starts at mid, reaches right */}
      <rect x="388" y="42" width="60" height="22" />
      {/* Step 2: narrower, above step 1, further right */}
      <rect x="420" y="20" width="28" height="22" />
      {/* Step 3: cap, top-right corner */}
      <rect x="448" y="0" width="28" height="20" />

      {/* K: lower arm — mirror staircase */}
      {/* Step 1: wide, starts just below mid */}
      <rect x="388" y="76" width="60" height="22" />
      {/* Step 2: narrower, below step 1, further right */}
      <rect x="420" y="98" width="28" height="22" />
      {/* Step 3: cap, bottom-right corner */}
      <rect x="448" y="120" width="28" height="20" />
    </svg>
  );
}
