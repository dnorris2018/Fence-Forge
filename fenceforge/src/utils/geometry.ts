export interface Vec2 { x: number; y: number; }

export function dist(a: Vec2, b: Vec2) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function segmentLength(points: number[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    total += dist({ x: points[i], y: points[i + 1] }, { x: points[i + 2], y: points[i + 3] });
  }
  return total;
}

export function perpendicular(dx: number, dy: number, len: number): { nx: number; ny: number } {
  if (len === 0) return { nx: 0, ny: 1 };
  return { nx: -dy / len, ny: dx / len };
}

export function angleDeg(x1: number, y1: number, x2: number, y2: number): number {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

export function pointOnSegment(
  x1: number, y1: number, x2: number, y2: number, t: number
): Vec2 {
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

// Closest point on segment to P, returns t in [0,1]
export function closestTOnSegment(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
}

// Distance from point to segment
export function distToSegment(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number {
  const t = closestTOnSegment(px, py, x1, y1, x2, y2);
  const cx = x1 + t * (x2 - x1);
  const cy = y1 + t * (y2 - y1);
  return dist({ x: px, y: py }, { x: cx, y: cy });
}

// Find which segment of a polyline is closest, returns {segIndex, t, cx, cy, d}
export function closestSegmentOnPolyline(
  px: number, py: number, points: number[]
): { segIndex: number; t: number; cx: number; cy: number; d: number } | null {
  if (points.length < 4) return null;
  let best = { segIndex: 0, t: 0, cx: 0, cy: 0, d: Infinity };
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i], y1 = points[i + 1];
    const x2 = points[i + 2], y2 = points[i + 3];
    const t = closestTOnSegment(px, py, x1, y1, x2, y2);
    const cx = x1 + t * (x2 - x1);
    const cy = y1 + t * (y2 - y1);
    const d = dist({ x: px, y: py }, { x: cx, y: cy });
    if (d < best.d) best = { segIndex: i / 2, t, cx, cy, d };
  }
  return best;
}
