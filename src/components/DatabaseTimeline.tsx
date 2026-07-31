import { useState } from 'react'
import { go } from '../board/boards'
import { addDays, daysApart, setCells, spanOf, today } from '../board/database'
import type { Field, Span, View } from '../board/database'
import type { Record as Row } from '../board/records'
import { getLang, t } from '../i18n'

const DAY = 26
const NAMES = 190

// Two weeks of air either side of the work, so a bar is never flush against the edge and there
// is somewhere to drag a row to when it needs to start earlier than anything else does.
const MARGIN = 14
const LEAST = 45

function extent(spans: Span[]): { from: string; days: number } {
  const at = today()
  const starts = spans.map((s) => s.start).concat(at)
  const ends = spans.map((s) => s.end).concat(at)
  const from = addDays(starts.reduce((a, b) => (a < b ? a : b)), -MARGIN)
  const to = addDays(ends.reduce((a, b) => (a > b ? a : b)), MARGIN)
  return { from, days: Math.max(LEAST, daysApart(from, to) + 1) }
}

type Grab = { id: string; edge: 'move' | 'end'; from: number; span: Span }

export function DatabaseTimeline({ rows, view, fields }: {
  rows: Row[]
  view: View
  fields: Field[]
}) {
  const [grab, setGrab] = useState<Grab | null>(null)
  const [shift, setShift] = useState(0)

  const starting = fields.find((f) => f.id === view.dateBy)
  if (!starting) {
    return (
      <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
        {t('A timeline lays rows out by a date column. Add one, then choose it above.')}
      </p>
    )
  }

  const placed = rows
    .map((row) => ({ row, span: spanOf(row, view) }))
    .filter((held): held is { row: Row; span: Span } => !!held.span)
    .sort((a, b) => a.span.start.localeCompare(b.span.start))

  const { from, days } = extent(placed.map((p) => p.span))
  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB'
  const axis = Array.from({ length: days }, (_, i) => addDays(from, i))

  // The bar being dragged is drawn where the pointer has taken it; the columns it is written to
  // are only touched on release, so a drag across a month is one write and not thirty.
  const shown = (id: string, span: Span): Span => {
    if (grab?.id !== id || !shift) return span
    return grab.edge === 'move'
      ? { start: addDays(span.start, shift), end: addDays(span.end, shift) }
      : { start: span.start, end: addDays(span.end, Math.max(shift, daysApart(span.end, span.start))) }
  }

  const move = (e: React.PointerEvent) => {
    if (!grab) return
    setShift(Math.round((e.clientX - grab.from) / DAY))
  }

  const release = () => {
    if (grab && shift) {
      const row = rows.find((r) => r.id === grab.id)
      const next = shown(grab.id, grab.span)
      if (row) {
        setCells(row, {
          ...(grab.edge === 'move' ? { [starting.id]: next.start } : {}),
          ...(view.endBy ? { [view.endBy]: next.end } : {}),
        })
      }
    }
    setGrab(null)
    setShift(0)
  }

  return (
    <div className="mt-4">
      {!view.endBy && (
        <p className="mb-2 text-[11px] text-[#8A867C]">
          {t('Every bar is one day wide until a second date column says where it ends.')}
        </p>
      )}

      <div
        onPointerMove={move}
        onPointerUp={release}
        onPointerLeave={release}
        className="overflow-x-auto rounded-xl border border-[#E2DED5] bg-[#FCFBF8]"
      >
        <div style={{ width: NAMES + days * DAY }}>
          <div className="sticky top-0 flex border-b border-[#E2DED5] bg-[#F7F5F0]">
            <div
              className="shrink-0 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#8A867C]"
              style={{ width: NAMES }}
            >{starting.name}</div>
            <div className="flex">
              {axis.map((iso) => {
                const first = iso.slice(8) === '01'
                const now = iso === today()
                return (
                  <div
                    key={iso}
                    style={{ width: DAY }}
                    className={`shrink-0 py-1.5 text-center text-[10px] leading-tight
                      ${first ? 'border-l border-[#D8D5CD] font-bold text-[#141310]' : 'text-[#B6B1A6]'}`}
                  >
                    {first && (
                      <span className="block truncate">
                        {new Date(`${iso}T00:00:00Z`)
                          .toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })}
                      </span>
                    )}
                    <span className={now ? 'rounded-full bg-[#C8452D] px-1 font-bold text-white' : ''}>
                      {Number(iso.slice(8))}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {placed.map(({ row, span }) => {
            const at = shown(row.id, span)
            const left = daysApart(from, at.start) * DAY
            const width = (daysApart(at.start, at.end) + 1) * DAY
            return (
              <div key={row.id} className="flex items-center border-b border-[#EAE6DD] last:border-0">
                <button
                  type="button"
                  onClick={() => go(`/d/${row.id}`)}
                  style={{ width: NAMES }}
                  className="shrink-0 truncate px-2.5 py-2 text-left text-[13px] text-[#141310] hover:text-[#C8452D]"
                >
                  {row.icon && <span className="mr-1.5">{row.icon}</span>}
                  {row.title || t('Untitled')}
                </button>

                <div className="relative h-8 flex-1">
                  <div
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId)
                      setGrab({ id: row.id, edge: 'move', from: e.clientX, span })
                    }}
                    style={{ left, width }}
                    className="absolute top-1 flex h-6 cursor-grab items-center rounded-md bg-[#C8452D] pl-2 pr-1 text-[11px] font-semibold text-white select-none hover:bg-[#A83621]"
                  >
                    <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled')}</span>
                    {!!view.endBy && (
                      <span
                        aria-hidden
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          e.currentTarget.setPointerCapture(e.pointerId)
                          setGrab({ id: row.id, edge: 'end', from: e.clientX, span })
                        }}
                        className="h-4 w-1.5 shrink-0 cursor-col-resize rounded-sm bg-white/50"
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {!placed.length && (
            <p className="px-2.5 py-4 text-[13px] text-[#8A867C]">
              {t('No row has a date in that column yet.')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
