import { Shape } from 'react-konva';

interface Props {
  points: number[];
  entranceEdge?: number;
}

export function BuildingObject({ points, entranceEdge = 0 }: Props) {
  return (
    <Shape
      sceneFunc={(ctx) => {
        const n = (ctx as any)._context as CanvasRenderingContext2D;
        const np = points.length / 2;
        if (np < 3) return;

        // Bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < np; i++) {
          if (points[i*2]   < minX) minX = points[i*2];
          if (points[i*2]   > maxX) maxX = points[i*2];
          if (points[i*2+1] < minY) minY = points[i*2+1];
          if (points[i*2+1] > maxY) maxY = points[i*2+1];
        }
        const bSize = Math.min(maxX - minX, maxY - minY);
        const parapetT = Math.max(8, Math.min(20, bSize * 0.042));

        // Centroid (used for HVAC placement only)
        let cx = 0, cy = 0;
        for (let i = 0; i < np; i++) { cx += points[i*2]; cy += points[i*2+1]; }
        cx /= np; cy /= np;

        // Signed area (shoelace) — determines polygon winding in canvas coords.
        // > 0: drawn CW on screen  → outward normal = left  of directed edge = ( edgeDirY, -edgeDirX)
        // < 0: drawn CCW on screen → outward normal = right of directed edge = (-edgeDirY,  edgeDirX)
        // Using signed area is reliable even for non-convex (L-shaped) polygons where
        // the vertex-average centroid can lie outside the polygon.
        let signedArea = 0;
        for (let i = 0; i < np; i++) {
          const j = (i + 1) % np;
          signedArea += points[i*2] * points[j*2+1] - points[j*2] * points[i*2+1];
        }

        function makePath() {
          n.beginPath();
          n.moveTo(points[0], points[1]);
          for (let i = 1; i < np; i++) n.lineTo(points[i*2], points[i*2+1]);
          n.closePath();
        }

        // ── Entrance edge geometry ───────────────────────────────────────
        const ei    = Math.abs(entranceEdge) % np;
        const nextI = (ei + 1) % np;
        const ex1 = points[ei*2],     ey1 = points[ei*2+1];
        const ex2 = points[nextI*2],  ey2 = points[nextI*2+1];
        const edgeLen = Math.hypot(ex2 - ex1, ey2 - ey1);
        const edgeDirX = (ex2 - ex1) / edgeLen;
        const edgeDirY = (ey2 - ey1) / edgeLen;
        const eMidX = (ex1 + ex2) / 2;
        const eMidY = (ey1 + ey2) / 2;

        // Outward normal derived from winding direction — works for any polygon shape
        const normalX = signedArea > 0 ?  edgeDirY : -edgeDirY;
        const normalY = signedArea > 0 ? -edgeDirX :  edgeDirX;

        // ── Drop shadow ──────────────────────────────────────────────────
        n.save();
        n.translate(5, 7);
        makePath();
        n.fillStyle = 'rgba(0,0,0,0.22)';
        n.fill();
        n.restore();

        // ── Roof surface + base details (all clipped to building) ─────────
        n.save();
        makePath(); n.clip();

        // Roof surface gradient
        const rg = n.createLinearGradient(minX, minY, minX + (maxX - minX) * 0.6, maxY);
        rg.addColorStop(0,   '#B8B8B8');
        rg.addColorStop(0.5, '#C0C0C0');
        rg.addColorStop(1,   '#ABABAB');
        n.fillStyle = rg;
        n.fillRect(minX - 2, minY - 2, (maxX - minX) + 4, (maxY - minY) + 4);

        // Roof membrane seams (subtle parallel lines)
        const seamGap = Math.max(18, bSize * 0.11);
        n.strokeStyle = 'rgba(0,0,0,0.07)';
        n.lineWidth   = 0.7;
        for (let sy = minY + seamGap; sy < maxY; sy += seamGap) {
          n.beginPath(); n.moveTo(minX, sy); n.lineTo(maxX, sy); n.stroke();
        }

        // Parapet inner-edge depth shadow (dark band just inside polygon edge)
        makePath();
        n.strokeStyle = 'rgba(0,0,0,0.22)';
        n.lineWidth   = parapetT * 2.2;
        n.stroke();

        n.restore();

        // ── Rooftop equipment (clipped so nothing bleeds outside) ─────────
        n.save();
        makePath(); n.clip();

        // ── Mechanical penthouse / stairwell box ────────────────────────
        const phW = Math.max(22, bSize * 0.14);
        const phH = Math.max(16, bSize * 0.10);
        const phX = cx - phW / 2;
        const phY = cy - bSize * 0.26 - phH / 2;
        n.fillStyle = 'rgba(0,0,0,0.13)';
        n.fillRect(phX + 3, phY + 3, phW, phH);
        n.fillStyle = '#989898';
        n.fillRect(phX, phY, phW, phH);
        // Raised-edge highlight (lighter top/left)
        n.fillStyle = 'rgba(255,255,255,0.12)';
        n.fillRect(phX, phY, phW, 2);
        n.fillRect(phX, phY, 2, phH);
        n.strokeStyle = '#6E6E6E'; n.lineWidth = 1.0;
        n.strokeRect(phX, phY, phW, phH);
        // Door on penthouse
        const pdW = phW * 0.36, pdH = phH * 0.58;
        const pdX = phX + (phW - pdW) / 2, pdY = phY + phH - pdH;
        n.fillStyle = '#7A7A7A';
        n.fillRect(pdX, pdY, pdW, pdH);
        n.strokeStyle = '#606060'; n.lineWidth = 0.7;
        n.strokeRect(pdX, pdY, pdW, pdH);

        // ── Two HVAC rooftop air handlers ────────────────────────────────
        const hvW = Math.max(18, bSize * 0.09);
        const hvH = Math.max(12, bSize * 0.065);
        for (const [ox, oy] of [[-bSize * 0.22, -bSize * 0.14], [bSize * 0.16, -bSize * 0.17]] as [number, number][]) {
          const hx = cx + ox - hvW / 2;
          const hy = cy + oy - hvH / 2;
          n.fillStyle = 'rgba(0,0,0,0.12)';
          n.fillRect(hx + 2, hy + 2, hvW, hvH);
          n.fillStyle = '#9A9A9A';
          n.fillRect(hx, hy, hvW, hvH);
          n.strokeStyle = '#787878'; n.lineWidth = 0.9;
          n.strokeRect(hx, hy, hvW, hvH);
          n.strokeStyle = '#848484'; n.lineWidth = 0.6;
          for (let i = 1; i <= 3; i++) {
            const ly = hy + hvH * i / 4;
            n.beginPath(); n.moveTo(hx + 2, ly); n.lineTo(hx + hvW - 2, ly); n.stroke();
          }
        }

        // ── Rooftop condenser unit (round fan view) ───────────────────────
        const fanR  = Math.max(9, bSize * 0.055);
        const fanX  = cx + bSize * 0.24;
        const fanY  = cy + bSize * 0.10;
        n.fillStyle = 'rgba(0,0,0,0.12)';
        n.beginPath(); n.arc(fanX + 2, fanY + 2, fanR, 0, Math.PI * 2); n.fill();
        n.fillStyle = '#909090';
        n.beginPath(); n.arc(fanX, fanY, fanR, 0, Math.PI * 2); n.fill();
        n.strokeStyle = '#707070'; n.lineWidth = 1.0;
        n.beginPath(); n.arc(fanX, fanY, fanR, 0, Math.PI * 2); n.stroke();
        // Fan blades (4 curved wedges)
        n.strokeStyle = '#787878'; n.lineWidth = 0.8;
        for (let b = 0; b < 4; b++) {
          const a = (b / 4) * Math.PI * 2;
          n.beginPath();
          n.moveTo(fanX, fanY);
          n.arc(fanX, fanY, fanR * 0.85, a, a + Math.PI * 0.45);
          n.stroke();
        }
        // Hub
        n.fillStyle = '#686868';
        n.beginPath(); n.arc(fanX, fanY, fanR * 0.2, 0, Math.PI * 2); n.fill();
        n.strokeStyle = '#555'; n.lineWidth = 0.6;
        n.beginPath(); n.arc(fanX, fanY, fanR * 0.2, 0, Math.PI * 2); n.stroke();

        // ── Roof drains (2) ───────────────────────────────────────────────
        const drainR = Math.max(4, bSize * 0.025);
        for (const [ox, oy] of [[-bSize * 0.10, bSize * 0.14], [bSize * 0.20, -bSize * 0.05]] as [number, number][]) {
          const dx = cx + ox, dy = cy + oy;
          n.fillStyle = '#888';
          n.beginPath(); n.arc(dx, dy, drainR, 0, Math.PI * 2); n.fill();
          n.strokeStyle = '#666'; n.lineWidth = 0.8;
          n.beginPath(); n.arc(dx, dy, drainR, 0, Math.PI * 2); n.stroke();
          // Crosshair
          n.strokeStyle = '#666'; n.lineWidth = 0.7;
          n.beginPath(); n.moveTo(dx - drainR, dy); n.lineTo(dx + drainR, dy); n.stroke();
          n.beginPath(); n.moveTo(dx, dy - drainR); n.lineTo(dx, dy + drainR); n.stroke();
        }

        // ── Vent stacks / pipes (3 small circles) ─────────────────────────
        const vR = Math.max(2.5, bSize * 0.014);
        for (const [ox, oy] of [
          [-bSize * 0.30, bSize * 0.08],
          [-bSize * 0.08, -bSize * 0.22],
          [ bSize * 0.30,  bSize * 0.16],
        ] as [number, number][]) {
          const vx = cx + ox, vy = cy + oy;
          n.fillStyle = '#6E6E6E';
          n.beginPath(); n.arc(vx, vy, vR, 0, Math.PI * 2); n.fill();
          n.strokeStyle = '#505050'; n.lineWidth = 0.7;
          n.beginPath(); n.arc(vx, vy, vR, 0, Math.PI * 2); n.stroke();
          // Dark hollow center
          n.fillStyle = '#444';
          n.beginPath(); n.arc(vx, vy, vR * 0.45, 0, Math.PI * 2); n.fill();
        }

        n.restore();

        // ── Parapet border (thick stroke inside polygon boundary) ─────────
        n.save();
        makePath(); n.clip();
        makePath();
        n.strokeStyle = '#848484';
        n.lineWidth = parapetT * 2;
        n.stroke();
        // Entrance wall: override that segment in cream
        n.beginPath();
        n.moveTo(ex1, ey1);
        n.lineTo(ex2, ey2);
        n.strokeStyle = '#E4E0D8';
        n.lineWidth = parapetT * 2;
        n.stroke();
        n.restore();

        // ── Entrance details — direct geometry (no coordinate transform) ──
        // All positions computed explicitly using the edge direction and outward normal.
        // ep(along, perp): point at `along` px along the edge + `perp` px in the outward normal direction.
        // perp > 0 → outside building,  perp < 0 → inside building.
        const entW  = Math.min(edgeLen * 0.45, 120);
        const doorPad = 3;
        const doorW   = (entW - doorPad * 2 - 2) / 2;
        const stepD   = Math.max(6, bSize * 0.030);

        function ep(along: number, perp: number): [number, number] {
          return [
            eMidX + edgeDirX * along + normalX * perp,
            eMidY + edgeDirY * along + normalY * perp,
          ];
        }

        function quad(pts: [number,number][]) {
          n.beginPath();
          n.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) n.lineTo(pts[i][0], pts[i][1]);
          n.closePath();
        }

        // ── Landing (outward side, perp = 0 → stepD) ─────────────────────
        const lhw = entW / 2 + 5;
        quad([ep(-lhw, 0), ep(lhw, 0), ep(lhw, stepD), ep(-lhw, stepD)]);
        n.fillStyle = '#C4C0B8'; n.fill();
        n.strokeStyle = '#AAAAAA'; n.lineWidth = 0.8; n.stroke();
        // Front-edge shadow
        quad([ep(-lhw, stepD - 2), ep(lhw, stepD - 2), ep(lhw, stepD), ep(-lhw, stepD)]);
        n.fillStyle = 'rgba(0,0,0,0.14)'; n.fill();

        // ── Glass double doors (perp = -parapetT inward → 0 outer face) ──
        const d0s = -entW / 2 + doorPad;
        const d1s =  d0s + doorW + 2;
        for (const ds of [d0s, d1s]) {
          const de = ds + doorW;
          const pts: [number,number][] = [
            ep(ds, -parapetT), ep(de, -parapetT),  // inner edge (inside building)
            ep(de, 0),         ep(ds, 0),           // outer face (wall surface)
          ];
          // Glass fill
          quad(pts);
          n.fillStyle = 'rgba(130,185,220,0.75)'; n.fill();
          // Frame
          n.strokeStyle = '#3A3A3A'; n.lineWidth = 1.5; n.stroke();
          // Reflection highlight
          n.fillStyle = 'rgba(255,255,255,0.30)';
          n.beginPath();
          n.moveTo(pts[0][0], pts[0][1]);
          n.lineTo(pts[1][0], pts[1][1]);
          n.lineTo(
            (pts[1][0] + pts[2][0]) / 2,
            (pts[1][1] + pts[2][1]) / 2,
          );
          n.closePath(); n.fill();
          // Handle bar (perpendicular to door face, in the inward direction)
          const mid = ds + doorW / 2;
          const hA = ep(mid, -parapetT * 0.3);
          const hB = ep(mid, -parapetT * 0.7);
          n.strokeStyle = '#606060'; n.lineWidth = 1.1;
          n.beginPath(); n.moveTo(hA[0], hA[1]); n.lineTo(hB[0], hB[1]); n.stroke();
        }

        // ── Direction arrow (past the landing) ────────────────────────────
        const arS = Math.max(4, stepD * 0.55);
        const arTip = ep(0,          stepD + arS + 2);
        const arL   = ep(-arS * 0.7, stepD + 2);
        const arR   = ep( arS * 0.7, stepD + 2);
        n.fillStyle = 'rgba(60,60,60,0.40)';
        n.beginPath();
        n.moveTo(arTip[0], arTip[1]);
        n.lineTo(arL[0],   arL[1]);
        n.lineTo(arR[0],   arR[1]);
        n.closePath(); n.fill();

        // ── Building outline ──────────────────────────────────────────────
        makePath();
        n.strokeStyle = '#505050';
        n.lineWidth = 1.5;
        n.stroke();
      }}
      listening={false}
    />
  );
}
