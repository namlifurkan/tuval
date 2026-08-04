import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { go } from '../board/boards'
import { coverUrl } from '../board/cover'
import { cellsOf, linksOf } from '../board/database'
import type { Field } from '../board/database'
import { attachmentUrl, attachmentsOf } from '../board/files'
import { createRecord, getRecords } from '../board/records'
import type { Record as Row } from '../board/records'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'

const PICTURE = /\.(png|jpe?g|gif|webp|avif|svg)$/i

export function pictureOf(row: Row, fields: Field[]): string {
  const cells = cellsOf(row)
  for (const field of fields) {
    if (field.type !== 'files') continue
    const shot = attachmentsOf(cells[field.id]).find((a) => PICTURE.test(a.path))
    if (shot) return shot.path
  }
  return ''
}

function Tile({ row, fields }: { row: Row; fields: Field[] }) {
  const [url, setUrl] = useState('')
  const picture = row.cover ? '' : pictureOf(row, fields)

  useEffect(() => {
    const asked = row.cover ? coverUrl(row.cover) : picture ? attachmentUrl(picture) : null
    if (!asked) { setUrl(''); return }
    let live = true
    void asked.then((made) => { if (live) setUrl(made) })
    return () => { live = false }
  }, [row.cover, picture])

  return (
    <span className="grid aspect-[8/5] w-full place-items-center overflow-hidden border-b border-shade bg-paper text-[40px] leading-none">
      {url
        ? <img src={url} alt="" className="h-full w-full object-cover" />
        : row.icon}
    </span>
  )
}

function Value({ row, field, team }: { row: Row; field: Field; team: Teammate[] }) {
  const held = cellsOf(row)[field.id]
  if (held === undefined || held === null || held === '') return null

  if (field.type === 'select') {
    const choice = (field.choices ?? []).find((c) => c.id === held)
    if (!choice) return null
    return (
      <span
        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink"
        style={{ background: choice.tone }}
      >{choice.name}</span>
    )
  }

  if (field.type === 'checkbox') {
    return <span className="text-[11px] text-muted">{held === true ? `☑ ${field.name}` : null}</span>
  }

  if (field.type === 'relation') {
    const names = linksOf(row, field.id)
      .map((id) => getRecords('doc').find((r) => r.id === id)?.title || t('Untitled'))
    if (!names.length) return null
    return <span className="truncate text-[11px] text-muted">{names.join(', ')}</span>
  }

  if (field.type === 'person') {
    const mate = team.find((m) => m.userId === held)
    return <span className="text-[11px] text-muted">{mate?.email.split('@')[0] ?? ''}</span>
  }

  return <span className="truncate text-[11px] text-muted">{String(held)}</span>
}

// The same rows as the table, given room to be looked at rather than read. A row with no cover
// of its own is shown by the first picture attached to it, and the icon only when it has neither.
export function DatabaseGallery({ dbId, rows, fields, team }: {
  dbId: string
  rows: Row[]
  fields: Field[]
  team: Teammate[]
}) {
  return (
    <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => go(`/d/${row.id}`)}
          className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface text-left transition-shadow hover:shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
        >
          <Tile row={row} fields={fields} />
          <span className="min-w-0 p-2.5">
            <span className="block truncate text-sm font-medium text-ink">
              {row.title || t('Untitled')}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {fields.slice(0, 3).map((field) => (
                <Value key={field.id} row={row} field={field} team={team} />
              ))}
            </span>
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => void createRecord('', 'doc', dbId)}
        className="grid aspect-[8/5] place-items-center rounded-xl border border-dashed border-rule text-sm font-semibold text-muted hover:border-pigment hover:text-pigment"
      >
        <span className="flex items-center gap-1.5"><Plus size={14} /> {t('New row')}</span>
      </button>
    </div>
  )
}
