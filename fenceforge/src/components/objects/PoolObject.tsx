import { Shape } from 'react-konva';

const COPING = 18; // px — ~1 ft coping border

function rng(s: number): number {
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawWaterEllipse(
  n: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
) {
  // Base water color
  n.fillStyle = '#1a8cd8';
  n.beginPath();
  n.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  n.fill();

  // Depth gradient — darker toward edges and bottom
  const dg = n.createRadialGradient(cx, cy - ry * 0.25, 0, cx, cy, Math.max(rx, ry));
  dg.addColorStop(0,   'rgba(100, 210, 255, 0.40)');
  dg.addColorStop(0.5, 'rgba( 20, 120, 210, 0.10)');
  dg.addColorStop(1,   'rgba(  0,  45, 110, 0.50)');
  n.fillStyle = dg;
  n.beginPath();
  n.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  n.fill();

  // Caustic light patches
  const GOLDEN = 2.39996323;
  const count = Math.min(70, Math.max(10, Math.floor((rx * ry) / 550)));
  for (let i = 0; i < count; i++) {
    const angle = i * GOLDEN;
    const dist  = Math.sqrt((i + 0.5) / count);
    const px = cx + Math.cos(angle) * dist * rx * 0.9;
    const py = cy + Math.sin(angle) * dist * ry * 0.9;

    const pr  = Math.min(rx, ry) * (0.04 + rng(i * 7 + 3) * 0.10);
    const pry = pr * (0.35 + rng(i * 7 + 4) * 0.65);
    const pa  = i * GOLDEN + rng(i * 7 + 5) * Math.PI;
    const alpha = 0.12 + rng(i * 7 + 6) * 0.22;

    const g = n.createRadialGradient(0, 0, 0, 0, 0, pr);
    g.addColorStop(0,   `rgba(170, 240, 255, ${(alpha * 2.0).toFixed(2)})`);
    g.addColorStop(0.35,`rgba( 80, 200, 255, ${alpha.toFixed(2)})`);
    g.addColorStop(1,   'rgba( 30, 160, 230, 0)');

    n.save();
    n.translate(px, py);
    n.rotate(pa);
    n.scale(1, pry / Math.max(pr, 0.1));
    n.beginPath();
    n.arc(0, 0, pr, 0, Math.PI * 2);
    n.fillStyle = g;
    n.fill();
    n.restore();
  }

  // Sparkle highlights
  const scount = Math.min(16, Math.max(3, Math.floor((rx * ry) / 3500)));
  for (let i = 0; i < scount; i++) {
    const px = cx + (rng(i * 31 + 200) * 1.6 - 0.8) * rx;
    const py = cy + (rng(i * 31 + 201) * 1.6 - 0.8) * ry;
    const sr = Math.min(rx, ry) * (0.015 + rng(i * 31 + 202) * 0.025);
    const sa = 0.4 + rng(i * 31 + 203) * 0.5;
    const sg = n.createRadialGradient(px, py, 0, px, py, sr);
    sg.addColorStop(0, `rgba(255,255,255,${sa.toFixed(2)})`);
    sg.addColorStop(1,  'rgba(255,255,255,0)');
    n.fillStyle = sg;
    n.beginPath();
    n.arc(px, py, sr, 0, Math.PI * 2);
    n.fill();
  }

  // Wave ripple lines
  const wc = Math.min(14, Math.max(4, Math.floor(ry / 18)));
  for (let i = 0; i < wc; i++) {
    const seed = i * 53.7 + 9;
    const py   = cy - ry * 0.85 + (i / (wc - 1)) * ry * 1.7;
    const amp  = 2 + rng(seed) * 4;
    const per  = rx * (0.5 + rng(seed + 1) * 0.5);
    const ph   = rng(seed + 2) * Math.PI * 2;
    const wa   = 0.04 + rng(seed + 3) * 0.08;
    n.beginPath();
    for (let x = cx - rx; x <= cx + rx; x += 3) {
      const y = py + Math.sin((x / per) * Math.PI * 2 + ph) * amp;
      x === cx - rx ? n.moveTo(x, y) : n.lineTo(x, y);
    }
    n.strokeStyle = `rgba(255,255,255,${wa.toFixed(2)})`;
    n.lineWidth   = 0.8 + rng(seed + 4) * 1.4;
    n.stroke();
  }
}

interface Props {
  width: number;
  height: number;
}

export function PoolObject({ width: w, height: h }: Props) {
  const cx  = w / 2, cy = h / 2;
  const rx  = w / 2, ry = h / 2;
  const irx = Math.max(4, rx - COPING);
  const iry = Math.max(4, ry - COPING);

  return (
    <Shape
      width={w} height={h}
      sceneFunc={(ctx) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;

        // Drop shadow
        n.save();
        n.shadowColor   = 'rgba(0,0,0,0.22)';
        n.shadowBlur    = 12;
        n.shadowOffsetX = 2;
        n.shadowOffsetY = 6;
        n.beginPath();
        n.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        n.fillStyle = '#D8D6D2';
        n.fill();
        n.restore();

        // Coping base
        n.beginPath();
        n.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        n.fillStyle = '#ECEAE6';
        n.fill();

        // Coping tile seams — subtle radial lines
        const seams = Math.round(Math.PI * 2 * Math.min(rx, ry) / 22);
        for (let i = 0; i < seams; i++) {
          const a = (i / seams) * Math.PI * 2;
          n.beginPath();
          n.moveTo(cx + Math.cos(a) * irx, cy + Math.sin(a) * iry);
          n.lineTo(cx + Math.cos(a) * rx,  cy + Math.sin(a) * ry);
          n.strokeStyle = 'rgba(0,0,0,0.07)';
          n.lineWidth   = 0.6;
          n.stroke();
        }
        // Coping inner ring line
        n.beginPath();
        n.ellipse(cx, cy, irx + 1, iry + 1, 0, 0, Math.PI * 2);
        n.strokeStyle = 'rgba(0,0,0,0.12)';
        n.lineWidth   = 1;
        n.stroke();

        // Water — clipped to inner ellipse
        n.save();
        n.beginPath();
        n.ellipse(cx, cy, irx, iry, 0, 0, Math.PI * 2);
        n.clip();
        drawWaterEllipse(n, cx, cy, irx, iry);
        n.restore();

        // Water edge shadow (depth illusion)
        n.beginPath();
        n.ellipse(cx, cy, irx, iry, 0, 0, Math.PI * 2);
        n.strokeStyle = 'rgba(0,40,100,0.40)';
        n.lineWidth   = 3;
        n.stroke();

        // Coping outer edge
        n.beginPath();
        n.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        n.strokeStyle = '#B8B2A8';
        n.lineWidth   = 1;
        n.stroke();
      }}
      listening={false}
    />
  );
}
