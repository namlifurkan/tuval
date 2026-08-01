import {
  Clock, Download, House, Layers, LayoutGrid, MoreHorizontal, Printer, Search, Trash2, Wand2,
} from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getLang, LANGS, setLang, subscribeLang, t } from '../i18n'
import type { ReactNode } from 'react'
import { isDarkSurface, PRODUCT, SURFACES, surfaceColor } from '../board/brand'
import { getItems, getMeta, removeItems, room, setMeta, subscribeMeta } from '../board/doc'
import { boardProject, setBoardProject } from '../board/projects'
import { exportPng } from '../board/export'
import { printFrames } from '../board/print'
import { TEXTURES } from '../board/paper'
import { readTexture } from '../board/paperPrefs'
import { requestRender, useBoardStore } from '../board/store'
import { leftovers } from '../board/tidy'
import { useItems } from '../board/useBoard'
import { Account } from './Account'
import { Share } from './Share'
import { Collaborators } from './Collaborators'
import { goHome } from '../board/boards'
import { HandoffMenu } from './HandoffMenu'
import { ProjectPicker } from './ProjectPicker'
import { ViewOnly } from './ViewOnly'
import { IconButton, Popover, usePopover } from './ui'
import { cloudError, subscribeCloud } from '../board/sync'

function Caption({ children }: { children: ReactNode }) {
  const boardName = useSyncExternalStore(subscribeMeta, readName, readName)
  const items = useItems()
  const frames = items.filter((i) => i.type === 'frame').length

  const parts = [
    `${items.length} ${t(items.length === 1 ? 'item' : 'items')}`,
    frames ? `${frames} ${t(frames === 1 ? 'frame' : 'frames')}` : null,
    room,
  ].filter(Boolean)

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <input
          value={boardName}
          placeholder={t('Untitled board')}
          onChange={(e) => setMeta('name', e.target.value)}
          spellCheck={false}
          aria-label={t('Board name')}
          className="w-auto min-w-[8ch] max-w-[min(40vw,380px)] truncate bg-transparent field-sizing-content text-[19px] font-semibold leading-tight tracking-[-0.01em] text-[#141310] outline-none placeholder:text-[#8A867C] focus:underline focus:decoration-[#C8452D] focus:underline-offset-4"
        />
        {children}
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] leading-none text-[#8A867C]">
        <span className="font-semibold uppercase tracking-[0.14em] text-[#C8452D]">{PRODUCT.name}</span>
        <span aria-hidden>·</span>
        {parts.join(' · ')}
        <ViewOnly />
      </p>
    </div>
  )
}

const readSurface = () => (getMeta().surface as string) ?? 'paper'
const readName = () => (getMeta().name as string) ?? ''

export function TopBar() {
  const surface = useSyncExternalStore(subscribeMeta, readSurface, readSurface)
  const paint = surfaceColor(surface)
  const dark = isDarkSurface(paint)
  const texture = useSyncExternalStore(subscribeMeta, readTexture, readTexture)
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang)
  const saveProblem = useSyncExternalStore(subscribeCloud, cloudError, cloudError)
  const boardsPanel = useBoardStore((s) => s.boardsPanel)
  const update = useBoardStore((s) => s.update)
  const setSelection = useBoardStore((s) => s.setSelection)
  const menu = usePopover()
  const [project, setProject] = useState<string | null>(null)

  useEffect(() => { if (menu.open) void boardProject(room).then(setProject) }, [menu.open])

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-24"
        style={dark
          ? { background: '#F2EFE9', height: 76, boxShadow: '0 2px 0 rgba(20,19,16,0.18)' }
          : { backgroundImage: `linear-gradient(to bottom, ${paint}, ${paint}B3, ${paint}00)` }}
      />
      <header className="pointer-events-none absolute inset-x-4 top-4 z-40 flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex min-w-0 items-start gap-1.5">
          <IconButton title={t('Home')} className="mt-0.5" onClick={goHome}>
            <House size={18} strokeWidth={1.8} />
          </IconButton>
          <IconButton
            title={t('Boards')}
            active={boardsPanel}
            className="mt-0.5"
            onClick={() => update({ boardsPanel: !boardsPanel })}
          >
            <LayoutGrid size={18} strokeWidth={1.8} />
          </IconButton>
          <Caption>
          <div className="relative">
            <IconButton title={t('Board menu')} active={menu.open} onClick={menu.toggle}>
              <MoreHorizontal size={18} strokeWidth={1.8} />
            </IconButton>
            <Popover open={menu.open} onClose={menu.close} anchor="bottom" className="w-[236px]">
              <button
                type="button"
                onClick={() => { update({ framesPanel: true }); menu.close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Layers size={15} /> {t('Frame panel')}
              </button>
              <button
                type="button"
                onClick={() => { update({ historyPanel: true }); menu.close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Clock size={15} /> {t('Version history')}
              </button>
              <button
                type="button"
                onClick={() => { exportPng(getItems(), readName() || 'board'); menu.close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Download size={15} /> {t('Download PNG')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!printFrames(getItems())) alert(t('At least one frame is needed for PDF.'))
                  menu.close()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Printer size={15} /> {t('Print frames as PDF')}
              </button>
              <div className="my-1 h-px bg-[#EAE6DD]" />
              <div className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-[#8A867C]">{t('Surface')}</div>
              <div className="grid grid-cols-5 gap-1.5 px-2 pb-1">
                {SURFACES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={t(s.name)}
                    onClick={() => { setMeta('surface', s.id); requestRender() }}
                    style={{ background: s.color }}
                    className={`h-7 rounded-md border transition-transform hover:scale-105
                      ${surface === s.id ? 'border-[#C8452D] ring-1 ring-[#C8452D]' : 'border-black/10'}`}
                  />
                ))}
              </div>
              <div className="px-2.5 pb-1.5 pt-2 text-xs font-semibold text-[#8A867C]">{t('Texture')}</div>
              <div className="flex flex-wrap gap-1 px-2 pb-1">
                {TEXTURES.map((tex) => (
                  <button
                    key={tex.id}
                    type="button"
                    onClick={() => { setMeta('texture', tex.id); requestRender() }}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold
                      ${texture === tex.id ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                  >{t(tex.name)}</button>
                ))}
              </div>
              <div className="px-2.5 pb-1.5 pt-2 text-xs font-semibold text-[#8A867C]">{t('Language')}</div>
              <div className="flex gap-1 px-2 pb-1">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className={`flex-1 rounded-lg px-2 py-1 text-xs font-semibold
                      ${lang === l.id ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                  >{l.name}</button>
                ))}
              </div>
              <div className="my-1 h-px bg-[#EAE6DD]" />
              <div className="flex items-center gap-2 px-2.5 pb-1 pt-1">
                <span className="shrink-0 text-xs font-semibold text-[#8A867C]">{t('Project')}</span>
                <ProjectPicker
                  value={project}
                  onPick={(next) => { setProject(next); void setBoardProject(room, next) }}
                  className="min-w-0 flex-1 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-1 text-[12px] outline-none focus:border-[#C8452D]"
                />
              </div>

              <div className="my-1 h-px bg-[#EAE6DD]" />
              <button
                type="button"
                onClick={() => {
                  const strays = leftovers(getItems())
                  setSelection(strays)
                  requestRender()
                  menu.close()
                  if (!strays.length) alert(t('Nothing left over — the board is tidy.'))
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Wand2 size={15} /> {t('Select leftovers')}
              </button>
              <p className="px-2.5 pb-1 text-[11px] leading-snug text-[#8A867C]">
                {t('Empty text and stickies, pen specks, connectors joined to nothing, unnamed empty frames. Selected rather than deleted, so you see what is going.')}
              </p>
              <div className="my-1 h-px bg-[#EAE6DD]" />
              <button
                type="button"
                onClick={() => {
                  if (confirm(t('Delete everything on this board?'))) {
                    removeItems(getItems().map((i) => i.id))
                    requestRender()
                  }
                  menu.close()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2]"
              >
                <Trash2 size={15} /> {t('Clear board')}
              </button>
            </Popover>
          </div>
          </Caption>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {saveProblem && (
            <span
              role="status"
              title={saveProblem}
              className="rounded-lg border border-[#C8452D]/30 bg-[#F7E9E4] px-2 py-1 text-[11px] font-semibold text-[#A83621]"
            >{t('Not saved to the cloud')}</span>
          )}
          <IconButton title={t('Search — ⌘F')} onClick={() => update({ searchOpen: true })}>
            <Search size={18} strokeWidth={1.8} />
          </IconButton>
          <HandoffMenu />

          <span className="mx-1 h-6 w-px bg-[#E2DED5]" aria-hidden />

          <Collaborators />
          <Account />

          <Share />
          <button
            type="button"
            onClick={() => {
              const frames = getItems().filter((i) => i.type === 'frame')
              if (frames.length) update({ presenting: 0, selection: [] })
              else alert(t('At least one frame is needed to present.'))
            }}
            className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
          >
            {t('Present')}
          </button>
        </div>
      </header>
    </>
  )
}
