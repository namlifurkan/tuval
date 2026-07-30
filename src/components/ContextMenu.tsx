import { getIndex, getItems, patchItems } from '../board/doc'
import {
  deleteSelection, duplicateSelection, groupSelection, reorder, ungroupSelection,
} from '../board/interaction'
import { requestRender, useBoardStore } from '../board/store'
import type { Id } from '../board/types'

interface Entry {
  label: string
  shortcut?: string
  run: () => void
  hidden?: boolean
  danger?: boolean
  divider?: boolean
}

export function ContextMenu() {
  const menu = useBoardStore((s) => s.menu)
  const selection = useBoardStore((s) => s.selection)
  const update = useBoardStore((s) => s.update)
  const setSelection = useBoardStore((s) => s.setSelection)
  if (!menu) return null

  const close = () => update({ menu: null })
  const index = getIndex()
  const items = selection.map((id) => index.get(id)!).filter(Boolean)
  const locked = items.length > 0 && items.every((i) => i.locked)
  const grouped = items.some((i) => i.groupId)

  const entries: Entry[] = [
    { label: 'Duplicate', shortcut: '⌘D', run: () => duplicateSelection(), hidden: !items.length },
    {
      label: grouped ? 'Ungroup' : 'Group',
      shortcut: grouped ? '⌘⇧G' : '⌘G',
      run: () => (grouped ? ungroupSelection() : groupSelection()),
      hidden: items.length < 2 && !grouped,
    },
    { label: 'Bring to front', shortcut: '⌘⇧]', run: () => reorder('front'), hidden: !items.length, divider: true },
    { label: 'Send to back', shortcut: '⌘⇧[', run: () => reorder('back'), hidden: !items.length },
    {
      label: locked ? 'Unlock' : 'Lock',
      run: () => {
        patchItems(selection.map((id) => [id, { locked: !locked }] as [Id, Record<string, unknown>]))
        requestRender()
      },
      hidden: !items.length,
      divider: true,
    },
    {
      label: 'Select all',
      shortcut: '⌘A',
      run: () => setSelection(getItems().filter((i) => !i.locked).map((i) => i.id)),
      hidden: items.length > 0,
    },
    { label: 'Delete', shortcut: '⌫', run: () => deleteSelection(), hidden: !items.length, danger: true, divider: true },
  ].filter((e) => !e.hidden)

  return (
    <>
      <div className="fixed inset-0 z-[60]" onPointerDown={close} onContextMenu={(e) => { e.preventDefault(); close() }} />
      <div
        className="absolute z-[61] min-w-[212px] rounded-xl border border-black/5 bg-white p-1.5 shadow-[0_8px_28px_rgba(9,9,20,0.18)]"
        style={{ left: menu.x, top: menu.y }}
      >
        {entries.map((e) => (
          <div key={e.label}>
            {e.divider && <div className="my-1 h-px bg-[#EDEDF2]" />}
            <button
              type="button"
              onClick={() => { e.run(); close() }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm
                ${e.danger ? 'text-[#DC2626] hover:bg-[#FEF2F2]' : 'text-[#050038] hover:bg-[#F1F1F3]'}`}
            >
              <span>{e.label}</span>
              {e.shortcut && <span className="ml-6 text-xs text-[#9B9BAB]">{e.shortcut}</span>}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
