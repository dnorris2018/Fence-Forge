import type React from 'react';
import Konva from 'konva';
import { useCanvasStore } from '../store/canvasStore';
import { useUiStore } from '../store/uiStore';
import { useHistory } from './useHistory';
import { closestSegmentOnFence } from '../utils/geometry';
import { PIXELS_PER_FOOT, SNAP_VERTEX_RADIUS } from '../constants/canvas';
import { isPolyObjectType } from '../types/object';

// Always read fresh state from the stores for event handlers
function getFreshStore() { return useCanvasStore.getState(); }
function getFreshUi() { return useUiStore.getState(); }

function snapPoint(x: number, y: number): [number, number] {
  const { snapEnabled, snapSizeFt } = getFreshUi();
  if (!snapEnabled) return [x, y];

  const { fences } = getFreshStore();

  // Try snap to fence endpoints
  for (const fence of Object.values(fences)) {
    const pts = fence.points;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = x - pts[i], dy = y - pts[i + 1];
      if (Math.sqrt(dx * dx + dy * dy) <= SNAP_VERTEX_RADIUS) {
        return [pts[i], pts[i + 1]];
      }
    }
  }

  // Grid snap
  const snapPx = snapSizeFt * PIXELS_PER_FOOT;
  return [Math.round(x / snapPx) * snapPx, Math.round(y / snapPx) * snapPx];
}

export function useCanvasInteraction(stageRef: React.RefObject<Konva.Stage | null>) {
  const { saveHistory } = useHistory();

  function getWorldPos(): [number, number] | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return null;
    return [pos.x, pos.y];
  }

  function handleMouseMove() {
    const pos = getWorldPos();
    if (!pos) return;
    const [x, y] = snapPoint(...pos);
    getFreshStore().setCursorPoint([x, y]);
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 1) return;

    const pos = getWorldPos();
    if (!pos) return;
    const [rx, ry] = snapPoint(...pos);

    const store = getFreshStore();

    if (store.toolMode === 'draw-fence') {
      store.appendDrawingPoint(rx, ry);
      return;
    }

    if (store.toolMode === 'place-object') {
      if (isPolyObjectType(store.activeObjectType)) {
        store.setToolMode('draw-poly-object');
        store.appendDrawingPoint(rx, ry);
      } else {
        saveHistory();
        const id = store.addObject(store.activeObjectType, rx, ry);
        store.setSelection(id, 'object');
        store.setToolMode('pan');
      }
      return;
    }

    if (store.toolMode === 'draw-poly-object') {
      store.appendDrawingPoint(rx, ry);
      return;
    }

    if (store.toolMode === 'place-gate') {
      const fences = Object.values(store.fences);
      let bestFence = null, bestSeg = null, bestD = 60;
      for (const fence of fences) {
        const result = closestSegmentOnFence(rx, ry, fence.points, fence.curveData);
        if (result && result.d < bestD) {
          bestD = result.d;
          bestFence = fence;
          bestSeg = result;
        }
      }
      if (bestFence && bestSeg) {
        saveHistory();
        const id = store.addGate({
          fenceId: bestFence.id,
          segmentIndex: bestSeg.segIndex,
          positionT: bestSeg.t,
          gateType: store.activeGateType,
          hingeSide: 'left',
          swingDirection: 'inward',
          widthFt: store.activeGateType === 'double-swing' ? 8 : 4,
          fenceType: bestFence.fenceType,
        });
        store.setSelection(id, 'gate');
        store.setToolMode('pan');
      }
      return;
    }

    // select mode — click on blank canvas deselects
    if (e.target === e.target.getStage()) {
      store.clearSelection();
    }
  }

  function handleDblClick() {
    const store = getFreshStore();

    if (store.toolMode === 'draw-fence') {
      const pts = store.drawingPoints.slice(0, -2);
      if (pts.length < 4) { store.cancelDrawing(); return; }
      saveHistory();
      const id = store.addFence(pts, store.activeFenceType);
      useCanvasStore.setState({ drawingPoints: [], cursorPoint: null });
      store.setSelection(id, 'fence');
      store.setToolMode('pan');
    }

    if (store.toolMode === 'draw-poly-object') {
      useCanvasStore.setState({ drawingPoints: store.drawingPoints.slice(0, -2) });
      saveHistory();
      const id = getFreshStore().finishPolyObject();
      if (id) getFreshStore().setSelection(id, 'object');
      getFreshStore().setToolMode('pan');
    }
  }

  return { handleMouseDown, handleMouseMove, handleDblClick };
}
