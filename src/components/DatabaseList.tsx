import { go } from '../board/boards'
import { cellsOf, cellText, COMPUTED, valueOf } from '../board/database'
import type { Field } from '../board/database'
import type { Record as Row } from '../board/records'
import { t } from '../i18n'

// The quietest view: one line a row, the name and whatever else fits. Notion's list is what
// people reach for when a table is too much furniture for six notes.
const SHOWN = 3

const shortOf = (row: Row, field: Field, fields: Field[]): string => {
  if (COMPUTED.includes(field.type)) return cellText(row, field, fields)
  const held = valueOf(row, field, fields)
  if (held === undefined || held === null || held === '') return ''
  if (Array.isArray(held)) {
    const names = held
      .map((id) => field.choices?.find((c) => c.id === id)?.name)
      .filter(Boolean)
    return names.length ? names.join(', ') : `${held.length}`
  }
  if (held === true) return field.name
  if (field.choices) return field.choices.find((c) => c.id === held)?.name ?? ''
  return String(held)
}

export function DatabaseList({ rows, fields }: { rows: Row[]; fields: Field[] }) {
  const shown = fields.filter((f) => !f.hidden).slice(0, SHOWN)

  return (
    <div className="mt-4 divide-y divide-shade border-y border-shade">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => go(`/d/${row.id}`)}
          className="group flex w-full items-center gap-3 py-2 text-left"
        >
          <span className="w-4 shrink-0 text-center text-[13px]">{row.icon || '·'}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:text-pigment">
            {row.title || t('Untitled')}
          </span>
          {shown.map((field) => {
            const text = shortOf(row, field, fields)
            if (!text) return null
            const choice = field.choices?.find((c) => c.id === cellsOf(row)[field.id])
            return (
              <span
                key={field.id}
                className="hidden max-w-[160px] shrink-0 truncate rounded-md px-1.5 py-0.5 text-[11px] text-ink-soft sm:block"
                style={choice ? { background: choice.tone } : undefined}
              >{text}</span>
            )
          })}
        </button>
      ))}

      {!rows.length && (
        <p className="py-4 text-sm text-muted">{t('Nothing here yet.')}</p>
      )}
    </div>
  )
}
