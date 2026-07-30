import { Pause, Play, RotateCcw, Timer, Vote, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getIndex } from '../board/doc'
import { fitRect } from '../board/camera'
import {
  clearTimer, getTimer, getVoteState, myVotesUsed, pauseTimer, resetVotes, resumeTimer,
  startTimer, startVoting, stopVoting, subscribeSession, timerSecondsLeft, voteResults,
} from '../board/session'
import { requestRender, useBoardStore } from '../board/store'
import { IconButton, Popover, usePopover } from './ui'

const mmss = (total: number) =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`

function useSession<T>(read: () => T): T {
  return useSyncExternalStore(subscribeSession, read, read)
}

export function SessionTools() {
  const timer = useSession(getTimer)
  const vote = useSession(getVoteState)
  const [left, setLeft] = useState(timerSecondsLeft)
  const timerPop = usePopover()
  const votePop = usePopover()
  const setCamera = useBoardStore((s) => s.setCamera)
  const setSelection = useBoardStore((s) => s.setSelection)

  useEffect(() => {
    setLeft(timerSecondsLeft())
    if (!timer.endsAt) return
    const id = setInterval(() => setLeft(timerSecondsLeft()), 250)
    return () => clearInterval(id)
  }, [timer.endsAt, timer.remaining])

  const running = Boolean(timer.endsAt)
  const showTimer = running || timer.remaining > 0
  const results = vote.active ? voteResults() : []
  const used = vote.active ? myVotesUsed() : 0

  const jumpTo = (id: string) => {
    const item = getIndex().get(id)
    const el = document.querySelector('canvas')
    if (!item || !el) return
    setCamera(fitRect({ x: item.x - 300, y: item.y - 200, w: item.w + 600, h: item.h + 400 }, el.clientWidth, el.clientHeight, 0))
    setSelection([id])
    requestRender()
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-[76px] z-40 flex flex-col items-end gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-black/5 bg-[#FCFBF8] p-1 shadow-[0_4px_16px_rgba(20,19,16,0.12)]">
        {showTimer && (
          <span
            className={`px-2 font-semibold tabular-nums ${left === 0 ? 'text-[#C8452D]' : 'text-[#141310]'}`}
          >
            {mmss(left)}
          </span>
        )}
        <div className="relative">
          <IconButton title="Zamanlayıcı" active={timerPop.open || showTimer} onClick={timerPop.toggle}>
            <Timer size={18} strokeWidth={1.8} />
          </IconButton>
          <Popover open={timerPop.open} onClose={timerPop.close} anchor="bottomRight" className="w-[212px]">
            <div className="mb-1 px-1 text-xs font-semibold text-[#141310]">Süre</div>
            <div className="mb-2 grid grid-cols-4 gap-1">
              {[60, 180, 300, 600].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { startTimer(s); timerPop.close() }}
                  className="rounded-lg px-1 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
                >
                  {s / 60}dk
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => (running ? pauseTimer() : resumeTimer())}
                disabled={!showTimer}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2] disabled:opacity-35"
              >
                {running ? <Pause size={13} /> : <Play size={13} />}
                {running ? 'Duraklat' : 'Devam'}
              </button>
              <button
                type="button"
                onClick={() => { clearTimer(); timerPop.close() }}
                className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
              >
                <X size={13} /> Bitir
              </button>
            </div>
          </Popover>
        </div>

        <div className="relative">
          <IconButton title="Oylama" active={votePop.open || vote.active} onClick={votePop.toggle}>
            <Vote size={18} strokeWidth={1.8} />
          </IconButton>
          <Popover open={votePop.open} onClose={votePop.close} anchor="bottomRight" className="w-[248px]">
            {!vote.active ? (
              <>
                <div className="mb-1 px-1 text-xs font-semibold text-[#141310]">Kişi başı oy</div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { startVoting(n, 300); votePop.close() }}
                      className="rounded-lg px-1 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-1 text-[11px] leading-snug text-[#8A867C]">
                  Oylama açıkken item'lara tıklayarak oy ver, tekrar tıklayınca oyunu geri al.
                </p>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-[#141310]">
                    Oyların: {used}/{vote.perPerson}
                  </span>
                  <button
                    type="button"
                    onClick={() => { resetVotes() }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#8A867C] hover:text-[#C8452D]"
                  >
                    <RotateCcw size={11} /> Sıfırla
                  </button>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {results.length === 0 && (
                    <p className="px-1 py-2 text-[11px] text-[#8A867C]">Henüz oy yok.</p>
                  )}
                  {results.map(([id, count], i) => {
                    const item = getIndex().get(id)
                    const label = item && 'text' in item ? item.text : item?.type ?? id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => jumpTo(id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#EFEBE2]"
                      >
                        <span className="w-4 text-[#8A867C]">{i + 1}.</span>
                        <span className="min-w-0 flex-1 truncate">{label || '(boş)'}</span>
                        <span className="font-semibold text-[#C8452D]">{count}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => { stopVoting(); votePop.close(); requestRender() }}
                  className="mt-2 w-full rounded-lg bg-[#C8452D] px-2 py-1.5 text-xs font-semibold text-white"
                >
                  Oylamayı bitir
                </button>
              </>
            )}
          </Popover>
        </div>
      </div>
    </div>
  )
}
