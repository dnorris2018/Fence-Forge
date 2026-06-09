import { Shape } from 'react-konva';

interface Props { width: number; height: number }

export function ShedObject({ width: w, height: h }: Props) {
  return (
    <Shape
      width={w}
      height={h}
      sceneFunc={(ctx, _sn) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;

        const overhang  = Math.max(5, w * 0.06);
        const roofH     = h * 0.32;
        const wallY     = roofH;
        const wallH     = h - roofH;
        const trimW     = Math.max(5, w * 0.055);
        const fasciaH   = Math.max(3, h * 0.03);

        // ── drop shadow ──────────────────────────────────────────────────
        n.save();
        n.shadowColor   = 'rgba(0,0,0,0.35)';
        n.shadowBlur    = 10;
        n.shadowOffsetX = 4;
        n.shadowOffsetY = 5;
        n.beginPath();
        n.rect(0, wallY, w, wallH);
        n.fillStyle = 'rgba(0,0,0,0.01)';
        n.fill();
        n.restore();

        // ── wall body ─────────────────────────────────────────────────────
        const wallGrad = n.createLinearGradient(0, wallY, w, wallY);
        wallGrad.addColorStop(0,   '#4C7A97');
        wallGrad.addColorStop(0.45,'#6497B1');
        wallGrad.addColorStop(1,   '#4A7590');
        n.fillStyle = wallGrad;
        n.fillRect(0, wallY, w, wallH);

        // vertical board siding
        const sidingStep = Math.max(5, w / 13);
        n.strokeStyle = 'rgba(20,50,75,0.22)';
        n.lineWidth   = 0.8;
        for (let x = sidingStep; x < w - trimW; x += sidingStep) {
          if (x < trimW) continue;
          n.beginPath(); n.moveTo(x, wallY); n.lineTo(x, h); n.stroke();
        }


        // ── door ─────────────────────────────────────────────────────────
        const doorW   = w * 0.26;
        const doorH   = wallH * 0.72;
        const doorX   = (w - doorW) / 2;
        const doorY   = h - doorH;
        const surround = Math.max(3, doorW * 0.10);

        // white surround
        n.fillStyle = '#FFFFFF';
        n.fillRect(doorX - surround, doorY - surround * 0.5,
                   doorW + surround * 2, doorH + surround * 0.5);

        // door fill
        const dg = n.createLinearGradient(doorX, 0, doorX + doorW, 0);
        dg.addColorStop(0,    '#9E7038');
        dg.addColorStop(0.35, '#C49450');
        dg.addColorStop(0.65, '#D4A860');
        dg.addColorStop(1,    '#A87A3A');
        n.fillStyle = dg;
        n.fillRect(doorX, doorY, doorW, doorH);

        // vertical planks
        const planks = 5;
        n.strokeStyle = 'rgba(50,22,4,0.28)';
        n.lineWidth   = 0.9;
        for (let i = 1; i < planks; i++) {
          const px = doorX + doorW * (i / planks);
          n.beginPath(); n.moveTo(px, doorY); n.lineTo(px, doorY + doorH); n.stroke();
        }

        // door border
        n.strokeStyle = 'rgba(0,0,0,0.45)';
        n.lineWidth   = 1.2;
        n.strokeRect(doorX, doorY, doorW, doorH);

        // oval knob
        const knobX = doorX + doorW * 0.54;
        const knobY = doorY + doorH * 0.52;
        n.fillStyle = '#D0CCCC';
        n.beginPath(); n.ellipse(knobX, knobY, 4.5, 2.8, 0, 0, Math.PI * 2); n.fill();
        n.strokeStyle = 'rgba(0,0,0,0.35)'; n.lineWidth = 0.6; n.stroke();

        // ── windows ───────────────────────────────────────────────────────
        const winW    = w * 0.16;
        const winH    = wallH * 0.30;
        const winY    = wallY + wallH * 0.15;
        const winInset = Math.max(2.5, winW * 0.1);
        const leftWin  = trimW + (doorX - trimW - winW) / 2;
        const rightWin = doorX + doorW + (w - trimW - doorX - doorW - winW) / 2;

        for (const wx of [leftWin, rightWin]) {
          // white frame
          n.fillStyle = '#FFFFFF';
          n.fillRect(wx, winY, winW, winH);

          // glass
          const gx = wx + winInset, gy = winY + winInset;
          const gw = winW - winInset * 2, gh = winH - winInset * 2;
          const glGrad = n.createLinearGradient(gx, gy, gx + gw, gy + gh);
          glGrad.addColorStop(0, '#C2DDED');
          glGrad.addColorStop(1, '#A4C8DC');
          n.fillStyle = glGrad;
          n.fillRect(gx, gy, gw, gh);

          // 2×2 pane dividers
          n.strokeStyle = '#FFFFFF';
          n.lineWidth   = 1.8;
          n.beginPath(); n.moveTo(gx + gw / 2, gy); n.lineTo(gx + gw / 2, gy + gh); n.stroke();
          n.beginPath(); n.moveTo(gx, gy + gh / 2); n.lineTo(gx + gw, gy + gh / 2); n.stroke();

          // frame border
          n.strokeStyle = 'rgba(0,0,0,0.28)';
          n.lineWidth   = 1.0;
          n.strokeRect(wx, winY, winW, winH);
        }

        // ── gable roof ────────────────────────────────────────────────────
        const peakX    = w / 2;
        const peakY    = 0;
        const eaveL    = -overhang;
        const eaveR    = w + overhang;
        const eaveY    = roofH;

        // roof face gradient
        const roofGrad = n.createLinearGradient(0, peakY, 0, eaveY);
        roofGrad.addColorStop(0,   '#3C3C3C');
        roofGrad.addColorStop(0.6, '#484848');
        roofGrad.addColorStop(1,   '#282828');

        n.beginPath();
        n.moveTo(peakX, peakY);
        n.lineTo(eaveR, eaveY);
        n.lineTo(eaveL, eaveY);
        n.closePath();
        n.fillStyle = roofGrad;
        n.fill();

        // subtle right-face highlight / left-face shadow
        const roofMidR = n.createLinearGradient(peakX, peakY, eaveR, eaveY);
        roofMidR.addColorStop(0, 'rgba(255,255,255,0.0)');
        roofMidR.addColorStop(1, 'rgba(255,255,255,0.07)');
        n.beginPath(); n.moveTo(peakX, peakY); n.lineTo(eaveR, eaveY); n.lineTo(w/2 + (eaveR-peakX)*0.5, eaveY); n.closePath();
        n.fillStyle = roofMidR; n.fill();

        // roof outline
        n.beginPath();
        n.moveTo(peakX, peakY); n.lineTo(eaveR, eaveY); n.lineTo(eaveL, eaveY); n.closePath();
        n.strokeStyle = '#1A1A1A'; n.lineWidth = 1.5; n.stroke();

        // fascia bar at eave
        n.fillStyle = '#252525';
        n.fillRect(eaveL, eaveY, eaveR - eaveL, fasciaH);
        n.strokeStyle = '#111'; n.lineWidth = 0.8;
        n.strokeRect(eaveL, eaveY, eaveR - eaveL, fasciaH);

        // ── wall outline ──────────────────────────────────────────────────
        n.strokeStyle = '#1A1A1A'; n.lineWidth = 1.5;
        n.strokeRect(0, wallY, w, wallH);
      }}
    />
  );
}
