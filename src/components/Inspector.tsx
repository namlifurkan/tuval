import { readOnly, subscribeAccess } from '../board/access'
import { go } from '../board/boards'
import { canPromote, promoteToIssue, recordHref } from '../board/promote'

const CARD_TITLES: { [kind: string]: string } = {
  issue: 'Issue', doc: 'Page', database: 'Database', project: 'Project',
}
import { patchRecord, STATUSES } from '../board/records'
import { boardPeople, isAssigned, toggleAssignee } from '../board/people'
import { initials } from '../board/me'
import { isNode, layoutMindmap, rootOf } from '../board/mindmap'
import { mindmapBranch, quickCreateFromSelection } from '../board/interaction'
import { LABEL_SIZES, labelInk, STATUS_LABELS } from '../board/labels'
import { t } from '../i18n'
import { LANGS } from '../board/code'
import { codeHeight } from '../board/items'
import { useSyncExternalStore } from 'react'
import { getDockPrefs, SIZE_PX, subscribeDock } from '../board/dockPrefs'

const readDockSide = () => getDockPrefs().side

import {
  AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, Bold, Copy, Grid3x3, Italic, Lock, Maximize, MoveDown, MoveUp,
  Strikethrough, Trash2, Underline, Unlock,
} from 'lucide-react'
import { patchItem, patchItems } from '../board/doc'
import {
  alignSelection, arrangeInGrid, deleteSelection, distributeSelection, duplicateSelection,
  fitStickyToText, reorder,
} from '../board/interaction'
import type { AlignMode } from '../board/interaction'
import { addCol, addRow, anchorOf, dropCol, dropRow, growMerge, mergeAt, splitMerge } from '../board/items'
import { requestRender, useBoardStore } from '../board/store'
import { useSelectedItems } from '../board/useBoard'
import type { Align, Cap, ConnectorShape, Id, Item, StrokeStyle } from '../board/types'
import { FONT_SIZES, LINE_COLORS, SHAPE_FILLS, STICKY_COLORS } from '../board/types'
import { ColorGrid, HexInput } from './ui'

const ALIGNMENTS: [AlignMode, typeof AlignLeft, string][] = [
  ['left', AlignStartVertical, 'Align left'],
  ['centerX', AlignCenterVertical, 'Center horizontally'],
  ['right', AlignEndVertical, 'Align right'],
  ['top', AlignStartHorizontal, 'Align top'],
  ['centerY', AlignCenterHorizontal, 'Center vertically'],
  ['bottom', AlignEndHorizontal, 'Align bottom'],
]

const has = (items: Item[], type: Item['type']) => items.some((i) => i.type === type)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#EAE6DD] px-3 py-3 last:border-b-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8A867C]">{title}</h3>
      {children}
    </section>
  )
}

function Chip({
  active, onClick, title, children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`tap-target grid h-8 w-8 place-items-center rounded-lg transition-colors
        ${active ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#141310] hover:bg-[#EFEBE2]'}`}
    >
      {children}
    </button>
  )
}

export function Inspector() {
  const selected = useSelectedItems()
  const dockSide = useSyncExternalStore(subscribeDock, readDockSide, readDockSide)
  const showMinimap = useBoardStore((s) => s.showMinimap)
  const dragging = useBoardStore((s) => s.dragging)
  const ro = useSyncExternalStore(subscribeAccess, readOnly, readOnly)
  // Merging needs a target, and the only cell the board knows about is the one being edited.
  const editing = useBoardStore((s) => s.editing)

  // The panel stays up while text is being edited: changing fill or font size mid-sentence is
  // the common case, and hiding it read as "the panel does not open when I add something".
  if (!selected.length || dragging || ro) return null
  if (selected.every((i) => i.type === 'comment')) return null

  const first = selected[0] as Item & Record<string, unknown>
  const textual = selected.filter((i) => 'text' in i && i.type !== 'code')
  const code = selected.length === 1 && selected[0].type === 'code' ? selected[0] : null
  const stickies = selected.filter((i) => i.type === 'sticky')
  const frame = selected.length === 1 && selected[0].type === 'frame' ? selected[0] : null
  const mind = selected.length === 1 && isNode(selected[0]) ? selected[0] : null
  const locked = selected.every((i) => i.locked)
  const table = selected.length === 1 && selected[0].type === 'table' ? selected[0] : null
  const card = selected.length === 1 && selected[0].type === 'record' ? selected[0] : null
  const promotable = selected.filter(canPromote)
  const cell = table && editing?.id === table.id ? editing.cell ?? null : null
  const wire = selected.length === 1 && selected[0].type === 'connector' ? selected[0] : null

  const patch = (changes: Record<string, unknown>, filter?: (i: Item) => boolean) => {
    patchItems(
      selected.filter((i) => !filter || filter(i)).map((i) => [i.id, changes] as [Id, Record<string, unknown>]),
    )
    requestRender()
  }

  return (
    <aside
      style={{
        right: dockSide === 'right' ? SIZE_PX[getDockPrefs().size] + 44 : 16,
        maxHeight: `calc(100dvh - ${76 + (showMinimap && dockSide !== 'right' ? 232 : 114)}px)`,
      }}
      className="pointer-events-auto absolute top-[76px] z-30 flex w-[264px] flex-col overflow-y-auto rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
      <header className="flex items-baseline justify-between border-b border-[#EAE6DD] px-3 py-2.5">
        <span className="text-sm font-semibold text-[#141310]">
          {selected.length === 1 ? t(TYPE_LABEL[selected[0].type] ?? selected[0].type) : `${selected.length} ${t(selected.length === 1 ? 'item' : 'items')}`}
        </span>
        <span className="text-[11px] text-[#8A867C]">
          {Math.round(first.w as number)} × {Math.round(first.h as number)}
        </span>
      </header>

      {(has(selected, 'sticky') || has(selected, 'shape') || has(selected, 'text')) && (
        <Section title={t('Fill')}>
          <ColorGrid
            colors={has(selected, 'sticky') ? STICKY_COLORS : SHAPE_FILLS}
            value={first.fill as string}
            onPick={(c) => patch({ fill: c }, (i) => i.type !== 'draw' && i.type !== 'connector' && i.type !== 'image')}
          />
          <HexInput
            value={first.fill as string}
            onPick={(c) => patch({ fill: c }, (i) => i.type !== 'draw' && i.type !== 'connector' && i.type !== 'image')}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-[#4A463E]">
            {t('Opacity')}
            <input
              type="range" min={10} max={100}
              value={Math.round(((first.opacity as number) ?? 1) * 100)}
              onChange={(e) => patch({ opacity: +e.target.value / 100 })}
              className="flex-1 accent-[#C8452D]"
            />
          </label>
        </Section>
      )}

      {(has(selected, 'shape') || has(selected, 'connector') || has(selected, 'draw')) && (
        <Section title={t('Line')}>
          <ColorGrid colors={LINE_COLORS} value={first.stroke as string} onPick={(c) => patch({ stroke: c })} columns={6} />
          <label className="mt-2 flex items-center gap-2 text-xs text-[#4A463E]">
            {t('Thickness')}
            <input
              type="range" min={1} max={24}
              value={(first.strokeWidth as number) ?? 2}
              onChange={(e) => patch({ strokeWidth: +e.target.value })}
              className="flex-1 accent-[#C8452D]"
            />
          </label>
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
        </Section>
      )}

      {has(selected, 'connector') && (
        <Section title={t('Connector')}>
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
        </Section>
      )}

      {wire && (
        <Section title={t('Labels')}>
          <div className="flex items-center gap-1.5">
            <input
              value={wire.text}
              onChange={(e) => patchItem(wire.id, { text: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t('Main label')}
              className="min-w-0 flex-1 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-xs outline-none focus:border-[#C8452D]"
            />
            <input
              type="range" min={0} max={1} step={0.05}
              value={wire.labelT ?? 0.5}
              onChange={(e) => patchItem(wire.id, { labelT: Number(e.target.value) })}
              className="w-16 shrink-0 accent-[#C8452D]"
            />
          </div>
          {(wire.labels ?? []).map((label, i) => (
            <div key={i} className="mt-1 flex items-center gap-1.5">
              <input
                value={label.text}
                onChange={(e) => patchItem(wire.id, {
                  labels: (wire.labels ?? []).map((l, j) => (j === i ? { ...l, text: e.target.value } : l)),
                })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={t('Label')}
                className="min-w-0 flex-1 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-xs outline-none focus:border-[#C8452D]"
              />
              <input
                type="range" min={0} max={1} step={0.05}
                value={label.t}
                onChange={(e) => patchItem(wire.id, {
                  labels: (wire.labels ?? []).map((l, j) => (j === i ? { ...l, t: Number(e.target.value) } : l)),
                })}
                className="w-16 shrink-0 accent-[#C8452D]"
              />
              <button
                type="button"
                title={t('Remove')}
                onClick={() => patchItem(wire.id, { labels: (wire.labels ?? []).filter((_, j) => j !== i) })}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#F7E9E4] hover:text-[#A83621]"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patchItem(wire.id, {
              labels: [...(wire.labels ?? []), { t: (wire.labels ?? []).length % 2 ? 0.85 : 0.15, text: '' }],
            })}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
          >{t('Add label')}</button>
        </Section>
      )}

      {mind && (
        <Section title={t('Mind map')}>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { quickCreateFromSelection('right'); requestRender() }}
              className="flex-1 rounded-lg bg-[#F7E9E4] px-2 py-1.5 text-xs font-semibold text-[#C8452D]"
            >
              {t('Add child')} <span className="opacity-60">Tab</span>
            </button>
            <button
              type="button"
              onClick={() => { mindmapBranch(true); requestRender() }}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
            >
              {t('Add sibling')} <span className="opacity-60">↵</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => { layoutMindmap(rootOf(mind.id)); requestRender() }}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
          >
            {t('Tidy layout')}
          </button>
        </Section>
      )}

      {frame && (
        <Section title={t('Frame')}>
          <input
            value={frame.title}
            onChange={(e) => { patchItem(frame.id, { title: e.target.value }); requestRender() }}
            spellCheck={false}
            placeholder={t('Frame name')}
            className="w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-sm outline-none focus:border-[#C8452D]"
          />
          <div className="mt-2 text-xs text-[#8A867C]">{t('Assigned to')}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {boardPeople().map((person) => {
              const on = isAssigned(frame.assignees, person.id)
              return (
                <button
                  key={person.id}
                  type="button"
                  title={person.name}
                  onClick={() => {
                    patchItem(frame.id, { assignees: toggleAssignee(frame.assignees, person) })
                    requestRender()
                  }}
                  className={`flex items-center gap-1.5 rounded-md py-1 pl-1 pr-2 text-xs font-semibold transition-colors
                    ${on ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EFEBE2]'}`}
                >
                  <span
                    className="grid h-5 w-5 place-items-center rounded-md text-[9px] font-bold text-white"
                    style={{ background: person.color }}
                  >
                    {initials(person.name)}
                  </span>
                  {person.name}
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {stickies.length > 0 && (
        <Section title={t('Status')}>
          <div className="flex flex-wrap gap-1">
            {STATUS_LABELS.map((l) => {
              const on = stickies.every((i) => i.type === 'sticky' && i.label === l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => patch({ label: on ? undefined : l.id }, (i) => i.type === 'sticky')}
                  style={on ? { background: l.color, color: labelInk(l.color) } : { boxShadow: `inset 0 0 0 2px ${l.color}` }}
                  className="rounded-md px-2 py-1 text-xs font-semibold"
                >
                  {t(l.id)}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => patch({ label: undefined }, (i) => i.type === 'sticky')}
              className="rounded-md px-2 py-1 text-xs font-semibold text-[#8A867C] hover:bg-[#EFEBE2]"
            >
              {t('None')}
            </button>
          </div>
          {stickies.some((i) => i.type === 'sticky' && i.label) && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-[#8A867C]">{t('Label size')}</span>
              <select
                value={(stickies[0] as { labelSize?: number }).labelSize ?? ''}
                onChange={(e) => patch(
                  { labelSize: e.target.value ? Number(e.target.value) : undefined },
                  (i) => i.type === 'sticky',
                )}
                className="flex-1 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1 text-sm outline-none focus:border-[#C8452D]"
              >
                <option value="">{t('Auto')}</option>
                {LABEL_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </Section>
      )}

      {code && (
        <Section title={t('Code')}>
          <div className="mb-2 flex gap-1.5">
            <select
              value={code.lang}
              onChange={(e) => patch({ lang: e.target.value })}
              className="flex-1 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1 text-sm outline-none focus:border-[#C8452D]"
            >
              {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={code.fontSize}
              onChange={(e) => {
                const fontSize = Number(e.target.value)
                patch({ fontSize, h: codeHeight({ text: code.text, fontSize }) })
              }}
              className="w-[70px] rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1 text-sm outline-none focus:border-[#C8452D]"
            >
              {[11, 13, 15, 18, 22, 28].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            <Chip title={t('Light theme')} active={code.theme === 'light'} onClick={() => patch({ theme: 'light' })}>
              <span className="px-1 text-xs font-semibold">{t('Light')}</span>
            </Chip>
            <Chip title={t('Dark theme')} active={code.theme === 'dark'} onClick={() => patch({ theme: 'dark' })}>
              <span className="px-1 text-xs font-semibold">{t('Dark')}</span>
            </Chip>
            <Chip title={t('Line numbers')} active={code.showLines} onClick={() => patch({ showLines: !code.showLines })}>
              <span className="px-1 text-xs font-semibold">1 2 3</span>
            </Chip>
          </div>
        </Section>
      )}

      {textual.length > 0 && (
        <Section title={t('Text')}>
          <div className="mb-2 flex items-center gap-2">
            <select
              value={(first.fontSize as number) ?? 24}
              onChange={(e) => patch({ fontSize: +e.target.value, autoFit: false })}
              className="w-20 rounded-lg border border-[#E2DED5] px-2 py-1.5 text-sm"
            >
              {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-0.5">
              <Chip title={t('Bold')} active={!!first.bold} onClick={() => patch({ bold: !first.bold })}><Bold size={15} strokeWidth={2.4} /></Chip>
              <Chip title={t('Italic')} active={!!first.italic} onClick={() => patch({ italic: !first.italic })}><Italic size={15} strokeWidth={2.4} /></Chip>
              <Chip title={t('Underline')} active={!!first.underline} onClick={() => patch({ underline: !first.underline })}><Underline size={15} strokeWidth={2.4} /></Chip>
              <Chip title={t('Strikethrough')} active={!!first.strike} onClick={() => patch({ strike: !first.strike })}><Strikethrough size={15} strokeWidth={2.4} /></Chip>
            </div>
          </div>
          <div className="mb-2 flex gap-0.5">
            {(['left', 'center', 'right'] as Align[]).map((a) => (
              <Chip key={a} title={a} active={first.align === a} onClick={() => patch({ align: a })}>
                {a === 'left' ? <AlignLeft size={15} /> : a === 'right' ? <AlignRight size={15} /> : <AlignCenter size={15} />}
              </Chip>
            ))}
          </div>
          <ColorGrid colors={LINE_COLORS} value={first.textColor as string} onPick={(c) => patch({ textColor: c })} columns={6} />
        </Section>
      )}

      {has(selected, 'sticky') && (
        <Section title={t('Sticky size')}>
          <div className="flex flex-wrap gap-1">
            {([['S', 120], ['M', 228], ['L', 340], ['XL', 480]] as [string, number][]).map(([label, size]) => (
              <button
                key={t(label)}
                type="button"
                onClick={() => patch({ w: size, h: size }, (i) => i.type === 'sticky')}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
              >{t(label)}</button>
            ))}
            <button
              type="button"
              onClick={() => fitStickyToText()}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
            >
              <Maximize size={13} /> {t('Fit to text')}
            </button>
          </div>
        </Section>
      )}

      {card && (
        <Section title={t(CARD_TITLES[card.kind] ?? 'Issue')}>
          {card.missing && (
            <p className="mb-2 rounded-lg bg-[#F7E9E4] px-2 py-1.5 text-[11px] leading-relaxed text-[#C8452D]">
              {t('The record behind this card was deleted or is no longer reachable.')}
            </p>
          )}
          {!card.missing && (card.kind === 'issue' || card.kind === 'project') && (
            <div className="grid grid-cols-3 gap-1">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    void patchRecord(card.recordId, { status: st })
                    patchItem(card.id, { snapshot: { ...card.snapshot, status: st } })
                    requestRender()
                  }}
                  className={`rounded-lg px-1 py-1.5 text-[11px] font-semibold capitalize
                    ${card.snapshot.status === st ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                >{t(st)}</button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={card.missing}
            onClick={() => go(recordHref(card))}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-[#8A867C] hover:bg-[#EFEBE2] disabled:cursor-not-allowed disabled:opacity-40"
          >{t('Open it')}</button>
        </Section>
      )}

      {!!promotable.length && (
        <Section title={t('Work')}>
          <button
            type="button"
            onClick={() => void promoteToIssue(promotable.map((i) => i.id))}
            className="w-full rounded-lg bg-[#C8452D] px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#A83621]"
          >
            {promotable.length > 1
              ? t('Turn {n} into issues', { n: promotable.length })
              : t('Turn into an issue')}
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-[#8A867C]">
            {t('It keeps its place on the board and turns up in the issue list, because it is the same thing in two views.')}
          </p>
        </Section>
      )}

      {table && cell && (
        <Section title={t('Cell')}>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => { const p = growMerge(table, cell[0], cell[1], 'col'); if (p) { patchItem(table.id, p); requestRender() } }}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
            >{t('Merge right')}</button>
            <button
              type="button"
              onClick={() => { const p = growMerge(table, cell[0], cell[1], 'row'); if (p) { patchItem(table.id, p); requestRender() } }}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
            >{t('Merge down')}</button>
            <button
              type="button"
              disabled={!mergeAt(table, ...anchorOf(table, cell[0], cell[1]))}
              onClick={() => { const p = splitMerge(table, cell[0], cell[1]); if (p) { patchItem(table.id, p); requestRender() } }}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2] disabled:opacity-40"
            >{t('Split')}</button>
          </div>
        </Section>
      )}

      {table && (
        <Section title={t('Table')}>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => { patchItem(table.id, addRow(table)); requestRender() }} className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]">{t('Add row')}</button>
            <button type="button" onClick={() => { patchItem(table.id, addCol(table)); requestRender() }} className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]">{t('Add column')}</button>
            <button type="button" onClick={() => { const c = dropRow(table, table.rows - 1); if (c) { patchItem(table.id, c); requestRender() } }} className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]">{t('Remove row')}</button>
            <button type="button" onClick={() => { const c = dropCol(table, table.cols - 1); if (c) { patchItem(table.id, c); requestRender() } }} className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]">{t('Remove column')}</button>
          </div>
          <button
            type="button"
            onClick={() => patch({ headerRow: !table.headerRow }, (i) => i.type === 'table')}
            className="mt-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-[#EFEBE2]"
          >
            <span>{t('Header row')}</span>
            <span className="text-[#8A867C]">{t(table.headerRow ? 'On' : 'Off')}</span>
          </button>
        </Section>
      )}

      {selected.length > 1 && (
        <Section title={t('Align')}>
          <div className="mb-2 grid grid-cols-6 gap-0.5">
            {ALIGNMENTS.map(([mode, Icon, label]) => (
              <Chip key={mode} title={t(label)} onClick={() => { alignSelection(mode); requestRender() }}>
                <Icon size={15} strokeWidth={1.9} />
              </Chip>
            ))}
          </div>
          <div className="flex gap-0.5">
            <Chip title={t('Distribute horizontally')} onClick={() => { distributeSelection('h'); requestRender() }}>
              <AlignHorizontalDistributeCenter size={15} strokeWidth={1.9} />
            </Chip>
            <Chip title={t('Distribute vertically')} onClick={() => { distributeSelection('v'); requestRender() }}>
              <AlignVerticalDistributeCenter size={15} strokeWidth={1.9} />
            </Chip>
            <Chip title={t('Snap to grid')} onClick={() => { arrangeInGrid(); requestRender() }}>
              <Grid3x3 size={15} strokeWidth={1.9} />
            </Chip>
          </div>
        </Section>
      )}

      <Section title={t('Layout')}>
        <div className="flex gap-0.5">
          <Chip title={`${t('Bring forward')} — ⌘]`} onClick={() => reorder('forward')}><MoveUp size={15} strokeWidth={1.9} /></Chip>
          <Chip title={`${t('Send backward')} — ⌘[`} onClick={() => reorder('backward')}><MoveDown size={15} strokeWidth={1.9} /></Chip>
          <Chip title={t(locked ? 'Unlock' : 'Lock')} active={locked} onClick={() => patch({ locked: !locked })}>
            {locked ? <Unlock size={15} strokeWidth={1.9} /> : <Lock size={15} strokeWidth={1.9} />}
          </Chip>
          <Chip title={`${t('Duplicate')} — ⌘D`} onClick={() => duplicateSelection()}><Copy size={15} strokeWidth={1.9} /></Chip>
          <button
            type="button"
            title={`${t('Delete')} — Del`}
            onClick={() => deleteSelection()}
            className="tap-target ml-auto grid h-8 w-8 place-items-center rounded-lg text-[#A83621] hover:bg-[#F7E9E4]"
          >
            <Trash2 size={15} strokeWidth={1.9} />
          </button>
        </div>
      </Section>
    </aside>
  )
}

const TYPE_LABEL: Record<string, string> = {
  sticky: 'Sticky', shape: 'Shape', text: 'Text', draw: 'Drawing', image: 'Image',
  frame: 'Frame', connector: 'Connector', table: 'Table', embed: 'Embed', comment: 'Comment',
  code: 'Code block', record: 'Issue',
}
