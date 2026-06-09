import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useCanvasStore } from './store/canvasStore'
import { useHistoryStore } from './store/historyStore'

if (import.meta.env.DEV) {
  (window as any).__canvasStore = useCanvasStore;
  (window as any).__historyStore = useHistoryStore;
}

// ── Keyboard shortcuts are handled via onKeyDown on the canvas container div ──
// (CanvasArea.tsx) — using React's synthetic event system ensures Zustand state
// updates properly trigger React re-renders. The document listener approach was
// unreliable because updates fired outside React's event batch.

// ── Render app ────────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')!).render(<App />)
