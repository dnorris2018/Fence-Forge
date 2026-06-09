import { create } from 'zustand';

export interface TakeoffSegment {
  curved: boolean;
  cp1X: number;  // cubic bezier control point 1 (near start)
  cp1Y: number;
  cp2X: number;  // cubic bezier control point 2 (near end)
  cp2Y: number;
}

export interface TakeoffLine {
  id: string;
  page: number;              // PDF page this line belongs to
  points: number[];          // flat [x0,y0,x1,y1,...] world px
  label: string;
  color: string;
  strokeWidth: number;       // display width in screen px (before zoom scaling)
  segments: TakeoffSegment[]; // length = nVertices - 1
}

export type TakeoffTool = 'select' | 'draw' | 'calibrate';

interface TakeoffState {
  pdfDataUrl: string | null;       // current hi-res image (swapped on zoom)
  pdfFileName: string | null;
  pdfPage: number;
  pdfTotalPages: number;
  pdfLogicalW: number;             // STABLE world-coordinate width (never changes after load)
  pdfLogicalH: number;             // STABLE world-coordinate height
  pdfBuffer: ArrayBuffer | null;   // raw bytes for re-rendering at higher scale

  calibrating: boolean;
  calibrationPoints: number[];
  calibrationFt: number;
  pixelsPerFt: number | null;

  lines: TakeoffLine[];
  drawingPoints: number[];
  selectedLineId: string | null;
  selectedSegIdx: number | null;   // which segment is focused
  activeTool: TakeoffTool;
  activeColor: string;
  activeLabel: string;
  activeStrokeWidth: number;

  setPdf: (dataUrl: string, fileName: string, logicalW: number, logicalH: number, totalPages: number, buffer: ArrayBuffer) => void;
  setPdfPage: (page: number) => void;
  setPdfImage: (dataUrl: string) => void;  // swap image only, keep logical size stable
  setActiveTool: (t: TakeoffTool) => void;
  setActiveColor: (c: string) => void;
  setActiveLabel: (l: string) => void;
  setActiveStrokeWidth: (w: number) => void;
  setLineStrokeWidth: (id: string, w: number) => void;
  setScalePreset: (pixelsPerFt: number) => void; // directly set scale from preset
  startCalibration: () => void;
  setCalibrationPoints: (pts: number[]) => void;
  finishCalibration: (ft: number) => void;
  cancelCalibration: () => void;
  addDrawingPoint: (x: number, y: number) => void;
  finishLine: () => void;
  cancelDrawing: () => void;
  renameLine: (id: string, label: string) => void;
  deleteLine: (id: string) => void;
  selectLine: (id: string | null) => void;
  selectSegment: (lineId: string, segIdx: number | null) => void;
  toggleSegmentCurved: (lineId: string, segIdx: number) => void;
  moveControlPoint: (lineId: string, segIdx: number, cpNum: 1 | 2, x: number, y: number) => void;
  moveVertex: (id: string, vertexIdx: number, x: number, y: number) => void;
  clearAll: () => void;
}

/** Build default (straight) segments for a points array. */
function buildSegments(pts: number[]): TakeoffSegment[] {
  const n = pts.length / 2;
  return Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
    const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const x2 = pts[(i + 1) * 2], y2 = pts[(i + 1) * 2 + 1];
    // Default control points sit 1/3 and 2/3 along the segment
    return {
      curved: false,
      cp1X: x1 + (x2 - x1) / 3, cp1Y: y1 + (y2 - y1) / 3,
      cp2X: x1 + (x2 - x1) * 2 / 3, cp2Y: y1 + (y2 - y1) * 2 / 3,
    };
  });
}

/** When enabling curve, offset cp1 and cp2 perpendicularly so the arc is immediately visible. */
function defaultCurvedCps(pts: number[], segIdx: number) {
  const x1 = pts[segIdx * 2], y1 = pts[segIdx * 2 + 1];
  const x2 = pts[(segIdx + 1) * 2], y2 = pts[(segIdx + 1) * 2 + 1];
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
  const offset = len * 0.25;
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len; // perpendicular unit vector
  return {
    cp1X: x1 + (x2 - x1) / 3 + nx * offset, cp1Y: y1 + (y2 - y1) / 3 + ny * offset,
    cp2X: x1 + (x2 - x1) * 2 / 3 + nx * offset, cp2Y: y1 + (y2 - y1) * 2 / 3 + ny * offset,
  };
}

export const useTakeoffStore = create<TakeoffState>((set, get) => ({
  pdfDataUrl: null,
  pdfFileName: null,
  pdfPage: 1,
  pdfTotalPages: 1,
  pdfLogicalW: 0,
  pdfLogicalH: 0,
  pdfBuffer: null,

  calibrating: false,
  calibrationPoints: [],
  calibrationFt: 50,
  pixelsPerFt: null,

  lines: [],
  drawingPoints: [],
  selectedLineId: null,
  selectedSegIdx: null,
  activeTool: 'draw',
  activeColor: '#f59e0b',
  activeLabel: 'Fence Line',
  activeStrokeWidth: 2,

  setPdf: (dataUrl, fileName, logicalW, logicalH, totalPages, buffer) =>
    set({ pdfDataUrl: dataUrl, pdfFileName: fileName, pdfLogicalW: logicalW, pdfLogicalH: logicalH, pdfTotalPages: totalPages, pdfPage: 1, pdfBuffer: buffer, lines: [], drawingPoints: [], pixelsPerFt: null }),

  setPdfPage: (page) => set({ pdfPage: page }),
  setPdfImage: (dataUrl) => set({ pdfDataUrl: dataUrl }), // logical size unchanged

  setActiveTool: (t) => set({ activeTool: t, drawingPoints: [], calibrating: t === 'calibrate', calibrationPoints: [] }),
  setActiveColor: (c) => set({ activeColor: c }),
  setActiveLabel: (l) => set({ activeLabel: l }),
  setActiveStrokeWidth: (w) => set({ activeStrokeWidth: w }),
  setScalePreset: (pxPerFt) => set({ pixelsPerFt: pxPerFt }),
  setLineStrokeWidth: (id, w) =>
    set(s => ({ lines: s.lines.map(l => l.id === id ? { ...l, strokeWidth: w } : l) })),

  startCalibration: () => set({ calibrating: true, activeTool: 'calibrate', calibrationPoints: [], drawingPoints: [] }),
  setCalibrationPoints: (pts) => set({ calibrationPoints: pts }),

  finishCalibration: (ft) => {
    const { calibrationPoints } = get();
    if (calibrationPoints.length < 4) return;
    const dx = calibrationPoints[2] - calibrationPoints[0];
    const dy = calibrationPoints[3] - calibrationPoints[1];
    const px = Math.sqrt(dx * dx + dy * dy);
    if (px < 5) return;
    set({ pixelsPerFt: px / ft, calibrationFt: ft, calibrating: false, calibrationPoints: [], activeTool: 'draw' });
  },

  cancelCalibration: () => set({ calibrating: false, calibrationPoints: [], activeTool: 'draw' }),

  addDrawingPoint: (x, y) => set(s => ({ drawingPoints: [...s.drawingPoints, x, y] })),

  finishLine: () => {
    const { drawingPoints, lines, activeColor, activeLabel, activeStrokeWidth, pdfPage } = get();
    if (drawingPoints.length < 4) { set({ drawingPoints: [] }); return; }
    const newLine: TakeoffLine = {
      id: crypto.randomUUID(),
      page: pdfPage,
      points: [...drawingPoints],
      color: activeColor,
      label: activeLabel,
      strokeWidth: activeStrokeWidth,
      segments: buildSegments(drawingPoints),
    };
    set({ lines: [...lines, newLine], drawingPoints: [] });
  },

  cancelDrawing: () => set({ drawingPoints: [] }),

  renameLine: (id, label) =>
    set(s => ({ lines: s.lines.map(l => l.id === id ? { ...l, label } : l) })),

  deleteLine: (id) =>
    set(s => ({
      lines: s.lines.filter(l => l.id !== id),
      selectedLineId: s.selectedLineId === id ? null : s.selectedLineId,
      selectedSegIdx: s.selectedLineId === id ? null : s.selectedSegIdx,
    })),

  selectLine: (id) => set({ selectedLineId: id, selectedSegIdx: null }),

  selectSegment: (lineId, segIdx) =>
    set({ selectedLineId: lineId, selectedSegIdx: segIdx }),

  toggleSegmentCurved: (lineId, segIdx) =>
    set(s => ({
      lines: s.lines.map(l => {
        if (l.id !== lineId) return l;
        const segs = l.segments.map((seg, i) => {
          if (i !== segIdx) return seg;
          if (!seg.curved) {
            const cps = defaultCurvedCps(l.points, segIdx);
            return { ...seg, curved: true, ...cps };
          }
          return { ...seg, curved: false };
        });
        return { ...l, segments: segs };
      }),
    })),

  moveControlPoint: (lineId, segIdx, cpNum, x, y) =>
    set(s => ({
      lines: s.lines.map(l => {
        if (l.id !== lineId) return l;
        const segs = l.segments.map((seg, i) => {
          if (i !== segIdx) return seg;
          return cpNum === 1 ? { ...seg, cp1X: x, cp1Y: y } : { ...seg, cp2X: x, cp2Y: y };
        });
        return { ...l, segments: segs };
      }),
    })),

  moveVertex: (id, vertexIdx, x, y) =>
    set(s => ({
      lines: s.lines.map(l => {
        if (l.id !== id) return l;
        const pts = [...l.points];
        pts[vertexIdx * 2]     = x;
        pts[vertexIdx * 2 + 1] = y;
        // Recompute control points for straight segments that touch this vertex
        const segs = l.segments.map((seg, i) => {
          if (seg.curved) return seg;
          const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
          const x2 = pts[(i + 1) * 2], y2 = pts[(i + 1) * 2 + 1];
          return {
            ...seg,
            cp1X: x1 + (x2 - x1) / 3, cp1Y: y1 + (y2 - y1) / 3,
            cp2X: x1 + (x2 - x1) * 2 / 3, cp2Y: y1 + (y2 - y1) * 2 / 3,
          };
        });
        return { ...l, points: pts, segments: segs };
      }),
    })),

  clearAll: () => set({ lines: [], drawingPoints: [], selectedLineId: null, selectedSegIdx: null, pixelsPerFt: null, calibrationPoints: [] }),
}));
