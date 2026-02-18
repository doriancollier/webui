'use client';

export function Logo01() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 120"
      fill="#000"
      role="img"
      aria-label="DORK"
    >
      {/*
        D — rectangular block with rounded-right inner cutout.
        Two horizontal stencil gaps cut through the vertical stroke.
      */}
      {/* D outer block */}
      <rect x="8" y="10" width="14" height="100" />
      <rect x="8" y="10" width="62" height="14" />
      <rect x="8" y="96" width="62" height="14" />
      <path d="M70 10 Q96 10 96 55 Q96 110 70 110 L56 110 Q82 110 82 55 Q82 10 56 10 Z" />
      {/* D right cap fill */}
      <path d="M70 10 L56 10 L56 24 L66 24 Q78 24 78 55 Q78 96 66 96 L56 96 L56 110 L70 110 Q96 110 96 55 Q96 10 70 10 Z" />
      {/* D stencil gap 1 — horizontal cut across vertical stroke */}
      <rect x="8" y="42" width="58" height="8" fill="white" />
      {/* D stencil gap 2 */}
      <rect x="8" y="70" width="58" height="8" fill="white" />

      {/*
        O — thick rectangular ring.
        Two horizontal stencil gaps on left and right sides.
      */}
      {/* O outer rect */}
      <rect x="108" y="10" width="78" height="100" />
      {/* O inner cutout */}
      <rect x="124" y="26" width="46" height="68" fill="white" />
      {/* O stencil gap left side, top */}
      <rect x="108" y="42" width="16" height="8" fill="white" />
      {/* O stencil gap left side, bottom */}
      <rect x="108" y="70" width="16" height="8" fill="white" />
      {/* O stencil gap right side, top */}
      <rect x="170" y="42" width="16" height="8" fill="white" />
      {/* O stencil gap right side, bottom */}
      <rect x="170" y="70" width="16" height="8" fill="white" />

      {/*
        R — vertical stroke, top arch, angled leg.
        Two horizontal gaps on the vertical stroke; gap at junction of arch base.
      */}
      {/* R vertical stroke */}
      <rect x="200" y="10" width="14" height="100" />
      {/* R top horizontal bar */}
      <rect x="200" y="10" width="52" height="14" />
      {/* R middle horizontal bar */}
      <rect x="200" y="50" width="52" height="14" />
      {/* R right arch fill — top to mid */}
      <rect x="238" y="24" width="14" height="26" />
      {/* R diagonal leg going bottom-right */}
      <polygon points="214,64 228,64 262,110 248,110" />
      {/* R stencil gap on vertical stroke, top zone */}
      <rect x="200" y="37" width="14" height="6" fill="white" />
      {/* R stencil gap — diagonal cut across leg */}
      <polygon points="228,80 242,80 248,90 234,90" fill="white" />

      {/*
        K — vertical stroke, upper diagonal arm, lower diagonal leg.
        Gaps cut the junction and the mid of the vertical stroke.
      */}
      {/* K vertical stroke */}
      <rect x="296" y="10" width="14" height="100" />
      {/* K upper arm (pointing upper-right from mid) */}
      <polygon points="310,58 310,44 392,10 392,24" />
      {/* K lower leg (pointing lower-right from mid) */}
      <polygon points="310,62 310,76 392,110 392,96" />
      {/* K stencil gap on vertical stroke, upper */}
      <rect x="296" y="40" width="14" height="8" fill="white" />
      {/* K stencil gap on vertical stroke, lower */}
      <rect x="296" y="72" width="14" height="8" fill="white" />
      {/* K stencil gap across upper arm */}
      <polygon points="338,28 352,28 346,38 332,38" fill="white" />
      {/* K stencil gap across lower leg */}
      <polygon points="338,92 352,92 346,82 332,82" fill="white" />
    </svg>
  );
}
