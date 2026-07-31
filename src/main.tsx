import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { room } from './board/doc'
import { startRealtime } from './board/realtime'
import { startCloudSync } from './board/sync'

if (room) {
  startCloudSync()
  startRealtime()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
