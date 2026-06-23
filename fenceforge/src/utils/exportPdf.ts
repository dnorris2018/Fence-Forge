import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getGlobalStage } from './stageRef';
import { computeMaterials } from './materials';
import { FENCE_TYPES } from '../constants/fenceTypes';
import { useUiStore } from '../store/uiStore';
import type { FenceLine, Gate, FenceTypeKey, FenceHeight, FenceStyle } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function styleLabel(style?: string): string {
  if (!style) return '';
  return style.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('-');
}

function fenceDisplayName(type: FenceTypeKey, heightFt?: number, fenceStyle?: string): string {
  const typeName = FENCE_TYPES[type]?.label ?? type;
  const parts: string[] = [];
  if (heightFt) parts.push(`${heightFt}'`);
  parts.push(typeName);
  const sl = styleLabel(fenceStyle);
  if (sl) parts.push(sl);
  return parts.join(' ');
}

export async function exportToPdf(
  fences: Record<string, FenceLine>,
  gates: Record<string, Gate>,
): Promise<void> {
  const stage = getGlobalStage();
  const hasFences = Object.keys(fences).length > 0;

  // Temporarily hide grid for a clean export
  const { gridVisible, toggleGrid } = useUiStore.getState();
  if (gridVisible) toggleGrid();
  await new Promise(r => requestAnimationFrame(r));

  // ── Page 1: Drawing (landscape) ──────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  // Header bar
  doc.setFillColor(30, 40, 55);
  doc.rect(0, 0, PW, 12, 'F');
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FENCE FORGE', 10, 8.5);
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Plan Drawing', PW - 10, 8.5, { align: 'right' });
  doc.text(new Date().toLocaleDateString(), PW / 2, 8.5, { align: 'center' });

  if (stage) {
    // Capture canvas at 2x for crisp output
    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
    const imgTop = 14;
    const imgH = PH - imgTop - 6;
    const imgW = PW - 12;
    doc.addImage(dataUrl, 'PNG', 6, imgTop, imgW, imgH, undefined, 'FAST');
  } else {
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(11);
    doc.text('(No canvas available)', PW / 2, PH / 2, { align: 'center' });
  }

  // Restore grid
  if (gridVisible) toggleGrid();

  if (!hasFences) {
    doc.save('fenceforge-export.pdf');
    return;
  }

  // ── Page 2: Materials (portrait) ─────────────────────────────────────────
  doc.addPage('letter', 'portrait');
  const PW2 = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(30, 40, 55);
  doc.rect(0, 0, PW2, 12, 'F');
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FENCE FORGE', 10, 8.5);
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Line Items', PW2 - 10, 8.5, { align: 'right' });
  doc.text(new Date().toLocaleDateString(), PW2 / 2, 8.5, { align: 'center' });

  const m = computeMaterials(fences, gates);
  const typeEntries = (Object.entries(m.byType) as [FenceTypeKey, NonNullable<typeof m.byType[FenceTypeKey]>][])
    .sort((a, b) => b[1].linearFt - a[1].linearFt);

  let cursorY = 18;

  for (const [type, acc] of typeEntries) {
    const def = FENCE_TYPES[type];
    const color = acc.color ?? def?.color ?? '#888888';
    const [r, g, b] = hexToRgb(color);

    // Collect distinct heights/styles for this type's fences
    const fencesOfType = Object.values(fences).filter(f => f.fenceType === type);
    const heights = [...new Set(fencesOfType.map(f => f.heightFt).filter((h): h is FenceHeight => h != null))].sort((a, b) => a - b);
    const fStyles = [...new Set(fencesOfType.map(f => f.fenceStyle).filter((s): s is FenceStyle => !!s))];

    // Section heading
    doc.setFillColor(r, g, b);
    doc.rect(10, cursorY, 3, 6, 'F');
    doc.setFillColor(r * 0.15, g * 0.15, b * 0.15 + 20);
    doc.rect(14, cursorY, PW2 - 24, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const heightStr2 = heights.length > 0 ? heights.map(h => `${h}'`).join('/') + ' ' : '';
    const styleStr2  = fStyles.length === 1 ? ' ' + styleLabel(fStyles[0]) : '';
    const sectionHeading = (heightStr2 + (def?.label ?? type) + styleStr2).toUpperCase();
    doc.text(sectionHeading, 16, cursorY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(`${acc.linearFt.toFixed(1)} ft`, PW2 - 14, cursorY + 4.2, { align: 'right' });
    cursorY += 7;
    const singleHeight = heights.length === 1 ? heights[0] : undefined;
    const singleStyle  = fStyles.length  === 1 ? fStyles[0]  : undefined;
    const dn = (h?: number, s?: string) => fenceDisplayName(type, h, s);

    // Gate grouping by description
    const gateGrouped = new Map<string, number>();
    for (const g of acc.gates) {
      const gTypeName = g.gateType === 'single-swing' ? 'Single' : 'Double';
      const dir = g.swingDirection === 'inward' ? 'In' : 'Out';
      const key = [dn(g.heightFt, g.fenceStyle), `${g.widthFt}'`, gTypeName, dir].join(' ');
      gateGrouped.set(key, (gateGrouped.get(key) ?? 0) + 1);
    }

    const rows: [string, string | number][] = [
      [dn(singleHeight, singleStyle), `${acc.linearFt.toFixed(1)} ft`],
      ...(acc.endPosts    > 0 ? [[`${dn(singleHeight, singleStyle)} End Post`,    acc.endPosts   ] as [string, number]] : []),
      ...(acc.cornerPosts > 0 ? [[`${dn(singleHeight, singleStyle)} Corner Post`, acc.cornerPosts] as [string, number]] : []),
      [`${dn(singleHeight, singleStyle)} Line Post`, acc.linePosts],
      ...(acc.gatePosts   > 0 ? [[`${dn(singleHeight, singleStyle)} Gate Post`,   acc.gatePosts  ] as [string, number]] : []),
      ...[...gateGrouped.entries()].map(([label, qty]) => [label, qty] as [string, number]),
    ];

    autoTable(doc, {
      startY: cursorY,
      margin: { left: 14, right: 14 },
      head: [],
      body: rows.map(r => [r[0], r[1]]),
      styles: { fontSize: 8.5, cellPadding: 1.8 },
      columnStyles: {
        0: { textColor: [200, 200, 200], fillColor: [28, 36, 48] },
        1: { textColor: [255, 255, 255], fillColor: [28, 36, 48], halign: 'right', fontStyle: 'bold' },
      },
      theme: 'plain',
    });

    cursorY = (doc as any).lastAutoTable.finalY + 5;
  }

  // ── Totals section ────────────────────────────────────────────────────────
  cursorY += 2;
  doc.setFillColor(50, 60, 75);
  doc.rect(10, cursorY, PW2 - 20, 6, 'F');
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTALS', 14, cursorY + 4.2);
  cursorY += 7;

  const totalRows = [
    ['Total Linear Footage', `${m.totalLinearFt.toFixed(1)} ft`],
    ['End Posts', m.totalEndPosts],
    ['Corner Posts', m.totalCornerPosts],
    ['Line Posts', m.totalLinePosts],
    ['Gate Posts', m.gatePosts],
    ['Total Posts', m.totalPosts],
  ];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14, right: 14 },
    head: [],
    body: totalRows.map(r => [r[0], r[1]]),
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { textColor: [220, 220, 220], fillColor: [35, 45, 60] },
      1: { textColor: [251, 191, 36], fillColor: [35, 45, 60], halign: 'right', fontStyle: 'bold' },
    },
    theme: 'plain',
  });

  doc.save('fenceforge-export.pdf');
}
