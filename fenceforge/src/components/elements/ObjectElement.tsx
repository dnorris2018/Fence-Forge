import { useRef } from 'react';
import { Group, Ellipse, Path, Rect, Circle, Line, Shape } from 'react-konva';
import type Konva from 'konva';
import type { PlaceableObject, SegmentCurveData } from '../../types';
import { catmullRomSvgPath, mixedPolySvgPath } from '../../utils/curveUtils';
import { BushObject } from '../objects/BushObject';
import { TreeObject } from '../objects/TreeObject';
import { ShedObject } from '../objects/ShedObject';
import { ConcretePadObject } from '../objects/ConcretePadObject';
import { BrickWallObject } from '../objects/BrickWallObject';
import { FreeformPoolObject } from '../objects/FreeformPoolObject';
import { BuildingObject } from '../objects/BuildingObject';
import { HouseObject } from '../objects/HouseObject';
import { LabelTextBox } from '../objects/LabelTextObject';
import { MeasureLineElement } from '../objects/MeasureLineObject';
import { UtilityLineObject } from '../objects/UtilityLineObject';
import { UtilityPointObject } from '../objects/UtilityPointObject';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistoryStore } from '../../store/historyStore';

interface Props {
  obj: PlaceableObject;
  isSelected: boolean;
  onSelect: () => void;
  selectedPolySegment: number | null;
  onSelectSegment: (idx: number) => void;
}


export function ObjectElement({ obj, isSelected, onSelect, selectedPolySegment, onSelectSegment }: Props) {
  const didPushHistory = useRef(false);

  function saveHistory() {
    useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().getSnapshot());
  }

  function handleVertexDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    if (!didPushHistory.current) {
      saveHistory();
      didPushHistory.current = true;
    }
  }

  function handleVertexDragMove(vi: number, e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    const node = e.target as Konva.Circle;
    const newPoints = [...(obj.points ?? [])];
    newPoints[vi * 2]     = node.x();
    newPoints[vi * 2 + 1] = node.y();
    useCanvasStore.getState().updateObject(obj.id, { points: newPoints });
  }

  function handleVertexDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    didPushHistory.current = false;
  }

  function handleCpDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    if (!didPushHistory.current) {
      saveHistory();
      didPushHistory.current = true;
    }
  }

  function handleCpDragMove(segIdx: number, which: 'cp1' | 'cp2', e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    const node = e.target as Konva.Circle;
    const pts = obj.points!;
    const nv = pts.length / 2;
    const numSegs = obj.objectType === 'brick-wall' ? nv - 1 : nv;
    const cur = obj.segmentCurveData ?? [];
    const next: SegmentCurveData[] = Array.from({ length: numSegs }, (_, i) =>
      cur[i] ?? { curved: false, cp1X: 0, cp1Y: 0, cp2X: 0, cp2Y: 0 }
    );
    if (which === 'cp1') {
      next[segIdx] = { ...next[segIdx], cp1X: node.x(), cp1Y: node.y() };
    } else {
      next[segIdx] = { ...next[segIdx], cp2X: node.x(), cp2Y: node.y() };
    }
    useCanvasStore.getState().updateObject(obj.id, { segmentCurveData: next });
  }

  function handleCpDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    didPushHistory.current = false;
  }

  function handleDragStart() { saveHistory(); }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    useCanvasStore.getState().updateObject(obj.id, { x: e.target.x(), y: e.target.y() });
  }

  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Node;
    const scaleX = node.scaleX(), scaleY = node.scaleY();
    saveHistory();
    useCanvasStore.getState().updateObject(obj.id, {
      x:        node.x(),
      y:        node.y(),
      width:    Math.max(20, obj.width  * scaleX),
      height:   Math.max(20, obj.height * scaleY),
      rotation: node.rotation(),
    });
    node.scaleX(1); node.scaleY(1);
  }

  // ── Measure line — two independent world-coordinate endpoints, no bounding box ──
  if (obj.objectType === 'measure-line') {
    return <MeasureLineElement obj={obj} isSelected={isSelected} onSelect={onSelect} />;
  }

  // ── Utility lines (gas, internet) — poly-drawn open lines ────────────────
  if (obj.objectType === 'gas-line' || obj.objectType === 'internet-line' || obj.objectType === 'water-line') {
    return (
      <Group id={obj.id} x={obj.x} y={obj.y} draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={onSelect} onTap={onSelect}>
        <UtilityLineObject obj={obj} isSelected={isSelected} />
      </Group>
    );
  }

  // ── Utility points (power outlet, water spigot) — single-click placed ──
  if (obj.objectType === 'power-outlet' || obj.objectType === 'water-spigot') {
    return (
      <Group
        id={obj.id} x={obj.x} y={obj.y}
        width={obj.width} height={obj.height}
        rotation={obj.rotation}
        draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={onSelect} onTap={onSelect}
      >
        <UtilityPointObject
          width={obj.width} height={obj.height}
          objectType={obj.objectType}
          isSelected={isSelected}
        />
        <Rect x={0} y={0} width={obj.width} height={obj.height} fill="white" opacity={0.01} />
        {isSelected && (
          <Rect x={-2} y={-2} width={obj.width + 4} height={obj.height + 4}
            stroke="#FFD700" strokeWidth={2} dash={[6, 4]} fill="transparent" listening={false} />
        )}
      </Group>
    );
  }

  // ── Poly-drawn object (concrete-pad, brick-wall) ──────────────────
  if (obj.points && obj.points.length >= 4) {
    const pts = obj.points!;
    const nv = pts.length / 2;
    const segCurveData = obj.segmentCurveData ?? [];
    const hasSegCurves = segCurveData.some(s => s?.curved);

    // Brick wall: open polyline — relative points, Group handles position
    if (obj.objectType === 'brick-wall') {
      const numSegs = nv - 1;

      // Build outline path for brick-wall
      const wallPathData = hasSegCurves
        ? mixedPolySvgPath(pts, segCurveData, false)
        : pts.reduce((d, v, i) => {
            if (i % 2 !== 0) return d;
            return d + (i === 0 ? `M ${v} ${pts[i+1]}` : ` L ${v} ${pts[i+1]}`);
          }, '');

      return (
        <Group id={obj.id} x={obj.x} y={obj.y} draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={onSelect} onTap={onSelect}>
          <BrickWallObject points={pts} isSelected={isSelected} capSide={obj.capSide ?? 'top'} curved={obj.curved ?? true} segmentCurveData={hasSegCurves ? segCurveData : undefined} />

          {/* Invisible path overlay for hit detection */}
          <Path data={wallPathData} fill="rgba(0,0,0,0.001)" stroke="transparent" hitStrokeWidth={10} />

          {/* Segment hit areas — one per segment for segment selection */}
          {isSelected && Array.from({ length: numSegs }, (_, i) => {
            const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
            const x2 = pts[(i + 1) * 2], y2 = pts[(i + 1) * 2 + 1];
            const cd = segCurveData[i];
            if (cd?.curved) {
              return (
                <Shape key={`sh-${i}`}
                  sceneFunc={(ctx, shape) => {
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    (ctx as any).bezierCurveTo(cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
                    ctx.strokeShape(shape);
                  }}
                  stroke={selectedPolySegment === i ? '#FFD700' : 'transparent'}
                  strokeWidth={selectedPolySegment === i ? 3 : 1}
                  hitStrokeWidth={14}
                  onClick={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
                  onTap={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
                  onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; }}
                  onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
                />
              );
            }
            return (
              <Line key={`sh-${i}`}
                points={[x1, y1, x2, y2]}
                stroke={selectedPolySegment === i ? '#FFD700' : 'transparent'}
                strokeWidth={selectedPolySegment === i ? 3 : 1}
                hitStrokeWidth={14}
                onClick={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
                onTap={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
                onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; }}
                onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
              />
            );
          })}

          {/* Vertex handles */}
          {isSelected && pts.map((_, i) => {
            if (i % 2 !== 0) return null;
            const vi = i / 2;
            return (
              <Circle key={`v-${vi}`}
                x={pts[vi * 2]} y={pts[vi * 2 + 1]}
                radius={5} fill="#FFD700" stroke="#333" strokeWidth={1.5}
                draggable hitStrokeWidth={12}
                onDragStart={handleVertexDragStart}
                onDragMove={(e) => handleVertexDragMove(vi, e)}
                onDragEnd={handleVertexDragEnd}
                onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'move'; }}
                onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
              />
            );
          })}

          {/* CP handles for selected curved segment */}
          {isSelected && selectedPolySegment !== null && (() => {
            const cd = segCurveData[selectedPolySegment];
            if (!cd?.curved) return null;
            const si = selectedPolySegment;
            const sx1 = pts[si * 2], sy1 = pts[si * 2 + 1];
            const sx2 = pts[(si + 1) * 2], sy2 = pts[(si + 1) * 2 + 1];
            return (
              <>
                <Line points={[sx1, sy1, cd.cp1X, cd.cp1Y]} stroke="#60a5fa" strokeWidth={1} dash={[4, 3]} listening={false} />
                <Line points={[sx2, sy2, cd.cp2X, cd.cp2Y]} stroke="#60a5fa" strokeWidth={1} dash={[4, 3]} listening={false} />
                <Circle x={cd.cp1X} y={cd.cp1Y} radius={5} fill="#60a5fa" stroke="#1e40af" strokeWidth={1.5}
                  draggable hitStrokeWidth={12}
                  onDragStart={handleCpDragStart}
                  onDragMove={(e) => handleCpDragMove(si, 'cp1', e)}
                  onDragEnd={handleCpDragEnd}
                  onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'move'; }}
                  onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
                />
                <Circle x={cd.cp2X} y={cd.cp2Y} radius={5} fill="#60a5fa" stroke="#1e40af" strokeWidth={1.5}
                  draggable hitStrokeWidth={12}
                  onDragStart={handleCpDragStart}
                  onDragMove={(e) => handleCpDragMove(si, 'cp2', e)}
                  onDragEnd={handleCpDragEnd}
                  onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'move'; }}
                  onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
                />
              </>
            );
          })()}
        </Group>
      );
    }

    // Closed poly objects (concrete-pad, pool-freeform, building)
    const curved = obj.curved ?? false;
    const closed = true;
    const numSegs = nv;

    const pathData = hasSegCurves
      ? mixedPolySvgPath(pts, segCurveData, closed)
      : curved
        ? catmullRomSvgPath(pts, closed)
        : pts.reduce((d, v, i) => {
            if (i % 2 !== 0) return d;
            return d + (i === 0 ? `M ${v} ${pts[i+1]}` : ` L ${v} ${pts[i+1]}`);
          }, '') + ' Z';

    return (
      <Group
        id={obj.id}
        x={obj.x} y={obj.y}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={onSelect}
        onTap={onSelect}
      >
        {obj.objectType === 'concrete-pad'  && <ConcretePadObject   points={pts} curved={curved} segmentCurveData={hasSegCurves ? segCurveData : undefined} />}
        {obj.objectType === 'pool-freeform' && <FreeformPoolObject  points={pts} curved={curved} segmentCurveData={hasSegCurves ? segCurveData : undefined} />}
        {obj.objectType === 'building'      && <BuildingObject      points={pts} entranceEdge={obj.entranceEdge ?? 0} />}
        <Path
          data={pathData}
          fill="rgba(0,0,0,0.001)"
          stroke={isSelected ? '#FFD700' : 'transparent'}
          strokeWidth={isSelected ? 2 : 0}
          hitStrokeWidth={10}
        />

        {/* Segment hit areas for closed poly objects */}
        {isSelected && obj.objectType !== 'building' && Array.from({ length: numSegs }, (_, i) => {
          const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
          const x2 = pts[((i + 1) % nv) * 2], y2 = pts[((i + 1) % nv) * 2 + 1];
          const cd = segCurveData[i];
          if (cd?.curved) {
            return (
              <Shape key={`sh-${i}`}
                sceneFunc={(ctx, shape) => {
                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  (ctx as any).bezierCurveTo(cd.cp1X, cd.cp1Y, cd.cp2X, cd.cp2Y, x2, y2);
                  ctx.strokeShape(shape);
                }}
                stroke={selectedPolySegment === i ? '#FFD700' : 'rgba(0,0,0,0.001)'}
                strokeWidth={selectedPolySegment === i ? 3 : 1}
                hitStrokeWidth={14}
                onClick={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
                onTap={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
                onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; }}
                onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
              />
            );
          }
          return (
            <Line key={`sh-${i}`}
              points={[x1, y1, x2, y2]}
              stroke={selectedPolySegment === i ? '#FFD700' : 'rgba(0,0,0,0.001)'}
              strokeWidth={selectedPolySegment === i ? 3 : 1}
              hitStrokeWidth={14}
              onClick={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
              onTap={(e) => { e.cancelBubble = true; onSelectSegment(i); }}
              onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; }}
              onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
            />
          );
        })}

        {/* Vertex handles */}
        {isSelected && obj.objectType !== 'building' && pts.map((_, i) => {
          if (i % 2 !== 0) return null;
          const vi = i / 2;
          return (
            <Circle key={`v-${vi}`}
              x={pts[vi * 2]} y={pts[vi * 2 + 1]}
              radius={5} fill="#FFD700" stroke="#333" strokeWidth={1.5}
              draggable hitStrokeWidth={12}
              onDragStart={handleVertexDragStart}
              onDragMove={(e) => handleVertexDragMove(vi, e)}
              onDragEnd={handleVertexDragEnd}
              onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'move'; }}
              onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
            />
          );
        })}

        {/* CP handles for selected curved segment */}
        {isSelected && selectedPolySegment !== null && (() => {
          const cd = segCurveData[selectedPolySegment];
          if (!cd?.curved) return null;
          const si = selectedPolySegment;
          const sx1 = pts[si * 2], sy1 = pts[si * 2 + 1];
          const sx2 = pts[((si + 1) % nv) * 2], sy2 = pts[((si + 1) % nv) * 2 + 1];
          return (
            <>
              <Line points={[sx1, sy1, cd.cp1X, cd.cp1Y]} stroke="#60a5fa" strokeWidth={1} dash={[4, 3]} listening={false} />
              <Line points={[sx2, sy2, cd.cp2X, cd.cp2Y]} stroke="#60a5fa" strokeWidth={1} dash={[4, 3]} listening={false} />
              <Circle x={cd.cp1X} y={cd.cp1Y} radius={5} fill="#60a5fa" stroke="#1e40af" strokeWidth={1.5}
                draggable hitStrokeWidth={12}
                onDragStart={handleCpDragStart}
                onDragMove={(e) => handleCpDragMove(si, 'cp1', e)}
                onDragEnd={handleCpDragEnd}
                onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'move'; }}
                onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
              />
              <Circle x={cd.cp2X} y={cd.cp2Y} radius={5} fill="#60a5fa" stroke="#1e40af" strokeWidth={1.5}
                draggable hitStrokeWidth={12}
                onDragStart={handleCpDragStart}
                onDragMove={(e) => handleCpDragMove(si, 'cp2', e)}
                onDragEnd={handleCpDragEnd}
                onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'move'; }}
                onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
              />
            </>
          );
        })()}
      </Group>
    );
  }

  // ── Rect / circle object (bush, tree, shed, …) ─────────────────────
  const hw = obj.width  / 2;
  const hh = obj.height / 2;

  return (
    <Group
      id={obj.id}
      x={obj.x} y={obj.y}
      width={obj.width} height={obj.height}
      rotation={obj.rotation}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      onClick={onSelect}
      onTap={onSelect}
    >
      {obj.objectType === 'bush'  && <BushObject  width={obj.width} height={obj.height} />}
      {obj.objectType === 'tree'  && <TreeObject  width={obj.width} height={obj.height} />}
      {obj.objectType === 'shed'  && <ShedObject  width={obj.width} height={obj.height} />}
      {obj.objectType === 'label-text' && (
        <LabelTextBox obj={obj} isSelected={isSelected} />
      )}
      {obj.objectType === 'house' && (
        <HouseObject
          width={obj.width} height={obj.height}
          houseStyle={obj.houseStyle ?? 'rectangle'}
          houseFlipX={obj.houseFlipX ?? false}
        />
      )}
      {/* Hit area — building without points is stale data, skip it so it can't be selected */}
      {obj.objectType !== 'building' && (
        obj.objectType === 'shed' || obj.objectType === 'house' || obj.objectType === 'label-text'
          ? <Rect x={0} y={0} width={obj.width} height={obj.height} fill="white" opacity={0.01} />
          : <Ellipse x={hw} y={hh} radiusX={hw} radiusY={hh} fill="white" opacity={0.01} />
      )}

      {/* Selection outline */}
      {isSelected && obj.objectType !== 'shed' && obj.objectType !== 'building' && obj.objectType !== 'house' && obj.objectType !== 'label-text' && (
        <Ellipse
          x={hw} y={hh}
          radiusX={hw + 2} radiusY={hh + 2}
          stroke="#FFD700" strokeWidth={2}
          dash={[6, 4]} fill="transparent"
          listening={false}
        />
      )}
      {isSelected && obj.objectType === 'house' && (
        <Rect
          x={-2} y={-2} width={obj.width + 4} height={obj.height + 4}
          stroke="#FFD700" strokeWidth={2}
          dash={[6, 4]} fill="transparent"
          listening={false}
        />
      )}
    </Group>
  );
}
