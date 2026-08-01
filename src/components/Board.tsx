import { useEffect, useSyncExternalStore } from 'react'
import { Ada } from './Ada'
import { Boundary } from './Boundary'
import { Canvas } from './Canvas'
import { BoardsPanel } from './BoardsPanel'
import { BriefImport } from './BriefImport'
import { CommentsPanel } from './CommentsPanel'
import { CursorChat } from './CursorChat'
import { FollowBanner } from './FollowBanner'
import { CommentThread } from './CommentThread'
import { ContextMenu } from './ContextMenu'
import { Dock } from './Dock'
import { EmbedLayer } from './EmbedLayer'
import { FramesPanel } from './FramesPanel'
import { HistoryPanel } from './HistoryPanel'
import { FrameTitleEditor } from './FrameTitleEditor'
import { Presentation } from './Presentation'
import { PublicBanner } from './PublicBanner'
import { SearchPanel } from './SearchPanel'
import { TextEditor } from './TextEditor'
import { TopBar } from './TopBar'
import { PasswordGate } from './PasswordGate'
import { Inspector } from './Inspector'
import { Minimap } from './Minimap'
import { startRealtime } from '../board/realtime'
import { refreshSnapshots } from '../board/promote'
import { subscribeRecords } from '../board/records'
import { startCloudSync, sweepOrphanImages } from '../board/sync'
import { takeTemplate } from '../board/boards'
import { insertItems } from '../board/interaction'
import { TEMPLATES } from '../board/templates'
import { useBoardStore } from '../board/store'
import { getDockPrefs, subscribeDock } from '../board/dockPrefs'

const readDockSide = () => getDockPrefs().side

function MinimapCorner() {
  const show = useBoardStore((s) => s.showMinimap)
  const side = useSyncExternalStore(subscribeDock, readDockSide, readDockSide)
  if (!show) return null
  const place = {
    bottom: 'bottom-[88px] right-4',
    top: 'bottom-5 right-4',
    right: 'bottom-5 left-4',
    left: 'bottom-5 right-4',
  }[side]
  return (
    <div className={`pointer-events-auto absolute z-30 ${place}`}>
      <Minimap />
    </div>
  )
}

// A board chosen from the board list can carry a template across the reload that binds the
// new document.
function usePendingTemplate() {
  useEffect(() => {
    const id = takeTemplate()
    const tpl = id && TEMPLATES.find((x) => x.id === id)
    const el = document.querySelector('canvas')
    if (!tpl || !el) return
    insertItems(tpl.build({ x: 0, y: 0 }), true, el)
  }, [])
}

export default function Board() {
  const presenting = useBoardStore((s) => s.presenting)
  usePendingTemplate()

  // The document only starts talking to the cloud once a board is on screen. Started from the
  // entry point instead, every page would carry the whole synchronisation layer.
  useEffect(() => {
    startCloudSync()
    startRealtime()
    // Once the document has arrived: the rows are the truth and the cards on the board carry a
    // copy, so the copies are brought up to date on the way in.
    const fresh = setTimeout(() => void refreshSnapshots(), 2500)
    // And from then on, whenever a row changes. Renaming an issue in a list used to leave the
    // card on an open board wearing the old name until the next time somebody loaded it, which
    // made "the same record, seen from three places" true only on arrival.
    //
    // Debounced, and that is not politeness: a title typed letter by letter would otherwise
    // write a Y.Map update per keystroke into every open board, and a Y.Map keeps the history of
    // every key it is ever given. refreshSnapshots writes only what actually differs, so a board
    // with nothing stale on it writes nothing at all.
    let settle = 0
    const follow = subscribeRecords(() => {
      clearTimeout(settle)
      settle = window.setTimeout(() => void refreshSnapshots(), 500)
    })
    const swept = setTimeout(() => void sweepOrphanImages(), 8000)
    return () => {
      clearTimeout(fresh); clearTimeout(swept); clearTimeout(settle); follow()
    }
  }, [])

  return (
    <div className="relative h-dvh w-dvw select-none overflow-hidden bg-[#F2EFE9] text-[#141310]">
      <Canvas />
      <EmbedLayer />
      <TextEditor />
      {presenting === null && (
        <Boundary>
          <div className="pointer-events-auto absolute inset-x-0 top-0 z-50"><PasswordGate /></div>
      <TopBar />
          <Inspector />
          <Dock />
          <MinimapCorner />
          <ContextMenu />
          <CommentThread />
          <BoardsPanel />
          <BriefImport />
          <CommentsPanel />
          <SearchPanel />
          <CursorChat />
          <FollowBanner />
          <FramesPanel />
          <HistoryPanel />
          <FrameTitleEditor />
          <PublicBanner />
          <Ada />
        </Boundary>
      )}
      <Presentation />
    </div>
  )
}
