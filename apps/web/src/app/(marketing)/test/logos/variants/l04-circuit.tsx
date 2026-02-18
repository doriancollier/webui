'use client';

// Stroke width and pad radius used throughout — declared once to avoid magic numbers.
const SW = 5;
const PR = 5.5;

/** Filled circle solder pad at a trace terminal or junction. */
function Pad({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={PR} fill="#000" />;
}

/**
 * Logo04 — "DOS" spelled with PCB trace paths.
 *
 * Each letter is built from right-angle stroked paths with rounded corners.
 * Filled circles mark solder pad terminals and junctions.
 * All strokes and fills are solid black (#000).
 */
export function Logo04() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 120"
      fill="none"
      stroke="#000"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="DOS"
    >
      {/*
        ── D ──────────────────────────────────────────────────────────────
        Layout origin: x=12, y=12  (letter occupies ~12–108, 12–108)

        Trace route (clockwise from top-left):
          (12,12) → right → (80,12)   [top horizontal]
          (80,12) → down  → (80,60)   [top-right vertical half]
          (80,60) → right → (96,60)   [mid bump out]
          (96,60) → down  → (96,60)   [just a pad at rightmost point]
          (96,60) → left  → (80,60)   [already covered — split into two paths]

        Simpler decomposition:
          Path A: left spine  (12,12)→(12,108)
          Path B: top rail    (12,12)→(80,12)→(80,36) [corner]
          Path C: right arch  (80,36)→(96,60)→(80,84)  (two right-angle hops via mid x)
          Path D: bottom rail (80,84)→(80,108)→(12,108)
        Each segment is a separate <path> so corner pads can sit at junctions.

        Right-angle arch approximation: two 90-degree bends
          top-right corner:   (80,12) → (80,36) — vertical drop then…
          arch right leg:     (80,36) → (96,48) → (96,60) — step right, step down
          arch left leg:      (96,60) → (96,72) → (80,84) — step down, step left
          bottom-right:       (80,84) → (80,108)
      */}

      {/* D — left spine */}
      <path d="M12,12 L12,108" />

      {/* D — top rail to arch entry */}
      <path d="M12,12 L80,12 L80,36" />

      {/* D — arch: right step then curve via right-angle hops */}
      <path d="M80,36 L96,36 L96,60" />
      <path d="M96,60 L96,84 L80,84" />

      {/* D — bottom rail from arch exit */}
      <path d="M80,84 L80,108 L12,108" />

      {/* D — mid horizontal crossbar connecting spine to arch mid-point */}
      <path d="M12,60 L80,60" />

      {/* D solder pads — terminals and junctions */}
      <Pad x={12} y={12} />
      <Pad x={80} y={12} />
      <Pad x={12} y={60} />
      <Pad x={80} y={36} />
      <Pad x={96} y={36} />
      <Pad x={96} y={60} />
      <Pad x={96} y={84} />
      <Pad x={80} y={84} />
      <Pad x={80} y={60} />
      <Pad x={12} y={108} />
      <Pad x={80} y={108} />

      {/*
        ── O ──────────────────────────────────────────────────────────────
        Layout origin: x=128  (occupies 128–236)

        Build as a rectangular ring of traces with right-angle corners.
          Top-left:     (128,12)
          Top-right:    (236,12)
          Bottom-right: (236,108)
          Bottom-left:  (128,108)

        Traces:
          Top:    (128,12) → (236,12)
          Right:  (236,12) → (236,108)
          Bottom: (236,108) → (128,108)
          Left:   (128,108) → (128,12)

        Inner window cut-out rendered as background, but since we're stroke-only
        the letter interior is naturally open. No inner path needed.

        Add mid-point pads on each side for PCB visual rhythm.
      */}

      {/* O — top trace */}
      <path d="M128,12 L236,12" />

      {/* O — right trace */}
      <path d="M236,12 L236,108" />

      {/* O — bottom trace */}
      <path d="M236,108 L128,108" />

      {/* O — left trace */}
      <path d="M128,108 L128,12" />

      {/* O solder pads — four corners + mid-points on each side */}
      <Pad x={128} y={12} />
      <Pad x={236} y={12} />
      <Pad x={236} y={108} />
      <Pad x={128} y={108} />
      <Pad x={182} y={12} />
      <Pad x={236} y={60} />
      <Pad x={182} y={108} />
      <Pad x={128} y={60} />

      {/*
        ── S ──────────────────────────────────────────────────────────────
        Layout origin: x=256  (occupies 256–388)

        S is the most complex — it reverses direction at mid.
        Decomposed into three horizontal rails and two vertical connectors:

          Top rail:     (388,12) → (256,12)          [right-to-left]
          Left drop:    (256,12) → (256,60)           [top-left corner going down]
          Mid rail:     (256,60) → (388,60)           [left-to-right]
          Right drop:   (388,60) → (388,108)          [top-right to bottom-right]
          Bottom rail:  (388,108) → (256,108)         [right-to-left]

        Each segment is a path so pads can be placed at all junctions.
      */}

      {/* S — top rail */}
      <path d="M388,12 L256,12" />

      {/* S — top-left vertical connector */}
      <path d="M256,12 L256,60" />

      {/* S — mid rail */}
      <path d="M256,60 L388,60" />

      {/* S — bottom-right vertical connector */}
      <path d="M388,60 L388,108" />

      {/* S — bottom rail */}
      <path d="M388,108 L256,108" />

      {/* S solder pads — terminals and junctions */}
      <Pad x={388} y={12} />
      <Pad x={256} y={12} />
      <Pad x={322} y={12} />
      <Pad x={256} y={60} />
      <Pad x={388} y={60} />
      <Pad x={322} y={60} />
      <Pad x={388} y={108} />
      <Pad x={256} y={108} />
      <Pad x={322} y={108} />
      <Pad x={256} y={36} />
      <Pad x={388} y={84} />
    </svg>
  );
}
