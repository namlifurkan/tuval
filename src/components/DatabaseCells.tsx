import { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { addChoice, cellsOf, setCell } from '../board/database'
import type { Choice, Field } from '../board/database'
import {
  attachmentsOf, attachmentUrl, MAX_BYTES, readableSize, removeAttachment, uploadAttachment,
} from '../board/files'
import type { Attachment } from '../board/files'
import type { Record as Row } from '../board/records'
import { displayName } from '../board/supabase'
import type { Teammate } from '../board/workspace'
import { getLang, t } from '../i18n'
import { Popover } from './Popover'

export function Tag({ choice }: { choice: Choice }) {
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[12px] font-medium text-ink"
      style={{ background: choice.tone }}
    >
      {choice.name}
    </span>
  )
}

// One picker for the three kinds of choosing: one value, several values, or a stage. What
// changes between them is how many can be on at once and whether the list comes in bands.
export function ChoiceCell({ db, row, field, many }: {
  db: Row; row: Row; field: Field; many: boolean
}) {
  const [typed, setTyped] = useState('')
  const choices = field.choices ?? []
  const raw = cellsOf(row)[field.id]
  const picked = many
    ? (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [])
    : (typeof raw === 'string' && raw ? [raw] : [])
  const held = choices.filter((c) => picked.includes(c.id))

  const toggle = (choice: Choice, close: () => void) => {
    if (!many) {
      setCell(row, field.id, picked.includes(choice.id) ? '' : choice.id)
      close()
    } else {
      const next = picked.includes(choice.id)
        ? picked.filter((id) => id !== choice.id)
        : [...picked, choice.id]
      setCell(row, field.id, next.length ? next : '')
    }
    setTyped('')
  }

  return (
    <Popover
      trigger={({ toggle: open }) => (
        <button
          type="button"
          onClick={open}
          className="flex w-full flex-wrap items-center gap-1 px-2.5 py-1.5 text-left text-sm hover:bg-paper"
        >
          {held.length
            ? held.map((c) => <Tag key={c.id} choice={c} />)
            : <span className="text-[#C6C2B6]">—</span>}
        </button>
      )}
    >
      {(close) => (
        <>
          {/* A status has the stages it was born with; inventing a fourth by typing would put a
              choice in no band at all. */}
          {field.type !== 'status' && (
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !typed.trim()) return
                const match = choices.find((c) => c.name.toLowerCase() === typed.trim().toLowerCase())
                toggle(match ?? addChoice(db, field.id, typed.trim()), close)
              }}
              placeholder={t('Find or create')}
              className="mb-1 w-full rounded-md border border-hairline bg-paper px-2 py-1 text-[13px] outline-none focus:border-pigment"
            />
          )}
          {!!held.length && (
            <button
              type="button"
              onClick={() => { setCell(row, field.id, ''); close() }}
              className="w-full rounded-md px-2 py-1 text-left text-[12px] text-muted hover:bg-shade"
            >{t('Clear')}</button>
          )}
          {choices
            .filter((c) => c.name.toLowerCase().includes(typed.trim().toLowerCase()))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c, close)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-shade"
              >
                {many && (
                  <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px]
                    ${picked.includes(c.id) ? 'border-pigment bg-pigment text-white' : 'border-[#D8D5CD]'}`}
                  >{picked.includes(c.id) ? '✓' : ''}</span>
                )}
                <Tag choice={c} />
              </button>
            ))}
        </>
      )}
    </Popover>
  )
}

const link = 'shrink-0 rounded px-1 text-[11px] font-semibold text-muted hover:text-pigment'

// An address is text until it is filled in, and then it is somewhere to go. The link only shows
// once there is something to open, so an empty cell is a cell and not a button.
export function AddressCell({ row, field }: { row: Row; field: Field }) {
  const held = cellsOf(row)[field.id]
  const value = typeof held === 'string' ? held : ''
  const href = field.type === 'email' ? `mailto:${value}` : field.type === 'phone' ? `tel:${value}` : value

  return (
    <div className="flex items-center">
      <input
        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'url'}
        value={value}
        onChange={(e) => setCell(row, field.id, e.target.value)}
        className="w-full bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none focus:bg-[#F7E9E4]"
      />
      {!!value && (
        <a href={href} target="_blank" rel="noreferrer" className={link}>{t('Open')}</a>
      )}
    </div>
  )
}

function Chip({ file, onOpen, onDrop }: {
  file: Attachment; onOpen: () => void; onDrop: () => void
}) {
  return (
    <span className="group/chip flex max-w-[160px] items-center gap-1 rounded-md border border-hairline bg-paper px-1.5 py-0.5 text-[12px]">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left hover:text-pigment">
        {file.name}
      </button>
      <button
        type="button"
        aria-label={t('Remove')}
        onClick={onDrop}
        className="shrink-0 text-[#B6B1A6] opacity-0 hover:text-[#943321] group-hover/chip:opacity-100"
      >
        <X size={10} />
      </button>
    </span>
  )
}

export function FilesCell({ row, field }: { row: Row; field: Field }) {
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const held = attachmentsOf(cellsOf(row)[field.id])

  const take = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    setFailed('')
    const added: Attachment[] = []
    for (const file of [...list]) {
      if (file.size > MAX_BYTES) { setFailed(t('Up to {size} each.', { size: readableSize(MAX_BYTES) })); continue }
      try {
        added.push(await uploadAttachment(row.id, file))
      } catch (problem) {
        setFailed(problem instanceof Error ? problem.message : t('That did not upload.'))
      }
    }
    if (added.length) setCell(row, field.id, [...held, ...added])
    setBusy(false)
    if (picker.current) picker.current.value = ''
  }

  const open = async (file: Attachment) => {
    const url = await attachmentUrl(file.path)
    if (url) window.open(url, '_blank', 'noreferrer')
  }

  const drop = (file: Attachment) => {
    const next = held.filter((f) => f.path !== file.path)
    setCell(row, field.id, next.length ? next : '')
    void removeAttachment(file.path)
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5">
      <input
        ref={picker}
        type="file"
        multiple
        onChange={(e) => void take(e.target.files)}
        className="hidden"
      />
      {held.map((file) => (
        <Chip key={file.path} file={file} onOpen={() => void open(file)} onDrop={() => drop(file)} />
      ))}
      <button
        type="button"
        disabled={busy}
        aria-label={t('Attach a file')}
        title={failed || t('Attach a file')}
        onClick={() => picker.current?.click()}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:bg-shade hover:text-pigment disabled:opacity-40
          ${failed ? 'text-[#943321]' : ''}`}
      >
        <Paperclip size={12} />
      </button>
    </div>
  )
}

// The stamps. Shown the way a person reads a date rather than the way a database stores one.
export function StampCell({ value, kind, team }: {
  value: unknown; kind: 'time' | 'person' | 'number'; team: Teammate[]
}) {
  const shown = (() => {
    if (kind === 'number') return value ? String(value) : ''
    if (kind === 'person') {
      const mate = team.find((m) => m.userId === value)
      return mate ? displayName(mate.email) || mate.email : ''
    }
    if (typeof value !== 'string' || !value) return ''
    return new Date(value).toLocaleString(getLang() === 'tr' ? 'tr-TR' : 'en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  })()

  return (
    <span className="block truncate px-2.5 py-1.5 text-sm text-ink-soft">
      {shown || <span className="text-[#C6C2B6]">—</span>}
    </span>
  )
}

// A currency or a percentage is the same number read differently, so the mark sits beside the
// field rather than replacing what is in it.
// shortcut: no thousands separator and no per-workspace currency. Both need the number to stop
// being an input and start being a display that turns into one, which is the upgrade path.
export function NumberCell({ row, field }: { row: Row; field: Field }) {
  const held = cellsOf(row)[field.id]
  const mark = field.format === 'currency' ? '₺' : field.format === 'percent' ? '%' : ''

  return (
    <div className="flex items-center px-2.5 py-1.5">
      {field.format === 'currency' && !!mark && (
        <span className="shrink-0 pr-0.5 text-sm text-muted">{mark}</span>
      )}
      <input
        type="number"
        value={held === undefined || held === null ? '' : String(held)}
        onChange={(e) => setCell(row, field.id, e.target.value === '' ? '' : Number(e.target.value))}
        className="w-full bg-transparent text-sm text-ink outline-none"
      />
      {field.format === 'percent' && (
        <span className="shrink-0 pl-0.5 text-sm text-muted">{mark}</span>
      )}
    </div>
  )
}
