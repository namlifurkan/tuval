import {
  AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignHorizontalJustifyCenter, AlignLeft, AlignRight,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, ArrowRight, Bold,
  Copy, Grid3x3, Italic, LayoutGrid, Lock, MoveDown, MoveUp, PenLine, Strikethrough, Trash2,
  Type, Underline, Unlock,
} from 'lucide-react'
import { toScreen } from '../board/camera'
import { patchItems } from '../board/doc'
import {
  alignSelection, arrangeInGrid, deleteSelection, distributeSelection, duplicateSelection, reorder,
} from '../board/interaction'
import type { AlignMode } from '../board/interaction'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { useSelectedItems } from '../board/useBoard'
import type { Align, Cap, ConnectorShape, Id, Item, StrokeStyle } from '../board/types'
import { FONT_SIZES, LINE_COLORS, SHAPE_FILLS, STICKY_COLORS } from '../board/types'
import { ColorGrid, Divider, HexInput, IconButton, Popover, usePopover } from './ui'

const ALIGNMENTS: [AlignMode, typeof AlignLeft, string][] = [
  ['left', AlignStartVertical, 'Sola hizala'],
  ['centerX', AlignCenterVertical, 'Yatayda ortala'],
  ['right', AlignEndVertical, 'Sağa hizala'],
  ['top', AlignStartHorizontal, 'Üste hizala'],
  ['centerY', AlignCenterHorizontal, 'Dikeyde ortala'],
  ['bottom', AlignEndHorizontal, 'Alta hizala'],
]

const has = (items: Item[], type: Item['type']) => items.some((i) => i.type === type)

export function ContextToolbar() {
  const selected = useSelectedItems()
  const camera = useBoardStore((s) => s.camera)
  const editing = useBoardStore((s) => s.editing)
  const dragging = useBoardStore((s) => s.dragging)
  const fillPop = usePopover()
  const strokePop = usePopover()
  const textPop = usePopover()
  const linePop = usePopover()
  const alignPop = usePopover()

  if (!selected.length || editing || dragging) return null
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
              <HexInput
                value={first.fill as string}
                onPick={(c) => patch({ fill: c }, (i) => i.type !== 'draw' && i.type !== 'connector' && i.type !== 'image')}
              />
              <div className="mt-2 flex items-center gap-2 px-1">
                <span className="text-xs text-[#585858]">Opaklık</span>
                <input
                  type="range" min={10} max={100}
                  value={Math.round(((first.opacity as number) ?? 1) * 100)}
                  onChange={(e) => patch({ opacity: +e.target.value / 100 })}
                  className="flex-1 accent-[#C8452D]"
                />
              </div>
            </Popover>
          </div>
        )}

        {(has(selected, 'shape') || has(selected, 'connector') || has(selected, 'draw')) && (
          <div className="relative">
            <IconButton title="Line color" onClick={strokePop.toggle}>
              <PenLine size={18} strokeWidth={1.8} style={{ color: (first.stroke as string) ?? '#141310' }} />
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
                  className="flex-1 accent-[#C8452D]"
                />
              </div>
              <div className="mt-2 flex gap-1">
                {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => patch({ strokeStyle: st })}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize
                      ${first.strokeStyle === st ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
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
              <div className="mb-1 px-1 text-xs font-semibold text-[#141310]">Shape</div>
              <div className="mb-2 flex gap-1">
                {(['straight', 'elbow', 'curved'] as ConnectorShape[]).map((sh) => (
                  <button
                    key={sh}
                    type="button"
                    onClick={() => patch({ shape: sh }, (i) => i.type === 'connector')}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize
                      ${first.shape === sh ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                  >{sh}</button>
                ))}
              </div>
              <div className="mb-1 px-1 text-xs font-semibold text-[#141310]">Endpoints</div>
              <div className="flex gap-1">
                {(['none', 'arrow', 'triangle', 'circle', 'diamond'] as Cap[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ capEnd: c }, (i) => i.type === 'connector')}
                    className={`flex-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold capitalize
                      ${first.capEnd === c ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
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
                    className="w-full rounded-lg border border-[#E2DED5] px-2 py-1.5 text-sm"
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

        {selected.length > 1 && (
          <>
            <Divider />
            <div className="relative">
              <IconButton title="Hizala ve dağıt" onClick={alignPop.toggle}>
                <LayoutGrid size={18} strokeWidth={1.8} />
              </IconButton>
              <Popover open={alignPop.open} onClose={alignPop.close} anchor="bottom" className="w-[212px]">
                <div className="mb-1 px-1 text-xs font-semibold text-[#141310]">Hizala</div>
                <div className="grid grid-cols-6 gap-0.5">
                  {ALIGNMENTS.map(([mode, Icon, label]) => (
                    <button
                      key={mode}
                      type="button"
                      title={label}
                      onClick={() => { alignSelection(mode); requestRender() }}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[#141310] hover:bg-[#EFEBE2]"
                    >
                      <Icon size={17} strokeWidth={1.8} />
                    </button>
                  ))}
                </div>
                <div className="mb-1 mt-2 px-1 text-xs font-semibold text-[#141310]">Dağıt</div>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    title="Yatayda eşit dağıt"
                    onClick={() => { distributeSelection('h'); requestRender() }}
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#EFEBE2]"
                  >
                    <AlignHorizontalDistributeCenter size={17} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    title="Dikeyde eşit dağıt"
                    onClick={() => { distributeSelection('v'); requestRender() }}
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#EFEBE2]"
                  >
                    <AlignVerticalDistributeCenter size={17} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    title="Izgaraya diz"
                    onClick={() => { arrangeInGrid(); requestRender() }}
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#EFEBE2]"
                  >
                    <Grid3x3 size={17} strokeWidth={1.8} />
                  </button>
                </div>
              </Popover>
            </div>
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
      </div>
    </div>
  )
}
