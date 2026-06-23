import { useState } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { CanvasArea } from './components/canvas/CanvasArea';
import { ElevationView } from './components/elevation/ElevationView';
import { TakeoffView } from './components/takeoff/TakeoffView';
import { useUiStore } from './store/uiStore';
import { THEMES } from './constants/themes';

type AppTab = 'design' | 'takeoff';

export default function App() {
  const elevationFenceId = useUiStore(s => s.elevationFenceId);
  const themeKey = useUiStore(s => s.theme);
  const [appTab, setAppTab] = useState<AppTab>('design');

  const themeVars = (THEMES.find(t => t.key === themeKey) ?? THEMES[1]).vars;

  return (
    <div className="flex flex-col h-screen bg-[var(--c-bg1)] overflow-hidden" style={themeVars as React.CSSProperties}>

      {/* ── App-level tab bar ─────────────────────────────────────────────── */}
      <div className="flex items-end bg-[var(--c-bg0)] border-b border-[var(--c-border1)] shrink-0 px-2 pt-1 gap-0.5">
        {(['design', 'takeoff'] as AppTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setAppTab(tab)}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-t transition-colors ${
              appTab === tab
                ? 'bg-[var(--c-bg2)] text-[var(--c-accent)] border border-b-0 border-[var(--c-border1)]'
                : 'text-[var(--c-text3)] hover:text-[var(--c-text2)] hover:bg-[var(--c-bg2-40)]'
            }`}
          >
            {tab === 'design' ? '⬡ Design' : '📐 Takeoff'}
          </button>
        ))}
      </div>

      {/* ── Design tab ───────────────────────────────────────────────────── */}
      {appTab === 'design' && (
        <>
          <Toolbar />
          <div className="flex flex-1 overflow-hidden">
            {elevationFenceId ? (
              <ElevationView />
            ) : (
              <>
                <Sidebar />
                <CanvasArea />
                <PropertiesPanel />
              </>
            )}
          </div>
        </>
      )}

      {/* ── Takeoff tab ──────────────────────────────────────────────────── */}
      {appTab === 'takeoff' && (
        <div className="flex flex-1 overflow-hidden">
          <TakeoffView />
        </div>
      )}

    </div>
  );
}
