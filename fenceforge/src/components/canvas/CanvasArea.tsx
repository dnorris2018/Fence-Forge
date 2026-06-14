import { useRef, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const { zoom, panX, panY, setZoom, setPan, gridVisible, snapSizeFt, snapEnabled, labelFontSize } = useUiStore();
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
      } else if (canvas.toolMode === 'draw-poly-object' && canvas.drawingPoints.length >= 6) {
        e.preventDefault();
        history.pushSnapshot(canvas.getSnapshot());
        const id = canvas.finishPolyObject();
        if (id) canvas.setSelection(id, 'object');
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

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 1 || toolMode === 'pan') {
      isPanning.current = true;
      lastPan.current = { x: e.evt.clientX, y: e.evt.clientY };
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

  function handleStageMouseUp() {
    isPanning.current = false;
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
          updateGate={toolMode === 'select' ? updateGate : undefined}
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
    </div>
  );
}
