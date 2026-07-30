import { Eye, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { awareness } from '../board/doc'
import { requestRender, useBoardStore } from '../board/store'

export function FollowBanner() {
  const following = useBoardStore((s) => s.following)
  const update = useBoardStore((s) => s.update)
  const [name, setName] = useState('')

  useEffect(() => {
    if (following === null) return
    const sync = () => {
      const state = awareness.getStates().get(following) as { user?: { name: string } } | undefined
      if (!state) {
        update({ following: null })
        return
      }
      setName(state.user?.name ?? 'Katılımcı')
    }
    awareness.on('change', sync)
    sync()
    return () => awareness.off('change', sync)
  }, [following, update])

  if (following === null) return null

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(20,19,16,0.2)]">
      <Eye size={15} strokeWidth={2.2} />
      {name} takip ediliyor
      <button
        type="button"
        onClick={() => { update({ following: null }); requestRender() }}
        className="ml-1 grid h-5 w-5 place-items-center rounded-full hover:bg-white/20"
      >
        <X size={12} strokeWidth={3} />
      </button>
    </div>
  )
}
