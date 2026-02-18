'use client';

/**
 * Logo15 — "DorkOS" in bold slab type with a horizontal inline channel.
 *
 * A single thin white stripe (~4 px) runs continuously through the vertical
 * center of every letter, splitting each glyph into a top half and a bottom
 * half. Letters are intentionally thick so the split stays legible.
 * ViewBox: 500 × 120. Fill: solid black (#000).
 */
export function Logo15() {
  // The inline gap sits at y=58, height=4 (vertical center of the 120-tall viewBox).
  // Each letter is drawn with filled rects / polygons. The gap rect is then
  // overlaid in white at the end to cut through all letters at once.

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 120"
      fill="#000"
      role="img"
      aria-label="DorkOS"
    >
      {/* ─────────────────────────────────────────────
          D  —  x: 0 … 72
          Left slab + top/bottom bars + rounded-right cap.
          Inner void reveals background, giving the bowl.
      ───────────────────────────────────────────── */}
      {/* D: left vertical slab */}
      <rect x="0" y="0" width="18" height="120" />
      {/* D: top horizontal bar */}
      <rect x="0" y="0" width="58" height="18" />
      {/* D: bottom horizontal bar */}
      <rect x="0" y="102" width="58" height="18" />
      {/* D: right-side curved cap — approximated as two rects + a path */}
      <path d="M58 0 Q80 0 80 30 L80 90 Q80 120 58 120 L44 120 Q62 120 62 90 L62 30 Q62 0 44 0 Z" />
      {/* D: inner void (bowl) */}
      <rect x="18" y="18" width="40" height="84" fill="white" />

      {/* ─────────────────────────────────────────────
          o  —  x: 88 … 148
          Thick rectangular ring (slightly shorter — mixed case feel).
      ───────────────────────────────────────────── */}
      {/* o: outer block */}
      <rect x="88" y="24" width="60" height="72" />
      {/* o: inner void */}
      <rect x="102" y="38" width="32" height="44" fill="white" />

      {/* ─────────────────────────────────────────────
          r  —  x: 156 … 206
          Vertical slab + top-right stub (no descender bowl).
      ───────────────────────────────────────────── */}
      {/* r: vertical slab */}
      <rect x="156" y="24" width="16" height="72" />
      {/* r: top horizontal bar */}
      <rect x="156" y="24" width="44" height="16" />
      {/* r: right cap of top bar */}
      <rect x="184" y="24" width="16" height="28" />

      {/* ─────────────────────────────────────────────
          k  —  x: 212 … 268
          Vertical slab + upper arm + lower arm (staircase).
      ───────────────────────────────────────────── */}
      {/* k: vertical slab */}
      <rect x="212" y="0" width="16" height="120" />
      {/* k: upper arm — two steps toward top-right */}
      <rect x="228" y="44" width="26" height="16" />
      <rect x="244" y="24" width="24" height="20" />
      <rect x="252" y="4" width="16" height="20" />
      {/* k: lower arm — two steps toward bottom-right */}
      <rect x="228" y="60" width="26" height="16" />
      <rect x="244" y="76" width="24" height="20" />
      <rect x="252" y="96" width="16" height="20" />

      {/* ─────────────────────────────────────────────
          O  —  x: 280 … 368
          Large capital O — thick rectangular ring.
      ───────────────────────────────────────────── */}
      {/* O: outer block */}
      <rect x="280" y="0" width="88" height="120" />
      {/* O: inner void */}
      <rect x="300" y="20" width="48" height="80" fill="white" />

      {/* ─────────────────────────────────────────────
          S  —  x: 376 … 500
          Built from three horizontal bars + two vertical connectors.
          Top bar + left-top connector + mid bar + right-bottom connector + bottom bar.
      ───────────────────────────────────────────── */}
      {/* S: top horizontal bar */}
      <rect x="376" y="0" width="118" height="22" />
      {/* S: left vertical connector (top half, left side) */}
      <rect x="376" y="0" width="22" height="64" />
      {/* S: mid horizontal bar */}
      <rect x="376" y="50" width="118" height="20" />
      {/* S: right vertical connector (bottom half, right side) */}
      <rect x="472" y="56" width="22" height="64" />
      {/* S: bottom horizontal bar */}
      <rect x="376" y="98" width="118" height="22" />
      {/* S: inner voids to carve the S shape */}
      {/* top-right void */}
      <rect x="398" y="22" width="96" height="28" fill="white" />
      {/* bottom-left void */}
      <rect x="376" y="70" width="96" height="28" fill="white" />

      {/* ─────────────────────────────────────────────
          INLINE CHANNEL
          A single white stripe cuts horizontally through every letter.
          y=58 places it just above the vertical midpoint of the 120-tall canvas,
          which lands in the thickest part of each glyph.
      ───────────────────────────────────────────── */}
      <rect x="0" y="57" width="500" height="4" fill="white" />
    </svg>
  );
}
