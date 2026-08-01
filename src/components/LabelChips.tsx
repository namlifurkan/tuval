import type { Label } from '../board/issues'

// Labels as they appear beside a title: small, coloured, and never more than three, because a
// line of eight chips is a line nobody reads.
const MOST = 3

export function LabelChips({ known, worn }: { known: Label[]; worn: string[] }) {
  const held = known.filter((l) => worn.includes(l.id))
  if (!held.length) return null

  return (
    <span className="flex shrink-0 items-center gap-1">
      {held.slice(0, MOST).map((label) => (
        <span
          key={label.id}
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#141310]"
          style={{ background: label.tone }}
        >{label.name}</span>
      ))}
      {held.length > MOST && (
        <span className="text-[10px] text-[#B6B1A6]">+{held.length - MOST}</span>
      )}
    </span>
  )
}
