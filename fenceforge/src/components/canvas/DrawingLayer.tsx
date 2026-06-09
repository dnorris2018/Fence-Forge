import { Layer, Line, Circle, Text, Rect, Group } from 'react-konva';
import type { FenceTypeKey, ObjectType, ToolMode } from '../../types';
import { FENCE_TYPES } from '../../constants/fenceTypes';
import { PIXELS_PER_FOOT } from '../../constants/canvas';

/** Object types whose polygon preview should use straight lines (tension=0) */
const STRAIGHT_POLY_TYPES: ObjectType[] = ['building'];

interface Props {
  drawingPoints: number[];
  cursorPoint: [number, number] | null;
  activeFenceType: FenceTypeKey;
  activeObjectType: ObjectType;
  toolMode: ToolMode;
  zoom: number;
}

export function DrawingLayer({ drawingPoints, cursorPoint, activeFenceType, activeObjectType, toolMode, zoom }: Props) {
  if (drawingPoints.length === 0) return null;

  // ── Polygon object drawing preview ──────────────────────────────────
  if (toolMode === 'draw-poly-object') {
    const tension = STRAIGHT_POLY_TYPES.includes(activeObjectType) ? 0 : 0.5;
    return (
      <Layer listening={false}>
        {/* Filled polygon so far */}
        {drawingPoints.length >= 6 && (
          <Line
            points={drawingPoints}
            closed
            tension={tension}
            fill="rgba(150,150,145,0.45)"
            stroke="#606060"
            strokeWidth={2}
          />
        )}
        {/* Rubber-band edge to cursor */}
        {cursorPoint && drawingPoints.length >= 2 && (
          <Line
            points={[...drawingPoints.slice(-2), cursorPoint[0], cursorPoint[1]]}
            stroke="#606060"
            strokeWidth={2}
            dash={[8, 6]}
          />
        )}
        {/* Close-to-start indicator */}
        {cursorPoint && drawingPoints.length >= 4 && (
          <Line
            points={[cursorPoint[0], cursorPoint[1], drawingPoints[0], drawingPoints[1]]}
            stroke="#606060"
            strokeWidth={1.5}
            dash={[4, 8]}
            opacity={0.5}
          />
        )}
        {/* Vertex dots */}
        {Array.from({ length: drawingPoints.length / 2 }).map((_, i) => (
          <Circle
            key={i}
            x={drawingPoints[i * 2]}
            y={drawingPoints[i * 2 + 1]}
            radius={i === 0 ? 6 : 4}
            fill="#606060"
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}
      </Layer>
    );
  }

  // ── Fence drawing preview ────────────────────────────────────────────
  if (toolMode !== 'draw-fence') return null;

  const def = FENCE_TYPES[activeFenceType];
  const previewPoints =
    cursorPoint && drawingPoints.length >= 2
      ? [...drawingPoints.slice(-2), cursorPoint[0], cursorPoint[1]]
      : [];

  // ── Live measurements ────────────────────────────────────────────────
  const n = drawingPoints.length / 2;
  // Total length of already-placed segments in feet
  let placedPx = 0;
  for (let i = 0; i < n - 1; i++) {
    const dx = drawingPoints[(i+1)*2] - drawingPoints[i*2];
    const dy = drawingPoints[(i+1)*2+1] - drawingPoints[i*2+1];
    placedPx += Math.sqrt(dx*dx + dy*dy);
  }

  // Current rubber-band segment
  let segLabel = '';
  let totalLabel = '';
  let segMidX = 0, segMidY = 0, segAngle = 0;
  if (cursorPoint && drawingPoints.length >= 2) {
    const lx = drawingPoints[drawingPoints.length - 2];
    const ly = drawingPoints[drawingPoints.length - 1];
    const dx = cursorPoint[0] - lx;
    const dy = cursorPoint[1] - ly;
    const segPx = Math.sqrt(dx*dx + dy*dy);
    segMidX = (lx + cursorPoint[0]) / 2;
    segMidY = (ly + cursorPoint[1]) / 2;
    segAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    const segFt = segPx / PIXELS_PER_FOOT;
    const totalFt = (placedPx + segPx) / PIXELS_PER_FOOT;
    segLabel   = `${segFt.toFixed(1)}'`;
    totalLabel = `Total: ${totalFt.toFixed(1)}'`;
  }

  const fs = 11 / zoom;   // font size — constant screen size
  const pad = 3 / zoom;

  return (
    <Layer listening={false}>
      {drawingPoints.length >= 4 && (
        <Line
          points={drawingPoints}
          stroke={def.color}
          strokeWidth={def.strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {previewPoints.length >= 4 && (
        <Line
          points={previewPoints}
          stroke={def.color}
          strokeWidth={def.strokeWidth}
          dash={[8, 6]}
          lineCap="round"
          opacity={0.6}
        />
      )}
      {Array.from({ length: drawingPoints.length / 2 }).map((_, i) => (
        <Circle
          key={i}
          x={drawingPoints[i * 2]}
          y={drawingPoints[i * 2 + 1]}
          radius={4}
          fill={def.color}
          stroke="#fff"
          strokeWidth={1}
        />
      ))}

      {/* Segment length label — follows the rubber-band line */}
      {segLabel && (
        <Group x={segMidX} y={segMidY} rotation={segAngle}>
          <Rect
            x={-28/zoom} y={-fs - pad*2 - 4/zoom}
            width={56/zoom} height={fs + pad*2}
            fill="rgba(0,0,0,0.72)" cornerRadius={2/zoom}
          />
          <Text
            text={segLabel}
            x={-28/zoom} y={-fs - pad*2 - 4/zoom}
            width={56/zoom} height={fs + pad*2}
            fontSize={fs} fill="#fff" align="center" verticalAlign="middle"
          />
        </Group>
      )}

      {/* Running total label — near cursor, offset up-right */}
      {totalLabel && cursorPoint && (
        <Group x={cursorPoint[0] + 12/zoom} y={cursorPoint[1] - 30/zoom}>
          <Rect
            width={80/zoom} height={fs + pad*2}
            fill="rgba(0,0,0,0.72)" cornerRadius={2/zoom}
          />
          <Text
            text={totalLabel}
            width={80/zoom} height={fs + pad*2}
            fontSize={fs} fill="#facc15" align="center" verticalAlign="middle"
          />
        </Group>
      )}
    </Layer>
  );
}
