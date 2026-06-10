import { MousePointer2, PenLine, Package, GitFork, Hand, Grid3x3, ZoomIn, ZoomOut, Undo2, Redo2, Magnet, Trash2, FileDown, CaseSensitive } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { useHistory } from '../../hooks/useHistory';
import { useHistoryStore } from '../../store/historyStore';
import { exportToPdf } from '../../utils/exportPdf';
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
  const { zoom, setZoom, gridVisible, toggleGrid, snapEnabled, toggleSnap, setSidebarTab, labelFontSize, setLabelFontSize } = useUiStore();
  const { undo, redo, saveHistory } = useHistory();
  const canUndo = useHistoryStore(s => s.past.length > 0);
  const canRedo = useHistoryStore(s => s.future.length > 0);

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
    <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-white shrink-0">
      {/* Logo */}
      <span className="font-bold text-amber-400 mr-3 text-sm tracking-wide">FENCE FORGE</span>

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
                ? 'bg-amber-500 text-gray-900'
                : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* Undo/Redo */}
      <button
        title="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={!canUndo}
        className="p-1.5 rounded hover:bg-gray-700 text-gray-300 disabled:opacity-30 transition-colors"
      >
        <Undo2 size={16} />
      </button>
      <button
        title="Redo (Ctrl+Y)"
        onClick={redo}
        disabled={!canRedo}
        className="p-1.5 rounded hover:bg-gray-700 text-gray-300 disabled:opacity-30 transition-colors"
      >
        <Redo2 size={16} />
      </button>

      <div className="w-px h-5 bg-gray-600 mx-1" />

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

      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* Grid + Snap */}
      <button
        title="Toggle Grid"
        onClick={toggleGrid}
        className={`p-1.5 rounded transition-colors ${gridVisible ? 'text-amber-400' : 'text-gray-500 hover:bg-gray-700'}`}
      >
        <Grid3x3 size={16} />
      </button>
      <button
        title="Toggle Snap"
        onClick={toggleSnap}
        className={`p-1.5 rounded transition-colors ${snapEnabled ? 'text-amber-400' : 'text-gray-500 hover:bg-gray-700'}`}
      >
        <Magnet size={16} />
      </button>

      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* Zoom */}
      <button title="Zoom Out" onClick={() => setZoom(zoom / 1.2)} className="p-1.5 rounded hover:bg-gray-700 text-gray-300">
        <ZoomOut size={16} />
      </button>
      <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
      <button title="Zoom In" onClick={() => setZoom(zoom * 1.2)} className="p-1.5 rounded hover:bg-gray-700 text-gray-300">
        <ZoomIn size={16} />
      </button>
      <button
        title="Reset Zoom"
        onClick={() => setZoom(1)}
        className="text-xs text-gray-500 hover:text-gray-300 px-1"
      >
        1:1
      </button>

      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* Label font size */}
      <CaseSensitive size={15} className="text-gray-400 shrink-0" />
      <input
        type="range"
        min={7}
        max={28}
        step={1}
        value={labelFontSize}
        onChange={e => setLabelFontSize(Number(e.target.value))}
        className="w-20 accent-amber-400"
        title={`Label font size: ${labelFontSize}px`}
      />
      <span className="text-xs text-gray-400 w-6">{labelFontSize}</span>
    </div>
  );
}
