import { Canvas } from './components/Canvas'
import { ContextMenu } from './components/ContextMenu'
import { ContextToolbar } from './components/ContextToolbar'
import { TextEditor } from './components/TextEditor'
import { Toolbar } from './components/Toolbar'
import { TopBar } from './components/TopBar'
import { ZoomControls } from './components/ZoomControls'

export default function App() {
  return (
    <div className="relative h-dvh w-dvw select-none overflow-hidden bg-[#F7F7F8] text-[#050038]">
      <Canvas />
      <TextEditor />
      <TopBar />
      <Toolbar />
      <ContextToolbar />
      <ZoomControls />
      <ContextMenu />
    </div>
  )
}
