import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BlameOverlay } from './blamescope/index.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <BlameOverlay />
  </StrictMode>,
)
