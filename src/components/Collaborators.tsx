import { t } from '../i18n'
import { Eye } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getAda, setAdaOff, subscribeAda } from '../board/ada'
import { GUIDE } from '../board/brand'
import { awareness } from '../board/doc'
import { initials, me } from '../board/me'
import { requestRender, useBoardStore } from '../board/store'
import { realtimeOn, subscribeRealtime } from '../board/realtime'
import { Popover, usePopover } from './ui'

interface Peer { id: number; name: string; color: string; avatar?: string }

export function Collaborators() {
  const [peers, setPeers] = useState<Peer[]>([])
  const following = useBoardStore((s) => s.following)
  const update = useBoardStore((s) => s.update)
  const ada = useSyncExternalStore(subscribeAda, getAda, getAda)
  const live = useSyncExternalStore(subscribeRealtime, realtimeOn, realtimeOn)
  const pop = usePopover()

  useEffect(() => {
    const sync = () => {
      const out: Peer[] = []
      awareness.getStates().forEach((state, id) => {
        if (id === awareness.clientID) return
        const user = (state as { user?: Peer }).user
        if (user) out.push({ id, name: user.name, color: user.color, avatar: user.avatar })
      })
      setPeers(out)
    }
    awareness.on('change', sync)
    sync()
    return () => awareness.off('change', sync)
  }, [])

  const guide: Peer = { id: -2, name: GUIDE.name, color: GUIDE.color }
  const all: Peer[] = [
    { id: -1, name: me.name, color: me.color, avatar: me.avatar },
    ...(ada.off ? [] : [guide]),
    ...peers,
  ]
  const shown = all.slice(0, 4)
  const extra = all.length - shown.length

  const chip = (p: Peer, size: number) => (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-md font-bold text-white"
      style={{ background: p.color, width: size, height: size, fontSize: size * 0.36 }}
    >
      {p.avatar
        ? <img src={p.avatar} alt="" className="h-full w-full object-cover" />
        : initials(p.name)}
    </span>
  )

  return (
    <div className="relative flex items-center pl-1">
      <button
        type="button"
        title={live ? `${all.length} ${t('people on this board')}` : t('Live connection unavailable')}
        onClick={pop.toggle}
        className={`flex items-center rounded-lg p-0.5 transition-[background-color,opacity] hover:bg-shade ${
          live ? '' : 'opacity-45'}`}
      >
        {shown.map((p, i) => (
          <span
            key={p.id}
            className={`relative grid h-8 w-8 place-items-center overflow-hidden rounded-md border-2 text-[11px] font-bold text-white
              ${following === p.id ? 'border-pigment' : 'border-surface'}`}
            style={{ background: p.color, marginLeft: i ? -8 : 0, zIndex: 10 - i }}
          >
            {p.avatar
              ? <img src={p.avatar} alt="" className="h-full w-full rounded-[4px] object-cover" />
              : initials(p.name)}
            {following === p.id && (
              <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-md bg-pigment">
                <Eye size={9} strokeWidth={3} className="text-white" />
              </span>
            )}
          </span>
        ))}
        {extra > 0 && (
          <span
            className="grid h-8 w-8 place-items-center rounded-md border-2 border-surface bg-shade text-[11px] font-bold text-ink-soft"
            style={{ marginLeft: -8 }}
          >
            +{extra}
          </span>
        )}
      </button>

      <Popover open={pop.open} onClose={pop.close} anchor="bottomRight" className="w-[248px]">
        <div className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-muted">
          {t('On the board')} {all.length} {t('people')}
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
          {chip(guide, 26)}
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {guide.name}
            <span className="ml-1 text-xs text-muted">{t('(guide)')}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!ada.off}
            title={t('Guidance')}
            onClick={() => setAdaOff(!ada.off)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors
              ${ada.off ? 'bg-dim' : 'bg-pigment'}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-on-pigment transition-[left]
                ${ada.off ? 'left-0.5' : 'left-[18px]'}`}
            />
          </button>
        </div>

        {all.filter((p) => p.id !== -2).map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={p.id === -1}
            onClick={() => {
              update({ following: following === p.id ? null : p.id })
              requestRender()
              pop.close()
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left
              ${p.id === -1 ? 'cursor-default' : 'hover:bg-tint'}`}
          >
            {chip(p, 26)}
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {p.name}
              {p.id === -1 && <span className="ml-1 text-xs text-muted">{t('(you)')}</span>}
            </span>
            {p.id !== -1 && (
              <span className={`shrink-0 text-xs ${following === p.id ? 'font-semibold text-pigment' : 'text-muted'}`}>
                {t(following === p.id ? 'following' : 'follow')}
              </span>
            )}
          </button>
        ))}
      </Popover>
    </div>
  )
}
