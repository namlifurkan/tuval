import { useEffect, useState } from 'react'
import { awareness } from '../board/doc'
import { initials, me } from '../board/me'

interface Peer { id: number; name: string; color: string }

export function Collaborators() {
  const [peers, setPeers] = useState<Peer[]>([])

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
        <div
          key={p.id}
          title={p.id === -1 ? `${p.name} (sen)` : p.name}
          className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white"
          style={{ background: p.color, marginLeft: i ? -8 : 0, zIndex: 10 - i }}
        >
          {initials(p.name)}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#EAE6DD] text-[11px] font-bold text-[#4A463E]"
          style={{ marginLeft: -8 }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
