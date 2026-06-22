import type { Gate } from '../types/gate';
import type { FenceCurveData } from '../types/fence';
import { PIXELS_PER_FOOT } from '../constants/canvas';
import { angleDeg } from './geometry';

function bezierPt(t: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number) {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*x1 + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*x2,
    y: mt*mt*mt*y1 + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*y2,
  };
}

function bezierTanDeg(t: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number): number {
  const mt = 1 - t;
  const dx = 3*mt*mt*(cp1x-x1) + 6*mt*t*(cp2x-cp1x) + 3*t*t*(x2-cp2x);
  const dy = 3*mt*mt*(cp1y-y1) + 6*mt*t*(cp2y-cp1y) + 3*t*t*(y2-cp2y);
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

export interface GateGeometry {
  hingeX: number;
  hingeY: number;
  latchX: number;
  latchY: number;
  panelEndX: number;   // single gate panel tip
  panelEndY: number;
  panelEnd1X: number;  // double gate — hinge-post panel tip (half width)
  panelEnd1Y: number;
  panelEnd2X: number;  // double gate — latch-post panel tip (half width)
  panelEnd2Y: number;
  arcStartAngle: number;
  arc2StartAngle: number;
  fenceAngleDeg: number;
  widthPx: number;
  gapHalfPx: number;
}

export function computeGateGeometry(gate: Gate, points: number[], finishSide: 'left' | 'right' = 'left', curveData?: FenceCurveData[]): GateGeometry | null {
  const segIdx = gate.segmentIndex;
  const ptIdx = segIdx * 2;
  if (ptIdx + 3 >= points.length) return null;

  const x1 = points[ptIdx], y1 = points[ptIdx + 1];
  const x2 = points[ptIdx + 2], y2 = points[ptIdx + 3];
  const t = gate.positionT;
  const cd = curveData?.[segIdx];

  let cx: number, cy: number, fenceAngleDeg: number;
  if (cd?.curved) {
    const pt = bezierPt(t, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
    cx = pt.x; cy = pt.y;
    fenceAngleDeg = bezierTanDeg(t, x1, y1, cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
  } else {
    cx = x1 + (x2 - x1) * t;
    cy = y1 + (y2 - y1) * t;
    fenceAngleDeg = angleDeg(x1, y1, x2, y2);
  }

  const widthPx = gate.widthFt * PIXELS_PER_FOOT;
  const halfW = widthPx / 2;
  const rad = (fenceAngleDeg * Math.PI) / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad);

  // ── Perpendicular / interior direction ───────────────────────────────────
  // "Inward" means toward the yard interior, which is always opposite the finished face.
  const interiorSign = finishSide === 'left' ? -1 : 1;
  const swingSign = gate.swingDirection === 'inward' ? interiorSign : -interiorSign;
  const perpAngle = rad + (Math.PI / 2) * swingSign; // radians

  // ── Hinge / latch posts ────────────────────────────────────────────────────
  // "Left hinge" = screen-left (smaller X) for horizontal fences, screen-top (smaller Y)
  // for vertical fences. We normalise by flipping hingeSign when the fence primary direction
  // is negative (leftward or upward), so "left" is always visually consistent on the canvas.
  const hingeSign = gate.hingeSide === 'left' ? -1 : 1;
  const primarySign = Math.abs(ux) >= Math.abs(uy)
    ? (Math.sign(ux) || 1)
    : (Math.sign(uy) || 1);
  const effHingeSign = hingeSign * primarySign;
  const hingeX = cx + ux * halfW * effHingeSign;
  const hingeY = cy + uy * halfW * effHingeSign;
  const latchX = cx - ux * halfW * effHingeSign;
  const latchY = cy - uy * halfW * effHingeSign;

  // ── Gate panels ───────────────────────────────────────────────────────────
  // Single gate: one full-width panel from hinge post
  const panelEndX = hingeX + Math.cos(perpAngle) * widthPx;
  const panelEndY = hingeY + Math.sin(perpAngle) * widthPx;

  // Double gate: two half-width panels — one from each post, same perpendicular direction
  const panelEnd1X = hingeX + Math.cos(perpAngle) * halfW;  // double gate panel 1
  const panelEnd1Y = hingeY + Math.sin(perpAngle) * halfW;
  const panelEnd2X = latchX + Math.cos(perpAngle) * halfW;
  const panelEnd2Y = latchY + Math.sin(perpAngle) * halfW;

  // ── Swing arcs ────────────────────────────────────────────────────────────
  // sweepCW: arc1 (centered at hinge) sweeps clockwise when true.
  const sweepCW = (effHingeSign * swingSign) > 0;
  const perpAngleDeg = fenceAngleDeg + swingSign * 90; // where the panel tip currently is

  // Arc 1 (hinge post): rotation adjusted so CW sweep ends at the latch direction.
  const arcStartAngle = perpAngleDeg - (sweepCW ? 0 : 90);

  // Arc 2 (latch post, double gate): sweeps in the opposite rotational direction.
  const arc2StartAngle = perpAngleDeg - (!sweepCW ? 0 : 90);

  return {
    hingeX, hingeY, latchX, latchY,
    panelEndX, panelEndY,
    panelEnd1X, panelEnd1Y,
    panelEnd2X, panelEnd2Y,
    arcStartAngle,
    arc2StartAngle,
    fenceAngleDeg,
    widthPx,
    gapHalfPx: halfW + PIXELS_PER_FOOT * 0.2,
  };
}
