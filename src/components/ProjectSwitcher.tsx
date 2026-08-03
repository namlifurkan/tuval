import { useEffect, useSyncExternalStore } from 'react'
import { Check, ChevronsUpDown, Target } from 'lucide-react'
import { go } from '../board/boards'
import { PHASE_TONE, phaseOf } from '../board/projects'
import { getRecords, loadRecords, subscribeRecords } from '../board/records'
import { getScope, setScope, settleScope, subscribeScope } from '../board/scope'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Popover } from './Popover'

const projects = () => getRecords('project')

// At the top of everything else, because it decides what everything else is showing.
export function ProjectSwitcher() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, projects, projects)
  const scope = useSyncExternalStore(subscribeScope, getScope, getScope)

  useEffect(() => { if (workspace) void loadRecords('project') }, [workspace])
  useEffect(() => { settleScope() }, [rows])

  if (!workspace) return null

  const here = rows.find((r) => r.id === scope)

  return (
    <Popover
      width={230}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="mb-4 flex w-full items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2 py-1.5 text-left text-[13px] font-semibold text-ink transition-colors hover:border-pigment"
        >
          {here
            ? <Target size={13} className="shrink-0" style={{ color: PHASE_TONE[phaseOf(here.id)] }} />
            : <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-dim" />}
          <span className="min-w-0 flex-1 truncate">
            {here ? (here.title || t('Untitled project')) : t('Everything')}
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <>
          <button
            type="button"
            onClick={() => { setScope(''); close() }}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-shade"
          >
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-dim" />
            <span className="min-w-0 flex-1 truncate">{t('Everything')}</span>
            {!scope && <Check size={13} className="shrink-0 text-pigment" />}
          </button>

          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => { setScope(row.id); close() }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-shade"
            >
              <Target size={13} className="shrink-0" style={{ color: PHASE_TONE[phaseOf(row.id)] }} />
              <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled project')}</span>
              {scope === row.id && <Check size={13} className="shrink-0 text-pigment" />}
            </button>
          ))}

          <div className="my-1 h-px bg-shade" />
          <button
            type="button"
            onClick={() => { close(); go(scope ? `/w/${scope}` : '/projects') }}
            className="w-full rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-muted hover:bg-shade hover:text-pigment"
          >
            {scope ? t('Open this project') : t('All projects')}
          </button>
        </>
      )}
    </Popover>
  )
}
