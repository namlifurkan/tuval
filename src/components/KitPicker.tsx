import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { go } from '../board/boards'
import { KITS, useKit as applyKit } from '../board/kits'
import { t } from '../i18n'
import { Popover } from './Popover'

// A trade's worth of databases in one click. What it makes is ordinary — the same databases
// anybody would build by hand — so there is nothing to undo but the usual archiving.
export function KitPicker() {
  const [busy, setBusy] = useState(false)

  return (
    <Popover
      width={280}
      trigger={({ toggle }) => (
        <button
          type="button"
          disabled={busy}
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-pigment hover:text-pigment disabled:opacity-40"
        >
          <Boxes size={15} /> {busy ? t('Making…') : t('Start from a kit')}
        </button>
      )}
    >
      {(close) => (
        <>
          {KITS.map((kit) => (
            <button
              key={kit.id}
              type="button"
              onClick={() => {
                close()
                setBusy(true)
                void applyKit(kit, null)
                  .then((id) => { if (id) go(`/d/${id}`); else setBusy(false) })
                  .catch(() => setBusy(false))
              }}
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-shade"
            >
              <span className="block text-[13px] font-semibold text-ink">{t(kit.name)}</span>
              <span className="block text-[11px] leading-snug text-muted">{t(kit.blurb)}</span>
              <span className="mt-0.5 block text-[10px] text-[#B6B1A6]">
                {kit.tables.map((table) => table.name).join(' · ')}
              </span>
            </button>
          ))}
        </>
      )}
    </Popover>
  )
}
