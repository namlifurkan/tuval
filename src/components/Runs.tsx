import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bot, RotateCcw } from 'lucide-react'
import { go } from '../board/boards'
import { getRecords, loadRecords } from '../board/records'
import { listRuns, readRun, spanOf, undoRun, undoTouch } from '../board/runs'
import type { Run, Touch } from '../board/runs'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { lastLooked, loadSeen, markSeen, subscribeSeen } from '../board/seen'
import { t } from '../i18n'
import { Shell } from './Shell'

function when(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
  return t('{n} d ago', { n: Math.floor(mins / 1440) })
}

// What a column was, in one line. A whole object dumped into the page is not review, it is
// homework; the point is to see at a glance whether the change was wanted.
function before(value: unknown): string {
  if (value === null || value === undefined || value === '') return t('empty')
  if (typeof value === 'string') return value.length > 90 ? `${value.slice(0, 90)}…` : value
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 90)
  return String(value)
}

export function Runs() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const looked = useSyncExternalStore(subscribeSeen, lastLooked, lastLooked)
  const [runs, setRuns] = useState<Run[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [touches, setTouches] = useState<Touch[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!workspace) return
    void loadSeen()
    void loadRecords('issue')
    void listRuns().then(setRuns)
  }, [workspace])

  useEffect(() => {
    if (!open) { setTouches([]); return }
    void readRun(open).then(setTouches)
  }, [open])

  const reread = async () => {
    setRuns(await listRuns())
    if (open) setTouches(await readRun(open))
  }

  const putBack = async (touch: Touch) => {
    setBusy(true)
    await undoTouch(touch)
    await reread()
    setBusy(false)
  }

  const putBackAll = async () => {
    setBusy(true)
    await undoRun(touches)
    await reread()
    setBusy(false)
  }

  const wentTo = (id: string) => {
    go(getRecords('issue').some((r) => r.id === id) ? `/i/${id}` : `/d/${id}`)
  }

  return (
    <Shell
      title={t('Agent runs')}
      action={!!runs.length && (
        <button
          type="button"
          onClick={() => void markSeen()}
          className="rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-shade hover:text-ink"
        >{t('Mark all as seen')}</button>
      )}
    >
      {!runs.length && (
        <p className="max-w-[62ch] text-sm leading-relaxed text-ink-soft">
          {t('Nothing has been written here by a key yet. When an agent writes through the API or the MCP server, everything it does in one session lands here as one run, with what each record was before it touched it.')}
        </p>
      )}

      <ul className="divide-y divide-hairline">
        {runs.map((run) => {
          const fresh = !!looked && run.ended > looked
          const showing = open === run.run
          return (
            <li key={run.run}>
              <button
                type="button"
                onClick={() => setOpen(showing ? null : run.run)}
                aria-expanded={showing}
                className="flex w-full items-baseline gap-3 py-3 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full
                    ${fresh ? 'bg-pigment' : 'bg-transparent'}`}
                />
                <Bot size={14} className="mt-0.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">
                    {run.via || t('A key')}
                    <span className="ml-2 font-mono text-[11px] font-normal text-faint">
                      {run.run}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {t('{records} records · {writes} writes · {span} · {when}', {
                      records: run.records,
                      writes: run.writes,
                      span: spanOf(run),
                      when: when(run.ended),
                    })}
                  </span>
                </span>
              </button>

              {showing && (
                <div className="pb-4 pl-9">
                  {touches.length > 1 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void putBackAll()}
                      className="mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-shade hover:text-ink disabled:opacity-50"
                    >
                      <RotateCcw size={12} />
                      {t('Put the whole run back')}
                    </button>
                  )}
                  <ul className="divide-y divide-tint">
                    {touches.map((touch) => (
                      <li key={touch.id} className="flex items-baseline gap-3 py-2">
                        <button
                          type="button"
                          onClick={() => wentTo(touch.record_id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-[13.5px] text-ink hover:underline">
                            {touch.title}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                            {touch.changed.length
                              ? touch.changed.map((field) => (
                                <span key={field} className="mr-3 inline-block">
                                  <span className="text-faint">{t(field)}</span>{' '}
                                  {before(touch.was[field])}
                                </span>
                              ))
                              : t('created here')}
                          </span>
                        </button>
                        {!!touch.changed.length && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void putBack(touch)}
                            title={t('Put this back')}
                            aria-label={t('Put this back')}
                            className="shrink-0 rounded-md p-1 text-muted hover:bg-shade hover:text-ink disabled:opacity-50"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Shell>
  )
}
