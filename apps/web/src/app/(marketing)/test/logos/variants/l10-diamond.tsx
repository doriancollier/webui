'use client';

/**
 * Logo10 — Diamond-cut faceted "DorkOS".
 *
 * Every letterform is built from polygon elements. All corners are chamfered
 * at 45 degrees (c=7px clip) as if carved from a gemstone. No curves, no
 * arcs — pure angular facets throughout. Solid black fill.
 *
 * Layout (viewBox 500x120):
 *   Cap baseline: y=8..112  (104px tall)
 *   Lowercase zone: y=32..112 (80px tall)
 *   Letter slots: D@0, o@82, r@152, k@210, O@282, S@370
 */
export function Logo10() {
  // Corner chamfer size for uppercase strokes
  const C = 7;
  // Smaller chamfer for lowercase / thin strokes
  const c = 5;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 120"
      fill="#000"
      role="img"
      aria-label="DorkOS"
    >
      {/*
        ── D ── x: 0..76
        Left vertical slab (x0=0, x1=18, y0=8, y1=112)
        Top horizontal bar (y0=8, y1=26)
        Bottom horizontal bar (y0=94, y1=112)
        Right cap slab (x0=58, x1=76, y0=26, y1=94) — forms the bowl right wall
        All four corners of every sub-polygon are chamfered at 45°.
      */}
      {/* D: left vertical slab */}
      <polygon
        points={`
          ${0 + C},8
          ${18 - C},8
          ${18},${8 + C}
          ${18},${112 - C}
          ${18 - C},112
          ${0 + C},112
          0,${112 - C}
          0,${8 + C}
        `.trim()}
      />
      {/* D: top horizontal bar (spans x=18..58, y=8..26, joins left slab) */}
      <polygon
        points={`
          ${18},${8 + C}
          ${58 - C},8
          ${58},${8 + C}
          ${58},${26 - C}
          ${58 - C},26
          ${18 + C},26
          ${18},${26 - C}
        `.trim()}
      />
      {/* D: bottom horizontal bar */}
      <polygon
        points={`
          ${18},${94 + C}
          ${18 + C},94
          ${58 - C},94
          ${58},${94 + C}
          ${58},${112 - C}
          ${58 - C},112
          ${18 + C},112
          ${18},${112 - C}
        `.trim()}
      />
      {/* D: right bowl cap (x=58..76, y=26..94) */}
      <polygon
        points={`
          ${58},${26 + C}
          ${58 + C},26
          ${76 - C},26
          ${76},${26 + C}
          ${76},${94 - C}
          ${76 - C},94
          ${58 + C},94
          ${58},${94 - C}
        `.trim()}
      />

      {/*
        ── o ── x: 82..148, lowercase zone y=32..112
        Outer chamfered rectangle ring.
        Inner void punched out (white chamfered rect).
        Stroke weight: 14px. Inner void inset by 14px.
      */}
      {/* o: outer ring */}
      <polygon
        points={`
          ${82 + c},32
          ${148 - c},32
          ${148},${32 + c}
          ${148},${112 - c}
          ${148 - c},112
          ${82 + c},112
          ${82},${112 - c}
          ${82},${32 + c}
        `.trim()}
      />
      {/* o: inner void (white) — inset 14px each side */}
      <polygon
        points={`
          ${82 + 14 + c},${32 + 14}
          ${148 - 14 - c},${32 + 14}
          ${148 - 14},${32 + 14 + c}
          ${148 - 14},${112 - 14 - c}
          ${148 - 14 - c},${112 - 14}
          ${82 + 14 + c},${112 - 14}
          ${82 + 14},${112 - 14 - c}
          ${82 + 14},${32 + 14 + c}
        `.trim()}
        fill="white"
      />

      {/*
        ── r ── x: 152..206, lowercase zone y=32..112
        Left vertical slab (x=152..168).
        Top horizontal arm (y=32..48, x=152..200).
        Right shoulder drop (x=190..206, y=48..68).
        All corners chamfered.
      */}
      {/* r: left vertical slab */}
      <polygon
        points={`
          ${152 + c},32
          ${168 - c},32
          ${168},${32 + c}
          ${168},${112 - c}
          ${168 - c},112
          ${152 + c},112
          ${152},${112 - c}
          ${152},${32 + c}
        `.trim()}
      />
      {/* r: top arm (joins left slab, reaches right) */}
      <polygon
        points={`
          ${168},${32 + c}
          ${168 + c},32
          ${206 - c},32
          ${206},${32 + c}
          ${206},${48 - c}
          ${206 - c},48
          ${168 + c},48
          ${168},${48 - c}
        `.trim()}
      />
      {/* r: right shoulder drop */}
      <polygon
        points={`
          ${190},${48 + c}
          ${190 + c},48
          ${206 - c},48
          ${206},${48 + c}
          ${206},${68 - c}
          ${206 - c},68
          ${190 + c},68
          ${190},${68 - c}
        `.trim()}
      />

      {/*
        ── k ── x: 210..278, cap height y=8..112
        Left vertical slab (x=210..228).
        Upper arm: diagonal parallelogram from (228,60) to (272,8) — 14px thick.
        Lower leg: diagonal parallelogram from (228,60) to (272,112) — 14px thick.
        Chamfered tips on the arm/leg endpoints.
      */}
      {/* k: left vertical slab */}
      <polygon
        points={`
          ${210 + C},8
          ${228 - C},8
          ${228},${8 + C}
          ${228},${112 - C}
          ${228 - C},112
          ${210 + C},112
          ${210},${112 - C}
          ${210},${8 + C}
        `.trim()}
      />
      {/* k: upper diagonal arm — parallelogram with chamfered tip */}
      {/* runs from mid-slab (228, y≈52-66) to upper-right (272, 8..22) */}
      <polygon
        points={`
          228,66
          228,52
          ${264 - C},8
          ${264},8
          ${272},${8 + C}
          ${272},${22 + C}
          242,66
        `.trim()}
      />
      {/* k: lower diagonal leg */}
      <polygon
        points={`
          228,54
          242,54
          ${272},${98 - C}
          ${272},${112 - C}
          ${264},112
          ${264 - C},112
          228,66
        `.trim()}
      />

      {/*
        ── O ── x: 282..360, cap height y=8..112
        Outer chamfered rectangle ring, stroke 18px.
        Inner void punched out.
      */}
      {/* O: outer ring */}
      <polygon
        points={`
          ${282 + C},8
          ${360 - C},8
          ${360},${8 + C}
          ${360},${112 - C}
          ${360 - C},112
          ${282 + C},112
          ${282},${112 - C}
          ${282},${8 + C}
        `.trim()}
      />
      {/* O: inner void — inset 18px */}
      <polygon
        points={`
          ${282 + 18 + C},${8 + 18}
          ${360 - 18 - C},${8 + 18}
          ${360 - 18},${8 + 18 + C}
          ${360 - 18},${112 - 18 - C}
          ${360 - 18 - C},${112 - 18}
          ${282 + 18 + C},${112 - 18}
          ${282 + 18},${112 - 18 - C}
          ${282 + 18},${8 + 18 + C}
        `.trim()}
        fill="white"
      />

      {/*
        ── S ── x: 370..490, cap height y=8..112
        Top horizontal bar (y=8..26).
        Middle horizontal bar (y=55..69).
        Bottom horizontal bar (y=94..112).
        Upper-left vertical (x=370..388, y=26..69) — left side of top half.
        Lower-right vertical (x=472..490, y=55..94) — right side of bottom half.
        All corners chamfered.
      */}
      {/* S: top bar */}
      <polygon
        points={`
          ${370 + C},8
          ${490 - C},8
          ${490},${8 + C}
          ${490},${26 - C}
          ${490 - C},26
          ${370 + C},26
          ${370},${26 - C}
          ${370},${8 + C}
        `.trim()}
      />
      {/* S: middle bar */}
      <polygon
        points={`
          ${370 + C},55
          ${490 - C},55
          ${490},${55 + C}
          ${490},${69 - C}
          ${490 - C},69
          ${370 + C},69
          ${370},${69 - C}
          ${370},${55 + C}
        `.trim()}
      />
      {/* S: bottom bar */}
      <polygon
        points={`
          ${370 + C},94
          ${490 - C},94
          ${490},${94 + C}
          ${490},${112 - C}
          ${490 - C},112
          ${370 + C},112
          ${370},${112 - C}
          ${370},${94 + C}
        `.trim()}
      />
      {/* S: upper-left vertical slab (joins top bar to middle bar, left side) */}
      <polygon
        points={`
          ${370},${26 + C}
          ${370 + C},26
          ${388 - C},26
          ${388},${26 + C}
          ${388},${69 - C}
          ${388 - C},69
          ${370 + C},69
          ${370},${69 - C}
        `.trim()}
      />
      {/* S: lower-right vertical slab (joins middle bar to bottom bar, right side) */}
      <polygon
        points={`
          ${472},${55 + C}
          ${472 + C},55
          ${490 - C},55
          ${490},${55 + C}
          ${490},${94 - C}
          ${490 - C},94
          ${472 + C},94
          ${472},${94 - C}
        `.trim()}
      />
    </svg>
  );
}
