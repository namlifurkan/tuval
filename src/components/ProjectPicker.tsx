import { useEffect, useSyncExternalStore } from 'react'
import { getRecords, loadRecords, subscribeRecords } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'

const projects = () => getRecords('project')

// Which piece of work this belongs to, if any. "Nowhere" is the first option and a real answer:
// the quick note and the scratch board are why belonging is not compulsory.
export function ProjectPicker({ value, onPick, className }: {
  value: string | null
  onPick: (project: string | null) => void
  className?: string
}) {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, projects, projects)

  useEffect(() => { if (workspace) void loadRecords('project') }, [workspace])

  if (!workspace) return null

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onPick(e.target.value || null)}
      className={className ?? 'rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none hover:bg-shade focus:border-pigment focus:bg-surface'}
    >
      <option value="">{t('No project')}</option>
      {rows.map((row) => (
        <option key={row.id} value={row.id}>{row.title || t('Untitled project')}</option>
      ))}
    </select>
  )
}
