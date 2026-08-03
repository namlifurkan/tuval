import { t } from '../i18n'
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
      setName(state.user?.name ?? t('Participant'))
    }
    awareness.on('change', sync)
    sync()
    return () => awareness.off('change', sync)
  }, [following, update])

  if (following === null) return null

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-[2px] bg-pigment px-3 py-1.5 text-sm font-semibold text-on-pigment shadow-[2px_2px_0_rgba(20,19,16,0.07)]">
      <Eye size={15} strokeWidth={2.2} />
      {name} takip ediliyor
      <button
        type="button"
        onClick={() => { update({ following: null }); requestRender() }}
        className="ml-1 grid h-5 w-5 place-items-center rounded-[2px] hover:bg-on-pigment/20"
      >
        <X size={12} strokeWidth={3} />
      </button>
    </div>
  )
}
