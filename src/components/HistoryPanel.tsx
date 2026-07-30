import { History, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import {
  deleteVersion, getVersions, maybeAutoSave, restoreVersion, saveVersion, subscribeHistory,
} from '../board/history'
import { requestRender, useBoardStore } from '../board/store'

const when = (at: number) => {
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`
  if (mins < 1440) return `${Math.floor(mins / 60)} sa önce`
  return new Date(at).toLocaleDateString('tr-TR')
}

export function HistoryPanel() {
  const open = useBoardStore((s) => s.historyPanel)
  const update = useBoardStore((s) => s.update)
  const versions = useSyncExternalStore(subscribeHistory, getVersions, getVersions)

  useEffect(() => {
    const id = setInterval(maybeAutoSave, 60000)
    return () => clearInterval(id)
  }, [])

  if (!open) return null

  return (
    <div className="absolute right-4 top-[76px] z-40 flex max-h-[calc(100dvh-160px)] w-[280px] flex-col rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[0_8px_28px_rgba(20,19,16,0.16)]">
      <div className="flex items-center justify-between border-b border-[#EAE6DD] px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#141310]">
          <History size={14} strokeWidth={2} />
          Sürümler ({versions.length})
        </span>
        <button
          type="button"
          onClick={() => update({ historyPanel: false })}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#EFEBE2]"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          const label = prompt('Sürüm adı', 'Kontrol noktası')
          if (label !== null) saveVersion(label)
        }}
        className="m-2 rounded-lg bg-[#C8452D] px-2 py-1.5 text-xs font-semibold text-white"
      >
        Şu anki hâli kaydet
      </button>

      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
        {versions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-[#8A867C]">
            Henüz sürüm yok. Board her 10 dakikada bir kendiliğinden de kaydedilir.
          </p>
        )}
        {versions.map((v) => (
          <div key={v.id} className="group mb-1 rounded-lg p-2 hover:bg-[#EFEBE2]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-[#141310]">{v.label}</span>
              <span className="shrink-0 text-[10px] text-[#8A867C]">{when(v.at)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[11px] text-[#8A867C]">{v.by} · {v.count} öğe</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  title="Bu sürüme dön"
                  onClick={() => {
                    if (confirm(`"${v.label}" sürümüne dönülsün mü? Şu anki hâl önce kaydedilir.`)) {
                      saveVersion('Geri dönmeden önce')
                      restoreVersion(v.id)
                      requestRender()
                    }
                  }}
                  className="grid h-6 w-6 place-items-center rounded-md text-[#141310] hover:bg-[#EAE6DD]"
                >
                  <RotateCcw size={12} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  title="Sil"
                  onClick={() => deleteVersion(v.id)}
                  className="grid h-6 w-6 place-items-center rounded-md text-[#DC2626] hover:bg-[#FEF2F2]"
                >
                  <Trash2 size={12} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
