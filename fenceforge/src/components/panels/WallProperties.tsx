import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { useHistory } from '../../hooks/useHistory';
import type { SegmentCurveData } from '../../types';

interface Props { objectId: string; }

export function WallProperties({ objectId }: Props) {
  const obj         = useCanvasStore(s => s.objects[objectId]);
  const updateObject = useCanvasStore(s => s.updateObject);
  const deleteObject = useCanvasStore(s => s.deleteObject);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const { saveHistory } = useHistory();
  const selectedPolySegment = useUiStore(s => s.selectedPolySegment);
  const setSelectedPolySegment = useUiStore(s => s.setSelectedPolySegment);

  if (!obj) return null;

  const capSide = obj.capSide ?? 'top';
  const curved  = obj.curved  ?? false;
  const pts = obj.points ?? [];
  const nv = pts.length / 2;
  const numSegs = nv - 1; // open polyline

  function setCapSide(side: 'top' | 'bottom') {
    saveHistory();
    updateObject(objectId, { capSide: side });
  }

  function toggleCurved() {
    saveHistory();
    updateObject(objectId, { curved: !curved });
  }

  function toggleSegmentCurve(segIdx: number) {
    saveHistory();
    const cur = obj.segmentCurveData ?? [];
    const next: SegmentCurveData[] = Array.from({ length: numSegs }, (_, i) =>
      cur[i] ?? { curved: false, cp1X: 0, cp1Y: 0, cp2X: 0, cp2Y: 0 }
    );
    if (next[segIdx].curved) {
      next[segIdx] = { ...next[segIdx], curved: false };
    } else {
      const x1 = pts[segIdx * 2], y1 = pts[segIdx * 2 + 1];
      const x2 = pts[(segIdx + 1) * 2], y2 = pts[(segIdx + 1) * 2 + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = len > 0 ? -dy / len : 0, perpY = len > 0 ? dx / len : 0;
      const offset = len * 0.25;
      next[segIdx] = {
        curved: true,
        cp1X: x1 + dx / 3 + perpX * offset,
        cp1Y: y1 + dy / 3 + perpY * offset,
        cp2X: x1 + 2 * dx / 3 + perpX * offset,
        cp2Y: y1 + 2 * dy / 3 + perpY * offset,
      };
    }
    updateObject(objectId, { segmentCurveData: next });
  }

  function handleDelete() {
    saveHistory();
    deleteObject(objectId);
    clearSelection();
    setSelectedPolySegment(null);
  }

  const segCurveData = obj.segmentCurveData ?? [];

  return (
    <div className="p-4 flex flex-col gap-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">Wall</p>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-400">Cap Position</p>
        <div className="flex gap-2">
          {(['top', 'bottom'] as const).map(side => (
            <button
              key={side}
              onClick={() => setCapSide(side)}
              className={`flex-1 py-1 rounded text-xs font-medium capitalize transition-colors ${
                capSide === side
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-400">Edge Style</p>
        <div className="flex gap-2">
          {([true, false] as const).map(c => (
            <button
              key={String(c)}
              onClick={() => { if (curved !== c) toggleCurved(); }}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                curved === c
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {c ? 'All Curved' : 'All Straight'}
            </button>
          ))}
        </div>
      </div>

      {/* Per-segment curve toggle */}
      {numSegs >= 1 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400">Segments — click a side on canvas to select</p>
          <div className="space-y-1">
            {Array.from({ length: numSegs }, (_, i) => {
              const isCurved = segCurveData[i]?.curved ?? false;
              const isActive = selectedPolySegment === i;
              return (
                <div key={i} className={`flex items-center gap-1 rounded px-1 py-0.5 ${isActive ? 'bg-gray-700' : ''}`}>
                  <span className="text-xs text-gray-400 w-14 shrink-0">Side {i + 1}</span>
                  <button
                    onClick={() => toggleSegmentCurve(i)}
                    className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                      isCurved
                        ? 'bg-blue-500/30 border border-blue-500/60 text-blue-300'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                    }`}
                  >
                    {isCurved ? '⌒ Curved' : '— Straight'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleDelete}
        className="mt-auto py-1 px-3 rounded text-xs bg-red-800 hover:bg-red-700 text-white transition-colors"
      >
        Delete Wall
      </button>
    </div>
  );
}
