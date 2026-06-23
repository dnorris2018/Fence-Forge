import { useRef, useEffect, useState, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { useUiStore } from '../../store/uiStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistoryStore } from '../../store/historyStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { CANVAS_BG } from '../../constants/canvas';
import { setGlobalStage } from '../../utils/stageRef';
import { GridLayer } from './GridLayer';
import { ObjectLayer } from './ObjectLayer';
import { FenceLayer } from './FenceLayer';
import { GateLayer } from './GateLayer';
import { DrawingLayer } from './DrawingLayer';
import { SelectionLayer } from './SelectionLayer';
import { ContextMenu, type MenuEntry } from '../ui/ContextMenu';
import { setClipboard, getClipboard } from '../../store/clipboard';
import { closestSegmentOnFence } from '../../utils/geometry';
import { nanoid } from 'nanoid';
import type { FenceCurveData, FenceHeight, FenceStyle } from '../../types';
import { HEIGHT_OPTIONS_MAP, STYLE_OPTIONS_MAP } from '../panels/FenceProperties';

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [ctxMenu, setCtxMenu] = useState<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const { zoom, panX, panY, setZoom, setPan, gridVisible, snapSizeFt, snapEnabled, labelFontSize, selectedPolySegment, setSelectedPolySegment } = useUiStore();
  const toolMode      = useCanvasStore(s => s.toolMode);
  const fences        = useCanvasStore(s => s.fences);
  const gates         = useCanvasStore(s => s.gates);
  const objects       = useCanvasStore(s => s.objects);
  const drawingPoints = useCanvasStore(s => s.drawingPoints);
  const cursorPoint   = useCanvasStore(s => s.cursorPoint);
  const activeFenceType  = useCanvasStore(s => s.activeFenceType);
  const activeObjectType = useCanvasStore(s => s.activeObjectType);
  const selectedId    = useCanvasStore(s => s.selectedId);
  const selectedType  = useCanvasStore(s => s.selectedType);
  const setSelection  = useCanvasStore(s => s.setSelection);
  const updateFence   = useCanvasStore(s => s.updateFence);
  const updateGate    = useCanvasStore(s => s.updateGate);

  useKeyboardShortcuts();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setGlobalStage(stageRef.current);
    return () => setGlobalStage(null);
  }, [stageRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const { handleMouseDown, handleMouseMove, handleDblClick } = useCanvasInteraction(stageRef);

  /** Push a history snapshot before any vertex-edit mutation */
  function handleBeforeEdit() {
    useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().getSnapshot());
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const canvas  = useCanvasStore.getState();
    const history = useHistoryStore.getState();

    // Undo — Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      const next = history.popUndo(canvas.getSnapshot());
      if (next) canvas.loadSnapshot(next);
      return;
    }

    // Redo — Ctrl+Y  or  Ctrl+Shift+Z
    if (
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      e.preventDefault();
      const next = history.popRedo(canvas.getSnapshot());
      if (next) canvas.loadSnapshot(next);
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Enter — finish drawing
    if (e.key === 'Enter') {
      if (canvas.toolMode === 'draw-fence' && canvas.drawingPoints.length >= 4) {
        e.preventDefault();
        history.pushSnapshot(canvas.getSnapshot());
        const id = canvas.finishDrawing();
        if (id) canvas.setSelection(id, 'fence');
        canvas.setToolMode('pan');
      } else if (canvas.toolMode === 'draw-poly-object' && canvas.drawingPoints.length >= 6) {
        e.preventDefault();
        history.pushSnapshot(canvas.getSnapshot());
        const id = canvas.finishPolyObject();
        if (id) canvas.setSelection(id, 'object');
        canvas.setToolMode('pan');
      }
      return;
    }

    // Escape — cancel drawing / clear selection
    if (e.key === 'Escape') {
      e.preventDefault();
      canvas.cancelDrawing();
      if (canvas.toolMode === 'draw-poly-object') canvas.setToolMode('select');
      canvas.clearSelection();
      return;
    }

    // Delete / Backspace — delete selected element
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const { selectedId, selectedType } = canvas;
      if (!selectedId) return;
      e.preventDefault();
      history.pushSnapshot(canvas.getSnapshot());
      if (selectedType === 'fence')  canvas.deleteFence(selectedId);
      if (selectedType === 'gate')   canvas.deleteGate(selectedId);
      if (selectedType === 'object') canvas.deleteObject(selectedId);
      canvas.clearSelection();
      return;
    }

    // Tool shortcuts
    const key = e.key.toLowerCase();
    if (key === 'v') { e.preventDefault(); canvas.cancelDrawing(); canvas.setToolMode('select');       return; }
    if (key === 'f') { e.preventDefault(); canvas.setToolMode('draw-fence');   useUiStore.getState().setSidebarTab('fences');  return; }
    if (key === 'o') { e.preventDefault(); canvas.setToolMode('place-object'); useUiStore.getState().setSidebarTab('objects'); return; }
    if (key === 'g') { e.preventDefault(); canvas.setToolMode('place-gate');   useUiStore.getState().setSidebarTab('fences');  return; }
    if (key === 'h') { e.preventDefault(); canvas.setToolMode('pan');          return; }
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.06;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = zoom;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    const mousePointTo = {
      x: (pointer.x - panX) / oldScale,
      y: (pointer.y - panY) / oldScale,
    };

    setZoom(newScale);
    setPan(pointer.x - mousePointTo.x * newScale, pointer.y - mousePointTo.y * newScale);
  }

  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const panStartPos = useRef({ x: 0, y: 0 });

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    // Middle-mouse always pans; pan tool pans only on background (stage) clicks so
    // gates and fence lines remain draggable/selectable in pan mode too.
    const clickedBackground = e.target === (e.target.getStage() as unknown);
    if (e.evt.button === 1 || (toolMode === 'pan' && clickedBackground)) {
      isPanning.current = true;
      lastPan.current = { x: e.evt.clientX, y: e.evt.clientY };
      panStartPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }
    handleMouseDown(e);
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (isPanning.current) {
      const dx = e.evt.clientX - lastPan.current.x;
      const dy = e.evt.clientY - lastPan.current.y;
      setPan(panX + dx, panY + dy);
      lastPan.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }
    handleMouseMove();
  }

  function handleStageMouseUp(e: Konva.KonvaEventObject<MouseEvent>) {
    if (isPanning.current && toolMode === 'pan') {
      const dx = e.evt.clientX - panStartPos.current.x;
      const dy = e.evt.clientY - panStartPos.current.y;
      // Click (no significant drag) — deselect
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        useCanvasStore.getState().clearSelection();
        setSelectedPolySegment(null);
      }
    }
    isPanning.current = false;
  }

  function handleContextMenu(e: Konva.KonvaEventObject<PointerEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;
    setCtxMenu({ sx: e.evt.clientX, sy: e.evt.clientY, wx: pos.x, wy: pos.y });
  }

  function buildMenuItems(): MenuEntry[] {
    const canvas = useCanvasStore.getState();
    const history = useHistoryStore.getState();
    const { selectedId, selectedType } = canvas;
    const clip = getClipboard();

    function pushHistory() {
      history.pushSnapshot(canvas.getSnapshot());
    }

    function doCopy() {
      if (!selectedId) return;
      if (selectedType === 'fence' && canvas.fences[selectedId]) {
        const { id: _id, ...data } = canvas.fences[selectedId];
        setClipboard({ kind: 'fence', data });
      } else if (selectedType === 'object' && canvas.objects[selectedId]) {
        const { id: _id, ...data } = canvas.objects[selectedId];
        setClipboard({ kind: 'object', data });
      } else if (selectedType === 'gate' && canvas.gates[selectedId]) {
        const { id: _id, ...data } = canvas.gates[selectedId];
        setClipboard({ kind: 'gate', data });
      }
    }

    function doCut() {
      doCopy();
      pushHistory();
      if (!selectedId) return;
      if (selectedType === 'fence')  canvas.deleteFence(selectedId);
      if (selectedType === 'object') canvas.deleteObject(selectedId);
      if (selectedType === 'gate')   canvas.deleteGate(selectedId);
      canvas.clearSelection();
    }

    function doPaste() {
      if (!clip) return;
      pushHistory();
      const OFFSET = 20;
      const wx = ctxMenu?.wx ?? 0, wy = ctxMenu?.wy ?? 0;
      if (clip.kind === 'fence') {
        const pts = clip.data.points.map((v, i) => v + (i % 2 === 0 ? OFFSET : OFFSET));
        const id = canvas.addFence(pts, clip.data.fenceType);
        canvas.updateFence(id, { ...clip.data, id, points: pts });
        canvas.setSelection(id, 'fence');
      } else if (clip.kind === 'object') {
        const id = nanoid();
        const obj = { ...clip.data, id, x: wx - clip.data.width / 2, y: wy - clip.data.height / 2 };
        useCanvasStore.setState(s => ({ objects: { ...s.objects, [id]: obj } }));
        canvas.setSelection(id, 'object');
      } else if (clip.kind === 'gate') {
        const id = canvas.addGate({ ...clip.data });
        canvas.setSelection(id, 'gate');
      }
    }

    const hasSelection = !!selectedId;
    const isFence = selectedType === 'fence' && !!selectedId;

    const items: MenuEntry[] = [
      { label: 'Cut',   shortcut: 'Ctrl+X', icon: '✂', disabled: !hasSelection, action: doCut },
      { label: 'Copy',  shortcut: 'Ctrl+C', icon: '⧉', disabled: !hasSelection, action: doCopy },
      { label: 'Paste', shortcut: 'Ctrl+V', icon: '📋', disabled: !clip,         action: doPaste },
      { separator: true },
      { label: 'Delete', shortcut: 'Del', icon: '🗑', disabled: !hasSelection, action: () => {
        if (!selectedId) return;
        pushHistory();
        if (selectedType === 'fence')  canvas.deleteFence(selectedId);
        if (selectedType === 'object') canvas.deleteObject(selectedId);
        if (selectedType === 'gate')   canvas.deleteGate(selectedId);
        canvas.clearSelection();
      }},
    ];

    if (isFence) {
      const fence = canvas.fences[selectedId];
      const numSegs = fence.points.length / 2 - 1;
      items.push({ separator: true });

      // Find segment closest to right-click
      const seg = ctxMenu ? closestSegmentOnFence(ctxMenu.wx, ctxMenu.wy, fence.points, fence.curveData) : null;
      const segIdx = seg?.segIndex ?? 0;
      const segIsCurved = fence.curveData?.[segIdx]?.curved ?? false;

      items.push({
        label: segIsCurved ? 'Straighten Segment' : 'Arc Segment',
        icon: '⌒',
        action: () => {
          pushHistory();
          const cur = fence.curveData ?? [];
          const next: FenceCurveData[] = Array.from({ length: numSegs }, (_, i) =>
            cur[i] ?? { curved: false, cp1X: 0, cp1Y: 0, cp2X: 0, cp2Y: 0 }
          );
          if (next[segIdx].curved) {
            next[segIdx] = { ...next[segIdx], curved: false };
          } else {
            const x1 = fence.points[segIdx * 2], y1 = fence.points[segIdx * 2 + 1];
            const x2 = fence.points[(segIdx + 1) * 2], y2 = fence.points[(segIdx + 1) * 2 + 1];
            const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx*dx+dy*dy);
            const perpX = len > 0 ? -dy/len : 0, perpY = len > 0 ? dx/len : 0;
            const offset = len * 0.25;
            next[segIdx] = { curved: true, cp1X: x1+dx/3+perpX*offset, cp1Y: y1+dy/3+perpY*offset, cp2X: x1+2*dx/3+perpX*offset, cp2Y: y1+2*dy/3+perpY*offset };
          }
          canvas.updateFence(selectedId, { curveData: next });
        },
      });

      const allCurved = Array.from({ length: numSegs }, (_, i) => fence.curveData?.[i]?.curved ?? false).every(Boolean);
      items.push({
        label: allCurved ? 'Straighten All' : 'Round All Corners',
        icon: '◯',
        action: () => {
          pushHistory();
          if (allCurved) {
            canvas.updateFence(selectedId, { curveData: undefined });
          } else {
            const next: FenceCurveData[] = Array.from({ length: numSegs }, (_, i) => {
              const cur = fence.curveData?.[i];
              if (cur?.curved) return cur;
              const x1 = fence.points[i*2], y1 = fence.points[i*2+1];
              const x2 = fence.points[(i+1)*2], y2 = fence.points[(i+1)*2+1];
              const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy);
              const perpX = len > 0 ? -dy/len : 0, perpY = len > 0 ? dx/len : 0;
              const offset = len * 0.25;
              return { curved: true, cp1X: x1+dx/3+perpX*offset, cp1Y: y1+dy/3+perpY*offset, cp2X: x1+2*dx/3+perpX*offset, cp2Y: y1+2*dy/3+perpY*offset };
            });
            canvas.updateFence(selectedId, { curveData: next });
          }
        },
      });

      items.push({
        label: 'Reset Caption Position',
        icon: '↺',
        disabled: !fence.finishLabelOffsets?.some(o => o?.x || o?.y),
        action: () => {
          pushHistory();
          canvas.updateFence(selectedId, { finishLabelOffsets: undefined });
        },
      });

      {
        const allHidden = Array.from({ length: numSegs }, (_, i) => fence.finishLabelHiddenSegs?.[i] ?? false);
        const hideSubmenu = [
          {
            label: allHidden.every(Boolean) ? 'Show All' : 'Hide All',
            icon: '👁',
            action: () => {
              pushHistory();
              const hide = !allHidden.every(Boolean);
              canvas.updateFence(selectedId, { finishLabelHiddenSegs: Array(numSegs).fill(hide) });
            },
          },
          ...(numSegs > 1 ? [{ separator: true as const }] : []),
          ...Array.from({ length: numSegs }, (_, i) => ({
            label: `${allHidden[i] ? 'Show' : 'Hide'} Segment ${i + 1}`,
            icon: allHidden[i] ? '○' : '●',
            action: () => {
              pushHistory();
              const next = [...allHidden];
              next[i] = !next[i];
              canvas.updateFence(selectedId, { finishLabelHiddenSegs: next });
            },
          })),
        ];
        items.push({
          label: 'Finish Side Label',
          icon: '👁',
          submenu: hideSubmenu,
        });
      }

      // Height submenu
      const heightOptions = HEIGHT_OPTIONS_MAP[fence.fenceType];
      if (heightOptions) {
        items.push({ separator: true });
        const currentH = fence.heightFt ?? heightOptions[0];
        items.push({
          label: `Height: ${currentH}'`,
          icon: '↕',
          submenu: heightOptions.map(h => ({
            label: `${h}'`,
            icon: currentH === h ? '✓' : ' ',
            action: () => { pushHistory(); canvas.updateFence(selectedId, { heightFt: h as FenceHeight }); },
          })),
        });
      }

      // Style submenu
      const styleOptions = STYLE_OPTIONS_MAP[fence.fenceType];
      if (styleOptions) {
        if (!heightOptions) items.push({ separator: true });
        const currentS = fence.fenceStyle ?? styleOptions[0].key;
        const currentSLabel = styleOptions.find(o => o.key === currentS)?.label ?? currentS;
        items.push({
          label: `Style: ${currentSLabel}`,
          icon: '▤',
          submenu: styleOptions.map(opt => ({
            label: opt.label,
            icon: currentS === opt.key ? '✓' : ' ',
            action: () => { pushHistory(); canvas.updateFence(selectedId, { fenceStyle: opt.key as FenceStyle }); },
          })),
        });
      }

      const getFinishSide = (i: number) => fence.finishSides?.[i] ?? fence.finishSide;
      const flipSegSubmenu = [
        {
          label: 'All Segments',
          icon: '↔',
          action: () => {
            pushHistory();
            canvas.updateFence(selectedId, { finishSide: fence.finishSide === 'left' ? 'right' : 'left', finishSides: undefined });
          },
        },
        ...(numSegs > 1 ? [{ separator: true as const }] : []),
        ...Array.from({ length: numSegs }, (_, i) => ({
          label: `Segment ${i + 1}`,
          icon: '↕',
          action: () => {
            pushHistory();
            const next = Array.from({ length: numSegs }, (_, j) => getFinishSide(j)) as ('left' | 'right')[];
            next[i] = getFinishSide(i) === 'left' ? 'right' : 'left';
            canvas.updateFence(selectedId, { finishSides: next });
          },
        })),
      ];

      items.push({ separator: true });
      items.push({
        label: 'Flip Finish Side',
        icon: '↔',
        submenu: flipSegSubmenu,
      });
    }

    return items;
  }

  const cursor =
    toolMode === 'pan'                                                                    ? 'grab' :
    toolMode === 'draw-fence' || toolMode === 'draw-poly-object' ? 'crosshair' :
    toolMode === 'place-object' || toolMode === 'place-gate'                              ? 'copy' :
    'default';

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden"
      style={{ background: CANVAS_BG, cursor, outline: 'none' }}
      tabIndex={-1}
      onMouseDown={() => containerRef.current?.focus()}
      onKeyDown={handleKeyDown}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={panX}
        y={panY}
        scaleX={zoom}
        scaleY={zoom}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={handleDblClick}
        onContextMenu={handleContextMenu}
      >
        <GridLayer
          width={size.width}
          height={size.height}
          zoom={zoom}
          panX={panX}
          panY={panY}
          snapSizeFt={snapSizeFt}
          gridVisible={gridVisible}
        />
        <ObjectLayer
          objects={objects}
          selectedId={selectedId}
          selectedType={selectedType}
          setSelection={setSelection}
          selectedPolySegment={selectedPolySegment}
          setSelectedPolySegment={setSelectedPolySegment}
        />
        <FenceLayer
          fences={fences}
          gates={gates}
          selectedId={selectedId}
          selectedType={selectedType}
          setSelection={setSelection}
          updateFence={updateFence}
          onBeforeEdit={handleBeforeEdit}
          snapEnabled={snapEnabled}
          snapSizeFt={snapSizeFt}
          labelFontSize={labelFontSize}
        />
        <GateLayer
          gates={gates}
          fences={fences}
          selectedId={selectedId}
          selectedType={selectedType}
          setSelection={setSelection}
          updateGate={toolMode === 'select' || toolMode === 'pan' ? updateGate : undefined}
          onBeforeEdit={handleBeforeEdit}
          labelFontSize={labelFontSize}
        />
        <DrawingLayer
          drawingPoints={drawingPoints}
          cursorPoint={cursorPoint}
          activeFenceType={activeFenceType}
          activeObjectType={activeObjectType}
          toolMode={toolMode}
          zoom={zoom}
        />
        <SelectionLayer
          stageRef={stageRef}
          selectedId={selectedId}
          selectedType={selectedType}
        />
      </Stage>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.sx}
          y={ctxMenu.sy}
          items={buildMenuItems()}
          onClose={closeCtxMenu}
        />
      )}
    </div>
  );
}
