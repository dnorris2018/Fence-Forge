import { Shape } from 'react-konva';
import type { HouseStyle } from '../../constants/houseShapes';
import { buildHousePoints } from '../../constants/houseShapes';

const PLANK_H = 9;
const PLANK_W = 15;

function rng(s: number): number {
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function inwardNormals(pts: [number,number][], cw: boolean): [number,number][] {
  return pts.map((_, i) => {
    const j = (i + 1) % pts.length;
    const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
    const len = Math.hypot(dx, dy) || 1;
    return cw ? [-dy / len, dx / len] : [dy / len, -dx / len];
  });
}


interface TextureEntry { oc: HTMLCanvasElement; offX: number; offY: number; }
const _textureCache = new Map<string, TextureEntry>();

function buildTexture(
  pts: [number,number][], rawNp: number,
  minX: number, minY: number, maxX: number, maxY: number,
  maxInset: number,
  norms: [number,number][], edgeAngles: number[],
): TextureEntry {
  const SHADOW_DEPTH = 7;
  const SX = 0.707, SY = -0.707;
  const bbW  = Math.ceil(maxX - minX) + PLANK_W * 2;
  const bbH  = Math.ceil(maxY - minY) + PLANK_H * 2;
  const offX = minX - PLANK_W;
  const offY = minY - PLANK_H;
  const oc   = document.createElement('canvas');
  oc.width   = bbW;
  oc.height  = bbH;
  const oc2  = oc.getContext('2d')!;

  for (let by = 0; by < bbH; by += PLANK_H) {
    for (let bx = 0; bx < bbW; bx += PLANK_W) {
      const cx = bx + offX + PLANK_W * 0.5;
      const cy = by + offY + PLANK_H * 0.5;
      let minD2 = Infinity, k = 0;
      for (let e = 0; e < rawNp; e++) {
        const e1 = (e + 1) % rawNp;
        const ex = pts[e1][0] - pts[e][0], ey = pts[e1][1] - pts[e][1];
        const len2 = ex * ex + ey * ey;
        if (len2 < 1) continue;
        const t  = Math.max(0, Math.min(1, ((cx - pts[e][0]) * ex + (cy - pts[e][1]) * ey) / len2));
        const nx = pts[e][0] + t * ex - cx, ny = pts[e][1] + t * ey - cy;
        const d2 = nx * nx + ny * ny;
        if (d2 < minD2) { minD2 = d2; k = e; }
      }
      const ca = Math.cos(edgeAngles[k]), sa = Math.sin(edgeAngles[k]);
      const ddx = cx - pts[k][0], ddy = cy - pts[k][1];
      const lx  =  ddx * ca + ddy * sa;
      const ly  = -ddx * sa + ddy * ca;
      const row    = Math.floor(ly / PLANK_H);
      const col    = Math.floor((lx + (row & 1 ? PLANK_W * 0.5 : 0)) / PLANK_W);
      const lit    = 0.55 + 0.45 * Math.max(0, norms[k][0] * SX + norms[k][1] * SY);
      const dr     = Math.max(0, Math.min(1, ly / (maxInset + PLANK_H)));
      const bright = lit * (0.87 + dr * 0.15);
      const r  = rng(row * 37 + col * 113 + k * 7);
      const rv = Math.min(255, Math.round((158 + r * 38) * bright));
      const gv = Math.min(255, Math.round(( 98 + r * 26) * bright));
      const bv = Math.min(255, Math.round(( 48 + r * 18) * bright));
      oc2.fillStyle = `rgb(${rv},${gv},${bv})`;
      oc2.fillRect(bx + 1, by + 1, PLANK_W - 2, PLANK_H - 1);
      const ha = (0.09 + r * 0.08);
      oc2.fillStyle = `rgba(255,220,170,${ha.toFixed(2)})`;
      oc2.fillRect(bx + 1, by + 1, PLANK_W - 2, 2);
      if (ly >= 0 && ly < SHADOW_DEPTH) {
        const sh = (0.42 * (1 - ly / SHADOW_DEPTH)).toFixed(2);
        oc2.fillStyle = `rgba(0,0,0,${sh})`;
        oc2.fillRect(bx, by, PLANK_W, PLANK_H);
      }
    }
  }
  return { oc, offX, offY };
}

interface Props {
  width: number;
  height: number;
  houseStyle?: HouseStyle;
  houseFlipX?: boolean;
}

export function HouseObject({ width, height, houseStyle = 'rectangle', houseFlipX = false }: Props) {
  return (
    <Shape
      width={width}
      height={height}
      sceneFunc={(ctx) => {
        const n   = (ctx as any)._context as CanvasRenderingContext2D;
        const raw = buildHousePoints(houseStyle, width, height, houseFlipX);
        const rawNp = raw.length / 2;
        if (rawNp < 3) return;

        const pts: [number,number][] = Array.from({ length: rawNp }, (_, i) => [raw[i * 2], raw[i * 2 + 1]]);

        let area2 = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < rawNp; i++) {
          const j = (i + 1) % rawNp;
          area2 += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
          if (pts[i][0] < minX) minX = pts[i][0];
          if (pts[i][0] > maxX) maxX = pts[i][0];
          if (pts[i][1] < minY) minY = pts[i][1];
          if (pts[i][1] > maxY) maxY = pts[i][1];
        }
        const cw      = area2 > 0;
        const bw      = maxX - minX, bh = maxY - minY;
        const maxInset = Math.min(bw, bh) / 2;

        const norms = inwardNormals(pts, cw);

        function makePath() {
          n.beginPath();
          n.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < rawNp; i++) n.lineTo(pts[i][0], pts[i][1]);
          n.closePath();
        }

        const edgeAngles: number[] = Array.from({ length: rawNp }, (_, ei) => {
          const ej = (ei + 1) % rawNp;
          return Math.atan2(pts[ej][1] - pts[ei][1], pts[ej][0] - pts[ei][0]);
        });

        // Drop shadow
        n.save();
        n.translate(5, 7);
        makePath();
        n.fillStyle = 'rgba(0,0,0,0.22)';
        n.fill();
        n.restore();

        // Base fill
        makePath();
        n.fillStyle = '#3A2410';
        n.fill();

        // Texture (cached) + skeleton lines — all clipped to footprint
        const cacheKey = `${houseStyle}:${width}:${height}:${houseFlipX}`;
        let tex = _textureCache.get(cacheKey);
        if (!tex) {
          tex = buildTexture(pts, rawNp, minX, minY, maxX, maxY, maxInset, norms, edgeAngles);
          _textureCache.set(cacheKey, tex);
        }

        n.save();
        makePath();
        n.clip();
        n.drawImage(tex.oc, tex.offX, tex.offY);

        n.restore();

        // Eave outline
        makePath();
        n.strokeStyle = '#1E1008';
        n.lineWidth   = 1.3;
        n.stroke();
      }}
      listening={false}
    />
  );
}
