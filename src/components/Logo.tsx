import { COLOR } from '../board/brand'

// Redrawn from public/brand/tuval-logo.png: an open canvas frame crossed by a pigment band.
// Bars are proportionally heavier than the source art so the mark survives at UI sizes.
export function Logo({ size = 24, ink = COLOR.ink, pigment = COLOR.pigment }: {
  size?: number
  ink?: string
  pigment?: string
}) {
  return (
    <svg viewBox="0 0 26 24" width={(size * 26) / 24} height={size} fill="none" aria-hidden>
      <path fill={ink} d="M2 1h18v4H2zM2 19h18v4H2zM2 1h5v22H2zM15 1h5v7h-5zM15 16h5v7h-5z" />
      <path fill={pigment} d="M6 9h19v6H6z" />
    </svg>
  )
}

export function Wordmark({ height = 20 }: { height?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: height * 0.36 }}>
      <Logo size={height} />
      <span
        className="font-semibold tracking-[-0.02em] text-[#141310]"
        style={{ fontSize: height, lineHeight: 1 }}
      >
        Tuval
      </span>
    </span>
  )
}
