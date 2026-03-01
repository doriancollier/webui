'use client';

// Each letter is built from 10 horizontal bars (slices) stacked at equal height.
// Bar height = 10px, gap = 2px → total letter height = 10*10 + 9*2 = 118px.
// ViewBox: 0 0 450 120 (1px padding top/bottom).
//
// Helper: given a letter's x origin, bar index (0–9), bar width, and x offset
// within the letter, compute the rect props.
//
// Letter widths:  D=90  O=90  R=90  K=90  (each spaced 110px apart)
// Letter origins: D=5   O=115 R=225 K=335

export function Logo09() {
  const BAR_H = 10;
  const GAP = 2;
  const STEP = BAR_H + GAP; // 12px per slice
  const TOP = 1; // 1px top padding

  /** y coordinate for bar at index i (0-based) */
  const y = (i: number) => TOP + i * STEP;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 450 120"
      fill="#000"
      role="img"
      aria-label="DORK"
    >
      {/*
        ── D ──
        Left vertical stem is full-width for all bars.
        Right side widens at center and narrows at top/bottom to
        suggest the curved right stroke of a D.

        Bar layout (stem x=5, width=85 at origin):
          Bar 0 (top):    stem(5,10) + top-cap(15,40)
          Bar 1:          stem(5,10) + body(15,58)
          Bar 2:          stem(5,10) + body(15,68)
          Bar 3:          stem(5,10) + body(15,74)
          Bar 4 (mid):    stem(5,10) + body(15,76)  ← widest
          Bar 5 (mid):    stem(5,10) + body(15,76)
          Bar 6:          stem(5,10) + body(15,74)
          Bar 7:          stem(5,10) + body(15,68)
          Bar 8:          stem(5,10) + body(15,58)
          Bar 9 (bot):    stem(5,10) + bot-cap(15,40)
      */}

      {/* D — Bar 0: top cap */}
      <rect x={5} y={y(0)} width={50} height={BAR_H} />

      {/* D — Bar 1 */}
      <rect x={5} y={y(1)} width={10} height={BAR_H} />
      <rect x={60} y={y(1)} width={20} height={BAR_H} />

      {/* D — Bar 2 */}
      <rect x={5} y={y(2)} width={10} height={BAR_H} />
      <rect x={68} y={y(2)} width={16} height={BAR_H} />

      {/* D — Bar 3 */}
      <rect x={5} y={y(3)} width={10} height={BAR_H} />
      <rect x={74} y={y(3)} width={14} height={BAR_H} />

      {/* D — Bar 4 (widest point) */}
      <rect x={5} y={y(4)} width={10} height={BAR_H} />
      <rect x={78} y={y(4)} width={12} height={BAR_H} />

      {/* D — Bar 5 (widest point) */}
      <rect x={5} y={y(5)} width={10} height={BAR_H} />
      <rect x={78} y={y(5)} width={12} height={BAR_H} />

      {/* D — Bar 6 */}
      <rect x={5} y={y(6)} width={10} height={BAR_H} />
      <rect x={74} y={y(6)} width={14} height={BAR_H} />

      {/* D — Bar 7 */}
      <rect x={5} y={y(7)} width={10} height={BAR_H} />
      <rect x={68} y={y(7)} width={16} height={BAR_H} />

      {/* D — Bar 8 */}
      <rect x={5} y={y(8)} width={10} height={BAR_H} />
      <rect x={60} y={y(8)} width={20} height={BAR_H} />

      {/* D — Bar 9: bottom cap */}
      <rect x={5} y={y(9)} width={50} height={BAR_H} />

      {/*
        ── O ──
        Origin x=115. Letter width ~80.
        Hollow center: each bar has a left chunk and a right chunk
        with a gap in the middle that widens at center, narrows top/bottom.

        Bar 0 (top):  full bar x=115 w=80
        Bar 1:        left x=115 w=12,  right x=175 w=20  (gap=28)
        Bar 2:        left x=115 w=12,  right x=178 w=17  (gap=34)
        Bar 3:        left x=115 w=12,  right x=181 w=14  (gap=40)
        Bar 4 (mid):  left x=115 w=12,  right x=183 w=12  (gap=44)
        Bar 5 (mid):  left x=115 w=12,  right x=183 w=12  (gap=44)
        Bar 6:        left x=115 w=12,  right x=181 w=14
        Bar 7:        left x=115 w=12,  right x=178 w=17
        Bar 8:        left x=115 w=12,  right x=175 w=20
        Bar 9 (bot):  full bar x=115 w=80
      */}

      {/* O — Bar 0: top cap */}
      <rect x={115} y={y(0)} width={80} height={BAR_H} />

      {/* O — Bar 1 */}
      <rect x={115} y={y(1)} width={12} height={BAR_H} />
      <rect x={175} y={y(1)} width={20} height={BAR_H} />

      {/* O — Bar 2 */}
      <rect x={115} y={y(2)} width={12} height={BAR_H} />
      <rect x={178} y={y(2)} width={17} height={BAR_H} />

      {/* O — Bar 3 */}
      <rect x={115} y={y(3)} width={12} height={BAR_H} />
      <rect x={181} y={y(3)} width={14} height={BAR_H} />

      {/* O — Bar 4 (widest gap) */}
      <rect x={115} y={y(4)} width={12} height={BAR_H} />
      <rect x={183} y={y(4)} width={12} height={BAR_H} />

      {/* O — Bar 5 (widest gap) */}
      <rect x={115} y={y(5)} width={12} height={BAR_H} />
      <rect x={183} y={y(5)} width={12} height={BAR_H} />

      {/* O — Bar 6 */}
      <rect x={115} y={y(6)} width={12} height={BAR_H} />
      <rect x={181} y={y(6)} width={14} height={BAR_H} />

      {/* O — Bar 7 */}
      <rect x={115} y={y(7)} width={12} height={BAR_H} />
      <rect x={178} y={y(7)} width={17} height={BAR_H} />

      {/* O — Bar 8 */}
      <rect x={115} y={y(8)} width={12} height={BAR_H} />
      <rect x={175} y={y(8)} width={20} height={BAR_H} />

      {/* O — Bar 9: bottom cap */}
      <rect x={115} y={y(9)} width={80} height={BAR_H} />

      {/*
        ── R ──
        Origin x=225. Letter width ~85.
        Left stem full-height. Top half has a right side that closes
        like the bump of an R. Bottom half has the diagonal leg that
        starts at center and runs to far right at bottom.

        Bars 0–4: stem + bump (right side of arch)
        Bar 4: stem only + mid-bar spans full width (crossbar)
        Bars 5–9: stem + diagonal leg (each bar the leg shifts right)

        Bump right edges (bars 0-4):
          Bar 0: full cap  x=225 w=70
          Bar 1: stem x=225 w=12, right x=295 w=15
          Bar 2: stem x=225 w=12, right x=298 w=12
          Bar 3: stem x=225 w=12, right x=295 w=15
          Bar 4: full crossbar x=225 w=70 (mid crossbar)

        Leg (bars 5-9) — leg starts at center (x≈260) moving right:
          Bar 5: stem x=225 w=12, leg x=262 w=18
          Bar 6: stem x=225 w=12, leg x=272 w=18
          Bar 7: stem x=225 w=12, leg x=282 w=18
          Bar 8: stem x=225 w=12, leg x=292 w=18
          Bar 9: stem x=225 w=12, leg x=302 w=18
      */}

      {/* R — Bar 0: top cap (full) */}
      <rect x={225} y={y(0)} width={70} height={BAR_H} />

      {/* R — Bar 1: stem + arch right */}
      <rect x={225} y={y(1)} width={12} height={BAR_H} />
      <rect x={295} y={y(1)} width={15} height={BAR_H} />

      {/* R — Bar 2: stem + arch right (deepest) */}
      <rect x={225} y={y(2)} width={12} height={BAR_H} />
      <rect x={298} y={y(2)} width={12} height={BAR_H} />

      {/* R — Bar 3: stem + arch right */}
      <rect x={225} y={y(3)} width={12} height={BAR_H} />
      <rect x={295} y={y(3)} width={15} height={BAR_H} />

      {/* R — Bar 4: full crossbar */}
      <rect x={225} y={y(4)} width={70} height={BAR_H} />

      {/* R — Bar 5: stem + leg starting center */}
      <rect x={225} y={y(5)} width={12} height={BAR_H} />
      <rect x={260} y={y(5)} width={20} height={BAR_H} />

      {/* R — Bar 6 */}
      <rect x={225} y={y(6)} width={12} height={BAR_H} />
      <rect x={272} y={y(6)} width={18} height={BAR_H} />

      {/* R — Bar 7 */}
      <rect x={225} y={y(7)} width={12} height={BAR_H} />
      <rect x={283} y={y(7)} width={18} height={BAR_H} />

      {/* R — Bar 8 */}
      <rect x={225} y={y(8)} width={12} height={BAR_H} />
      <rect x={294} y={y(8)} width={18} height={BAR_H} />

      {/* R — Bar 9: stem + leg at far right */}
      <rect x={225} y={y(9)} width={12} height={BAR_H} />
      <rect x={305} y={y(9)} width={18} height={BAR_H} />

      {/*
        ── K ──
        Origin x=335. Letter width ~100.
        Left stem full-height.
        Upper arm: each bar above center has a right chunk that shifts
          left as we go up (pointing upper-right from mid).
        Lower arm: each bar below center has a right chunk that shifts
          right as we go down (pointing lower-right from mid).

        Upper arm (bars 0-4, bar 4 = join point at mid):
          Bar 0: stem x=335 w=12, arm x=415 w=18  (topmost = rightmost)
          Bar 1: stem x=335 w=12, arm x=400 w=18
          Bar 2: stem x=335 w=12, arm x=385 w=18
          Bar 3: stem x=335 w=12, arm x=370 w=18
          Bar 4: stem x=335 w=12, arm x=360 w=18  (junction, meet stem)

        Lower arm (bars 5-9):
          Bar 5: stem x=335 w=12, leg x=360 w=18
          Bar 6: stem x=335 w=12, leg x=373 w=18
          Bar 7: stem x=335 w=12, leg x=386 w=18
          Bar 8: stem x=335 w=12, leg x=399 w=18
          Bar 9: stem x=335 w=12, leg x=412 w=18  (bottommost = rightmost)
      */}

      {/* K — Bar 0: stem + arm top (rightmost) */}
      <rect x={335} y={y(0)} width={12} height={BAR_H} />
      <rect x={415} y={y(0)} width={18} height={BAR_H} />

      {/* K — Bar 1 */}
      <rect x={335} y={y(1)} width={12} height={BAR_H} />
      <rect x={400} y={y(1)} width={18} height={BAR_H} />

      {/* K — Bar 2 */}
      <rect x={335} y={y(2)} width={12} height={BAR_H} />
      <rect x={385} y={y(2)} width={18} height={BAR_H} />

      {/* K — Bar 3 */}
      <rect x={335} y={y(3)} width={12} height={BAR_H} />
      <rect x={370} y={y(3)} width={18} height={BAR_H} />

      {/* K — Bar 4: junction (arm meets stem gap) */}
      <rect x={335} y={y(4)} width={12} height={BAR_H} />
      <rect x={358} y={y(4)} width={18} height={BAR_H} />

      {/* K — Bar 5: first leg bar */}
      <rect x={335} y={y(5)} width={12} height={BAR_H} />
      <rect x={358} y={y(5)} width={18} height={BAR_H} />

      {/* K — Bar 6 */}
      <rect x={335} y={y(6)} width={12} height={BAR_H} />
      <rect x={373} y={y(6)} width={18} height={BAR_H} />

      {/* K — Bar 7 */}
      <rect x={335} y={y(7)} width={12} height={BAR_H} />
      <rect x={388} y={y(7)} width={18} height={BAR_H} />

      {/* K — Bar 8 */}
      <rect x={335} y={y(8)} width={12} height={BAR_H} />
      <rect x={403} y={y(8)} width={18} height={BAR_H} />

      {/* K — Bar 9: stem + leg bottom (rightmost) */}
      <rect x={335} y={y(9)} width={12} height={BAR_H} />
      <rect x={418} y={y(9)} width={18} height={BAR_H} />
    </svg>
  );
}
