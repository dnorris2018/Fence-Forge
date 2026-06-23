import { useState } from 'react';
import { MousePointer2, PenLine, Package, GitFork, Hand, Grid3x3, ZoomIn, ZoomOut, Undo2, Redo2, Magnet, Trash2, FileDown, ImageDown, CaseSensitive, Palette } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { useHistory } from '../../hooks/useHistory';
import { useHistoryStore } from '../../store/historyStore';
import { exportToPdf } from '../../utils/exportPdf';
import { exportToJpeg } from '../../utils/exportJpeg';
import { THEMES } from '../../constants/themes';
import type { ToolMode } from '../../types';

const TOOLS: { mode: ToolMode; icon: React.ReactNode; title: string }[] = [
  { mode: 'select',       icon: <MousePointer2 size={16} />, title: 'Select (V)' },
  { mode: 'draw-fence',   icon: <PenLine size={16} />,       title: 'Draw Fence (F)' },
  { mode: 'place-object', icon: <Package size={16} />,       title: 'Objects (O)' },
  { mode: 'place-gate',   icon: <GitFork size={16} />,       title: 'Place Gate (G)' },
  { mode: 'pan',          icon: <Hand size={16} />,          title: 'Pan (H)' },
];

export function Toolbar() {
  const toolMode = useCanvasStore(s => s.toolMode);
  const setToolMode = useCanvasStore(s => s.setToolMode);
  const cancelDrawing = useCanvasStore(s => s.cancelDrawing);
  const loadSnapshot = useCanvasStore(s => s.loadSnapshot);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const fences = useCanvasStore(s => s.fences);
  const gates  = useCanvasStore(s => s.gates);
  const { zoom, setZoom, gridVisible, toggleGrid, snapEnabled, toggleSnap, setSidebarTab, labelFontSize, setLabelFontSize, theme, setTheme } = useUiStore();
  const { undo, redo, saveHistory } = useHistory();
  const canUndo = useHistoryStore(s => s.past.length > 0);
  const canRedo = useHistoryStore(s => s.future.length > 0);
  const [themeOpen, setThemeOpen] = useState(false);

  function handleClearCanvas() {
    if (!window.confirm('Clear all fences, gates, and objects? This cannot be undone.')) return;
    saveHistory();
    cancelDrawing();
    clearSelection();
    loadSnapshot({ fences: {}, gates: {}, objects: {} });
  }

  function switchTool(mode: ToolMode) {
    if (toolMode === 'draw-fence') cancelDrawing();
    setToolMode(mode);
    if (mode === 'place-object') setSidebarTab('objects');
    if (mode === 'draw-fence' || mode === 'place-gate') setSidebarTab('fences');
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-[var(--c-bg2)] border-b border-[var(--c-border1)] text-[var(--c-text1)] shrink-0">
      {/* Logo */}
      <span className="font-bold text-[var(--c-accent)] mr-3 text-sm tracking-wide">FENCE FORGE</span>

      {/* Tool buttons */}
      <div className="flex gap-0.5 mr-3">
        {TOOLS.map(t => (
          <button
            key={t.mode}
            type="button"
            title={t.title}
            onClick={() => switchTool(t.mode)}
            onMouseDown={e => e.preventDefault()}
            className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
              toolMode === t.mode
                ? 'bg-[var(--c-accent)] text-gray-900'
                : 'hover:bg-[var(--c-bg3)] text-[var(--c-text2)]'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-[var(--c-bg4)] mx-1" />

      {/* Undo/Redo */}
      <button
        title="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={!canUndo}
        className="p-1.5 rounded hover:bg-[var(--c-bg3)] text-[var(--c-text2)] disabled:opacity-30 transition-colors"
      >
        <Undo2 size={16} />
      </button>
      <button
        title="Redo (Ctrl+Y)"
        onClick={redo}
        disabled={!canRedo}
        className="p-1.5 rounded hover:bg-[var(--c-bg3)] text-[var(--c-text2)] disabled:opacity-30 transition-colors"
      >
        <Redo2 size={16} />
      </button>

      <div className="w-px h-5 bg-[var(--c-bg4)] mx-1" />

      {/* Clear canvas */}
      <button
        title="Clear Canvas"
        onClick={handleClearCanvas}
        className="p-1.5 rounded bg-red-900/40 hover:bg-red-700/70 text-red-400 hover:text-red-300 border border-red-800/60 transition-colors"
      >
        <Trash2 size={16} />
      </button>

      {/* Export PDF */}
      <button
        title="Export PDF"
        onClick={() => exportToPdf(fences, gates)}
        className="p-1.5 rounded bg-blue-900/40 hover:bg-blue-700/60 text-blue-400 hover:text-blue-200 border border-blue-800/60 transition-colors"
      >
        <FileDown size={16} />
      </button>

      {/* Export JPEG */}
      <button
        title="Save as JPEG"
        onClick={exportToJpeg}
        className="p-1.5 rounded bg-green-900/40 hover:bg-green-700/60 text-green-400 hover:text-green-200 border border-green-800/60 transition-colors"
      >
        <ImageDown size={16} />
      </button>

      <div className="w-px h-5 bg-[var(--c-bg4)] mx-1" />

      {/* Grid + Snap */}
      <button
        title="Toggle Grid"
        onClick={toggleGrid}
        className={`p-1.5 rounded transition-colors ${gridVisible ? 'text-[var(--c-accent)]' : 'text-[var(--c-text3)] hover:bg-[var(--c-bg3)]'}`}
      >
        <Grid3x3 size={16} />
      </button>
      <button
        title="Toggle Snap"
        onClick={toggleSnap}
        className={`p-1.5 rounded transition-colors ${snapEnabled ? 'text-[var(--c-accent)]' : 'text-[var(--c-text3)] hover:bg-[var(--c-bg3)]'}`}
      >
        <Magnet size={16} />
      </button>

      <div className="w-px h-5 bg-[var(--c-bg4)] mx-1" />

      {/* Zoom */}
      <button title="Zoom Out" onClick={() => setZoom(zoom / 1.2)} className="p-1.5 rounded hover:bg-[var(--c-bg3)] text-[var(--c-text2)]">
        <ZoomOut size={16} />
      </button>
      <span className="text-xs text-[var(--c-text3)] w-12 text-center">{Math.round(zoom * 100)}%</span>
      <button title="Zoom In" onClick={() => setZoom(zoom * 1.2)} className="p-1.5 rounded hover:bg-[var(--c-bg3)] text-[var(--c-text2)]">
        <ZoomIn size={16} />
      </button>
      <button
        title="Reset Zoom"
        onClick={() => setZoom(1)}
        className="text-xs text-[var(--c-text3)] hover:text-[var(--c-text2)] px-1"
      >
        1:1
      </button>

      <div className="w-px h-5 bg-[var(--c-bg4)] mx-1" />

      {/* Label font size */}
      <CaseSensitive size={15} className="text-[var(--c-text3)] shrink-0" />
      <input
        type="range"
        min={7}
        max={28}
        step={1}
        value={labelFontSize}
        onChange={e => setLabelFontSize(Number(e.target.value))}
        className="w-20 accent-[var(--c-accent)]"
        title={`Label font size: ${labelFontSize}px`}
      />
      <span className="text-xs text-[var(--c-text3)] w-6">{labelFontSize}</span>

      <div className="w-px h-5 bg-[var(--c-bg4)] mx-1" />

      {/* Theme picker */}
      <div className="relative">
        <button
          title="Change theme"
          onClick={() => setThemeOpen(o => !o)}
          className={`p-1.5 rounded transition-colors ${themeOpen ? 'text-[var(--c-accent)] bg-[var(--c-bg3)]' : 'text-[var(--c-text3)] hover:bg-[var(--c-bg3)]'}`}
        >
          <Palette size={16} />
        </button>
        {themeOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
            <div className="absolute right-0 top-8 z-50 bg-[var(--c-bg2)] border border-[var(--c-border1)] rounded shadow-2xl p-2 flex flex-col gap-1 min-w-[160px]">
              {THEMES.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTheme(t.key); setThemeOpen(false); }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                    theme === t.key
                      ? 'bg-[var(--c-a-glow)] text-[var(--c-accent)]'
                      : 'text-[var(--c-text2)] hover:bg-[var(--c-bg3)]'
                  }`}
                >
                  <span className="flex gap-0.5 shrink-0">
                    {t.swatches.map((s, i) => (
                      <span key={i} style={{ background: s, width: 10, height: 10, borderRadius: 2, display: 'inline-block', border: '1px solid rgba(255,255,255,0.1)' }} />
                    ))}
                  </span>
                  {t.label}
                  {theme === t.key && <span className="ml-auto text-[var(--c-accent)]">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
