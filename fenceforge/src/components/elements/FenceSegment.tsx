import { useRef } from 'react';
import { Group, Line, Shape, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import { FENCE_TYPES, getFenceColor } from '../../constants/fenceTypes';
import { perpendicular } from '../../utils/geometry';
import type { FenceLine, Gate, FenceCurveData } from '../../types';
import { getFinishSide } from '../../types';
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

function bezierPt(t: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number) {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*x1 + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*x2,
    y: mt*mt*mt*y1 + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*y2,
  };
}

function bezierTan(t: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number) {
  const mt = 1 - t;
  return {
    dx: 3*mt*mt*(cp1x - x1) + 6*mt*t*(cp2x - cp1x) + 3*t*t*(x2 - cp2x),
    dy: 3*mt*mt*(cp1y - y1) + 6*mt*t*(cp2y - cp1y) + 3*t*t*(y2 - cp2y),
  };
}

function bezierArcLength(x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number, steps = 20): number {
  let len = 0;
  let px = x1, py = y1;
  for (let i = 1; i <= steps; i++) {
    const p = bezierPt(i / steps, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
    len += Math.hypot(p.x - px, p.y - py);
    px = p.x; py = p.y;
  }
  return len;
}

function bezierArcLengthTo(t: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number, steps = 20): number {
  let len = 0;
  let px = x1, py = y1;
  for (let i = 1; i <= steps; i++) {
    const ti = (i / steps) * t;
    const p = bezierPt(ti, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
    len += Math.hypot(p.x - px, p.y - py);
    px = p.x; py = p.y;
  }
  return len;
}

function bezierTFromArcLen(target: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (bezierArcLengthTo(mid, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// De Casteljau subdivision — returns control points for the sub-curve from ta to tb
function bezierSubcurve(ta: number, tb: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number) {
  function split(t: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
    const ex = ax+(bx-ax)*t, ey = ay+(by-ay)*t;
    const fx = bx+(cx-bx)*t, fy = by+(cy-by)*t;
    const gx = cx+(dx-cx)*t, gy = cy+(dy-cy)*t;
    const hx = ex+(fx-ex)*t, hy = ey+(fy-ey)*t;
    const ix = fx+(gx-fx)*t, iy = fy+(gy-fy)*t;
    const jx = hx+(ix-hx)*t, jy = hy+(iy-hy)*t;
    return { left: [ax,ay,ex,ey,hx,hy,jx,jy], right: [jx,jy,ix,iy,gx,gy,dx,dy] };
  }
  const s1 = split(ta, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
  const newT = ta === 1 ? 0 : (tb - ta) / (1 - ta);
  const [rx1,ry1,rcp1x,rcp1y,rcp2x,rcp2y,rx2,ry2] = s1.right;
  const s2 = split(newT, rx1,ry1,rcp1x,rcp1y,rcp2x,rcp2y,rx2,ry2);
  const [lx1,ly1,lcp1x,lcp1y,lcp2x,lcp2y,lx2,ly2] = s2.left;
  return { x1:lx1, y1:ly1, cp1x:lcp1x, cp1y:lcp1y, cp2x:lcp2x, cp2y:lcp2y, x2:lx2, y2:ly2 };
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
  const numVertices = fence.points.length / 2;

  // Track whether we've already pushed history for the current drag gesture
  const didPushHistory = useRef(false);
  // Snapshot of fence.points at the start of a whole-line drag
  const dragStartPoints = useRef<number[] | null>(null);

  const editMode = isSelected && !!updateFence;

  // ── Whole-fence group drag handlers ────────────────────────────────────────
  function handleGroupDragStart() {
    if (!didPushHistory.current) {
      onBeforeEdit?.();
      didPushHistory.current = true;
    }
    dragStartPoints.current = [...fence.points];
  }

  function handleGroupDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target as Konva.Group;
    const ddx = node.x(), ddy = node.y();
    if (dragStartPoints.current) {
      const newPoints = dragStartPoints.current.map((v, i) => (i % 2 === 0 ? v + ddx : v + ddy));
      updateFence!(fence.id, { points: newPoints });
    }
    node.position({ x: 0, y: 0 });
    dragStartPoints.current = null;
    didPushHistory.current = false;
  }

  function setLineCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
    const s = e.target.getStage();
    if (s) s.container().style.cursor = cursor;
  }

  // ── Vertex drag handlers ────────────────────────────────────────────────────
  function handleVertexDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    if (!didPushHistory.current) {
      onBeforeEdit?.();
      didPushHistory.current = true;
    }
  }

  function handleVertexDragMove(e: Konva.KonvaEventObject<DragEvent>, vi: number) {
    e.cancelBubble = true;
    const node = e.target as Konva.Circle;
    let [sx, sy] = snapVertex(node.x(), node.y(), snapEnabled, snapSizeFt, otherVertices);
    node.position({ x: sx, y: sy });
    const newPoints = [...fence.points];
    newPoints[vi * 2]     = sx;
    newPoints[vi * 2 + 1] = sy;
    updateFence!(fence.id, { points: newPoints });
  }

  function handleVertexDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
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
  const spacingPx = (fence.linePostSpacingFt ?? linePostSpacingFt(fence.fenceType)) * PIXELS_PER_FOOT;
  const fixedSpacing = fence.fenceType === 'aluminum-ornamental' || fence.fenceType === 'steel-ornamental';

  for (let si = 0; si < numVertices - 1; si++) {
    const x1 = fence.points[si * 2],       y1 = fence.points[si * 2 + 1];
    const x2 = fence.points[(si + 1) * 2], y2 = fence.points[(si + 1) * 2 + 1];
    const cd = fence.curveData?.[si];

    if (cd?.curved) {
      const arcLen = bezierArcLength(x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
      if (arcLen <= spacingPx) continue;
      // Compute gate gap t-ranges in arc-length space
      const curveGaps = gates
        .filter(g => g.segmentIndex === si)
        .map(g => {
          const halfGap = (g.widthFt * PIXELS_PER_FOOT) / 2;
          const centerArc = bezierArcLengthTo(g.positionT, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
          const t0 = Math.max(0, bezierTFromArcLen(centerArc - halfGap, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2));
          const t1 = Math.min(1, bezierTFromArcLen(centerArc + halfGap, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2));
          return { t0, t1 };
        })
        .sort((a, b) => a.t0 - b.t0);
      // Build pieces between gaps
      const curvePieces: { ta: number; tb: number }[] = [];
      let cprev = 0;
      for (const gap of curveGaps) {
        if (gap.t0 > cprev) curvePieces.push({ ta: cprev, tb: gap.t0 });
        cprev = gap.t1;
      }
      if (cprev < 1) curvePieces.push({ ta: cprev, tb: 1 });
      for (const piece of curvePieces) {
        const arcA = bezierArcLengthTo(piece.ta, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
        const arcB = bezierArcLengthTo(piece.tb, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
        const pieceArc = arcB - arcA;
        if (pieceArc <= spacingPx) continue;
        if (fixedSpacing) {
          for (let d = spacingPx; d < pieceArc; d += spacingPx) {
            const t = bezierTFromArcLen(arcA + d, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
            const p = bezierPt(t, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
            linePostPositions.push({ x: p.x, y: p.y });
          }
        } else {
          const numSpans = Math.ceil(pieceArc / spacingPx);
          for (let k = 1; k < numSpans; k++) {
            const t = bezierTFromArcLen(arcA + (k / numSpans) * pieceArc, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
            const p = bezierPt(t, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
            linePostPositions.push({ x: p.x, y: p.y });
          }
        }
      }
      continue;
    }

    const dx = x2 - x1, dy = y2 - y1;
    const segPx = Math.sqrt(dx * dx + dy * dy);
    if (segPx === 0) continue;

    const gaps = gates
      .filter(g => g.segmentIndex === si)
      .map(g => {
        const halfFrac = ((g.widthFt * PIXELS_PER_FOOT) / 2) / segPx;
        return { t0: Math.max(0, g.positionT - halfFrac), t1: Math.min(1, g.positionT + halfFrac) };
      })
      .sort((a, b) => a.t0 - b.t0);

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
      if (fixedSpacing) {
        for (let d = spacingPx; d < piecePx; d += spacingPx) {
          const t = piece.t0 + d / segPx;
          linePostPositions.push({ x: x1 + dx * t, y: y1 + dy * t });
        }
      } else {
        const numSpans = Math.ceil(piecePx / spacingPx);
        for (let k = 1; k < numSpans; k++) {
          const t = piece.t0 + (piece.t1 - piece.t0) * (k / numSpans);
          linePostPositions.push({ x: x1 + dx * t, y: y1 + dy * t });
        }
      }
    }
  }

  return (
    <Group
      onClick={onSelect} onTap={onSelect}
      draggable={!!updateFence}
      onDragStart={updateFence ? handleGroupDragStart : undefined}
      onDragEnd={updateFence ? handleGroupDragEnd : undefined}
    >
      {/* Per-segment gradient strips */}
      {Array.from({ length: numVertices - 1 }, (_, si) => {
        const gx1 = fence.points[si * 2], gy1 = fence.points[si * 2 + 1];
        const gx2 = fence.points[(si + 1) * 2], gy2 = fence.points[(si + 1) * 2 + 1];
        const cd = fence.curveData?.[si];
        const sign = getFinishSide(fence, si) === 'left' ? 1 : -1;
        const w = GRADIENT_STRIP_WIDTH;

        if (cd?.curved) {
          // Chord perpendicular direction (fixed for whole segment)
          const cdx = gx2 - gx1, cdy = gy2 - gy1;
          const cLen = Math.hypot(cdx, cdy);
          const { nx: cnx, ny: cny } = cLen > 0 ? perpendicular(cdx, cdy, cLen) : { nx: 0, ny: 1 };
          // Scale gradient width by arc sag so it fills the visible concave space
          const arcMid = bezierPt(0.5, gx1, gy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, gx2, gy2);
          const sag = Math.hypot(arcMid.x - (gx1 + gx2) / 2, arcMid.y - (gy1 + gy2) / 2);
          const effectiveW = Math.max(w, sag + w);
          const ox = cnx * sign * effectiveW, oy = cny * sign * effectiveW;
          return (
            <Shape key={`grad-${si}`} listening={false} sceneFunc={(ctx, _shape) => {
              const native = (ctx as any)._context as CanvasRenderingContext2D;
              const N = 20;
              const inner: [number, number][] = [];
              const outer: [number, number][] = [];
              for (let k = 0; k <= N; k++) {
                const p = bezierPt(k / N, gx1, gy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, gx2, gy2);
                inner.push([p.x, p.y]);
                outer.push([p.x + ox, p.y + oy]);
              }
              const mid = Math.floor(N / 2);
              const grad = native.createLinearGradient(inner[mid][0], inner[mid][1], outer[mid][0], outer[mid][1]);
              grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
              grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
              native.beginPath();
              native.moveTo(inner[0][0], inner[0][1]);
              for (let k = 1; k <= N; k++) native.lineTo(inner[k][0], inner[k][1]);
              for (let k = N; k >= 0; k--) native.lineTo(outer[k][0], outer[k][1]);
              native.closePath();
              native.fillStyle = grad;
              native.fill();
            }} />
          );
        }

        const dx = gx2 - gx1, dy = gy2 - gy1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return null;
        const { nx, ny } = perpendicular(dx, dy, len);
        const ox = nx * sign * w, oy = ny * sign * w;
        const mx = (gx1 + gx2) / 2, my = (gy1 + gy2) / 2;
        const gPoly = [gx1, gy1, gx2, gy2, gx2 + ox, gy2 + oy, gx1 + ox, gy1 + oy];
        return (
          <Shape key={`grad-${si}`} listening={false} sceneFunc={(ctx, _shape) => {
            const native = (ctx as any)._context as CanvasRenderingContext2D;
            const grad = native.createLinearGradient(mx, my, mx + ox, my + oy);
            grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            native.beginPath();
            native.moveTo(gPoly[0], gPoly[1]);
            for (let j = 2; j < gPoly.length; j += 2) native.lineTo(gPoly[j], gPoly[j + 1]);
            native.closePath();
            native.fillStyle = grad;
            native.fill();
          }} />
        );
      })}

      {/* Fence line segments: bezier for curved, line-with-gate-gaps for straight */}
      {Array.from({ length: numVertices - 1 }, (_, si) => {
        const sx1 = fence.points[si * 2],       sy1 = fence.points[si * 2 + 1];
        const sx2 = fence.points[(si + 1) * 2], sy2 = fence.points[(si + 1) * 2 + 1];
        const cd = fence.curveData?.[si];
        const segColor = isSelected ? '#FFD700' : color;
        const sw = isSelected ? strokeWidth + 2 : strokeWidth;

        if (cd?.curved) {
          const gapsOnCurve = gates
            .filter(g => g.segmentIndex === si)
            .map(g => {
              const halfGap = (g.widthFt * PIXELS_PER_FOOT) / 2 + PIXELS_PER_FOOT * 0.3;
              const centerArc = bezierArcLengthTo(g.positionT, sx1, sy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, sx2, sy2);
              const t0 = Math.max(0, bezierTFromArcLen(centerArc - halfGap, sx1, sy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, sx2, sy2));
              const t1 = Math.min(1, bezierTFromArcLen(centerArc + halfGap, sx1, sy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, sx2, sy2));
              return { t0, t1 };
            })
            .sort((a, b) => a.t0 - b.t0);

          const pieces: { ta: number; tb: number }[] = [];
          let prev = 0;
          for (const gap of gapsOnCurve) {
            if (gap.t0 > prev) pieces.push({ ta: prev, tb: gap.t0 });
            prev = gap.t1;
          }
          if (prev < 1) pieces.push({ ta: prev, tb: 1 });

          const renderBezierPiece = (key: string, ta: number, tb: number) => {
            const sub = ta === 0 && tb === 1
              ? { x1: sx1, y1: sy1, cp1x: cd.cp1X, cp1y: cd.cp1Y, cp2x: cd.cp2X, cp2y: cd.cp2Y, x2: sx2, y2: sy2 }
              : bezierSubcurve(ta, tb, sx1, sy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, sx2, sy2);
            return (
              <Shape
                key={key}
                sceneFunc={(ctx, shape) => {
                  ctx.beginPath();
                  ctx.moveTo(sub.x1, sub.y1);
                  (ctx as any).bezierCurveTo(sub.cp1x, sub.cp1y, sub.cp2x, sub.cp2y, sub.x2, sub.y2);
                  ctx.strokeShape(shape);
                }}
                stroke={segColor} strokeWidth={sw} lineCap="round" hitStrokeWidth={12}
                onMouseEnter={updateFence ? (e) => setLineCursor(e as Konva.KonvaEventObject<MouseEvent>, 'move') : undefined}
                onMouseLeave={updateFence ? (e) => setLineCursor(e as Konva.KonvaEventObject<MouseEvent>, 'default') : undefined}
              />
            );
          };

          if (pieces.length === 0) return null;
          if (pieces.length === 1 && pieces[0].ta === 0 && pieces[0].tb === 1) {
            return renderBezierPiece(`s-${si}`, 0, 1);
          }
          return (
            <Group key={`s-${si}`}>
              {pieces.map((p, pi) => renderBezierPiece(`p-${pi}`, p.ta, p.tb))}
            </Group>
          );
        }

        // Straight segment: compute gate gaps and render pieces
        const dx = sx2 - sx1, dy = sy2 - sy1;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        const gapsOnSeg = gates
          .filter(g => g.segmentIndex === si)
          .map(g => {
            const halfGap = (g.widthFt * PIXELS_PER_FOOT) / 2 + PIXELS_PER_FOOT * 0.3;
            const t0 = Math.max(0, g.positionT - halfGap / segLen);
            const t1 = Math.min(1, g.positionT + halfGap / segLen);
            return { t0, t1 };
          })
          .sort((a, b) => a.t0 - b.t0);

        if (gapsOnSeg.length === 0 || segLen === 0) {
          return (
            <Line
              key={`s-${si}`}
              points={[sx1, sy1, sx2, sy2]}
              stroke={segColor} strokeWidth={sw}
              lineCap="round" lineJoin="round"
              hitStrokeWidth={12}
              shadowColor={color} shadowBlur={def.category === 'vinyl' ? 3 : 0} shadowOpacity={0.4}
              onMouseEnter={updateFence ? (e) => setLineCursor(e as Konva.KonvaEventObject<MouseEvent>, 'move') : undefined}
              onMouseLeave={updateFence ? (e) => setLineCursor(e as Konva.KonvaEventObject<MouseEvent>, 'default') : undefined}
            />
          );
        }

        const pieces: { t0: number; t1: number }[] = [];
        let prev = 0;
        for (const gap of gapsOnSeg) {
          if (gap.t0 > prev) pieces.push({ t0: prev, t1: gap.t0 });
          prev = gap.t1;
        }
        if (prev < 1) pieces.push({ t0: prev, t1: 1 });

        return (
          <Group key={`s-${si}`}>
            {pieces.map((piece, pi) => (
              <Line
                key={pi}
                points={[sx1 + dx * piece.t0, sy1 + dy * piece.t0, sx1 + dx * piece.t1, sy1 + dy * piece.t1]}
                stroke={segColor} strokeWidth={sw}
                lineCap="round" lineJoin="round"
                hitStrokeWidth={12}
                shadowColor={color} shadowBlur={def.category === 'vinyl' ? 3 : 0} shadowOpacity={0.4}
                onMouseEnter={updateFence ? (e) => setLineCursor(e as Konva.KonvaEventObject<MouseEvent>, 'move') : undefined}
                onMouseLeave={updateFence ? (e) => setLineCursor(e as Konva.KonvaEventObject<MouseEvent>, 'default') : undefined}
              />
            ))}
          </Group>
        );
      })}

      {/* Angle labels at interior vertices */}
      {Array.from({ length: numVertices - 2 }).map((_, i) => {
        const vi = i + 1;
        const vx = fence.points[vi * 2], vy = fence.points[vi * 2 + 1];

        // For curved segments, use the tangent at the endpoint rather than the chord direction
        const prevCd = fence.curveData?.[vi - 1];
        let ax: number, ay: number;
        if (prevCd?.curved) {
          const pvx1 = fence.points[(vi - 1) * 2], pvy1 = fence.points[(vi - 1) * 2 + 1];
          const t = bezierTan(1, pvx1, pvy1, prevCd.cp1X, prevCd.cp1Y, prevCd.cp2X, prevCd.cp2Y, vx, vy);
          ax = -t.dx; ay = -t.dy; // reverse: direction from vi back toward vi-1
        } else {
          ax = fence.points[(vi - 1) * 2] - vx; ay = fence.points[(vi - 1) * 2 + 1] - vy;
        }
        const nextCd = fence.curveData?.[vi];
        let bx: number, by: number;
        if (nextCd?.curved) {
          const nvx2 = fence.points[(vi + 1) * 2], nvy2 = fence.points[(vi + 1) * 2 + 1];
          const t = bezierTan(0, vx, vy, nextCd.cp1X, nextCd.cp1Y, nextCd.cp2X, nextCd.cp2Y, nvx2, nvy2);
          bx = t.dx; by = t.dy;
        } else {
          bx = fence.points[(vi + 1) * 2] - vx; by = fence.points[(vi + 1) * 2 + 1] - vy;
        }
        const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
        if (lenA === 0 || lenB === 0) return null;
        const angleDeg = Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / (lenA * lenB)))) * 180 / Math.PI;
        const text = `${Math.round(angleDeg)}°`;
        // offset label away from the interior of the angle (bisector direction, flipped outward)
        const bisX = ax / lenA + bx / lenB, bisY = ay / lenA + by / lenB;
        const bisLen = Math.hypot(bisX, bisY);
        const offsetDir = bisLen > 0.001 ? [-bisX / bisLen, -bisY / bisLen] : [0, -1];
        const off = strokeWidth + labelFontSize + 2;
        return (
          <Text
            key={`angle-${vi}`}
            x={vx + offsetDir[0] * off}
            y={vy + offsetDir[1] * off}
            text={text}
            fontSize={labelFontSize}
            fontFamily="monospace"
            fill="#555"
            offsetX={text.length * (labelFontSize * 0.3)}
            offsetY={labelFontSize / 2}
            listening={false}
          />
        );
      })}

      {/* Per-sub-segment length labels — each visible piece between / around gate gaps */}
      {buildSegmentLabels(fence, gates, strokeWidth, labelFontSize).map((lbl, i) => (
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
          offsetY={0}
          listening={false}
        />
      ))}

      {/* Finish-side label — "Finish" at midpoint of each segment, offset onto gradient side.
          Independent of the line: each segment's label is draggable and can be hidden separately. */}
      {Array.from({ length: numVertices - 1 }, (_, si) => {
        if (fence.finishLabelHiddenSegs?.[si]) return null;
        const fx1 = fence.points[si * 2], fy1 = fence.points[si * 2 + 1];
        const fx2 = fence.points[(si + 1) * 2], fy2 = fence.points[(si + 1) * 2 + 1];
        const cd = fence.curveData?.[si];
        const fsign = getFinishSide(fence, si) === 'left' ? 1 : -1;
        const w = GRADIENT_STRIP_WIDTH;

        let gox: number, goy: number, labelAngle: number;
        if (cd?.curved) {
          const mid = bezierPt(0.5, fx1, fy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, fx2, fy2);
          const tan = bezierTan(0.5, fx1, fy1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, fx2, fy2);
          const tl = Math.hypot(tan.dx, tan.dy);
          const fnx = tl > 0 ? -tan.dy / tl * fsign : 0;
          const fny = tl > 0 ? tan.dx / tl * fsign : 0;
          const adeg = Math.atan2(tan.dy, tan.dx) * 180 / Math.PI;
          labelAngle = adeg > 90 || adeg < -90 ? adeg + 180 : adeg;
          gox = mid.x + fnx * w;
          goy = mid.y + fny * w;
        } else {
          const dx = fx2 - fx1, dy = fy2 - fy1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return null;
          const { nx, ny } = perpendicular(dx, dy, len);
          const mx = (fx1 + fx2) / 2, my = (fy1 + fy2) / 2;
          const adeg = Math.atan2(dy, dx) * 180 / Math.PI;
          labelAngle = adeg > 90 || adeg < -90 ? adeg + 180 : adeg;
          gox = mx + nx * fsign * w;
          goy = my + ny * fsign * w;
        }

        const finishText = 'Finished Side';
        const charW = labelFontSize * 0.55;
        const off = fence.finishLabelOffsets?.[si];
        const offX = off?.x ?? 0;
        const offY = off?.y ?? 0;
        const baseGox = gox, baseGoy = goy;
        return (
          <Text
            key={`finish-${si}`}
            x={gox + offX}
            y={goy + offY}
            text={finishText}
            fontSize={labelFontSize}
            fontFamily="sans-serif"
            fontStyle="italic"
            fill="#000"
            opacity={0.6}
            rotation={labelAngle}
            offsetX={finishText.length * charW / 2}
            offsetY={labelFontSize / 2}
            draggable={editMode}
            listening={editMode}
            onDragStart={(e) => handleVertexDragStart(e)}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const node = e.target as Konva.Text;
              const offsets = [...(fence.finishLabelOffsets ?? [])];
              offsets[si] = { x: node.x() - baseGox, y: node.y() - baseGoy };
              updateFence!(fence.id, { finishLabelOffsets: offsets });
            }}
            onDragEnd={(e) => { e.cancelBubble = true; handleVertexDragEnd(e); }}
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

      {/* ── Bezier control point handles (when segment is curved and fence is selected) ── */}
      {editMode && Array.from({ length: numVertices - 1 }, (_, si) => {
        const cd = fence.curveData?.[si];
        if (!cd?.curved) return null;
        const cpx1 = fence.points[si * 2], cpy1 = fence.points[si * 2 + 1];
        const cpx2 = fence.points[(si + 1) * 2], cpy2 = fence.points[(si + 1) * 2 + 1];
        return (
          <Group key={`cp-${si}`}>
            <Line points={[cpx1, cpy1, cd.cp1X, cd.cp1Y]} stroke="#888" strokeWidth={1} dash={[4, 3]} listening={false} />
            <Line points={[cpx2, cpy2, cd.cp2X, cd.cp2Y]} stroke="#888" strokeWidth={1} dash={[4, 3]} listening={false} />
            <Circle x={cd.cp1X} y={cd.cp1Y} radius={6} fill="#60a5fa" stroke="#fff" strokeWidth={1.5}
              draggable hitStrokeWidth={12}
              onDragStart={(e) => handleVertexDragStart(e)}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const node = e.target as Konva.Circle;
                const next = [...(fence.curveData ?? [])];
                next[si] = { ...(next[si] as FenceCurveData), cp1X: node.x(), cp1Y: node.y() };
                updateFence!(fence.id, { curveData: next });
              }}
              onDragEnd={(e) => handleVertexDragEnd(e)}
              onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'crosshair'; }}
              onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
            />
            <Circle x={cd.cp2X} y={cd.cp2Y} radius={6} fill="#60a5fa" stroke="#fff" strokeWidth={1.5}
              draggable hitStrokeWidth={12}
              onDragStart={(e) => handleVertexDragStart(e)}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const node = e.target as Konva.Circle;
                const next = [...(fence.curveData ?? [])];
                next[si] = { ...(next[si] as FenceCurveData), cp2X: node.x(), cp2Y: node.y() };
                updateFence!(fence.id, { curveData: next });
              }}
              onDragEnd={(e) => handleVertexDragEnd(e)}
              onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'crosshair'; }}
              onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
            />
          </Group>
        );
      })}

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
            onDragStart={(e) => handleVertexDragStart(e)}
            onDragMove={(e) => handleVertexDragMove(e, vi)}
            onDragEnd={(e) => handleVertexDragEnd(e)}
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
function buildSegmentLabels(
  fence: FenceLine,
  gates: Gate[],
  strokeWidth: number,
  labelFontSize: number,
): LabelInfo[] {
  const points = fence.points;
  const labels: LabelInfo[] = [];
  const numSegs = points.length / 2 - 1;
  const offsetMag = strokeWidth / 2 + labelFontSize + 1;

  for (let si = 0; si < numSegs; si++) {
    const x1 = points[si * 2], y1 = points[si * 2 + 1];
    const x2 = points[si * 2 + 2], y2 = points[si * 2 + 3];
    const cd = fence.curveData?.[si];
    const labelSign = getFinishSide(fence, si) === 'left' ? -1 : 1;

    if (cd?.curved) {
      const arcLen = bezierArcLength(x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
      if (arcLen < 4) continue;
      const mid = bezierPt(0.5, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
      const tan = bezierTan(0.5, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
      const tl = Math.hypot(tan.dx, tan.dy);
      const fnx = tl > 0 ? -tan.dy / tl * labelSign : 0;
      const fny = tl > 0 ? tan.dx / tl * labelSign : 0;
      const adeg = Math.atan2(tan.dy, tan.dx) * 180 / Math.PI;
      const labelAngle = adeg > 90 || adeg < -90 ? adeg + 180 : adeg;
      labels.push({
        mx: mid.x + fnx * offsetMag,
        my: mid.y + fny * offsetMag,
        labelAngle,
        text: `${(arcLen / PIXELS_PER_FOOT).toFixed(1)}'`,
      });
      continue;
    }

    const dx = x2 - x1, dy = y2 - y1;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen === 0) continue;

    const { nx, ny } = perpendicular(dx, dy, segLen);
    const lox = nx * labelSign * offsetMag;
    const loy = ny * labelSign * offsetMag;

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

    const pieces: { t0: number; t1: number }[] = [];
    let prev = 0;
    for (const gap of gapsOnSeg) {
      if (gap.t0 > prev) pieces.push({ t0: prev, t1: gap.t0 });
      prev = gap.t1;
    }
    if (prev < 1) pieces.push({ t0: prev, t1: 1 });

    for (const piece of pieces) {
      const subLen = (piece.t1 - piece.t0) * segLen;
      if (subLen < 4) continue;
      const midT = (piece.t0 + piece.t1) / 2;
      labels.push({
        mx: x1 + dx * midT + lox,
        my: y1 + dy * midT + loy,
        labelAngle,
        text: `${(subLen / PIXELS_PER_FOOT).toFixed(1)}'`,
      });
    }
  }

  return labels;
}

