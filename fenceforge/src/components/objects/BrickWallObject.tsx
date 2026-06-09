import { Group, Shape, Line } from 'react-konva';
import { catmullRomSample } from '../../utils/curveUtils';

const WALL_W  = 32;
const CAP_H   = Math.round(WALL_W * 0.18);
const MORTAR  = 2;
const BRICK_H = Math.max(6, Math.round((WALL_W - CAP_H - MORTAR) / 3 - MORTAR));
const BRICK_W = Math.round(BRICK_H * 2.4);
const ROW_H   = BRICK_H + MORTAR;

// Compute miter-corrected polygon vertices for one edge of the wall.
// offset > 0 = left side (cap side), offset < 0 = right side.
function edgeVertices(pts: number[], offset: number): [number, number][] {
  const n = pts.length / 2;
  const verts: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const px = pts[i * 2], py = pts[i * 2 + 1];

    if (i === 0 || i === n - 1) {
      // Endpoint: use the single segment's normal
      const si = i === 0 ? 0 : n - 2;
      const dx = pts[si * 2 + 2] - pts[si * 2];
      const dy = pts[si * 2 + 3] - pts[si * 2 + 1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.01) { verts.push([px, py]); continue; }
      const nx = -dy / len, ny = dx / len;
      verts.push([px + nx * offset, py + ny * offset]);
    } else {
      // Interior vertex: miter
      const dx1 = pts[i * 2] - pts[(i - 1) * 2];
      const dy1 = pts[i * 2 + 1] - pts[(i - 1) * 2 + 1];
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

      const dx2 = pts[(i + 1) * 2] - pts[i * 2];
      const dy2 = pts[(i + 1) * 2 + 1] - pts[i * 2 + 1];
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (len1 < 0.01 || len2 < 0.01) { verts.push([px, py]); continue; }

      const nx1 = -dy1 / len1, ny1 = dx1 / len1;
      const nx2 = -dy2 / len2, ny2 = dx2 / len2;

      // Bisector of the two normals
      const bx = nx1 + nx2, by = ny1 + ny2;
      const blen = Math.sqrt(bx * bx + by * by);

      if (blen < 0.01) {
        // 180° reversal — use current segment normal
        verts.push([px + nx2 * offset, py + ny2 * offset]);
        continue;
      }

      // Miter scale: offset / cos(half-angle) = offset / dot(bisector, normal)
      const dot = (bx / blen) * nx1 + (by / blen) * ny1;
      // Clamp miter to 4× wall half-width to avoid extreme spikes
      const scale = Math.abs(dot) < 0.1 ? offset * 4 : offset / dot;
      verts.push([px + (bx / blen) * scale, py + (by / blen) * scale]);
    }
  }
  return verts;
}

interface Props {
  points: number[];   // relative coords [x0,y0, x1,y1, ...]
  isSelected: boolean;
  capSide?: 'top' | 'bottom';
  curved?: boolean;
}

export function BrickWallObject({ points, isSelected, capSide = 'top', curved = false }: Props) {
  const dense = curved ? catmullRomSample(points, false, 6) : points;
  const numDense = dense.length / 2;

  // Outline polygon for the selection Line uses the dense curve edges
  const outlinePts: number[] = [];
  if (numDense >= 2) {
    const capEdge   = edgeVertices(dense, WALL_W / 2);
    const brickEdge = edgeVertices(dense, -WALL_W / 2);
    for (const v of capEdge)   outlinePts.push(v[0], v[1]);
    for (let i = brickEdge.length - 1; i >= 0; i--) outlinePts.push(brickEdge[i][0], brickEdge[i][1]);
  }

  return (
    <Group>
      <Shape
      sceneFunc={(ctx) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;
        if (numDense < 2) return;

        const capEdge    = edgeVertices(dense, WALL_W / 2);
        const brickEdge  = edgeVertices(dense, -WALL_W / 2);

        // Precompute cumulative arc lengths for position-based brick seeding
        const arcLens: number[] = [0];
        for (let k = 1; k < numDense; k++) {
          const ddx = dense[k * 2] - dense[(k - 1) * 2];
          const ddy = dense[k * 2 + 1] - dense[(k - 1) * 2 + 1];
          arcLens.push(arcLens[k - 1] + Math.sqrt(ddx * ddx + ddy * ddy));
        }

        // ── Build full wall outline polygon ────────────────────────────────
        n.beginPath();
        n.moveTo(capEdge[0][0], capEdge[0][1]);
        for (let i = 1; i < capEdge.length; i++) n.lineTo(capEdge[i][0], capEdge[i][1]);
        for (let i = brickEdge.length - 1; i >= 0; i--) n.lineTo(brickEdge[i][0], brickEdge[i][1]);
        n.closePath();

        // Mortar fill
        n.fillStyle = '#4A3E36';
        n.fill();

        // ── Draw bricks per segment, clipped to that segment's miter quad ──
        for (let si = 0; si < numDense - 1; si++) {
          const x1 = dense[si * 2],       y1 = dense[si * 2 + 1];
          const x2 = dense[(si + 1) * 2], y2 = dense[(si + 1) * 2 + 1];
          const dx = x2 - x1, dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) continue;

          // Miter quad for this segment: capEdge[si], capEdge[si+1], brickEdge[si+1], brickEdge[si]
          const q = [
            capEdge[si],
            capEdge[si + 1],
            brickEdge[si + 1],
            brickEdge[si],
          ];

          n.save();
          n.beginPath();
          n.moveTo(q[0][0], q[0][1]);
          n.lineTo(q[1][0], q[1][1]);
          n.lineTo(q[2][0], q[2][1]);
          n.lineTo(q[3][0], q[3][1]);
          n.closePath();
          n.clip();

          // Transform into segment-local space
          const angle = Math.atan2(dy, dx);
          n.translate(x1, y1);
          n.rotate(angle);
          n.translate(0, -WALL_W / 2);

          const capY       = capSide === 'bottom' ? WALL_W - CAP_H : 0;
          const brickAreaY = capSide === 'bottom' ? 0 : CAP_H;
          const brickAreaH = WALL_W - CAP_H;
          const rows = Math.ceil(brickAreaH / ROW_H) + 2;
          // Extend bricks beyond segment to fill miter region
          const extend = WALL_W;

          for (let row = 0; row < rows; row++) {
            const ry = brickAreaY + row * ROW_H;
            const offset = row % 2 === 0 ? 0 : -(BRICK_W / 2);
            const cols = Math.ceil((len + extend * 2 - offset) / (BRICK_W + MORTAR)) + 2;

            for (let col = 0; col < cols; col++) {
              const bx = offset + col * (BRICK_W + MORTAR) - extend;
              const by = ry + MORTAR;
              // Seed by arc-length position so brick colors stay consistent along the curve
              const globalBrickIdx = Math.round((arcLens[si] + bx) / (BRICK_W + MORTAR));
              const rng = Math.abs(Math.sin(row * 31.7 + globalBrickIdx * 97.3));
              const rv = Math.round(160 + rng * 42);
              const gv = Math.round(58  + rng * 28);
              const bv = Math.round(42  + rng * 18);

              n.fillStyle = `rgb(${rv},${gv},${bv})`;
              n.fillRect(bx + MORTAR, by, BRICK_W - MORTAR, BRICK_H);

              const hl = n.createLinearGradient(0, by, 0, by + BRICK_H * 0.45);
              hl.addColorStop(0, 'rgba(255,200,160,0.20)');
              hl.addColorStop(1, 'rgba(255,200,160,0)');
              n.fillStyle = hl;
              n.fillRect(bx + MORTAR, by, BRICK_W - MORTAR, BRICK_H * 0.5);

              const sh = n.createLinearGradient(0, by + BRICK_H * 0.55, 0, by + BRICK_H);
              sh.addColorStop(0, 'rgba(0,0,0,0)');
              sh.addColorStop(1, 'rgba(0,0,0,0.25)');
              n.fillStyle = sh;
              n.fillRect(bx + MORTAR, by + BRICK_H * 0.5, BRICK_W - MORTAR, BRICK_H * 0.5);
            }
          }

          // Concrete cap strip
          const capGrad = n.createLinearGradient(0, capY, 0, capY + CAP_H);
          capGrad.addColorStop(0,   '#D2CEC8');
          capGrad.addColorStop(0.5, '#C2BEB8');
          capGrad.addColorStop(1,   '#ACACAA');
          n.fillStyle = capGrad;
          n.fillRect(-extend, capY, len + extend * 2, CAP_H);

          // Cap→brick shadow (always on the brick side of the cap)
          const shadowY = capSide === 'bottom' ? capY - 4 : capY + CAP_H - 4;
          const eg = n.createLinearGradient(0, shadowY, 0, shadowY + 4);
          eg.addColorStop(0, 'rgba(0,0,0,0)');
          eg.addColorStop(1, 'rgba(0,0,0,0.28)');
          n.fillStyle = eg;
          n.fillRect(-extend, shadowY, len + extend * 2, 4);

          n.restore();
        }

        // ── Base dark outline ──────────────────────────────────────────────
        n.beginPath();
        n.moveTo(capEdge[0][0], capEdge[0][1]);
        for (let i = 1; i < capEdge.length; i++) n.lineTo(capEdge[i][0], capEdge[i][1]);
        for (let i = brickEdge.length - 1; i >= 0; i--) n.lineTo(brickEdge[i][0], brickEdge[i][1]);
        n.closePath();
        n.strokeStyle = '#2A1E16';
        n.lineWidth   = 1.2;
        n.stroke();
      }}
      listening={false}
    />
    {/* Hit area — follow the dense curve so clicks register on the visual wall */}
    <Line
      points={dense}
      stroke="transparent"
      strokeWidth={0}
      hitStrokeWidth={WALL_W}
      listening={true}
    />
    {/* Selection outline — standard Konva stroke attr triggers proper layer redraws */}
    <Line
      points={outlinePts}
      closed
      fill="transparent"
      stroke={isSelected ? '#FFD700' : 'transparent'}
      strokeWidth={2.5}
      listening={false}
    />
    </Group>
  );
}
