import { useState, useRef } from 'react';
import { startDrag } from '../../hooks/useDragResize';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { FENCE_TYPES, FENCE_CATEGORIES } from '../../constants/fenceTypes';
import { OBJECT_DEFAULTS } from '../../constants/objectTypes';
import { useHistory } from '../../hooks/useHistory';
import type { FenceTypeKey, FenceHeight, FenceStyle, ObjectType } from '../../types';
import { HEIGHT_OPTIONS_MAP, STYLE_OPTIONS_MAP } from '../panels/FenceProperties';

const MIN_W = 140;
const MAX_W = 400;
const DEFAULT_W = 208; // w-52

export function Sidebar() {
  const [width, setWidth]         = useState(DEFAULT_W);
  const [collapsed, setCollapsed] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  function onMouseDown(e: React.MouseEvent) {
    const el = divRef.current; if (!el) return;
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    startDrag(e,
      (clientX) => { el.style.width = `${Math.min(MAX_W, Math.max(MIN_W, startW + (clientX - startX)))}px`; },
      () => setWidth(Math.round(el.getBoundingClientRect().width)),
    );
  }

  const { sidebarTab, setSidebarTab } = useUiStore();
  const activeObjectType  = useCanvasStore(s => s.activeObjectType);
  const setActiveObjectType = useCanvasStore(s => s.setActiveObjectType);
  const activeFenceType   = useCanvasStore(s => s.activeFenceType);
  const setActiveFenceType  = useCanvasStore(s => s.setActiveFenceType);
  const activeGateType    = useCanvasStore(s => s.activeGateType);
  const setActiveGateType   = useCanvasStore(s => s.setActiveGateType);
  const setToolMode     = useCanvasStore(s => s.setToolMode);
  const cancelDrawing   = useCanvasStore(s => s.cancelDrawing);
  const selectedId      = useCanvasStore(s => s.selectedId);
  const selectedType    = useCanvasStore(s => s.selectedType);
  const fences          = useCanvasStore(s => s.fences);
  const updateFence     = useCanvasStore(s => s.updateFence);
  const { saveHistory } = useHistory();

  const selectedFence = selectedType === 'fence' && selectedId ? fences[selectedId] : null;

  function handleFenceTypeClick(key: FenceTypeKey) {
    if (selectedFence) {
      saveHistory();
      const newHeights = HEIGHT_OPTIONS_MAP[key];
      const newStyles  = STYLE_OPTIONS_MAP[key];
      updateFence(selectedFence.id, {
        fenceType: key,
        heightFt: newHeights
          ? ((newHeights as readonly number[]).includes(selectedFence.heightFt ?? 0)
              ? selectedFence.heightFt
              : (newHeights[0] as FenceHeight))
          : undefined,
        fenceStyle: newStyles
          ? (newStyles.some((s: { key: FenceStyle }) => s.key === selectedFence.fenceStyle)
              ? selectedFence.fenceStyle
              : newStyles[0].key)
          : undefined,
      });
    } else {
      setActiveFenceType(key);
      setToolMode('draw-fence');
    }
  }

  // ── Collapsed strip ───────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex flex-col items-center bg-gray-800 border-r border-gray-700 shrink-0 py-2 gap-2" style={{ width: 28 }}>
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-400 hover:text-amber-400 transition-colors"
          title="Expand sidebar"
        >
          ▸
        </button>
      </div>
    );
  }

  return (
    <div
      ref={divRef}
      style={{ width }}
      className="bg-gray-800 border-r border-gray-700 flex flex-col text-white overflow-y-auto shrink-0 relative"
    >
      {/* Tab bar + collapse button */}
      <div className="flex border-b border-gray-700 shrink-0">
        {(['fences', 'objects'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSidebarTab(t)}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              sidebarTab === t ? 'bg-gray-700 text-amber-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          className="px-2 text-gray-500 hover:text-amber-400 transition-colors text-xs"
          title="Collapse sidebar"
        >
          ◂
        </button>
      </div>

      {/* Content */}
      {sidebarTab === 'objects' && (
        <div className="p-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Place Object</p>
          <div className="grid grid-cols-2 gap-1">
            {(Object.entries(OBJECT_DEFAULTS) as [ObjectType, typeof OBJECT_DEFAULTS[ObjectType]][]).map(([type, def]) => (
              <button
                key={type}
                onClick={() => {
                  cancelDrawing();
                  setActiveObjectType(type);
                  setToolMode('place-object');
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded text-xs transition-colors ${
                  activeObjectType === type
                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                    : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                <span className="text-lg">{def.icon}</span>
                <span className="text-center leading-tight">{def.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sidebarTab === 'fences' && (
        <div className="p-2 space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Fence Type</p>
          {selectedFence && (
            <p className="text-[10px] text-teal-400 -mt-2">Click to change selected fence</p>
          )}
          {FENCE_CATEGORIES.map(cat => {
            const types = (Object.entries(FENCE_TYPES) as [FenceTypeKey, typeof FENCE_TYPES[FenceTypeKey]][])
              .filter(([, def]) => def.category === cat.key);
            return (
              <div key={cat.key}>
                <p className="text-xs text-gray-400 font-medium mb-1">{cat.label}</p>
                <div className="space-y-0.5">
                  {types.map(([key, def]) => {
                    const isActive = selectedFence
                      ? selectedFence.fenceType === key
                      : activeFenceType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleFenceTypeClick(key)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                          isActive
                            ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                            : 'hover:bg-gray-700 text-gray-300'
                        }`}
                      >
                        <span
                          className="w-4 h-3 rounded-sm shrink-0 border border-black/20"
                          style={{ background: def.color }}
                        />
                        <span className="truncate">{def.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400 font-medium mb-1">Gate Type</p>
            {(['single-swing', 'double-swing'] as const).map(gt => (
              <button
                key={gt}
                onClick={() => {
                  setActiveGateType(gt);
                  setToolMode('place-gate');
                }}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors mb-0.5 ${
                  activeGateType === gt
                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                    : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                {gt === 'single-swing' ? '🚪 Single Gate' : '🚪🚪 Double Gate'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drag handle — right edge */}
      <div
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-400/60 transition-colors z-10"
        title="Drag to resize"
      />
    </div>
  );
}
