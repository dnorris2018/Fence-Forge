import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect, Shape, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import * as pdfjsLib from 'pdfjs-dist';
import { useTakeoffStore } from '../../store/takeoffStore';
import { CalibrationDialog } from './CalibrationDialog';

type PdfSnapKind = 'endpoint' | 'midpoint';
interface PdfSnapTarget { pt: [number, number]; kind: PdfSnapKind }

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

import type { TakeoffSegment } from '../../store/takeoffStore';

function totalLengthFt(pts: number[], segs: TakeoffSegment[], pixelsPerFt: number | null): number {
  if (!pixelsPerFt || pts.length < 4) return 0;
  let total = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const x2 = pts[(i + 1) * 2], y2 = pts[(i + 1) * 2 + 1];
    const seg = segs[i];
    if (seg?.curved) {
      // Approximate cubic bezier arc length
      let px = x1, py = y1, len = 0;
      for (let t = 1; t <= 20; t++) {
        const u = t / 20;
        const bx = (1-u)**3*x1 + 3*(1-u)**2*u*seg.cp1X + 3*(1-u)*u**2*seg.cp2X + u**3*x2;
        const by = (1-u)**3*y1 + 3*(1-u)**2*u*seg.cp1Y + 3*(1-u)*u**2*seg.cp2Y + u**3*y2;
        len += Math.sqrt((bx-px)**2 + (by-py)**2);
        px = bx; py = by;
      }
      total += len;
    } else {
      total += Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    }
  }
  return total / pixelsPerFt;
}


function lineMidpoint(pts: number[]): [number, number] {
  if (pts.length < 4) return [pts[0] ?? 0, pts[1] ?? 0];
  return [(pts[0] + pts[pts.length - 2]) / 2, (pts[1] + pts[pts.length - 1]) / 2];
}

export function TakeoffCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  // PDF rendered to an offscreen canvas displayed as a Konva Image — no separate HTML canvas needed
  const [pdfImage, setPdfImage] = useState<HTMLCanvasElement | null>(null);
  const [pdfImageRect, setPdfImageRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const renderingRef = useRef(false);
  const SNAP_RADIUS_SCREEN = 16;

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [cursorPt, setCursorPt] = useState<[number, number] | null>(null);
  const [snapTarget, setSnapTarget] = useState<[number, number] | null>(null);
  const [pdfSnap, setPdfSnap] = useState<PdfSnapTarget | null>(null);
  const [showCalibDialog, setShowCalibDialog] = useState(false);
  const pdfEndpointsRef = useRef<Float32Array>(new Float32Array(0));
  const pdfMidpointsRef = useRef<Float32Array>(new Float32Array(0));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: 800, height: 600 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const draggingVertex = useRef<{ lineId: string; vertexIdx: number } | null>(null);
  const draggingCP = useRef<{ lineId: string; segIdx: number; cpNum: 1 | 2 } | null>(null);

  const {
    pdfLogicalW, pdfLogicalH, pdfBuffer, pdfPage,
    activeTool, calibrating, calibrationPoints,
    drawingPoints, lines, selectedLineId, selectedSegIdx, pixelsPerFt,
    activeColor,
    addDrawingPoint, finishLine,
    setCalibrationPoints, selectLine, selectSegment, deleteLine, moveVertex, moveControlPoint,
  } = useTakeoffStore();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      sizeRef.current = { width, height };
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep refs in sync so renderPdfToCanvas always sees latest values
  sizeRef.current = size;
  panRef.current = pan;
  zoomRef.current = zoom;

  // Cached PDF.js document — parsed once per buffer/page, never re-parsed on zoom
  const pdfPageRef = useRef<pdfjsLib.PDFPageProxy | null>(null);
  const isFirstLoad = useRef(true);

  // Cache the parsed PDF document — only re-parse when the file changes, NOT on zoom/page change
  const pdfDocCacheRef = useRef<{ buffer: ArrayBuffer; doc: pdfjsLib.PDFDocumentProxy } | null>(null);

  // Load document when buffer changes; load page when buffer OR page changes
  useEffect(() => {
    if (!pdfBuffer || pdfLogicalW === 0) {
      pdfPageRef.current = null;
      pdfDocCacheRef.current = null;
      setPdfImage(null);
      isFirstLoad.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Re-use cached doc if buffer hasn't changed
        let doc = pdfDocCacheRef.current?.buffer === pdfBuffer ? pdfDocCacheRef.current!.doc : null;
        if (!doc) {
          const copy = pdfBuffer.slice(0);
          doc = await pdfjsLib.getDocument({ data: copy }).promise;
          if (cancelled) return;
          pdfDocCacheRef.current = { buffer: pdfBuffer, doc };
        }
        const page = await doc.getPage(pdfPage);
        if (cancelled) return;
        pdfPageRef.current = page;
        // Fit to container only on first load of a new file
        if (containerRef.current && isFirstLoad.current) {
          isFirstLoad.current = false;
          const { width, height } = containerRef.current.getBoundingClientRect();
          const s = Math.min(width / pdfLogicalW, height / pdfLogicalH) * 0.95;
          setZoom(s);
          setPan({ x: (width - pdfLogicalW * s) / 2, y: (height - pdfLogicalH * s) / 2 });
        }
        // Extract vector snap points from PDF content
        if (!cancelled) extractPdfSnapPoints(page);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [pdfBuffer, pdfPage, pdfLogicalW, pdfLogicalH]);

  const extractPdfSnapPoints = useCallback(async (page: pdfjsLib.PDFPageProxy) => {
    pdfEndpointsRef.current = new Float32Array(0);
    pdfMidpointsRef.current = new Float32Array(0);
    try {
      // Viewport transform at scale=1 maps PDF user space → canvas world coords.
      // Standard portrait: canvasX = x, canvasY = logicalH - y.
      // We read the actual viewport transform to handle rotated pages.
      const vp = page.getViewport({ scale: 1 });
      const [a, b, c, d, e, f] = vp.transform;
      const toWorld = (x: number, y: number): [number, number] => [
        a * x + c * y + e,
        b * x + d * y + f,
      ];

      const opList = await page.getOperatorList();
      const { fnArray, argsArray } = opList;

      const endpoints: number[] = [];
      const midpoints: number[] = [];

      let curX = 0, curY = 0;
      let subX = 0, subY = 0;

      const onMoveTo = (x: number, y: number) => {
        const [wx, wy] = toWorld(x, y);
        endpoints.push(wx, wy);
        curX = x; curY = y; subX = x; subY = y;
      };
      const onLineTo = (x: number, y: number) => {
        const [mx, my] = toWorld((curX + x) / 2, (curY + y) / 2);
        const [wx, wy] = toWorld(x, y);
        midpoints.push(mx, my);
        endpoints.push(wx, wy);
        curX = x; curY = y;
      };
      const onCurveTo = (x: number, y: number) => {
        const [wx, wy] = toWorld(x, y);
        endpoints.push(wx, wy);
        curX = x; curY = y;
      };
      const onClosePath = () => {
        const [mx, my] = toWorld((curX + subX) / 2, (curY + subY) / 2);
        midpoints.push(mx, my);
        curX = subX; curY = subY;
      };

      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i];
        const args = argsArray[i] as number[] | [number[], number[]];

        if (fn === pdfjsLib.OPS.constructPath) {
          // Batched: args = [opCodes[], coords[]]
          const ops = (args as [number[], number[]])[0];
          const coords = (args as [number[], number[]])[1];
          let ci = 0;
          for (const op of ops) {
            if (op === pdfjsLib.OPS.moveTo) {
              onMoveTo(coords[ci++], coords[ci++]);
            } else if (op === pdfjsLib.OPS.lineTo) {
              onLineTo(coords[ci++], coords[ci++]);
            } else if (op === pdfjsLib.OPS.curveTo) {
              ci += 4; onCurveTo(coords[ci++], coords[ci++]);
            } else if (op === pdfjsLib.OPS.curveTo2) {
              ci += 2; onCurveTo(coords[ci++], coords[ci++]);
            } else if (op === pdfjsLib.OPS.curveTo3) {
              ci += 2; onCurveTo(coords[ci++], coords[ci++]);
            } else if (op === pdfjsLib.OPS.closePath) {
              onClosePath();
            }
          }
        } else if (fn === pdfjsLib.OPS.moveTo) {
          const a2 = args as number[];
          onMoveTo(a2[0], a2[1]);
        } else if (fn === pdfjsLib.OPS.lineTo) {
          const a2 = args as number[];
          onLineTo(a2[0], a2[1]);
        } else if (fn === pdfjsLib.OPS.curveTo) {
          const a2 = args as number[];
          onCurveTo(a2[4], a2[5]);
        } else if (fn === pdfjsLib.OPS.closePath) {
          onClosePath();
        }
      }

      pdfEndpointsRef.current = new Float32Array(endpoints);
      pdfMidpointsRef.current = new Float32Array(midpoints);
    } catch { /* ignore — snap just won't use PDF content */ }
  }, []);

  // Render OVERSCAN× the screen area so short pans use CSS transform with no re-render.
  // Uses PDF.js offsetX/offsetY to shift into the overscan region. Always pixel-perfect.
  const renderPdfToCanvas = useCallback(async () => {
    if (!pdfPageRef.current) {
      let waited = 0;
      await new Promise<void>(resolve => {
        const t = setInterval(() => {
          waited += 50;
          if (pdfPageRef.current || waited >= 3000) { clearInterval(t); resolve(); }
        }, 50);
      });
    }
    const page = pdfPageRef.current;
    if (!page || pdfLogicalW === 0) return;
    if (renderingRef.current) return;
    renderingRef.current = true;
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch { /**/ } }
    try {
      const dpr = window.devicePixelRatio || 1;
      const rZoom = zoomRef.current;
      const rSize = sizeRef.current;
      // Cap canvas size to avoid browser limits (~16k px). At high zoom render only the
      // visible viewport (+ 50% overscan) so the canvas stays manageable.
      const MAX_PX = 6000;
      const fullW = pdfLogicalW * rZoom * dpr;
      const fullH = pdfLogicalH * rZoom * dpr;

      let offscreen: HTMLCanvasElement;
      let imgX = 0, imgY = 0, imgW = pdfLogicalW, imgH = pdfLogicalH;

      if (fullW <= MAX_PX && fullH <= MAX_PX) {
        // Full page fits — render everything at current zoom
        const scale = rZoom * dpr;
        const viewport = page.getViewport({ scale });
        offscreen = document.createElement('canvas');
        offscreen.width  = Math.round(fullW);
        offscreen.height = Math.round(fullH);
        const task = page.render({ canvasContext: offscreen.getContext('2d') as unknown as CanvasRenderingContext2D, viewport, canvas: offscreen });
        renderTaskRef.current = task;
        await task.promise;
        // imgX/imgY/imgW/imgH stay at (0,0,pdfLogicalW,pdfLogicalH)
      } else {
        // Zoomed in too close — render only the visible area + 50% overscan at screen resolution
        const rPan = panRef.current;
        const ovW = rSize.width  * 1.5;
        const ovH = rSize.height * 1.5;
        // Visible area in world coords
        const wx0 = (-rPan.x - rSize.width  * 0.25) / rZoom;
        const wy0 = (-rPan.y - rSize.height * 0.25) / rZoom;
        const wx1 = wx0 + ovW / rZoom;
        const wy1 = wy0 + ovH / rZoom;
        // Clamp to page bounds
        const cx0 = Math.max(0, wx0), cy0 = Math.max(0, wy0);
        const cx1 = Math.min(pdfLogicalW, wx1), cy1 = Math.min(pdfLogicalH, wy1);
        if (cx1 <= cx0 || cy1 <= cy0) { renderingRef.current = false; return; }
        const scale = rZoom * dpr;
        const offX = -(cx0 * scale);
        const offY = -(cy0 * scale);
        const canvW = Math.round((cx1 - cx0) * scale);
        const canvH = Math.round((cy1 - cy0) * scale);
        const viewport = page.getViewport({ scale, offsetX: offX, offsetY: offY });
        offscreen = document.createElement('canvas');
        offscreen.width  = canvW;
        offscreen.height = canvH;
        const task = page.render({ canvasContext: offscreen.getContext('2d') as unknown as CanvasRenderingContext2D, viewport, canvas: offscreen });
        renderTaskRef.current = task;
        await task.promise;
        imgX = cx0; imgY = cy0; imgW = cx1 - cx0; imgH = cy1 - cy0;
      }

      setPdfImage(offscreen);
      setPdfImageRect({ x: imgX, y: imgY, w: imgW, h: imgH });
    } catch { /* cancelled */ }
    renderingRef.current = false;
    renderTaskRef.current = null;
  }, [pdfLogicalW, pdfLogicalH]);

  // Re-render when zoom/pan settle (debounced 120ms) or page/buffer changes.
  useEffect(() => {
    if (pdfLogicalW === 0) return;
    const timer = setTimeout(() => renderPdfToCanvas(), 120);
    return () => clearTimeout(timer);
  }, [zoom, pan, pdfBuffer, pdfPage, pdfLogicalW, renderPdfToCanvas]);

  const stageToWorld = useCallback((sx: number, sy: number): [number, number] => {
    return [(sx - pan.x) / zoom, (sy - pan.y) / zoom];
  }, [pan, zoom]);

  /** Find the closest snap point within snap radius. User-drawn vertices take priority over PDF content. */
  const findSnapPoint = useCallback((wx: number, wy: number): { pt: [number, number]; kind: 'vertex' | PdfSnapKind } | null => {
    const snapRadiusWorld = SNAP_RADIUS_SCREEN / zoom;
    let best: { pt: [number, number]; kind: 'vertex' | PdfSnapKind } | null = null;
    let bestDist = snapRadiusWorld;

    const check = (vx: number, vy: number, kind: 'vertex' | PdfSnapKind) => {
      const d = Math.sqrt((vx - wx) ** 2 + (vy - wy) ** 2);
      if (d < bestDist) { bestDist = d; best = { pt: [vx, vy], kind }; }
    };

    // Snap to vertices of completed lines (highest priority)
    for (const line of lines) {
      const n = line.points.length / 2;
      for (let i = 0; i < n; i++) check(line.points[i * 2], line.points[i * 2 + 1], 'vertex');
    }

    // Snap to in-progress points — skip the LAST point (that's where cursor is)
    const dp = useTakeoffStore.getState().drawingPoints;
    const dn = dp.length / 2;
    for (let i = 0; i < dn - 1; i++) check(dp[i * 2], dp[i * 2 + 1], 'vertex');

    // Snap to PDF content endpoints
    const eps = pdfEndpointsRef.current;
    for (let i = 0; i < eps.length - 1; i += 2) check(eps[i], eps[i + 1], 'endpoint');

    // Snap to PDF content midpoints (lower priority — only if no endpoint is closer)
    const mps = pdfMidpointsRef.current;
    for (let i = 0; i < mps.length - 1; i += 2) check(mps[i], mps[i + 1], 'midpoint');

    return best;
  }, [lines, zoom]);

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const [wx, wy] = stageToWorld(pos.x, pos.y);

    if (activeTool === 'select' || e.evt.button === 1) {
      isPanning.current = true;
      lastPan.current = { x: pos.x - pan.x, y: pos.y - pan.y };
      return;
    }
    if (activeTool === 'draw') {
      if (e.evt.button === 2) { finishLine(); return; }
      const snap = findSnapPoint(wx, wy);
      addDrawingPoint(snap ? snap.pt[0] : wx, snap ? snap.pt[1] : wy);
    }
    if (calibrating) {
      if (e.evt.button === 2) { useTakeoffStore.getState().cancelCalibration(); return; }
      const pts = calibrationPoints;
      if (pts.length === 0) {
        setCalibrationPoints([wx, wy, wx, wy]);
      } else {
        setCalibrationPoints([pts[0], pts[1], wx, wy]);
        setShowCalibDialog(true);
      }
    }
  }

  function handleMouseMove(_e: Konva.KonvaEventObject<MouseEvent>) {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const [wx, wy] = stageToWorld(pos.x, pos.y);

    // Snap detection (only while drawing)
    if (activeTool === 'draw') {
      const snap = findSnapPoint(wx, wy);
      if (snap) {
        setSnapTarget(snap.kind === 'vertex' ? snap.pt : null);
        setPdfSnap(snap.kind !== 'vertex' ? { pt: snap.pt, kind: snap.kind } : null);
        setCursorPt(snap.pt);
      } else {
        setSnapTarget(null);
        setPdfSnap(null);
        setCursorPt([wx, wy]);
      }
    } else {
      setSnapTarget(null);
      setPdfSnap(null);
      setCursorPt([wx, wy]);
    }

    if (isPanning.current) {
      const newPan = { x: pos.x - lastPan.current.x, y: pos.y - lastPan.current.y };
      setPan(newPan);
      panRef.current = newPan;
    }
    if (draggingVertex.current) {
      moveVertex(draggingVertex.current.lineId, draggingVertex.current.vertexIdx, wx, wy);
    }
    if (draggingCP.current) {
      const { lineId, segIdx, cpNum } = draggingCP.current;
      moveControlPoint(lineId, segIdx, cpNum, wx, wy);
    }
    if (calibrating && calibrationPoints.length >= 2) {
      setCalibrationPoints([calibrationPoints[0], calibrationPoints[1], wx, wy]);
    }
  }

  function handleMouseUp() {
    isPanning.current = false;
    draggingVertex.current = null;
    draggingCP.current = null;
  }

  function handleDblClick() {
    if (activeTool === 'draw') finishLine();
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const delta = e.evt.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(50, zoom * delta));
    const newPan = {
      x: pos.x - (pos.x - pan.x) * (newZoom / zoom),
      y: pos.y - (pos.y - pan.y) * (newZoom / zoom),
    };
    zoomRef.current = newZoom;
    panRef.current  = newPan;
    setPan(newPan);
    setZoom(newZoom);

  }

  const inProgressPts = activeTool === 'draw'
    ? (drawingPoints.length >= 2 && cursorPt ? [...drawingPoints, cursorPt[0], cursorPt[1]] : drawingPoints)
    : (calibrating && calibrationPoints.length >= 4 ? calibrationPoints : []);

  const cursor = activeTool === 'select' ? 'default' : 'crosshair';

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative" style={{ cursor, backgroundColor: '#1a1f2e' }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        style={{ position: 'absolute', top: 0, left: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        onWheel={handleWheel}
        onContextMenu={e => e.evt.preventDefault()}
      >
        <Layer x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>

          {/* Dark background — always covers visible area regardless of pan/zoom */}
          <Rect
            x={-pan.x / zoom} y={-pan.y / zoom}
            width={size.width / zoom} height={size.height / zoom}
            fill="#1a1f2e" listening={false}
          />

          {/* PDF page rendered as Konva image in world coords */}
          {pdfImage && (
            <KonvaImage
              image={pdfImage}
              x={pdfImageRect.x} y={pdfImageRect.y}
              width={pdfImageRect.w} height={pdfImageRect.h}
              listening={false}
            />
          )}

          {lines.filter(l => l.page === pdfPage).map(line => {
            const ft = totalLengthFt(line.points, line.segments, pixelsPerFt);
            const [mx, my] = lineMidpoint(line.points);
            const isLineSelected = line.id === selectedLineId;
            const nVerts = line.points.length / 2;
            const nSegs = line.segments.length;

            return (
              <Group key={line.id}>

                {/* ── Render each segment individually ── */}
                {Array.from({ length: nSegs }, (_, si) => {
                  const x1 = line.points[si * 2], y1 = line.points[si * 2 + 1];
                  const x2 = line.points[(si + 1) * 2], y2 = line.points[(si + 1) * 2 + 1];
                  const seg = line.segments[si];
                  const isSegSelected = isLineSelected && selectedSegIdx === si;
                  const segColor = line.color;
                  // World-pixel stroke — Konva layer scale makes it proportional to content at all zooms
                  const baseSW = line.strokeWidth ?? 2;
                  const sw = isSegSelected ? baseSW + 2 / zoom : baseSW;

                  return (
                    <Group key={si}>
                      {/* Glow halo for selected segment */}
                      {isSegSelected && (
                        seg.curved ? (
                          <Shape
                            sceneFunc={(ctx, shape) => {
                              ctx.beginPath();
                              ctx.moveTo(x1, y1);
                              (ctx as unknown as CanvasRenderingContext2D).bezierCurveTo(seg.cp1X, seg.cp1Y, seg.cp2X, seg.cp2Y, x2, y2);
                              ctx.strokeShape(shape);
                            }}
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth={10 / zoom}
                            lineCap="round"
                            listening={false}
                          />
                        ) : (
                          <Line
                            points={[x1, y1, x2, y2]}
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth={10 / zoom}
                            lineCap="round"
                            listening={false}
                          />
                        )
                      )}

                      {/* Invisible wide hit area */}
                      <Shape
                        sceneFunc={(ctx) => {
                          ctx.beginPath();
                          ctx.moveTo(x1, y1);
                          if (seg.curved) {
                            (ctx as unknown as CanvasRenderingContext2D).bezierCurveTo(seg.cp1X, seg.cp1Y, seg.cp2X, seg.cp2Y, x2, y2);
                          } else {
                            ctx.lineTo(x2, y2);
                          }
                        }}
                        stroke="transparent"
                        strokeWidth={18 / zoom}
                        onClick={e => { e.cancelBubble = true; selectSegment(line.id, si); }}
                      />

                      {/* Visible segment */}
                      {seg.curved ? (
                        <Shape
                          sceneFunc={(ctx, shape) => {
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            (ctx as unknown as CanvasRenderingContext2D).bezierCurveTo(seg.cp1X, seg.cp1Y, seg.cp2X, seg.cp2Y, x2, y2);
                            ctx.strokeShape(shape);
                          }}
                          stroke={segColor}
                          strokeWidth={sw}
                          lineCap="round"
                          onClick={e => { e.cancelBubble = true; selectSegment(line.id, si); }}
                        />
                      ) : (
                        <Line
                          points={[x1, y1, x2, y2]}
                          stroke={segColor}
                          strokeWidth={sw}
                          lineCap="round"
                          onClick={e => { e.cancelBubble = true; selectSegment(line.id, si); }}
                        />
                      )}

                      {/* Selected curved segment: two control point handles */}
                      {isSegSelected && seg.curved && (
                        <Group>
                          {/* Arm lines: start→cp1 and cp2→end */}
                          <Line points={[x1, y1, seg.cp1X, seg.cp1Y]}
                            stroke={line.color} strokeWidth={1 / zoom}
                            dash={[4 / zoom, 3 / zoom]} opacity={0.7} />
                          <Line points={[seg.cp2X, seg.cp2Y, x2, y2]}
                            stroke={line.color} strokeWidth={1 / zoom}
                            dash={[4 / zoom, 3 / zoom]} opacity={0.7} />

                          {/* CP1 diamond (near start) */}
                          <Rect
                            x={seg.cp1X} y={seg.cp1Y}
                            width={9 / zoom} height={9 / zoom}
                            fill="#fff" stroke={line.color} strokeWidth={2 / zoom}
                            offsetX={4.5 / zoom} offsetY={4.5 / zoom}
                            rotation={45}
                            draggable
                            onMouseDown={e => { e.cancelBubble = true; draggingCP.current = { lineId: line.id, segIdx: si, cpNum: 1 }; }}
                            onDragMove={e => {
                              e.cancelBubble = true;
                              const pos = stageRef.current?.getPointerPosition();
                              if (!pos) return;
                              const [wx, wy] = stageToWorld(pos.x, pos.y);
                              moveControlPoint(line.id, si, 1, wx, wy);
                              e.target.x(seg.cp1X); e.target.y(seg.cp1Y);
                            }}
                            onDragEnd={() => { draggingCP.current = null; }}
                          />

                          {/* CP2 diamond (near end) */}
                          <Rect
                            x={seg.cp2X} y={seg.cp2Y}
                            width={9 / zoom} height={9 / zoom}
                            fill="#fff" stroke={line.color} strokeWidth={2 / zoom}
                            offsetX={4.5 / zoom} offsetY={4.5 / zoom}
                            rotation={45}
                            draggable
                            onMouseDown={e => { e.cancelBubble = true; draggingCP.current = { lineId: line.id, segIdx: si, cpNum: 2 }; }}
                            onDragMove={e => {
                              e.cancelBubble = true;
                              const pos = stageRef.current?.getPointerPosition();
                              if (!pos) return;
                              const [wx, wy] = stageToWorld(pos.x, pos.y);
                              moveControlPoint(line.id, si, 2, wx, wy);
                              e.target.x(seg.cp2X); e.target.y(seg.cp2Y);
                            }}
                            onDragEnd={() => { draggingCP.current = null; }}
                          />
                        </Group>
                      )}

                      {/* Segment midpoint hit target (only when line selected, segment not selected) */}
                      {isLineSelected && !isSegSelected && (
                        <Circle
                          x={(x1 + x2) / 2} y={(y1 + y2) / 2}
                          radius={5 / zoom}
                          fill={line.color} opacity={0.4}
                          stroke={line.color} strokeWidth={1 / zoom}
                          onClick={e => { e.cancelBubble = true; selectSegment(line.id, si); }}
                        />
                      )}
                    </Group>
                  );
                })}

                {/* Footage label */}
                {pixelsPerFt && (
                  <>
                    <Rect
                      x={mx - 26 / zoom} y={my - 18 / zoom}
                      width={52 / zoom} height={14 / zoom}
                      fill="rgba(0,0,0,0.6)" cornerRadius={3 / zoom}
                    />
                    <Text
                      x={mx - 24 / zoom} y={my - 16 / zoom}
                      text={`${ft.toFixed(1)} ft`}
                      fontSize={10 / zoom} fill="#fff"
                      width={48 / zoom} align="center"
                    />
                  </>
                )}

                {/* Line click target (deselects segment, selects line) */}
                <Rect
                  x={mx - 20 / zoom} y={my + 0 / zoom}
                  width={40 / zoom} height={12 / zoom}
                  fill="transparent"
                  onClick={e => { e.cancelBubble = true; selectLine(isLineSelected ? null : line.id); }}
                />

                {/* When line is selected: vertex handles + delete */}
                {isLineSelected && (
                  <Group>
                    {Array.from({ length: nVerts }, (_, vi) => {
                      const vx = line.points[vi * 2];
                      const vy = line.points[vi * 2 + 1];
                      return (
                        <Circle
                          key={vi}
                          x={vx} y={vy}
                          radius={5 / zoom}
                          fill="#fff" stroke={line.color} strokeWidth={2 / zoom}
                          draggable
                          onMouseDown={e => { e.cancelBubble = true; draggingVertex.current = { lineId: line.id, vertexIdx: vi }; }}
                          onDragMove={e => {
                            e.cancelBubble = true;
                            const pos = stageRef.current?.getPointerPosition();
                            if (!pos) return;
                            const [wx, wy] = stageToWorld(pos.x, pos.y);
                            moveVertex(line.id, vi, wx, wy);
                            e.target.x(vx); e.target.y(vy);
                          }}
                          onDragEnd={() => { draggingVertex.current = null; }}
                        />
                      );
                    })}

                    {/* Delete button */}
                    <Group x={mx + 30 / zoom} y={my - 22 / zoom} onClick={() => deleteLine(line.id)}>
                      <Rect width={16 / zoom} height={16 / zoom} fill="#ef4444"
                        cornerRadius={3 / zoom} offsetX={8 / zoom} offsetY={8 / zoom} />
                      <Text text="✕" fontSize={10 / zoom} fill="#fff"
                        width={16 / zoom} align="center" offsetX={8 / zoom} offsetY={7 / zoom} />
                    </Group>
                  </Group>
                )}
              </Group>
            );
          })}

          {/* In-progress drawing */}
          {inProgressPts.length >= 4 && (
            <>
              <Line
                points={inProgressPts}
                stroke={calibrating ? '#22d3ee' : activeColor}
                strokeWidth={2 / zoom} dash={[6 / zoom, 3 / zoom]} lineCap="round"
              />
              <Circle x={inProgressPts[0]} y={inProgressPts[1]}
                radius={4 / zoom} fill={calibrating ? '#22d3ee' : activeColor} />
              {Array.from({ length: inProgressPts.length / 2 - 1 }, (_, i) => (
                <Circle key={i}
                  x={inProgressPts[(i + 1) * 2]} y={inProgressPts[(i + 1) * 2 + 1]}
                  radius={3 / zoom} fill={activeColor} opacity={0.7} />
              ))}

              {/* ── Live measurement labels (only when scale is calibrated) ── */}
              {(() => {
                if (!pixelsPerFt || calibrating) return null;
                const nPts = inProgressPts.length / 2;

                // Total length of all placed segments (all but the last cursor segment)
                let placedPx = 0;
                for (let i = 0; i < nPts - 2; i++) {
                  const dx = inProgressPts[(i+1)*2] - inProgressPts[i*2];
                  const dy = inProgressPts[(i+1)*2+1] - inProgressPts[i*2+1];
                  placedPx += Math.sqrt(dx*dx + dy*dy);
                }

                // Current rubber-band segment (second-to-last point → last point = cursor)
                const lx = inProgressPts[(nPts-2)*2];
                const ly = inProgressPts[(nPts-2)*2+1];
                const cx2 = inProgressPts[(nPts-1)*2];
                const cy2 = inProgressPts[(nPts-1)*2+1];
                const sdx = cx2 - lx, sdy = cy2 - ly;
                const segPx = Math.sqrt(sdx*sdx + sdy*sdy);
                const midX = (lx + cx2) / 2;
                const midY = (ly + cy2) / 2;
                const angle = Math.atan2(sdy, sdx) * 180 / Math.PI;

                const segFt    = segPx / pixelsPerFt;
                const totalFt  = (placedPx + segPx) / pixelsPerFt;
                const segTxt   = `${segFt.toFixed(1)}'`;
                const totalTxt = `Total: ${totalFt.toFixed(1)}'`;

                const fs  = 11 / zoom;
                const pad = 3 / zoom;
                const sw  = 60 / zoom;
                const sh  = fs + pad * 2;
                const tw  = 84 / zoom;

                return (
                  <>
                    {/* Segment length along rubber-band line */}
                    {segPx > 1 / zoom && (
                      <Group x={midX} y={midY} rotation={angle}>
                        <Rect x={-sw/2} y={-sh - 4/zoom} width={sw} height={sh}
                          fill="rgba(0,0,0,0.75)" cornerRadius={2/zoom} />
                        <Text text={segTxt} x={-sw/2} y={-sh - 4/zoom}
                          width={sw} height={sh} fontSize={fs}
                          fill="#fff" align="center" verticalAlign="middle" />
                      </Group>
                    )}
                    {/* Running total near cursor */}
                    <Group x={cx2 + 12/zoom} y={cy2 - 30/zoom}>
                      <Rect width={tw} height={sh}
                        fill="rgba(0,0,0,0.75)" cornerRadius={2/zoom} />
                      <Text text={totalTxt} width={tw} height={sh}
                        fontSize={fs} fill="#facc15"
                        align="center" verticalAlign="middle" />
                    </Group>
                  </>
                );
              })()}
            </>
          )}

          {calibrating && calibrationPoints.length >= 4 && (
            <>
              <Circle x={calibrationPoints[0]} y={calibrationPoints[1]} radius={5 / zoom} fill="#22d3ee" />
              <Circle x={calibrationPoints[2]} y={calibrationPoints[3]} radius={5 / zoom} fill="#22d3ee" />
            </>
          )}

          {/* Vertex snap — cyan ring */}
          {snapTarget && activeTool === 'draw' && (
            <Circle
              x={snapTarget[0]} y={snapTarget[1]}
              radius={SNAP_RADIUS_SCREEN / zoom}
              stroke="#22d3ee" strokeWidth={1.5 / zoom}
              fill="rgba(34,211,238,0.15)"
              listening={false}
            />
          )}
          {/* PDF content snap — endpoint: green square, midpoint: orange triangle indicator */}
          {pdfSnap && activeTool === 'draw' && (
            <>
              {pdfSnap.kind === 'endpoint' ? (
                <Rect
                  x={pdfSnap.pt[0]} y={pdfSnap.pt[1]}
                  width={10 / zoom} height={10 / zoom}
                  offsetX={5 / zoom} offsetY={5 / zoom}
                  stroke="#4ade80" strokeWidth={1.5 / zoom}
                  fill="rgba(74,222,128,0.2)"
                  listening={false}
                />
              ) : (
                <Circle
                  x={pdfSnap.pt[0]} y={pdfSnap.pt[1]}
                  radius={6 / zoom}
                  stroke="#fb923c" strokeWidth={1.5 / zoom}
                  fill="rgba(251,146,60,0.2)"
                  listening={false}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>

      {!pdfBuffer && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-500 text-sm">Upload a PDF drawing to begin</p>
        </div>
      )}

      {showCalibDialog && (
        <CalibrationDialog
          onConfirm={ft => {
            useTakeoffStore.getState().finishCalibration(ft);
            setShowCalibDialog(false);
          }}
          onCancel={() => {
            useTakeoffStore.getState().cancelCalibration();
            setShowCalibDialog(false);
          }}
        />
      )}
    </div>
  );
}
