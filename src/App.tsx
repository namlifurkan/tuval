import { Canvas } from './components/Canvas'
import { CommentThread } from './components/CommentThread'
import { ContextMenu } from './components/ContextMenu'
import { ContextToolbar } from './components/ContextToolbar'
import { FramesPanel } from './components/FramesPanel'
import { FrameTitleEditor } from './components/FrameTitleEditor'
import { Presentation } from './components/Presentation'
import { SearchPanel } from './components/SearchPanel'
import { TextEditor } from './components/TextEditor'
import { Toolbar } from './components/Toolbar'
import { TopBar } from './components/TopBar'
import { ZoomControls } from './components/ZoomControls'
import { useBoardStore } from './board/store'

export default function App() {
  const presenting = useBoardStore((s) => s.presenting)
  return (
    <div className="relative h-dvh w-dvw select-none overflow-hidden bg-[#F7F7F8] text-[#050038]">
      <Canvas />
      <TextEditor />
      {presenting === null && (
        <>
          <TopBar />
          <Toolbar />
          <ContextToolbar />
          <ZoomControls />
          <ContextMenu />
          <CommentThread />
          <SearchPanel />
          <FramesPanel />
          <FrameTitleEditor />
        </>
      )}
      <Presentation />
    </div>
  )
}
