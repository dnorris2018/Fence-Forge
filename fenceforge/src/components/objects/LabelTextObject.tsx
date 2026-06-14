import { useRef } from 'react';
import { Text, Rect, Line, Circle, Group } from 'react-konva';
import type Konva from 'konva';
import type { PlaceableObject } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistoryStore } from '../../store/historyStore';

/** Find where the line from box center to the tip exits the box boundary (local coords). */
function boxEdgePoint(w: number, h: number, tipRelX: number, tipRelY: number) {
  const cx = w / 2, cy = h / 2;
  const dx = tipRelX - cx, dy = tipRelY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
  const tx = dx !== 0 ? (dx > 0 ? (w - cx) / dx : -cx / dx) : Infinity;
  const ty = dy !== 0 ? (dy > 0 ? (h - cy) / dy : -cy / dy) : Infinity;
  const t = Math.min(Math.abs(tx), Math.abs(ty));
  return { x: cx + dx * t, y: cy + dy * t };
}

interface BoxProps {
  obj: PlaceableObject;
  isSelected: boolean;
}

/** The label box only — rendered inside the draggable/transformable Group. */
export function LabelTextBox({ obj, isSelected }: BoxProps) {
  const { width, height, label } = obj;
  const fontSize = Math.max(10, Math.min(height * 0.55, 32));
  return (
    <>
      <Rect
        x={0} y={0}
        width={width} height={height}
        fill="rgba(255,255,255,0.9)"
        stroke={isSelected ? '#FFD700' : '#555'}
        strokeWidth={isSelected ? 2 : 1.5}
        cornerRadius={4}
        listening={false}
      />
      <Text
        x={6} y={0}
        width={width - 12} height={height}
        text={label || 'Type in properties →'}
        fontSize={fontSize}
        fontFamily="sans-serif"
        fill={label ? '#111' : '#aaa'}
        verticalAlign="middle"
        wrap="word"
        listening={false}
      />
    </>
  );
}

interface ArrowProps {
  obj: PlaceableObject;
  isSelected: boolean;
}

/** Arrow + tip dot rendered as a sibling Group (outside the transform group). */
export function LabelTextArrow({ obj, isSelected }: ArrowProps) {
  const didPush = useRef(false);
  const { x, y, width, height } = obj;

  const tipWorldX = obj.arrowTipX ?? x + width + 80;
  const tipWorldY = obj.arrowTipY ?? y + height / 2 + 60;

  // Box edge connection point in world coords
  const tipRelToBox = { x: tipWorldX - x, y: tipWorldY - y };
  const edgeLocal = boxEdgePoint(width, height, tipRelToBox.x, tipRelToBox.y);
  const edgeWorldX = x + edgeLocal.x;
  const edgeWorldY = y + edgeLocal.y;

  const dotColor = isSelected ? '#FFD700' : '#333';
  const lineColor = isSelected ? '#FFD700' : '#444';

  function handleTipDragStart() {
    if (!didPush.current) {
      useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().getSnapshot());
      didPush.current = true;
    }
  }

  function handleTipDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target as Konva.Node;
    useCanvasStore.getState().updateObject(obj.id, {
      arrowTipX: node.x(),
      arrowTipY: node.y(),
    });
  }

  function handleTipDragEnd() { didPush.current = false; }

  return (
    <Group listening={isSelected}>
      {/* Leader line */}
      <Line
        points={[edgeWorldX, edgeWorldY, tipWorldX, tipWorldY]}
        stroke={lineColor}
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />

      {/* Dot at the tip */}
      <Circle
        x={tipWorldX} y={tipWorldY}
        radius={9}
        fill={dotColor}
        stroke="#fff"
        strokeWidth={1.5}
        listening={false}
      />

      {/* Draggable handle (only when selected) */}
      {isSelected && (
        <Circle
          x={tipWorldX} y={tipWorldY}
          radius={10}
          fill="#FFD700"
          stroke="#333"
          strokeWidth={1.5}
          opacity={0.7}
          draggable
          onDragStart={handleTipDragStart}
          onDragMove={handleTipDragMove}
          onDragEnd={handleTipDragEnd}
          onMouseEnter={e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'crosshair'; }}
          onMouseLeave={e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
        />
      )}
    </Group>
  );
}
