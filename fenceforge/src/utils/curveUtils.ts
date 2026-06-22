/**
 * Catmull-Rom spline helpers shared by poly-drawn objects.
 * All functions expect points as flat [x0,y0,x1,y1,...] arrays.
 */

import type { SegmentCurveData } from '../types/object';

/**
 * Sample a mixed straight/bezier polyline into a dense flat point array.
 * Curved segments (with bezier CPs) are sampled parametrically; straight segments stay as-is.
 */
export function sampleMixedPolyline(
  pts: number[],
  segCurveData: (SegmentCurveData | undefined)[],
  closed: boolean,
  step = 6,
): number[] {
  const nv = pts.length / 2;
  if (nv < 2) return pts.slice();
  const result: number[] = [];
  const numSegs = closed ? nv : nv - 1;
  for (let i = 0; i < numSegs; i++) {
    const ni = (i + 1) % nv;
    const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const x2 = pts[ni * 2], y2 = pts[ni * 2 + 1];
    const cd = segCurveData[i];
    if (cd?.curved) {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(2, Math.ceil(len / step));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const mt = 1 - t;
        result.push(
          mt*mt*mt*x1 + 3*mt*mt*t*cd.cp1X + 3*mt*t*t*cd.cp2X + t*t*t*x2,
          mt*mt*mt*y1 + 3*mt*mt*t*cd.cp1Y + 3*mt*t*t*cd.cp2Y + t*t*t*y2,
        );
      }
    } else {
      result.push(x1, y1);
    }
  }
  // Append the final endpoint
  const lastIdx = closed ? 0 : nv - 1;
  result.push(pts[lastIdx * 2], pts[lastIdx * 2 + 1]);
  return result;
}

/**
 * Build an SVG path string with per-segment control: straight lines or explicit bezier curves.
 * Segments not in segCurveData (or not marked curved) become L commands.
 */
export function mixedPolySvgPath(
  pts: number[],
  segCurveData: (SegmentCurveData | undefined)[],
  closed: boolean,
): string {
  const nv = pts.length / 2;
  if (nv < 2) return '';
  let d = `M ${pts[0].toFixed(1)} ${pts[1].toFixed(1)}`;
  const numSegs = closed ? nv : nv - 1;
  for (let i = 0; i < numSegs; i++) {
    const ni = (i + 1) % nv;
    const x2 = pts[ni * 2], y2 = pts[ni * 2 + 1];
    const cd = segCurveData[i];
    if (cd?.curved) {
      d += ` C ${cd.cp1X.toFixed(1)} ${cd.cp1Y.toFixed(1)} ${cd.cp2X.toFixed(1)} ${cd.cp2Y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    } else {
      d += ` L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
  }
  if (closed) d += ' Z';
  return d;
}

/**
 * Draw a mixed straight/bezier poly path onto a CanvasRenderingContext2D.
 * Caller must call beginPath() before; this adds moveTo + line/curve commands.
 */
export function mixedPolyNativePath(
  n: CanvasRenderingContext2D,
  pts: number[],
  segCurveData: (SegmentCurveData | undefined)[],
  closed: boolean,
): void {
  const nv = pts.length / 2;
  if (nv < 2) return;
  n.moveTo(pts[0], pts[1]);
  const numSegs = closed ? nv : nv - 1;
  for (let i = 0; i < numSegs; i++) {
    const ni = (i + 1) % nv;
    const x2 = pts[ni * 2], y2 = pts[ni * 2 + 1];
    const cd = segCurveData[i];
    if (cd?.curved) {
      n.bezierCurveTo(cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
    } else {
      n.lineTo(x2, y2);
    }
  }
  if (closed) n.closePath();
}

function ctrlPt(pts: number[], i: number, n: number, closed: boolean): [number, number] {
  if (closed) i = ((i % n) + n) % n;
  else i = Math.max(0, Math.min(n - 1, i));
  return [pts[i * 2], pts[i * 2 + 1]];
}

/**
 * Draw a Catmull-Rom spline onto a CanvasRenderingContext2D.
 * Caller must call n.beginPath() beforehand; this function adds move + bezier commands.
 */
export function catmullRomPath(
  n: CanvasRenderingContext2D,
  pts: number[],
  closed: boolean,
): void {
  const nv = pts.length / 2;
  if (nv < 2) return;
  n.moveTo(pts[0], pts[1]);
  const segs = closed ? nv : nv - 1;
  for (let s = 0; s < segs; s++) {
    const p0 = ctrlPt(pts, s - 1, nv, closed);
    const p1 = ctrlPt(pts, s,     nv, closed);
    const p2 = ctrlPt(pts, s + 1, nv, closed);
    const p3 = ctrlPt(pts, s + 2, nv, closed);
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    n.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
  }
  if (closed) n.closePath();
}

/**
 * Sample a Catmull-Rom spline at regular arc-length intervals.
 * Returns a dense flat [x,y,...] array suitable for straight-segment rendering.
 */
export function catmullRomSample(
  pts: number[],
  closed: boolean,
  step = 6,
): number[] {
  const nv = pts.length / 2;
  if (nv < 2) return pts.slice();

  const result: number[] = [];
  const segs = closed ? nv : nv - 1;

  for (let s = 0; s < segs; s++) {
    const p0 = ctrlPt(pts, s - 1, nv, closed);
    const p1 = ctrlPt(pts, s,     nv, closed);
    const p2 = ctrlPt(pts, s + 1, nv, closed);
    const p3 = ctrlPt(pts, s + 2, nv, closed);

    // Rough segment length to decide subdivision count
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(2, Math.ceil(len / step));

    for (let k = 0; k < steps; k++) {
      const t  = k / steps;
      const t2 = t * t, t3 = t2 * t;
      result.push(
        0.5 * (2*p1[0] + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5 * (2*p1[1] + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
      );
    }
  }

  // Append the final endpoint (for open paths it's the last control point; closed loops back)
  if (!closed) result.push(pts[(nv - 1) * 2], pts[(nv - 1) * 2 + 1]);

  return result;
}

/**
 * Build an SVG path-data string (for Konva <Path>) representing a Catmull-Rom spline.
 */
export function catmullRomSvgPath(pts: number[], closed: boolean): string {
  const nv = pts.length / 2;
  if (nv < 2) return '';
  let d = `M ${pts[0].toFixed(1)} ${pts[1].toFixed(1)}`;
  const segs = closed ? nv : nv - 1;
  for (let s = 0; s < segs; s++) {
    const p0 = ctrlPt(pts, s - 1, nv, closed);
    const p1 = ctrlPt(pts, s,     nv, closed);
    const p2 = ctrlPt(pts, s + 1, nv, closed);
    const p3 = ctrlPt(pts, s + 2, nv, closed);
    const cp1x = (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1);
    const cp1y = (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1);
    const cp2x = (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1);
    const cp2y = (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1);
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  if (closed) d += ' Z';
  return d;
}
