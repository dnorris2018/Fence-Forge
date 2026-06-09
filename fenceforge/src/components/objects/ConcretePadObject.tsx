import { Shape } from 'react-konva';
import { catmullRomPath } from '../../utils/curveUtils';

interface Props { points: number[]; curved?: boolean }

// Tile dimensions in world-space pixels
const TILE_W = 100;  // ~5 ft
const TILE_H = 140;  // ~7 ft  (portrait-oriented, matches reference)
const GROUT  = 1.5;  // grout line thickness (unchanged)

export function ConcretePadObject({ points, curved = false }: Props) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i]     < minX) minX = points[i];
    if (points[i]     > maxX) maxX = points[i];
    if (points[i + 1] < minY) minY = points[i + 1];
    if (points[i + 1] > maxY) maxY = points[i + 1];
  }

  return (
    <Shape
      sceneFunc={(ctx, _sn) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;

        const nv = points.length / 2;
        function polyPath() {
          n.beginPath();
          if (curved) {
            catmullRomPath(n, points, true);
          } else {
            for (let i = 0; i < nv; i++) n[i === 0 ? 'moveTo' : 'lineTo'](points[i*2], points[i*2+1]);
            n.closePath();
          }
        }

        // Deterministic rng seeded per tile position
        function rng(s: number): number {
          const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
          return x - Math.floor(x);
        }

        // ── drop shadow ────────────────────────────────────────────────
        n.save();
        n.translate(3, 5);
        polyPath();
        n.fillStyle = 'rgba(0,0,0,0.18)';
        n.fill();
        n.restore();

        // ── base fill (grout colour) ───────────────────────────────────
        polyPath();
        n.fillStyle = '#B8B8B4';
        n.fill();

        // ── tile grid (clipped to polygon) ────────────────────────────
        n.save();
        polyPath();
        n.clip();

        // Align grid to polygon's local bounding box top-left corner
        const col0 = minX;
        const row0 = minY;

        for (let row = row0; row < maxY + TILE_H; row += TILE_H) {
          for (let col = col0; col < maxX + TILE_W; col += TILE_W) {
            const tx = col + GROUT;
            const ty = row + GROUT;
            const tw = TILE_W - GROUT * 2;
            const th = TILE_H - GROUT * 2;
            if (tw <= 0 || th <= 0) continue;

            // Per-tile seed from its grid position
            const ts = Math.round(Math.abs(col * 17 + row * 31)) % 99991;

            // Tile base — slight variance across tiles
            const lightness = 0.92 + rng(ts) * 0.08;  // 0.92–1.00
            const gv = Math.round(lightness * 210);
            n.fillStyle = `rgb(${gv},${gv},${gv - 2})`;
            n.fillRect(tx, ty, tw, th);

            // Subtle mottled clouds per tile (2–3 soft blobs)
            const blobs = 2 + (rng(ts + 1000) > 0.65 ? 1 : 0);
            for (let b = 0; b < blobs; b++) {
              const bx  = tx + rng(ts + b * 7 + 1) * tw;
              const by  = ty + rng(ts + b * 7 + 2) * th;
              const brx = tw * (0.18 + rng(ts + b * 7 + 3) * 0.30);
              const bry = th * (0.15 + rng(ts + b * 7 + 4) * 0.28);
              const ba  = 0.04 + rng(ts + b * 7 + 5) * 0.09;
              const bright = rng(ts + b * 7 + 6) > 0.45;

              const grad = n.createRadialGradient(bx, by, 0, bx, by, Math.max(brx, bry));
              if (bright) {
                grad.addColorStop(0, `rgba(255,255,255,${(ba * 1.8).toFixed(2)})`);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
              } else {
                grad.addColorStop(0, `rgba(80,80,80,${ba.toFixed(2)})`);
                grad.addColorStop(1, 'rgba(80,80,80,0)');
              }

              n.save();
              n.scale(1, bry / brx);
              n.beginPath();
              n.arc(bx, by * (brx / bry), brx, 0, Math.PI * 2);
              n.fillStyle = grad;
              n.fill();
              n.restore();
            }
          }
        }

        n.restore(); // end polygon clip

        // ── perimeter border ───────────────────────────────────────────
        polyPath();
        n.strokeStyle = '#A0A09C';
        n.lineWidth = 1.5;
        n.stroke();
      }}
      listening={false}
    />
  );
}
