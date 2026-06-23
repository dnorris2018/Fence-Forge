import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';
import { HOUSE_STYLES, HOUSE_STYLE_LABELS } from '../../constants/houseShapes';
import type { HouseStyle } from '../../constants/houseShapes';
import { PIXELS_PER_FOOT } from '../../constants/canvas';

interface Props { objectId: string; }

/** Tiny SVG preview of each house footprint shape */
function ShapeIcon({ style, flipX }: { style: HouseStyle; flipX?: boolean }) {
  const paths: Record<HouseStyle, string> = {
    rectangle:  'M0,0 H10 V10 H0 Z',
    'l-shape':  'M0,0 H10 V5 H5 V10 H0 Z',
    'stepped-l':'M0,0 H10 V4 H7 V7 H4 V10 H0 Z',
    't-shape':  'M0,0 H10 V4 H6.5 V10 H3.5 V4 H0 Z',
    'u-shape':  'M0,0 H10 V10 H6.5 V4 H3.5 V10 H0 Z',
    plus:       'M3.3,0 H6.7 V3.3 H10 V6.7 H6.7 V10 H3.3 V6.7 H0 V3.3 H3.3 Z',
    'z-shape':  'M0,0 H6 V4.5 H10 V10 H4 V5.5 H0 Z',
    'h-shape':  'M0,0 H3.5 V3.8 H6.5 V0 H10 V10 H6.5 V6.2 H3.5 V10 H0 Z',
  };
  return (
    <svg viewBox="0 0 10 10" width="28" height="28"
      style={{ transform: flipX ? 'scaleX(-1)' : undefined }}>
      <path d={paths[style]} fill="#8B5C2A" stroke="#3A1A08" strokeWidth="0.6" />
    </svg>
  );
}

export function HouseProperties({ objectId }: Props) {
  const obj          = useCanvasStore(s => s.objects[objectId]);
  const updateObject = useCanvasStore(s => s.updateObject);
  const deleteObject = useCanvasStore(s => s.deleteObject);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const { saveHistory } = useHistory();

  if (!obj) return null;

  const style  = obj.houseStyle  ?? 'rectangle';
  const flipX  = obj.houseFlipX  ?? false;
  const wFt    = Math.round(obj.width  / PIXELS_PER_FOOT);
  const hFt    = Math.round(obj.height / PIXELS_PER_FOOT);

  function setStyle(s: HouseStyle) {
    saveHistory();
    updateObject(objectId, { houseStyle: s });
  }

  function toggleFlip() {
    saveHistory();
    updateObject(objectId, { houseFlipX: !flipX });
  }

  function setSize(wFt: number, hFt: number) {
    saveHistory();
    updateObject(objectId, {
      width:  Math.max(PIXELS_PER_FOOT, wFt * PIXELS_PER_FOOT),
      height: Math.max(PIXELS_PER_FOOT, hFt * PIXELS_PER_FOOT),
    });
  }

  function handleDelete() {
    saveHistory();
    deleteObject(objectId);
    clearSelection();
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <p className="text-xs text-[var(--c-text3)] uppercase tracking-wide">House</p>

      {/* Shape style picker */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-[var(--c-text3)]">Shape</p>
        <div className="grid grid-cols-3 gap-1">
          {HOUSE_STYLES.map(s => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              title={HOUSE_STYLE_LABELS[s]}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-xs transition-colors ${
                style === s
                  ? 'bg-emerald-700 text-[var(--c-text1)]'
                  : 'bg-[var(--c-bg3)] hover:bg-[var(--c-bg4)] text-[var(--c-text2)]'
              }`}
            >
              <ShapeIcon style={s} />
              <span className="text-[9px] leading-none">{HOUSE_STYLE_LABELS[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Flip */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-[var(--c-text3)]">Direction</p>
        <button
          onClick={toggleFlip}
          className={`py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 ${
            flipX
              ? 'bg-emerald-700 text-[var(--c-text1)]'
              : 'bg-[var(--c-bg3)] hover:bg-[var(--c-bg4)] text-[var(--c-text2)]'
          }`}
        >
          <ShapeIcon style={style} flipX={flipX} />
          <span>Mirror</span>
        </button>
      </div>

      {/* Size */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-[var(--c-text3)]">Size (ft)</p>
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label className="text-[10px] text-[var(--c-text3)]">Width</label>
            <input
              type="number" min={5} step={1}
              value={wFt}
              onChange={e => setSize(Number(e.target.value), hFt)}
              className="w-full bg-[var(--c-bg3)] text-[var(--c-text2)] text-xs rounded px-2 py-1 border border-[var(--c-border2)] focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label className="text-[10px] text-[var(--c-text3)]">Depth</label>
            <input
              type="number" min={5} step={1}
              value={hFt}
              onChange={e => setSize(wFt, Number(e.target.value))}
              className="w-full bg-[var(--c-bg3)] text-[var(--c-text2)] text-xs rounded px-2 py-1 border border-[var(--c-border2)] focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleDelete}
        className="mt-auto py-1 px-3 rounded text-xs bg-red-800 hover:bg-red-700 text-[var(--c-text1)] transition-colors"
      >
        Delete House
      </button>
    </div>
  );
}
