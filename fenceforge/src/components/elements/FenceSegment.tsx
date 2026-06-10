import { useRef } from 'react';
import { Group, Line, Shape, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import { FENCE_TYPES, getFenceColor } from '../../constants/fenceTypes';
import { perpendicular, pointOnSegment } from '../../utils/geometry';
import type { FenceLine, Gate } from '../../types';
import { PIXELS_PER_FOOT, GRADIENT_STRIP_WIDTH, SNAP_VERTEX_RADIUS } from '../../constants/canvas';
import { linePostSpacingFt } from '../../utils/materials';

// Returns effective stroke width based on fence type + optional height
function effectiveStrokeWidth(fence: FenceLine, baseWidth: number): number {
  const h = fence.heightFt;
  switch (fence.fenceType) {
    case 'wood-privacy':
      return h === 8 ? 8 : 6;
    case 'ranch-rail':
      return h === 5 ? 4 : 3;
    case 'wood-cap-board':
      return h === 8 ? 7 : 5;
    case 'chain-link-galv':
    case 'chain-link-black':
      switch (h) { case 4: return 3; case 5: return 4; case 8: return 6; case 10: return 7; default: return 5; }
    case 'aluminum-ornamental':
    case 'steel-ornamental':
      switch (h) { case 4: return 3; case 5: return 4; default: return 5; }
    default:
      return baseWidth;
  }
}

/** Snap a world-coord point to grid or nearby vertices */
function snapVertex(
  x: number, y: number,
  enabled: boolean,
  sizeFt: number,
  others: [number, number][],
): [number, number] {
  if (!enabled) return [x, y];
  for (const [vx, vy] of others) {
    if (Math.hypot(x - vx, y - vy) < SNAP_VERTEX_RADIUS) return [vx, vy];
  }
  const s = sizeFt * PIXELS_PER_FOOT;
  return [Math.round(x / s) * s, Math.round(y / s) * s];
}

interface Props {
  fence: FenceLine;
  gates: Gate[];
  isSelected: boolean;
  onSelect: () => void;
  /** Vertex-editing callbacks — only supplied when a fence is selected */
  updateFence?: (id: string, patch: Partial<FenceLine>) => void;
  onBeforeEdit?: () => void;
  snapEnabled?: boolean;
  snapSizeFt?: number;
  /** Vertices from all other fences — used for vertex-snap */
  otherVertices?: [number, number][];
  labelFontSize?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

interface SegInfo {
  x1: number; y1: number; x2: number; y2: number;
  lengthFt: string;
  mx: number; my: number;
  labelAngle: number;
  // Gradient quad corners (inner = at fence, outer = away from fence)
  gPoly: number[];
  // Gradient direction: inner midpoint → outer midpoint
  gix: number; giy: number;
  gox: number; goy: number;
}

function buildSegInfos(points: number[], finishSide: 'left' | 'right'): SegInfo[] {
  const sign = finishSide === 'left' ? 1 : -1;
  const w = GRADIENT_STRIP_WIDTH;
  const segs: SegInfo[] = [];

  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i], y1 = points[i + 1];
    const x2 = points[i + 2], y2 = points[i + 3];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    const { nx, ny } = perpendicular(dx, dy, len);
    const ox = nx * sign * w;
    const oy = ny * sign * w;

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    const labelAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

    segs.push({
      x1, y1, x2, y2,
      lengthFt: (len / PIXELS_PER_FOOT).toFixed(1),
      mx, my,
      labelAngle,
      // Quad: inner edge (on fence line), then outer edge (offset away)
      gPoly: [x1, y1, x2, y2, x2 + ox, y2 + oy, x1 + ox, y1 + oy],
      gix: mx, giy: my,
      gox: mx + ox, goy: my + oy,
    });
  }

  return segs;
}

export function FenceSegment({
  fence, gates, isSelected, onSelect,
  updateFence, onBeforeEdit,
  snapEnabled = true, snapSizeFt = 1, otherVertices = [], labelFontSize = 11,
}: Props) {
  const def = FENCE_TYPES[fence.fenceType];
  if (!def) return null;
  const color = getFenceColor(fence);
  const [r, g, b] = hexToRgb(color);

  const strokeWidth = effectiveStrokeWidth(fence, def.strokeWidth);
  const segs = buildSegInfos(fence.points, fence.finishSide);
  const subSegments = buildSubSegments(fence.points, gates);
  const numVertices = fence.points.length / 2;

  // Track whether we've already pushed history for the current drag gesture
  const didPushHistory = useRef(false);

  const editMode = isSelected && !!updateFence;

  // ── Vertex drag handlers ────────────────────────────────────────────────────
  function handleVertexDragStart() {
    if (!didPushHistory.current) {
      onBeforeEdit?.();
      didPushHistory.current = true;
    }
  }

  function handleVertexDragMove(e: Konva.KonvaEventObject<DragEvent>, vi: number) {
    const node = e.target as Konva.Circle;
    let [sx, sy] = snapVertex(node.x(), node.y(), snapEnabled, snapSizeFt, otherVertices);
    node.position({ x: sx, y: sy });
    const newPoints = [...fence.points];
    newPoints[vi * 2]     = sx;
    newPoints[vi * 2 + 1] = sy;
    updateFence!(fence.id, { points: newPoints });
  }

  function handleVertexDragEnd() {
    didPushHistory.current = false;
  }

  // ── Vertex double-click → delete that vertex ────────────────────────────────
  function handleVertexDblClick(e: Konva.KonvaEventObject<MouseEvent>, vi: number) {
    e.cancelBubble = true;
    if (numVertices <= 2) return;   // must keep at least 2 points (1 segment)
    onBeforeEdit?.();
    const newPoints = [...fence.points];
    newPoints.splice(vi * 2, 2);
    updateFence!(fence.id, { points: newPoints });
  }

  // ── Compute line post positions ────────────────────────────────────────────
  const linePostPositions: { x: number; y: number }[] = [];
  const spacingPx = linePostSpacingFt(fence.fenceType) * PIXELS_PER_FOOT;

  for (let si = 0; si < numVertices - 1; si++) {
    const x1 = fence.points[si * 2],       y1 = fence.points[si * 2 + 1];
    const x2 = fence.points[(si + 1) * 2], y2 = fence.points[(si + 1) * 2 + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const segPx = Math.sqrt(dx * dx + dy * dy);
    if (segPx === 0) continue;

    // Build gate gap ranges on this segment as [t0, t1] fractions
    const gaps = gates
      .filter(g => g.segmentIndex === si)
      .map(g => {
        const halfFrac = ((g.widthFt * PIXELS_PER_FOOT) / 2) / segPx;
        return { t0: Math.max(0, g.positionT - halfFrac), t1: Math.min(1, g.positionT + halfFrac) };
      })
      .sort((a, b) => a.t0 - b.t0);

    // Visible pieces between gaps
    const pieces: { t0: number; t1: number }[] = [];
    let prev = 0;
    for (const gap of gaps) {
      if (gap.t0 > prev) pieces.push({ t0: prev, t1: gap.t0 });
      prev = gap.t1;
    }
    if (prev < 1) pieces.push({ t0: prev, t1: 1 });

    for (const piece of pieces) {
      const piecePx = (piece.t1 - piece.t0) * segPx;
      if (piecePx <= spacingPx) continue;
      const numSpans = Math.ceil(piecePx / spacingPx);
      for (let k = 1; k < numSpans; k++) {
        const t = piece.t0 + (piece.t1 - piece.t0) * (k / numSpans);
        linePostPositions.push({ x: x1 + dx * t, y: y1 + dy * t });
      }
    }
  }

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      {/* Per-segment gradient strips */}
      {segs.map((seg, i) => (
        <Shape
          key={`grad-${i}`}
          sceneFunc={(ctx: Konva.Context, _shape) => {
            const native = (ctx as any)._context as CanvasRenderingContext2D;
            const grad = native.createLinearGradient(seg.gix, seg.giy, seg.gox, seg.goy);
            grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            native.beginPath();
            const p = seg.gPoly;
            native.moveTo(p[0], p[1]);
            for (let j = 2; j < p.length; j += 2) native.lineTo(p[j], p[j + 1]);
            native.closePath();
            native.fillStyle = grad;
            native.fill();
          }}
          listening={false}
        />
      ))}

      {/* Fence line segments (with gate gaps) */}
      {subSegments.map((seg, i) => (
        <Line
          key={i}
          points={seg}
          stroke={isSelected ? '#FFD700' : color}
          strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={12}
          shadowColor={color}
          shadowBlur={def.category === 'vinyl' ? 3 : 0}
          shadowOpacity={0.4}
        />
      ))}

      {/* Per-sub-segment length labels — each visible piece between / around gate gaps */}
      {buildSegmentLabels(fence.points, gates).map((lbl, i) => (
        <Text
          key={`lbl-${i}`}
          x={lbl.mx}
          y={lbl.my}
          text={lbl.text}
          fontSize={labelFontSize}
          fontFamily="monospace"
          fill="#333"
          rotation={lbl.labelAngle}
          offsetX={lbl.text.length * (labelFontSize * 0.3)}
          offsetY={strokeWidth / 2 + labelFontSize + 1}
          listening={false}
        />
      ))}

      {/* Finish-side label — "Finish" at midpoint of each segment, offset onto gradient side */}
      {segs.map((seg, i) => {
        const finishText = 'Finished Side';
        const charW = labelFontSize * 0.55;
        return (
          <Text
            key={`finish-${i}`}
            x={seg.gox}
            y={seg.goy}
            text={finishText}
            fontSize={labelFontSize}
            fontFamily="sans-serif"
            fontStyle="italic"
            fill={color}
            opacity={0.75}
            rotation={seg.labelAngle}
            offsetX={finishText.length * charW / 2}
            offsetY={labelFontSize / 2}
            listening={false}
          />
        );
      })}

      {/* ── Line post markers ───────────────────────────────────────────────── */}
      {linePostPositions.map((lp, i) => (
        <Circle
          key={`lp-${i}`}
          x={lp.x} y={lp.y}
          radius={isSelected ? 4 : 3}
          fill={isSelected ? '#FFD700' : '#ccc'}
          stroke={isSelected ? '#fff' : color}
          strokeWidth={1}
          listening={false}
        />
      ))}

      {/* ── Vertex handles — drag to move, dblclick to delete ───────────────── */}
      {Array.from({ length: numVertices }).map((_, vi) => {
        const vx = fence.points[vi * 2];
        const vy = fence.points[vi * 2 + 1];
        const isEndpoint = vi === 0 || vi === numVertices - 1;

        return (
          <Circle
            key={`v-${vi}`}
            x={vx}
            y={vy}
            radius={isSelected ? (isEndpoint ? 6 : 5) : (isEndpoint ? 5 : 4)}
            fill={isSelected ? '#FFD700' : '#fff'}
            stroke={isSelected ? '#fff' : color}
            strokeWidth={isSelected ? 2 : 1.5}
            draggable={editMode}
            listening={isSelected}
            hitStrokeWidth={14}
            onDragStart={handleVertexDragStart}
            onDragMove={(e) => handleVertexDragMove(e, vi)}
            onDragEnd={handleVertexDragEnd}
            onDblClick={(e) => editMode && handleVertexDblClick(e, vi)}
            onMouseEnter={(e) => {
              if (!editMode) return;
              const s = e.target.getStage();
              if (s) s.container().style.cursor = 'move';
            }}
            onMouseLeave={(e) => {
              if (!editMode) return;
              const s = e.target.getStage();
              if (s) s.container().style.cursor = 'default';
            }}
          />
        );
      })}
    </Group>
  );
}

interface LabelInfo { mx: number; my: number; labelAngle: number; text: string; }

/** Per-sub-segment length labels — splits around gate gaps so each visible piece gets its own label */
function buildSegmentLabels(points: number[], gates: Gate[]): LabelInfo[] {
  const labels: LabelInfo[] = [];
  const numSegs = points.length / 2 - 1;

  for (let si = 0; si < numSegs; si++) {
    const x1 = points[si * 2], y1 = points[si * 2 + 1];
    const x2 = points[si * 2 + 2], y2 = points[si * 2 + 3];
    const dx = x2 - x1, dy = y2 - y1;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen === 0) continue;

    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    const labelAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

    const gapsOnSeg = gates
      .filter(g => g.segmentIndex === si)
      .map(g => {
        const halfGap = (g.widthFt * PIXELS_PER_FOOT) / 2 + PIXELS_PER_FOOT * 0.3;
        const tc = g.positionT;
        return { t0: Math.max(0, tc - halfGap / segLen), t1: Math.min(1, tc + halfGap / segLen) };
      })
      .sort((a, b) => a.t0 - b.t0);

    // Build the visible pieces between / around gate gaps
    const pieces: { t0: number; t1: number }[] = [];
    let prev = 0;
    for (const gap of gapsOnSeg) {
      if (gap.t0 > prev) pieces.push({ t0: prev, t1: gap.t0 });
      prev = gap.t1;
    }
    if (prev < 1) pieces.push({ t0: prev, t1: 1 });

    for (const piece of pieces) {
      const subLen = (piece.t1 - piece.t0) * segLen;
      if (subLen < 4) continue; // skip slivers too small to label
      const midT = (piece.t0 + piece.t1) / 2;
      labels.push({
        mx: x1 + dx * midT,
        my: y1 + dy * midT,
        labelAngle,
        text: `${(subLen / PIXELS_PER_FOOT).toFixed(1)}'`,
      });
    }
  }

  return labels;
}

function buildSubSegments(points: number[], gates: Gate[]): number[][] {
  if (gates.length === 0) return [points];

  type Gap = { segIdx: number; t: number; halfGap: number };
  const gapList: Gap[] = gates.map(gate => ({
    segIdx: gate.segmentIndex,
    t: gate.positionT,
    halfGap: (gate.widthFt * PIXELS_PER_FOOT) / 2 + PIXELS_PER_FOOT * 0.3,
  }));

  const numSegs = points.length / 2 - 1;
  const result: number[][] = [];
  let currentSeg: number[] = [];

  function flushSeg() {
    if (currentSeg.length >= 4) result.push([...currentSeg]);
    currentSeg = [];
  }

  for (let si = 0; si < numSegs; si++) {
    const x1 = points[si * 2], y1 = points[si * 2 + 1];
    const x2 = points[si * 2 + 2], y2 = points[si * 2 + 3];
    const segLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    const gapsOnSeg = gapList
      .filter(g => g.segIdx === si)
      .map(g => {
        const tc = g.t;
        const t0 = tc - g.halfGap / segLen;
        const t1 = tc + g.halfGap / segLen;
        return { t0: Math.max(0, t0), t1: Math.min(1, t1) };
      })
      .sort((a, b) => a.t0 - b.t0);

    if (currentSeg.length === 0) currentSeg.push(x1, y1);

    for (const gap of gapsOnSeg) {
      const p0 = pointOnSegment(x1, y1, x2, y2, gap.t0);
      currentSeg.push(p0.x, p0.y);
      flushSeg();
      const p1 = pointOnSegment(x1, y1, x2, y2, gap.t1);
      currentSeg.push(p1.x, p1.y);
    }

    currentSeg.push(x2, y2);
  }

  flushSeg();
  return result;
}
