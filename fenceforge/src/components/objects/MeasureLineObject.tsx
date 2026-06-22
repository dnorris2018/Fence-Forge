import { useRef, useState } from 'react';
import { Group, Line, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import type { PlaceableObject } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { PIXELS_PER_FOOT } from '../../constants/canvas';

function snap(v: number): number {
  const { snapEnabled, snapSizeFt } = useUiStore.getState();
  if (!snapEnabled) return v;
  const s = snapSizeFt * PIXELS_PER_FOOT;
  return Math.round(v / s) * s;
}

interface Props {
  obj: PlaceableObject;
  isSelected: boolean;
  onSelect: () => void;
}

/** A freestanding dimension line with draggable endpoints and a length label. */
export function MeasureLineElement({ obj, isSelected, onSelect }: Props) {
  const didPush = useRef(false);
  const bodyOrigin = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // Live offset applied to circles/label while body is being dragged
  const [liveDx, setLiveDx] = useState(0);
  const [liveDy, setLiveDy] = useState(0);
  const isDraggingBody = useRef(false);

  const x1 = obj.x, y1 = obj.y;
  const x2 = obj.lineEndX ?? obj.x + obj.width, y2 = obj.lineEndY ?? obj.y;

  // Effective positions accounting for live body-drag offset
  const ex1 = x1 + liveDx, ey1 = y1 + liveDy;
  const ex2 = x2 + liveDx, ey2 = y2 + liveDy;

  const ddx = ex2 - ex1, ddy = ey2 - ey1;
  const len = Math.hypot(ddx, ddy);
  const angleDeg = Math.atan2(ddy, ddx) * 180 / Math.PI;
  const labelAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;
  const lengthFt = (Math.hypot(x2 - x1, y2 - y1) / PIXELS_PER_FOOT).toFixed(1);
  const midX = (ex1 + ex2) / 2, midY = (ey1 + ey2) / 2;
  const nx = len ? -ddy / len : 0, ny = len ? ddx / len : 1;
  const tick = 6;

  function pushHistory() {
    if (!didPush.current) {
      useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().getSnapshot());
      didPush.current = true;
    }
  }
  function endDrag() { didPush.current = false; }

  function handleBodyDragStart() {
    bodyOrigin.current = { x1, y1, x2, y2 };
    isDraggingBody.current = true;
    pushHistory();
  }

  function handleBodyDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target as Konva.Line;
    // Update live offset so circles and label track the line visually
    setLiveDx(node.x());
    setLiveDy(node.y());
  }

  function handleBodyDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    if (!bodyOrigin.current) return;
    const node = e.target as Konva.Line;
    const ox = node.x(), oy = node.y();
    const { x1: bx1, y1: by1, x2: bx2, y2: by2 } = bodyOrigin.current;
    useCanvasStore.getState().updateObject(obj.id, {
      x: snap(bx1 + ox), y: snap(by1 + oy),
      lineEndX: snap(bx2 + ox), lineEndY: snap(by2 + oy),
    });
    node.position({ x: 0, y: 0 });
    bodyOrigin.current = null;
    isDraggingBody.current = false;
    setLiveDx(0);
    setLiveDy(0);
    endDrag();
  }

  function handleStartDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target as Konva.Circle;
    const sx = snap(node.x()), sy = snap(node.y());
    node.position({ x: sx, y: sy });
    useCanvasStore.getState().updateObject(obj.id, { x: sx, y: sy });
  }

  function handleEndDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target as Konva.Circle;
    const sx = snap(node.x()), sy = snap(node.y());
    node.position({ x: sx, y: sy });
    useCanvasStore.getState().updateObject(obj.id, { lineEndX: sx, lineEndY: sy });
  }

  const color = isSelected ? '#FFD700' : '#444';

  function setCursor(stage: Konva.Stage | null, cursor: string) {
    if (stage) stage.container().style.cursor = cursor;
  }

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      {/* End tick marks */}
      <Line points={[ex1 - nx * tick, ey1 - ny * tick, ex1 + nx * tick, ey1 + ny * tick]} stroke={color} strokeWidth={1.5} listening={false} />
      <Line points={[ex2 - nx * tick, ey2 - ny * tick, ex2 + nx * tick, ey2 + ny * tick]} stroke={color} strokeWidth={1.5} listening={false} />

      {/* Main line — draggable to move the whole measurement */}
      <Line
        points={[x1, y1, x2, y2]}
        stroke={color}
        strokeWidth={isSelected ? 2.5 : 2}
        dash={[8, 5]}
        hitStrokeWidth={14}
        draggable
        onDragStart={handleBodyDragStart}
        onDragMove={handleBodyDragMove}
        onDragEnd={handleBodyDragEnd}
        onMouseEnter={(e) => setCursor(e.target.getStage(), 'move')}
        onMouseLeave={(e) => setCursor(e.target.getStage(), 'default')}
      />

      {/* Length label */}
      <Text
        x={midX}
        y={midY}
        text={`${lengthFt}'`}
        fontSize={12}
        fontFamily="monospace"
        fill={color}
        rotation={labelAngle}
        offsetX={lengthFt.length * 3.5}
        offsetY={14}
        listening={false}
      />

      {/* Endpoint handles — draggable when selected */}
      {isSelected && (
        <>
          <Circle
            x={ex1} y={ey1}
            radius={7}
            fill="#FFD700"
            stroke="#333"
            strokeWidth={1.5}
            draggable
            onDragStart={pushHistory}
            onDragMove={handleStartDragMove}
            onDragEnd={endDrag}
            onMouseEnter={(e) => setCursor(e.target.getStage(), 'crosshair')}
            onMouseLeave={(e) => setCursor(e.target.getStage(), 'default')}
          />
          <Circle
            x={ex2} y={ey2}
            radius={7}
            fill="#FFD700"
            stroke="#333"
            strokeWidth={1.5}
            draggable
            onDragStart={pushHistory}
            onDragMove={handleEndDragMove}
            onDragEnd={endDrag}
            onMouseEnter={(e) => setCursor(e.target.getStage(), 'crosshair')}
            onMouseLeave={(e) => setCursor(e.target.getStage(), 'default')}
          />
        </>
      )}
    </Group>
  );
}
