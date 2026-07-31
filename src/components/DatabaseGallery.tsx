import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { go } from '../board/boards'
import { coverUrl } from '../board/cover'
import { cellsOf, linksOf } from '../board/database'
import type { Field } from '../board/database'
import { createRecord, getRecords } from '../board/records'
import type { Record as Row } from '../board/records'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'

function Tile({ row }: { row: Row }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!row.cover) { setUrl(''); return }
    let live = true
    void coverUrl(row.cover).then((made) => { if (live) setUrl(made) })
    return () => { live = false }
  }, [row.cover])

  return (
    <span className="grid aspect-[8/5] w-full place-items-center overflow-hidden border-b border-[#EAE6DD] bg-[#F2EFE9] text-[40px] leading-none">
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
        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#141310]"
        style={{ background: choice.tone }}
      >{choice.name}</span>
    )
  }

  if (field.type === 'checkbox') {
    return <span className="text-[11px] text-[#8A867C]">{held === true ? `☑ ${field.name}` : null}</span>
  }

  if (field.type === 'relation') {
    const names = linksOf(row, field.id)
      .map((id) => getRecords('doc').find((r) => r.id === id)?.title || t('Untitled'))
    if (!names.length) return null
    return <span className="truncate text-[11px] text-[#8A867C]">{names.join(', ')}</span>
  }

  if (field.type === 'person') {
    const mate = team.find((m) => m.userId === held)
    return <span className="text-[11px] text-[#8A867C]">{mate?.email.split('@')[0] ?? ''}</span>
  }

  return <span className="truncate text-[11px] text-[#8A867C]">{String(held)}</span>
}

// The same rows as the table, given room to be looked at rather than read. The icon stands in
// for the cover picture until pages have one.
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
          className="flex flex-col overflow-hidden rounded-xl border border-[#E2DED5] bg-[#FCFBF8] text-left transition-shadow hover:shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
        >
          <Tile row={row} />
          <span className="min-w-0 p-2.5">
            <span className="block truncate text-sm font-medium text-[#141310]">
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
        className="grid aspect-[8/5] place-items-center rounded-xl border border-dashed border-[#D8D5CD] text-sm font-semibold text-[#8A867C] hover:border-[#C8452D] hover:text-[#C8452D]"
      >
        <span className="flex items-center gap-1.5"><Plus size={14} /> {t('New row')}</span>
      </button>
    </div>
  )
}
