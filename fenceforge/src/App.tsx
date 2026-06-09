import { useState } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { CanvasArea } from './components/canvas/CanvasArea';
import { ElevationView } from './components/elevation/ElevationView';
import { TakeoffView } from './components/takeoff/TakeoffView';
import { useUiStore } from './store/uiStore';

type AppTab = 'design' | 'takeoff';

export default function App() {
  const elevationFenceId = useUiStore(s => s.elevationFenceId);
  const [appTab, setAppTab] = useState<AppTab>('design');

  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">

      {/* ── App-level tab bar ─────────────────────────────────────────────── */}
      <div className="flex items-end bg-gray-950 border-b border-gray-700 shrink-0 px-2 pt-1 gap-0.5">
        {(['design', 'takeoff'] as AppTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setAppTab(tab)}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-t transition-colors ${
              appTab === tab
                ? 'bg-gray-800 text-amber-400 border border-b-0 border-gray-700'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
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
