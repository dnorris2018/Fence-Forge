import { Shape } from 'react-konva';

interface Props { width: number; height: number }

export function TreeObject({ width: w, height: h }: Props) {
  return (
    <Shape
      width={w}
      height={h}
      sceneFunc={(ctx, _sn) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;
        const r  = Math.min(w, h) / 2;
        const ox = w / 2;
        const oy = h / 2;

        // ── deterministic rng ──────────────────────────────────────────
        function rng(s: number): number {
          const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
          return x - Math.floor(x);
        }

        // Relative → canvas coords
        function p(rx: number, ry: number): [number, number] {
          return [ox + rx * r, oy + ry * r];
        }

        // ── tapered filled branch ──────────────────────────────────────
        function branch(
          x1: number, y1: number,
          x2: number, y2: number,
          w1: number, w2: number,
        ) {
          const dx = x2 - x1, dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len, ny = dx / len;
          // Slightly curved midpoint pushes the sides outward
          const mx = (x1 + x2) / 2 + nx * (w1 * 0.15);
          const my = (y1 + y2) / 2 + ny * (w1 * 0.15);

          n.beginPath();
          n.moveTo(x1 + nx * w1 * 0.5, y1 + ny * w1 * 0.5);
          n.quadraticCurveTo(mx + nx * (w1 + w2) * 0.25, my + ny * (w1 + w2) * 0.25,
                             x2 + nx * w2 * 0.5, y2 + ny * w2 * 0.5);
          n.lineTo(x2 - nx * w2 * 0.5, y2 - ny * w2 * 0.5);
          n.quadraticCurveTo(mx - nx * (w1 + w2) * 0.25, my - ny * (w1 + w2) * 0.25,
                             x1 - nx * w1 * 0.5, y1 - ny * w1 * 0.5);
          n.closePath();

          const g = n.createLinearGradient(x1, y1, x2, y2);
          g.addColorStop(0,   '#8B4A22');
          g.addColorStop(0.5, '#7A3E1C');
          g.addColorStop(1,   '#5C2E12');
          n.fillStyle = g;
          n.fill();
          n.strokeStyle = '#3A1C08';
          n.lineWidth = 0.7;
          n.stroke();
        }

        // ── leaf cluster ───────────────────────────────────────────────
        function cluster(
          cx: number, cy: number,
          count: number,
          seed: number,
          outAngle: number,   // direction leaves fan toward
        ) {
          const LL = r * 0.200;
          const LW = r * 0.125;
          const SPREAD = Math.PI * 2.0;   // full circle — no bunching

          for (let i = 0; i < count; i++) {
            // Evenly space around full circle with jitter
            const frac = i / count;
            const a = outAngle + frac * SPREAD
                    + (rng(seed + i * 7.3) - 0.5) * 0.55;
            const d = r * (0.10 + rng(seed + i * 3.7) * 0.22);  // wider scatter
            const lx = cx + Math.cos(a) * d;
            const ly = cy + Math.sin(a) * d;

            const t = rng(seed + i * 11);
            const col = t > 0.62 ? '#78DC28'   // bright lime
                      : t > 0.32 ? '#4AA81C'   // medium green
                      :            '#2C6812';   // dark green

            n.save();
            n.translate(lx, ly);
            n.rotate(a + Math.PI * 0.5); // leaf tip points outward
            n.beginPath();
            n.moveTo(0, 0);
            n.bezierCurveTo( LW * 0.65, LL * 0.28,  LW * 0.55, LL * 0.78, 0, LL);
            n.bezierCurveTo(-LW * 0.55, LL * 0.78, -LW * 0.65, LL * 0.28, 0, 0);
            n.closePath();
            n.fillStyle = col;
            n.fill();
            // midrib
            n.strokeStyle = 'rgba(0,0,0,0.18)';
            n.lineWidth = 0.7;
            n.beginPath();
            n.moveTo(0, LL * 0.08);
            n.lineTo(0, LL * 0.88);
            n.stroke();
            n.restore();
          }
        }

        // ── node positions ─────────────────────────────────────────────
        //  trunk
        const [r0x, r0y] = p( 0.02,  0.28);  // root (trunk base)
        const [fkx, fky] = p( 0.01,  0.00);  // main fork

        //  primary fork nodes
        const [plx, ply] = p(-0.28, -0.26);  // left-primary node
        const [prx, pry] = p( 0.27, -0.22);  // right-primary node
        const [pdx, pdy] = p(-0.05,  0.25);  // down-primary node

        //  tip positions — pushed further out for wider canopy
        const [t1x, t1y] = p(-0.72, -0.72);  // upper-left
        const [t2x, t2y] = p(-0.85, -0.22);  // left
        const [t3x, t3y] = p(-0.14, -0.88);  // upper-center
        const [t4x, t4y] = p( 0.26, -0.86);  // upper-right
        const [t5x, t5y] = p( 0.78, -0.58);  // right-upper
        const [t6x, t6y] = p( 0.82,  0.12);  // right
        const [t7x, t7y] = p(-0.68,  0.42);  // lower-left
        const [t8x, t8y] = p( 0.00,  0.88);  // lower-center
        const [t9x, t9y] = p( 0.56,  0.68);  // lower-right

        const BW = r * 0.095; // base branch width

        // ── shadow ─────────────────────────────────────────────────────
        n.save();
        n.globalAlpha = 0.22;
        n.translate(r * 0.08, r * 0.12);
        n.beginPath();
        n.ellipse(ox, oy, r * 0.82, r * 0.60, 0.15, 0, Math.PI * 2);
        n.fillStyle = '#6080A0';
        n.fill();
        n.globalAlpha = 1;
        n.restore();

        // ── branches — drawn first so clusters paint over them ─────────
        //  trunk
        branch(r0x, r0y, fkx, fky,   BW * 1.00, BW * 0.88);
        //  trunk → primary forks
        branch(fkx, fky, plx, ply,   BW * 0.80, BW * 0.62);
        branch(fkx, fky, prx, pry,   BW * 0.75, BW * 0.58);
        branch(fkx, fky, pdx, pdy,   BW * 0.68, BW * 0.52);
        //  left-primary → tips
        branch(plx, ply, t1x, t1y,   BW * 0.55, BW * 0.20);
        branch(plx, ply, t2x, t2y,   BW * 0.50, BW * 0.18);
        branch(plx, ply, t3x, t3y,   BW * 0.45, BW * 0.18);
        //  right-primary → tips
        branch(prx, pry, t4x, t4y,   BW * 0.52, BW * 0.18);
        branch(prx, pry, t5x, t5y,   BW * 0.48, BW * 0.18);
        branch(prx, pry, t6x, t6y,   BW * 0.42, BW * 0.17);
        //  down-primary → tips
        branch(pdx, pdy, t7x, t7y,   BW * 0.46, BW * 0.18);
        branch(pdx, pdy, t8x, t8y,   BW * 0.45, BW * 0.17);
        branch(pdx, pdy, t9x, t9y,   BW * 0.42, BW * 0.17);

        // Helper: midpoint between two positions
        function mid(ax: number, ay: number, bx: number, by: number, t = 0.5): [number, number] {
          return [ax + (bx - ax) * t, ay + (by - ay) * t];
        }

        // ── tip clusters — two overlapping rings per tip ───────────────
        const tips: [number, number, number, number, number, number][] = [
          [t1x, t1y, 14, 100, plx, ply],
          [t2x, t2y, 14, 200, plx, ply],
          [t3x, t3y, 13, 300, plx, ply],
          [t4x, t4y, 14, 400, prx, pry],
          [t5x, t5y, 14, 500, prx, pry],
          [t6x, t6y, 13, 600, prx, pry],
          [t7x, t7y, 14, 700, pdx, pdy],
          [t8x, t8y, 14, 800, pdx, pdy],
          [t9x, t9y, 13, 900, pdx, pdy],
        ];
        for (const [tx, ty, cnt, seed, px2, py2] of tips) {
          const outA = Math.atan2(ty - py2, tx - px2);
          cluster(tx, ty, cnt, seed, outA);
        }

        // ── mid-branch clusters ────────────────────────────────────────
        const midBranches: [number, number, number, number, number, number][] = [
          [...mid(plx, ply, t1x, t1y), 12, 1010, plx, ply] as [number,number,number,number,number,number],
          [...mid(plx, ply, t2x, t2y), 12, 1020, plx, ply] as [number,number,number,number,number,number],
          [...mid(plx, ply, t3x, t3y), 11, 1030, plx, ply] as [number,number,number,number,number,number],
          [...mid(prx, pry, t4x, t4y), 12, 1040, prx, pry] as [number,number,number,number,number,number],
          [...mid(prx, pry, t5x, t5y), 12, 1050, prx, pry] as [number,number,number,number,number,number],
          [...mid(prx, pry, t6x, t6y), 11, 1060, prx, pry] as [number,number,number,number,number,number],
          [...mid(pdx, pdy, t7x, t7y), 12, 1070, pdx, pdy] as [number,number,number,number,number,number],
          [...mid(pdx, pdy, t8x, t8y), 12, 1080, pdx, pdy] as [number,number,number,number,number,number],
          [...mid(pdx, pdy, t9x, t9y), 11, 1090, pdx, pdy] as [number,number,number,number,number,number],
        ];
        for (const [mx, my, cnt, seed, px2, py2] of midBranches) {
          const outA = Math.atan2(my - py2, mx - px2);
          cluster(mx, my, cnt, seed, outA);
        }

        // ── clusters at the fork nodes ─────────────────────────────────
        cluster(plx, ply, 14, 1100, Math.atan2(ply - fky, plx - fkx));
        cluster(prx, pry, 14, 1200, Math.atan2(pry - fky, prx - fkx));
        cluster(pdx, pdy, 13, 1300, Math.atan2(pdy - fky, pdx - fkx));
        cluster(fkx, fky, 10, 1400, Math.atan2(fky - r0y, fkx - r0x));
        // quarter-way clusters for extra coverage
        cluster(...mid(fkx, fky, plx, ply, 0.4), 9, 1500, Math.atan2(ply - fky, plx - fkx));
        cluster(...mid(fkx, fky, prx, pry, 0.4), 9, 1600, Math.atan2(pry - fky, prx - fkx));
        cluster(...mid(fkx, fky, pdx, pdy, 0.4), 8, 1700, Math.atan2(pdy - fky, pdx - fkx));

        // ── trunk base cap ─────────────────────────────────────────────
        n.beginPath();
        n.ellipse(r0x, r0y, BW * 0.55, BW * 0.40, 0, 0, Math.PI * 2);
        n.fillStyle = '#2A1408';
        n.fill();
      }}
    />
  );
}
