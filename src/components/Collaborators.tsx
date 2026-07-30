import { Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { awareness } from '../board/doc'
import { initials, me } from '../board/me'
import { requestRender, useBoardStore } from '../board/store'

interface Peer { id: number; name: string; color: string }

export function Collaborators() {
  const [peers, setPeers] = useState<Peer[]>([])
  const following = useBoardStore((s) => s.following)
  const update = useBoardStore((s) => s.update)

  useEffect(() => {
    const sync = () => {
      const out: Peer[] = []
      awareness.getStates().forEach((state, id) => {
        if (id === awareness.clientID) return
        const user = (state as { user?: { name: string; color: string } }).user
        if (user) out.push({ id, name: user.name, color: user.color })
      })
      setPeers(out)
    }
    awareness.on('change', sync)
    sync()
    return () => awareness.off('change', sync)
  }, [])

  const shown = [{ id: -1, name: me.name, color: me.color }, ...peers].slice(0, 4)
  const extra = peers.length + 1 - shown.length

  return (
    <div className="flex items-center pl-1">
      {shown.map((p, i) => (
        <button
          key={p.id}
          type="button"
          disabled={p.id === -1}
          title={p.id === -1 ? `${p.name} (sen)` : following === p.id ? `${p.name} takibini bırak` : `${p.name} kullanıcısını takip et`}
          onClick={() => {
            update({ following: following === p.id ? null : p.id })
            requestRender()
          }}
          className={`relative grid h-8 w-8 place-items-center rounded-[2px] border-2 text-[11px] font-bold text-white
            ${following === p.id ? 'border-[#C8452D]' : 'border-[#FCFBF8]'}`}
          style={{ background: p.color, marginLeft: i ? -8 : 0, zIndex: 10 - i }}
        >
          {initials(p.name)}
          {following === p.id && (
            <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-[2px] bg-[#C8452D]">
              <Eye size={9} strokeWidth={3} className="text-white" />
            </span>
          )}
        </button>
      ))}
      {extra > 0 && (
        <div
          className="grid h-8 w-8 place-items-center rounded-[2px] border-2 border-[#FCFBF8] bg-[#EAE6DD] text-[11px] font-bold text-[#4A463E]"
          style={{ marginLeft: -8 }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
