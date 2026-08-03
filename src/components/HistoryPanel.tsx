import { t } from '../i18n'
import { History, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import {
  deleteVersion, getVersions, maybeAutoSave, restoreVersion, saveVersion, subscribeHistory,
} from '../board/history'
import { requestRender, useBoardStore } from '../board/store'

const when = (at: number) => {
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
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
    <div className="absolute right-4 top-[76px] z-40 flex max-h-[calc(100dvh-160px)] w-[280px] flex-col rounded-xl border border-black/5 bg-surface shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
      <div className="flex items-center justify-between border-b border-shade px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <History size={14} strokeWidth={2} />
          {t('Versions')} ({versions.length})
        </span>
        <button
          type="button"
          onClick={() => update({ historyPanel: false })}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-tint"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          const label = prompt(t('Version name'), t('Checkpoint'))
          if (label !== null) saveVersion(label)
        }}
        className="m-2 rounded-lg bg-pigment px-2 py-1.5 text-xs font-semibold text-on-pigment"
      >
        {t('Save current state')}
      </button>

      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
        {versions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted">
            {t('No versions yet. The board is also saved automatically every 10 minutes.')}
          </p>
        )}
        {versions.map((v) => (
          <div key={v.id} className="group mb-1 rounded-lg p-2 hover:bg-tint">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-ink">{v.label}</span>
              <span className="shrink-0 text-[10px] text-muted">{when(v.at)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[11px] text-muted">{v.by} · {v.count} {t(v.count === 1 ? 'item' : 'items')}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  title={t('Restore this version')}
                  onClick={() => {
                    if (confirm(t('Restore version "{name}"? The current state is saved first.', { name: v.label }))) {
                      saveVersion(t('Before going back'))
                      restoreVersion(v.id)
                      requestRender()
                    }
                  }}
                  className="grid h-6 w-6 place-items-center rounded-md text-ink hover:bg-shade"
                >
                  <RotateCcw size={12} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  title={t('Delete')}
                  onClick={() => deleteVersion(v.id)}
                  className="grid h-6 w-6 place-items-center rounded-md text-pigment-deep hover:bg-pigment-wash"
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
