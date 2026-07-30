import {
  AlignCenter, AlignLeft, AlignRight, ArrowRight, Bold, Copy, Italic, Lock, MoveDown, MoveUp,
  Palette, PenLine, Strikethrough, Trash2, Type, Underline, Unlock,
} from 'lucide-react'
import { toScreen } from '../board/camera'
import { patchItems } from '../board/doc'
import { duplicateSelection, deleteSelection, reorder } from '../board/interaction'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { useSelectedItems } from '../board/useBoard'
import type { Align, Cap, ConnectorShape, Id, Item, StrokeStyle } from '../board/types'
import { FONT_SIZES, LINE_COLORS, SHAPE_FILLS, STICKY_COLORS } from '../board/types'
import { ColorGrid, Divider, IconButton, Popover, usePopover } from './ui'

const has = (items: Item[], type: Item['type']) => items.some((i) => i.type === type)

export function ContextToolbar() {
  const selected = useSelectedItems()
  const camera = useBoardStore((s) => s.camera)
  const editing = useBoardStore((s) => s.editing)
  const fillPop = usePopover()
  const strokePop = usePopover()
  const textPop = usePopover()
  const linePop = usePopover()

  if (!selected.length || editing) return null
  if (selected.every((i) => i.type === 'comment')) return null

  const box = boxOf(selected)
  const p = toScreen(camera, box.x + box.w / 2, box.y)
  const patch = (changes: Record<string, unknown>, filter?: (i: Item) => boolean) => {
    patchItems(selected.filter((i) => !filter || filter(i)).map((i) => [i.id, changes] as [Id, Record<string, unknown>]))
    requestRender()
  }

  const textual = selected.filter((i) => 'text' in i)
  const first = selected[0] as Item & Record<string, unknown>
  const locked = selected.every((i) => i.locked)

  return (
    <div
      className="pointer-events-auto absolute z-40"
      style={{ left: p.x, top: Math.max(70, p.y - 56), transform: 'translateX(-50%)' }}
    >
      <div className="flex items-center gap-0.5 rounded-xl border border-black/5 bg-white px-1.5 py-1 shadow-[0_4px_16px_rgba(9,9,20,0.16)]">
        {(has(selected, 'sticky') || has(selected, 'shape') || has(selected, 'text')) && (
          <div className="relative">
            <IconButton title="Fill color" onClick={fillPop.toggle}>
              <span
                className="h-5 w-5 rounded-md border border-black/10"
                style={{ background: (first.fill as string) ?? '#FFF' }}
              />
            </IconButton>
            <Popover open={fillPop.open} onClose={fillPop.close} anchor="bottom" className="w-[228px]">
              <ColorGrid
                colors={has(selected, 'sticky') ? STICKY_COLORS : SHAPE_FILLS}
                value={first.fill as string}
                onPick={(c) => patch({ fill: c }, (i) => i.type !== 'draw' && i.type !== 'connector' && i.type !== 'image')}
              />
            </Popover>
          </div>
        )}

        {(has(selected, 'shape') || has(selected, 'connector') || has(selected, 'draw')) && (
          <div className="relative">
            <IconButton title="Line color" onClick={strokePop.toggle}>
              <PenLine size={18} strokeWidth={1.8} style={{ color: (first.stroke as string) ?? '#1A1A1A' }} />
            </IconButton>
            <Popover open={strokePop.open} onClose={strokePop.close} anchor="bottom" className="w-[212px]">
              <ColorGrid
                colors={LINE_COLORS}
                value={first.stroke as string}
                onPick={(c) => patch({ stroke: c })}
                columns={6}
              />
              <div className="mt-2 flex items-center gap-2 px-1">
                <span className="text-xs text-[#585858]">Width</span>
                <input
                  type="range" min={1} max={24}
                  value={(first.strokeWidth as number) ?? 2}
                  onChange={(e) => patch({ strokeWidth: +e.target.value })}
                  className="flex-1 accent-[#4262FF]"
                />
              </div>
              <div className="mt-2 flex gap-1">
                {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => patch({ strokeStyle: st })}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize
                      ${first.strokeStyle === st ? 'bg-[#E8ECFF] text-[#4262FF]' : 'hover:bg-[#F1F1F3]'}`}
                  >{st}</button>
                ))}
              </div>
            </Popover>
          </div>
        )}

        {has(selected, 'connector') && (
          <div className="relative">
            <IconButton title="Connector style" onClick={linePop.toggle}>
              <ArrowRight size={19} strokeWidth={1.8} />
            </IconButton>
            <Popover open={linePop.open} onClose={linePop.close} anchor="bottom" className="w-[236px]">
              <div className="mb-1 px-1 text-xs font-semibold text-[#050038]">Shape</div>
              <div className="mb-2 flex gap-1">
                {(['straight', 'elbow', 'curved'] as ConnectorShape[]).map((sh) => (
                  <button
                    key={sh}
                    type="button"
                    onClick={() => patch({ shape: sh }, (i) => i.type === 'connector')}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize
                      ${first.shape === sh ? 'bg-[#E8ECFF] text-[#4262FF]' : 'hover:bg-[#F1F1F3]'}`}
                  >{sh}</button>
                ))}
              </div>
              <div className="mb-1 px-1 text-xs font-semibold text-[#050038]">Endpoints</div>
              <div className="flex gap-1">
                {(['none', 'arrow', 'triangle', 'circle', 'diamond'] as Cap[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ capEnd: c }, (i) => i.type === 'connector')}
                    className={`flex-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold capitalize
                      ${first.capEnd === c ? 'bg-[#E8ECFF] text-[#4262FF]' : 'hover:bg-[#F1F1F3]'}`}
                  >{c}</button>
                ))}
              </div>
            </Popover>
          </div>
        )}

        {textual.length > 0 && (
          <>
            <Divider />
            <div className="relative">
              <IconButton title="Text options" onClick={textPop.toggle}>
                <Type size={19} strokeWidth={1.8} />
              </IconButton>
              <Popover open={textPop.open} onClose={textPop.close} anchor="bottom" className="w-[240px]">
                <div className="mb-2 flex items-center gap-2">
                  <select
                    value={(first.fontSize as number) ?? 24}
                    onChange={(e) => patch({ fontSize: +e.target.value, autoFit: false })}
                    className="w-full rounded-lg border border-[#E6E6EB] px-2 py-1.5 text-sm"
                  >
                    {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <ColorGrid
                  colors={LINE_COLORS}
                  value={first.textColor as string}
                  onPick={(c) => patch({ textColor: c })}
                  columns={6}
                />
              </Popover>
            </div>
            <IconButton title="Bold" active={!!first.bold} onClick={() => patch({ bold: !first.bold })}>
              <Bold size={18} strokeWidth={2} />
            </IconButton>
            <IconButton title="Italic" active={!!first.italic} onClick={() => patch({ italic: !first.italic })}>
              <Italic size={18} strokeWidth={2} />
            </IconButton>
            <IconButton title="Underline" active={!!first.underline} onClick={() => patch({ underline: !first.underline })}>
              <Underline size={18} strokeWidth={2} />
            </IconButton>
            <IconButton title="Strikethrough" active={!!first.strike} onClick={() => patch({ strike: !first.strike })}>
              <Strikethrough size={18} strokeWidth={2} />
            </IconButton>
            <IconButton
              title="Align"
              onClick={() => {
                const order: Align[] = ['left', 'center', 'right']
                const next = order[(order.indexOf((first.align as Align) ?? 'center') + 1) % 3]
                patch({ align: next })
              }}
            >
              {first.align === 'left' ? <AlignLeft size={18} /> : first.align === 'right' ? <AlignRight size={18} /> : <AlignCenter size={18} />}
            </IconButton>
          </>
        )}

        <Divider />
        <IconButton title="Bring forward — ⌘]" onClick={() => reorder('forward')}>
          <MoveUp size={18} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Send backward — ⌘[" onClick={() => reorder('backward')}>
          <MoveDown size={18} strokeWidth={1.8} />
        </IconButton>
        <IconButton title={locked ? 'Unlock' : 'Lock'} onClick={() => patch({ locked: !locked })}>
          {locked ? <Unlock size={18} strokeWidth={1.8} /> : <Lock size={18} strokeWidth={1.8} />}
        </IconButton>
        <IconButton title="Duplicate — ⌘D" onClick={() => duplicateSelection()}>
          <Copy size={18} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Delete — Del" onClick={() => deleteSelection()}>
          <Trash2 size={18} strokeWidth={1.8} />
        </IconButton>
        <Palette size={0} />
      </div>
    </div>
  )
}
