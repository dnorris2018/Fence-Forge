import { perpendicular } from './geometry';
import { GRADIENT_STRIP_WIDTH } from '../constants/canvas';

// Build a polygon for the finish-side gradient strip along a polyline.
// Returns flat [x,y,...] points forming a closed polygon.
export function buildGradientStrip(
  points: number[],
  side: 'left' | 'right',
  width = GRADIENT_STRIP_WIDTH
): number[] {
  if (points.length < 4) return [];

  const inner: number[] = [];
  const outer: number[] = [];

  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i], y1 = points[i + 1];
    const x2 = points[i + 2], y2 = points[i + 3];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const { nx, ny } = perpendicular(dx, dy, len);
    const sign = side === 'left' ? 1 : -1;
    const ox = nx * sign * width;
    const oy = ny * sign * width;

    if (i === 0) {
      inner.push(x1, y1);
      outer.push(x1 + ox, y1 + oy);
    }
    inner.push(x2, y2);
    outer.push(x2 + ox, y2 + oy);
  }

  // Build closed polygon: inner forward, outer backward
  const poly: number[] = [...inner];
  for (let i = outer.length - 2; i >= 0; i -= 2) {
    poly.push(outer[i], outer[i + 1]);
  }
  return poly;
}

// Midpoints of inner and outer edges for gradient direction
export function gradientEndpoints(
  points: number[],
  side: 'left' | 'right',
  width = GRADIENT_STRIP_WIDTH
): { ix: number; iy: number; ox: number; oy: number } {
  const midIdx = Math.floor((points.length / 2) / 2) * 2;
  const x = points[midIdx], y = points[midIdx + 1];
  const x2 = points[midIdx + 2] ?? points[midIdx];
  const y2 = points[midIdx + 3] ?? points[midIdx + 1];
  const dx = x2 - x, dy = y2 - y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const { nx, ny } = perpendicular(dx, dy, len);
  const sign = side === 'left' ? 1 : -1;
  return {
    ix: x, iy: y,
    ox: x + nx * sign * width,
    oy: y + ny * sign * width,
  };
}
