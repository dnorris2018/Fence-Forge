import { useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';
import { useUiStore } from '../../store/uiStore';
import { FENCE_TYPES, getFenceColor } from '../../constants/fenceTypes';
import { segmentLength } from '../../utils/geometry';
import { PIXELS_PER_FOOT } from '../../constants/canvas';
import type { FenceTypeKey, FenceHeight, FenceStyle } from '../../types';
import {
  WOOD_PRIVACY_HEIGHTS, WOOD_PRIVACY_STYLES,
  RANCH_RAIL_HEIGHTS, RANCH_RAIL_STYLES,
  CAP_BOARD_HEIGHTS, CAP_BOARD_STYLES,
  VINYL_PRIVACY_STYLES,
  VINYL_RANCH_RAIL_STYLES,
  CHAIN_LINK_HEIGHTS,
  ORNAMENTAL_HEIGHTS, ORNAMENTAL_STYLES,
} from '../../types';

interface Props { fenceId: string; }

// Per-type height picker options (exported for Sidebar)
export const HEIGHT_OPTIONS_MAP: Partial<Record<FenceTypeKey, readonly number[]>> = {
  'wood-privacy':        WOOD_PRIVACY_HEIGHTS,
  'ranch-rail':          RANCH_RAIL_HEIGHTS,
  'wood-cap-board':      CAP_BOARD_HEIGHTS,
  'chain-link-galv':     CHAIN_LINK_HEIGHTS,
  'chain-link-black':    CHAIN_LINK_HEIGHTS,
  'aluminum-ornamental': ORNAMENTAL_HEIGHTS,
  'steel-ornamental':    ORNAMENTAL_HEIGHTS,
};

// Per-type style picker options (exported for Sidebar)
export const STYLE_OPTIONS_MAP: Partial<Record<FenceTypeKey, { key: FenceStyle; label: string }[]>> = {
  'wood-privacy':     WOOD_PRIVACY_STYLES    as { key: FenceStyle; label: string }[],
  'ranch-rail':       RANCH_RAIL_STYLES      as { key: FenceStyle; label: string }[],
  'wood-cap-board':   CAP_BOARD_STYLES       as { key: FenceStyle; label: string }[],
  'vinyl-privacy':    VINYL_PRIVACY_STYLES   as { key: FenceStyle; label: string }[],
  'vinyl-ranch-rail': VINYL_RANCH_RAIL_STYLES as { key: FenceStyle; label: string }[],
  'aluminum-ornamental': ORNAMENTAL_STYLES   as { key: FenceStyle; label: string }[],
  'steel-ornamental':    ORNAMENTAL_STYLES   as { key: FenceStyle; label: string }[],
};

export function FenceProperties({ fenceId }: Props) {
  const fence = useCanvasStore(s => s.fences[fenceId]);
  const updateFence = useCanvasStore(s => s.updateFence);
  const deleteFence = useCanvasStore(s => s.deleteFence);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const { saveHistory } = useHistory();
  const openElevationView = useUiStore(s => s.openElevationView);

  // Track whether history was saved for the current color-pick session so we
  // don't push a snapshot on every pixel drag inside the color picker.
  const colorPickSessionRef = useRef(false);

  if (!fence) return null;

  const def = FENCE_TYPES[fence.fenceType];
  const currentColor = getFenceColor(fence);
  const lengthFt = (segmentLength(fence.points) / PIXELS_PER_FOOT).toFixed(1);

  function handleColorChange(hex: string) {
    if (!colorPickSessionRef.current) {
      saveHistory();
      colorPickSessionRef.current = true;
    }
    updateFence(fenceId, { color: hex });
  }

  function handleColorCommit() {
    colorPickSessionRef.current = false;
  }

  const heightOptions = HEIGHT_OPTIONS_MAP[fence.fenceType];
  const styleOptions  = STYLE_OPTIONS_MAP[fence.fenceType];

  function handleHeightChange(h: FenceHeight) {
    saveHistory();
    updateFence(fenceId, { heightFt: h });
  }

  function handleStyleChange(s: FenceStyle) {
    saveHistory();
    updateFence(fenceId, { fenceStyle: s });
  }

  function flipFinishSide() {
    saveHistory();
    updateFence(fenceId, { finishSide: fence.finishSide === 'left' ? 'right' : 'left' });
  }

  function handleDelete() {
    saveHistory();
    deleteFence(fenceId);
    clearSelection();
  }

  return (
    <div className="p-3 space-y-4">
      {/* Fence type label */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Fence</p>
        <div className="flex items-center gap-2 p-2 bg-gray-700 rounded">
          <span
            className="w-4 h-4 rounded-sm border border-black/20 shrink-0"
            style={{ background: currentColor }}
          />
          <span className="text-sm text-white truncate">{def.label}</span>
        </div>
      </div>

      {/* Per-line color picker */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Fence Color</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentColor}
            onChange={e => handleColorChange(e.target.value)}
            onBlur={handleColorCommit}
            className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
            title="Pick fence color"
          />
          <span className="text-xs font-mono text-gray-300">{currentColor.toUpperCase()}</span>
          <button
            onClick={() => { saveHistory(); updateFence(fenceId, { color: FENCE_TYPES[fence.fenceType].color }); }}
            className="ml-auto text-xs text-gray-400 hover:text-gray-200 transition-colors"
            title="Reset to default color"
          >
            Reset
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1">Length</p>
        <p className="text-sm text-amber-300 font-mono">{lengthFt} ft</p>
      </div>

      {/* Height picker */}
      {heightOptions && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Fence Height</p>
          <div className="flex gap-1 flex-wrap">
            {heightOptions.map(h => (
              <button
                key={h}
                onClick={() => handleHeightChange(h as FenceHeight)}
                className={`flex-1 py-1 rounded text-xs font-mono transition-colors ${
                  (fence.heightFt ?? heightOptions[0]) === h
                    ? 'bg-amber-500/30 border border-amber-500/60 text-amber-300'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {h}'
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Style picker */}
      {styleOptions && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Style</p>
          <div className="flex flex-col gap-1">
            {styleOptions.map(opt => {
              // Show the color this style would produce given current height
              const previewColor = getFenceColor({ ...fence, fenceStyle: opt.key });
              return (
                <button
                  key={opt.key}
                  onClick={() => handleStyleChange(opt.key)}
                  className={`w-full flex items-center gap-2 py-1 px-2 rounded text-xs text-left transition-colors ${
                    (fence.fenceStyle ?? styleOptions[0].key) === opt.key
                      ? 'bg-amber-500/30 border border-amber-500/60 text-amber-300'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-sm border border-black/20 shrink-0"
                    style={{ background: previewColor }}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Finish Side */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Finish Side</p>
        <button
          onClick={flipFinishSide}
          className="w-full py-1.5 px-3 rounded bg-gray-700 hover:bg-gray-600 text-sm text-white transition-colors"
        >
          ↔ Flip Finish Side
          <span className="text-xs text-gray-400 ml-2">({fence.finishSide})</span>
        </button>
      </div>

      {/* Elevation profile */}
      <button
        onClick={() => openElevationView(fenceId)}
        className="w-full py-1.5 rounded bg-teal-900/50 hover:bg-teal-800 text-teal-300 text-xs font-medium transition-colors"
      >
        ↕ Elevation Profile
      </button>

      <button
        onClick={handleDelete}
        className="w-full py-1.5 rounded bg-red-900/50 hover:bg-red-800 text-red-300 text-xs font-medium transition-colors"
      >
        Delete Fence
      </button>
    </div>
  );
}
