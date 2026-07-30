import { Canvas } from './components/Canvas'
import { CommentsPanel } from './components/CommentsPanel'
import { CursorChat } from './components/CursorChat'
import { FollowBanner } from './components/FollowBanner'
import { CommentThread } from './components/CommentThread'
import { ContextMenu } from './components/ContextMenu'
import { ContextToolbar } from './components/ContextToolbar'
import { EmbedLayer } from './components/EmbedLayer'
import { FramesPanel } from './components/FramesPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { FrameTitleEditor } from './components/FrameTitleEditor'
import { Presentation } from './components/Presentation'
import { SearchPanel } from './components/SearchPanel'
import { SessionTools } from './components/SessionTools'
import { SpotlightInvite } from './components/SpotlightInvite'
import { TextEditor } from './components/TextEditor'
import { Toolbar } from './components/Toolbar'
import { TopBar } from './components/TopBar'
import { ZoomControls } from './components/ZoomControls'
import { useBoardStore } from './board/store'

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
          <Toolbar />
          <ContextToolbar />
          <ZoomControls />
          <ContextMenu />
          <CommentThread />
          <CommentsPanel />
          <SearchPanel />
          <SessionTools />
          <CursorChat />
          <FollowBanner />
          <SpotlightInvite />
          <FramesPanel />
          <HistoryPanel />
          <FrameTitleEditor />
        </>
      )}
      <Presentation />
    </div>
  )
}
