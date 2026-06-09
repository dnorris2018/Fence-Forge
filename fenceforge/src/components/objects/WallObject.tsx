import { Shape } from 'react-konva';

interface Props {
  width: number;
  height: number;
  capSide: 'top' | 'bottom';
}

export function WallObject({ width: w, height: h, capSide }: Props) {
  return (
    <Shape
      width={w}
      height={h}
      sceneFunc={(ctx, _sn) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;

        // ── dimensions ────────────────────────────────────────────────
        const capH      = Math.max(6, Math.min(h * 0.18, 20));
        const brickAreaY = capSide === 'top' ? capH : 0;
        const brickAreaH = h - capH;

        // Brick unit sizes — fixed pixel sizes so bricks are always legible
        const mortar    = 2;
        const brickH    = Math.max(7, Math.min(12, brickAreaH / 3));
        const brickW    = brickH * 2.4;
        const rowH      = brickH + mortar;

        // ── drop shadow ───────────────────────────────────────────────
        n.save();
        n.shadowColor   = 'rgba(0,0,0,0.4)';
        n.shadowBlur    = 6;
        n.shadowOffsetX = 3;
        n.shadowOffsetY = 3;
        n.fillStyle     = 'rgba(0,0,0,0.01)';
        n.fillRect(0, 0, w, h);
        n.restore();

        // ── mortar background (fills entire brick area) ───────────────
        n.fillStyle = '#5A4E44';
        n.fillRect(0, brickAreaY, w, brickAreaH);

        // ── brick rows ─────────────────────────────────────────────────
        // Clip to brick area
        n.save();
        n.beginPath();
        n.rect(0, brickAreaY, w, brickAreaH);
        n.clip();

        const rows = Math.ceil(brickAreaH / rowH) + 1;

        for (let row = 0; row < rows; row++) {
          const y     = brickAreaY + row * rowH;
          // Offset every other row by half a brick for the staggered pattern
          const offset = (row % 2 === 0) ? 0 : -(brickW / 2);
          // How many bricks needed to span the width (with offset start)
          const cols  = Math.ceil((w - offset) / (brickW + mortar)) + 2;

          for (let col = 0; col < cols; col++) {
            const x = offset + col * (brickW + mortar);

            // Per-brick color variation for realism
            const rng = Math.sin(row * 31 + col * 97) * 0.5 + 0.5;
            const r   = Math.round(170 + rng * 35);
            const g   = Math.round(72  + rng * 28);
            const b   = Math.round(52  + rng * 20);

            // Base brick fill
            n.fillStyle = `rgb(${r},${g},${b})`;
            n.fillRect(x + mortar, y + mortar, brickW - mortar, brickH - mortar);

            // Highlight along top edge
            const hlGrad = n.createLinearGradient(x, y + mortar, x, y + mortar + brickH * 0.4);
            hlGrad.addColorStop(0, 'rgba(255,200,160,0.18)');
            hlGrad.addColorStop(1, 'rgba(255,200,160,0)');
            n.fillStyle = hlGrad;
            n.fillRect(x + mortar, y + mortar, brickW - mortar, brickH * 0.5);

            // Shadow along bottom edge
            const shGrad = n.createLinearGradient(x, y + brickH * 0.6, x, y + brickH);
            shGrad.addColorStop(0, 'rgba(0,0,0,0)');
            shGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
            n.fillStyle = shGrad;
            n.fillRect(x + mortar, y + brickH * 0.5, brickW - mortar, brickH * 0.5);
          }
        }

        n.restore();

        // ── concrete cap ──────────────────────────────────────────────
        const capY = capSide === 'top' ? 0 : h - capH;

        // Cap base gradient (light gray concrete)
        const capGrad = n.createLinearGradient(0, capY, 0, capY + capH);
        capGrad.addColorStop(0,   '#D8D4CE');
        capGrad.addColorStop(0.5, '#C8C4BC');
        capGrad.addColorStop(1,   '#B0ACA4');
        n.fillStyle = capGrad;
        n.fillRect(0, capY, w, capH);

        // Subtle aggregate texture on cap
        n.save();
        n.beginPath(); n.rect(0, capY, w, capH); n.clip();
        for (let i = 0; i < Math.floor(w / 6); i++) {
          const tx = (Math.sin(i * 53) * 0.5 + 0.5) * w;
          const ty = capY + (Math.sin(i * 37) * 0.5 + 0.5) * capH;
          const tr = 0.8 + (Math.sin(i * 71) * 0.5 + 0.5) * 1.2;
          n.beginPath(); n.arc(tx, ty, tr, 0, Math.PI * 2);
          n.fillStyle = `rgba(100,95,88,${0.12 + (Math.sin(i * 41) * 0.5 + 0.5) * 0.12})`;
          n.fill();
        }
        n.restore();

        // Cap edge shadow (on the side facing the bricks)
        const edgeShadowGrad = n.createLinearGradient(
          0, capSide === 'top' ? capY + capH - 5 : capY,
          0, capSide === 'top' ? capY + capH      : capY + 5
        );
        edgeShadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeShadowGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
        if (capSide === 'top') {
          n.fillStyle = edgeShadowGrad;
          n.fillRect(0, capY + capH - 5, w, 5);
        } else {
          const g2 = n.createLinearGradient(0, capY, 0, capY + 5);
          g2.addColorStop(0, 'rgba(0,0,0,0.28)');
          g2.addColorStop(1, 'rgba(0,0,0,0)');
          n.fillStyle = g2;
          n.fillRect(0, capY, w, 5);
        }

        // Cap outline
        n.strokeStyle = '#706860';
        n.lineWidth   = 1;
        n.strokeRect(0, capY, w, capH);

        // ── overall wall border ───────────────────────────────────────
        n.strokeStyle = '#3A2E28';
        n.lineWidth   = 1.5;
        n.strokeRect(0, 0, w, h);
      }}
    />
  );
}
