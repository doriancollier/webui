import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'DorkOS - A web UI for Claude Code'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Twitter uses the same image as OpenGraph for consistency
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FFFCF7',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Graph paper background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(139, 90, 43, 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(139, 90, 43, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo triangles */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '40px',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 100 100">
            <polygon points="50,10 90,90 10,90" fill="#E86C3A" />
          </svg>
          <svg width="60" height="60" viewBox="0 0 100 100">
            <polygon points="50,10 90,90 10,90" fill="#E86C3A" />
          </svg>
          <svg width="60" height="60" viewBox="0 0 100 100">
            <polygon points="50,10 90,90 10,90" fill="#E86C3A" />
          </svg>
        </div>

        {/* Main tagline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#2C2C2C',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            Build fast.
          </span>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#E86C3A',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            Learn faster.
          </span>
        </div>

        {/* Subhead */}
        <span
          style={{
            fontSize: '24px',
            color: '#6B6B6B',
            marginTop: '32px',
            fontWeight: 300,
          }}
        >
          Products. Art. Tools. Experiments.
        </span>

        {/* Retro stripes at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ height: '8px', background: '#E86C3A' }} />
          <div style={{ height: '8px', background: '#5B8C5A' }} />
        </div>

        {/* Studio name */}
        <span
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#9A9A9A',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          DorkOS
        </span>
      </div>
    ),
    {
      ...size,
    }
  )
}
