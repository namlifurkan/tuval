import { useSyncExternalStore } from 'react'
import { Canvas } from './components/Canvas'
import { CommentsPanel } from './components/CommentsPanel'
import { CursorChat } from './components/CursorChat'
import { FollowBanner } from './components/FollowBanner'
import { CommentThread } from './components/CommentThread'
import { ContextMenu } from './components/ContextMenu'
import { Dock } from './components/Dock'
import { EmbedLayer } from './components/EmbedLayer'
import { FramesPanel } from './components/FramesPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { FrameTitleEditor } from './components/FrameTitleEditor'
import { Presentation } from './components/Presentation'
import { SearchPanel } from './components/SearchPanel'
import { TextEditor } from './components/TextEditor'
import { TopBar } from './components/TopBar'
import { Inspector } from './components/Inspector'
import { Minimap } from './components/Minimap'
import { useBoardStore } from './board/store'
import { getDockPrefs, subscribeDock } from './board/dockPrefs'

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

export default function App() {
  const presenting = useBoardStore((s) => s.presenting)
  return (
    <div className="relative h-dvh w-dvw select-none overflow-hidden bg-[#F2EFE9] text-[#141310]">
      <Canvas />
      <EmbedLayer />
      <TextEditor />
      {presenting === null && (
        <>
          <TopBar />
          <Inspector />
          <Dock />
          <MinimapCorner />
          <ContextMenu />
          <CommentThread />
          <CommentsPanel />
          <SearchPanel />
          <CursorChat />
          <FollowBanner />
          <FramesPanel />
          <HistoryPanel />
          <FrameTitleEditor />
        </>
      )}
      <Presentation />
    </div>
  )
}
