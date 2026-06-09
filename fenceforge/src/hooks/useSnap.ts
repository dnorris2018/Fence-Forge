import { useUiStore } from '../store/uiStore';
import { useCanvasStore } from '../store/canvasStore';
import { PIXELS_PER_FOOT, SNAP_VERTEX_RADIUS } from '../constants/canvas';

export function useSnap() {
  const { snapEnabled, snapSizeFt } = useUiStore();
  const fences = useCanvasStore(s => s.fences);

  function snap(x: number, y: number): [number, number] {
    if (!snapEnabled) return [x, y];

    // Try snap to fence endpoints
    for (const fence of Object.values(fences)) {
      const pts = fence.points;
      for (let i = 0; i < pts.length; i += 2) {
        const px = pts[i], py = pts[i + 1];
        const dx = x - px, dy = y - py;
        if (Math.sqrt(dx * dx + dy * dy) <= SNAP_VERTEX_RADIUS) {
          return [px, py];
        }
      }
    }

    // Grid snap
    const snapPx = snapSizeFt * PIXELS_PER_FOOT;
    return [
      Math.round(x / snapPx) * snapPx,
      Math.round(y / snapPx) * snapPx,
    ];
  }

  return snap;
}
