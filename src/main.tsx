import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startRealtime } from './board/realtime'
import { startCloudSync } from './board/sync'

startCloudSync()
startRealtime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
