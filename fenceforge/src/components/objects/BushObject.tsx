import { Shape } from 'react-konva';

interface Props { width: number; height: number }

export function BushObject({ width: w, height: h }: Props) {
  return (
    <Shape
      width={w}
      height={h}
      sceneFunc={(ctx, _sn) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;
        const r  = Math.min(w, h) / 2;
        const ox = w / 2;
        const oy = h / 2;

        // ── helpers ────────────────────────────────────────────────────
        /** Pointed leaf from (0,0) outward along +Y */
        function leaf(
          lx: number, ly: number,
          angle: number,
          len: number, wid: number,
          fill: string,
        ) {
          n.save();
          n.translate(lx, ly);
          n.rotate(angle);
          n.beginPath();
          n.moveTo(0, 0);
          n.bezierCurveTo( wid * 0.55, len * 0.28,  wid * 0.55, len * 0.72, 0, len);
          n.bezierCurveTo(-wid * 0.55, len * 0.72, -wid * 0.55, len * 0.28, 0, 0);
          n.closePath();
          n.fillStyle = fill;
          n.fill();
          // midrib
          n.strokeStyle = 'rgba(0,0,0,0.13)';
          n.lineWidth = Math.max(0.4, wid * 0.06);
          n.beginPath();
          n.moveTo(0, len * 0.05);
          n.lineTo(0, len * 0.90);
          n.stroke();
          n.restore();
        }

        /** Ring of `count` leaves at (rx,ry) */
        function rosette(
          rx: number, ry: number,
          count: number,
          len: number, wid: number,
          colA: string, colB: string,
          startAngle: number,
        ) {
          for (let i = 0; i < count; i++) {
            const a = startAngle + (i / count) * Math.PI * 2;
            leaf(rx, ry, a, len, wid, i % 2 === 0 ? colA : colB);
          }
        }

        n.save();

        // ── drop shadow (drawn without clip so it bleeds naturally) ────
        n.save();
        n.shadowColor   = 'rgba(0,0,0,0.38)';
        n.shadowBlur    = r * 0.18;
        n.shadowOffsetX = r * 0.07;
        n.shadowOffsetY = r * 0.10;
        n.beginPath();
        n.ellipse(ox, oy, r * 0.80, r * 0.78, 0, 0, Math.PI * 2);
        n.fillStyle = 'rgba(0,0,0,0.01)'; // near-transparent so only shadow shows
        n.fill();
        n.restore();

        // ── outer ring — 8 dark rosettes (long leaves reach the edge) ─
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          rosette(
            ox + Math.cos(a) * r * 0.50,
            oy + Math.sin(a) * r * 0.50,
            7, r * 0.46, r * 0.13,
            '#1B5813', '#245F17',
            a + i * 0.22,
          );
        }

        // ── second ring — 6 medium-dark rosettes ──────────────────────
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.28;
          rosette(
            ox + Math.cos(a) * r * 0.30,
            oy + Math.sin(a) * r * 0.30,
            7, r * 0.38, r * 0.115,
            '#287318', '#30801C',
            a + i * 0.38,
          );
        }

        // ── third ring — 5 medium-bright rosettes ─────────────────────
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.65;
          rosette(
            ox + Math.cos(a) * r * 0.15,
            oy + Math.sin(a) * r * 0.15,
            6, r * 0.32, r * 0.105,
            '#3A9220', '#44A426',
            a + i * 0.48,
          );
        }

        // ── centre — two overlapping bright rosettes ───────────────────
        rosette(ox,            oy - r * 0.04, 7, r * 0.28, r * 0.096, '#4EC020', '#58D026', 0.10);
        rosette(ox + r * 0.03, oy + r * 0.03, 6, r * 0.25, r * 0.090, '#52C822', '#5ED82A', 0.82);

        n.restore();
      }}
    />
  );
}
