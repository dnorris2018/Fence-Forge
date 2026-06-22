import { Shape } from 'react-konva';
import { catmullRomPath, mixedPolyNativePath } from '../../utils/curveUtils';
import type { SegmentCurveData } from '../../types/object';

const COPING = 20;

function rng(s: number): number {
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawWater(
  n: CanvasRenderingContext2D,
  pts: number[],
  minX: number, minY: number,
  maxX: number, maxY: number,
) {
  const w = maxX - minX, h = maxY - minY;
  const hw = w / 2, hh = h / 2;
  const np = pts.length / 2;
  let cx = 0, cy = 0;
  for (let i = 0; i < np; i++) { cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
  cx /= np; cy /= np;

  // R = reference radius (smaller half-axis). In scaled space the pool is a circle of radius R.
  const R   = Math.max(Math.min(hw, hh), 1);
  const sx  = hw / R;   // horizontal stretch (>= 1 for wide pools)
  const sy  = hh / R;   // vertical stretch   (>= 1 for tall pools)

  // Solid base — oversized rect so Catmull-Rom curves that bulge beyond the
  // vertex bounding box are still fully covered (clip handles the exact boundary).
  n.fillStyle = '#1a8cd8';
  n.fillRect(minX - w, minY - h, w * 3, h * 3);

  // All texture effects are drawn in pool-local scaled space so circles → ellipses
  // matching the pool's aspect ratio.
  n.save();
  n.translate(cx, cy);
  n.scale(sx, sy);

  // Depth gradient — elliptical because of the scale transform
  const dg = n.createRadialGradient(0, -R * 0.2, 0, 0, 0, R * 1.3);
  dg.addColorStop(0,   'rgba(100, 210, 255, 0.40)');
  dg.addColorStop(0.5, 'rgba( 20, 120, 210, 0.10)');
  dg.addColorStop(1,   'rgba(  0,  45, 110, 0.55)');
  n.fillStyle = dg;
  // Oversized in scaled space — clip handles the exact boundary
  n.fillRect(-R * 2, -R * 2, R * 4, R * 4);

  // Caustic blobs distributed in pool-ellipse space
  const GOLDEN = 2.39996323;
  const count  = Math.min(80, Math.max(12, Math.floor((w * h) / 450)));
  for (let i = 0; i < count; i++) {
    const angle = i * GOLDEN, dist = Math.sqrt((i + 0.5) / count);
    const px = Math.cos(angle) * dist * R * 0.85;
    const py = Math.sin(angle) * dist * R * 0.85;
    const pr    = R * (0.04 + rng(i * 7 + 3) * 0.10);
    const pry   = pr * (0.35 + rng(i * 7 + 4) * 0.65);
    const pa    = i * GOLDEN + rng(i * 7 + 5) * Math.PI;
    const alpha = 0.12 + rng(i * 7 + 6) * 0.22;
    const g = n.createRadialGradient(0, 0, 0, 0, 0, pr);
    g.addColorStop(0,    `rgba(170, 240, 255, ${(alpha * 2).toFixed(2)})`);
    g.addColorStop(0.35, `rgba( 80, 200, 255, ${alpha.toFixed(2)})`);
    g.addColorStop(1,    'rgba( 30, 160, 230, 0)');
    n.save();
    n.translate(px, py);
    n.rotate(pa);
    n.scale(1, pry / Math.max(pr, 0.1));
    n.beginPath(); n.arc(0, 0, pr, 0, Math.PI * 2);
    n.fillStyle = g; n.fill();
    n.restore();
  }

  // Specular highlights
  const sc = Math.min(16, Math.max(3, Math.floor(w * h / 3500)));
  for (let i = 0; i < sc; i++) {
    const px = (rng(i * 31 + 200) * 1.8 - 0.9) * R * 0.65;
    const py = (rng(i * 31 + 201) * 1.8 - 0.9) * R * 0.65;
    const sr = R * (0.012 + rng(i * 31 + 202) * 0.022);
    const sa = 0.4 + rng(i * 31 + 203) * 0.5;
    const sg = n.createRadialGradient(px, py, 0, px, py, sr);
    sg.addColorStop(0, `rgba(255,255,255,${sa.toFixed(2)})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    n.fillStyle = sg;
    n.beginPath(); n.arc(px, py, sr, 0, Math.PI * 2); n.fill();
  }

  // Ripple arcs — elliptical in world space due to scale transform
  const wc = Math.min(7, Math.max(2, Math.floor(R / 30)));
  const lw  = 1 / Math.min(sx, sy); // compensate scale so strokes aren't too thick
  for (let i = 0; i < wc; i++) {
    const seed = i * 53.7 + 9;
    n.beginPath();
    n.arc(0, 0, R * (0.18 + (i / wc) * 0.65), rng(seed) * Math.PI * 2,
          rng(seed) * Math.PI * 2 + Math.PI * (0.5 + rng(seed + 1)));
    n.strokeStyle = `rgba(255,255,255,${(0.03 + rng(seed + 2) * 0.05).toFixed(2)})`;
    n.lineWidth   = (0.6 + rng(seed + 3) * 1.2) * lw;
    n.stroke();
  }

  n.restore();
}

interface Props { points: number[]; curved?: boolean; segmentCurveData?: SegmentCurveData[] }

export function FreeformPoolObject({ points, curved = false, segmentCurveData }: Props) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i]     < minX) minX = points[i];
    if (points[i]     > maxX) maxX = points[i];
    if (points[i + 1] < minY) minY = points[i + 1];
    if (points[i + 1] > maxY) maxY = points[i + 1];
  }

  return (
    <Shape
      sceneFunc={(ctx) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;
        const nv = points.length / 2;

        const hasSegCurves = segmentCurveData?.some(s => s?.curved);
        function makePath() {
          n.beginPath();
          if (hasSegCurves) {
            mixedPolyNativePath(n, points, segmentCurveData ?? [], true);
          } else if (curved) {
            catmullRomPath(n, points, true);
          } else {
            for (let i = 0; i < nv; i++) n[i === 0 ? 'moveTo' : 'lineTo'](points[i*2], points[i*2+1]);
            n.closePath();
          }
        }

        // Drop shadow
        n.save();
        n.translate(3, 6);
        makePath();
        n.fillStyle = 'rgba(0,0,0,0.20)';
        n.fill();
        n.restore();

        // Outer coping fill
        makePath();
        n.fillStyle = '#ECEAE6';
        n.fill();
        n.strokeStyle = '#C0BAB0';
        n.lineWidth   = 1;
        n.stroke();

        // Clip to outer path — use evenodd so Catmull-Rom self-intersections don't punch holes
        n.save();
        makePath();
        n.clip('evenodd');

        // Water fills the entire clip region
        drawWater(n, points, minX, minY, maxX, maxY);

        // Dark inner shadow band (COPING+6 px inward) — appears just inside the white coping
        makePath();
        n.strokeStyle = 'rgba(0,40,100,0.26)';
        n.lineWidth   = (COPING + 6) * 2;
        n.stroke();

        // White coping stroke (COPING px inward) — covers outer portion of dark band
        makePath();
        n.strokeStyle = '#ECEAE6';
        n.lineWidth   = COPING * 2;
        n.stroke();

        n.restore();

        // Outer coping edge
        makePath();
        n.strokeStyle = '#B8B2A8';
        n.lineWidth   = 1;
        n.stroke();
      }}
      listening={false}
    />
  );
}
