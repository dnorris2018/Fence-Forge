import { useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';
import { useUiStore } from '../../store/uiStore';
import { FENCE_TYPES, getFenceColor } from '../../constants/fenceTypes';
import { segmentLength } from '../../utils/geometry';
import { PIXELS_PER_FOOT } from '../../constants/canvas';
import type { FenceTypeKey, FenceStyle } from '../../types';
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

  function handleDelete() {
    saveHistory();
    deleteFence(fenceId);
    clearSelection();
  }

  return (
    <div className="p-3 space-y-4">
      {/* Fence type label */}
      <div>
        <p className="text-xs text-[var(--c-text3)] uppercase tracking-wide mb-1">Fence</p>
        <div className="flex items-center gap-2 p-2 bg-[var(--c-bg3)] rounded">
          <span
            className="w-4 h-4 rounded-sm border border-black/20 shrink-0"
            style={{ background: currentColor }}
          />
          <span className="text-sm text-[var(--c-text1)] truncate">{def.label}</span>
        </div>
      </div>

      {/* Per-line color picker */}
      <div>
        <p className="text-xs text-[var(--c-text3)] mb-2">Fence Color</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentColor}
            onChange={e => handleColorChange(e.target.value)}
            onBlur={handleColorCommit}
            className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
            title="Pick fence color"
          />
          <span className="text-xs font-mono text-[var(--c-text2)]">{currentColor.toUpperCase()}</span>
          <button
            onClick={() => { saveHistory(); updateFence(fenceId, { color: FENCE_TYPES[fence.fenceType].color }); }}
            className="ml-auto text-xs text-[var(--c-text3)] hover:text-[var(--c-text2)] transition-colors"
            title="Reset to default color"
          >
            Reset
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-[var(--c-text3)] mb-1">Length</p>
        <p className="text-sm text-[var(--c-accent2)] font-mono">{lengthFt} ft</p>
      </div>



      {/* Line post spacing (ornamental only) */}
      {(fence.fenceType === 'aluminum-ornamental' || fence.fenceType === 'steel-ornamental') && (
        <div>
          <p className="text-xs text-[var(--c-text3)] mb-2">Line Post Spacing</p>
          <div className="flex gap-1">
            {[6, 8].map(sp => (
              <button
                key={sp}
                onClick={() => { saveHistory(); updateFence(fenceId, { linePostSpacingFt: sp }); }}
                className={`flex-1 py-1 rounded text-xs font-mono transition-colors ${
                  (fence.linePostSpacingFt ?? 6) === sp
                    ? 'bg-[var(--c-accent)]/30 border border-emerald-500/60 text-[var(--c-accent2)]'
                    : 'bg-[var(--c-bg3)] hover:bg-[var(--c-bg4)] text-[var(--c-text2)]'
                }`}
              >
                {sp}'
              </button>
            ))}
          </div>
        </div>
      )}

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
