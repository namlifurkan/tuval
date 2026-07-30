import { Radio, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { awareness } from '../board/doc'
import { requestRender, useBoardStore } from '../board/store'

interface Invite { id: number; name: string; at: number }

export function SpotlightInvite() {
  const update = useBoardStore((s) => s.update)
  const following = useBoardStore((s) => s.following)
  const [invite, setInvite] = useState<Invite | null>(null)

  useEffect(() => {
    const sync = () => {
      let found: Invite | null = null
      awareness.getStates().forEach((state, id) => {
        if (id === awareness.clientID) return
        const s = state as { spotlight?: { at: number; name: string } | null }
        if (s.spotlight && Date.now() - s.spotlight.at < 15000) {
          found = { id, name: s.spotlight.name, at: s.spotlight.at }
        }
      })
      setInvite(found)
    }
    awareness.on('change', sync)
    sync()
    return () => awareness.off('change', sync)
  }, [])

  if (!invite || following === invite.id) return null

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-black/5 bg-[#FCFBF8] px-3 py-2 shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
      <Radio size={16} strokeWidth={2} className="text-[#C8452D]" />
      <span className="text-sm text-[#141310]">
        <strong>{invite.name}</strong> herkesi kendi görüşüne çağırıyor
      </span>
      <button
        type="button"
        onClick={() => { update({ following: invite.id }); requestRender() }}
        className="rounded-lg bg-[#C8452D] px-2.5 py-1 text-xs font-semibold text-white"
      >
        Katıl
      </button>
      <button
        type="button"
        onClick={() => setInvite(null)}
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-[#EFEBE2]"
      >
        <X size={13} strokeWidth={2.5} />
      </button>
    </div>
  )
}
