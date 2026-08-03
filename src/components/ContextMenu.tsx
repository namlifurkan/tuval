import { t } from '../i18n'
import { getIndex, getItems, patchItems } from '../board/doc'
import { exportPng } from '../board/export'
import {
  arrangeInGrid, copyStyle, deleteSelection, duplicateSelection, groupSelection, hasStyleClipboard,
  openLinkOf, pasteStyle, reorder, selectInsideFrame, ungroupSelection,
} from '../board/interaction'
import { requestRender, useBoardStore } from '../board/store'
import { firstUrl } from '../board/text'
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
    {
      label: t('Open link'),
      shortcut: t('⌘click'),
      run: () => openLinkOf(items[0].id),
      hidden: items.length !== 1 || !('text' in items[0]) || !firstUrl((items[0] as { text: string }).text),
    },
    {
      label: t('Select frame contents'),
      run: () => selectInsideFrame(items[0].id),
      hidden: items.length !== 1 || items[0].type !== 'frame',
    },
    {
      label: t('Reset bends'),
      run: () => {
        patchItems(selection.map((id) => [id, { bend: null, bends: [] }] as [Id, Record<string, unknown>]))
        requestRender()
      },
      hidden: !items.some((i) => i.type === 'connector' && (i.bend || i.bends?.length)),
    },
    {
      label: t('Export as PNG'),
      run: () => exportPng(items, items.length === 1 && items[0].type === 'frame' ? items[0].title : 'secim'),
      hidden: !items.length,
    },
    { label: 'Stili kopyala', shortcut: '⌘⌥C', run: () => copyStyle(), hidden: !items.length },
    {
      label: t('Paste style'),
      shortcut: '⌘⌥V',
      run: () => { pasteStyle(); requestRender() },
      hidden: !items.length || !hasStyleClipboard(),
    },
    {
      label: 'Izgaraya diz',
      run: () => { arrangeInGrid(); requestRender() },
      hidden: items.length < 2,
      divider: true,
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
        className="absolute z-[61] min-w-[212px] rounded-xl border border-black/5 bg-[#FCFBF8] p-1.5 shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
        style={{ left: menu.x, top: menu.y }}
      >
        {entries.map((e) => (
          <div key={e.label}>
            {e.divider && <div className="my-1 h-px bg-[#EAE6DD]" />}
            <button
              type="button"
              onClick={() => { e.run(); close() }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm
                ${e.danger ? 'text-[#A83621] hover:bg-[#F7E9E4]' : 'text-[#141310] hover:bg-[#EFEBE2]'}`}
            >
              <span>{e.label}</span>
              {e.shortcut && <span className="ml-6 text-xs text-[#8A867C]">{e.shortcut}</span>}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
