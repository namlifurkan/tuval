import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { go } from '../board/boards'
import { KITS, useKit } from '../board/kits'
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
          className="flex items-center gap-1.5 rounded-lg border border-[#E2DED5] px-3 py-2 text-sm font-semibold text-[#4A463E] transition-colors hover:border-[#C8452D] hover:text-[#C8452D] disabled:opacity-40"
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
                void useKit(kit, null)
                  .then((id) => { if (id) go(`/d/${id}`); else setBusy(false) })
                  .catch(() => setBusy(false))
              }}
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-[#EAE6DD]"
            >
              <span className="block text-[13px] font-semibold text-[#141310]">{t(kit.name)}</span>
              <span className="block text-[11px] leading-snug text-[#8A867C]">{t(kit.blurb)}</span>
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
