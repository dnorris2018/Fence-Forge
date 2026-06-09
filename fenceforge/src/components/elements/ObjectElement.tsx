import { Group, Ellipse, Path, Rect } from 'react-konva';
import type Konva from 'konva';
import type { PlaceableObject } from '../../types';
import { catmullRomSvgPath } from '../../utils/curveUtils';
import { BushObject } from '../objects/BushObject';
import { TreeObject } from '../objects/TreeObject';
import { ShedObject } from '../objects/ShedObject';
import { ConcretePadObject } from '../objects/ConcretePadObject';
import { BrickWallObject } from '../objects/BrickWallObject';
import { FreeformPoolObject } from '../objects/FreeformPoolObject';
import { BuildingObject } from '../objects/BuildingObject';
import { HouseObject } from '../objects/HouseObject';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistoryStore } from '../../store/historyStore';

interface Props {
  obj: PlaceableObject;
  isSelected: boolean;
  onSelect: () => void;
}


export function ObjectElement({ obj, isSelected, onSelect }: Props) {
  function saveHistory() {
    useHistoryStore.getState().pushSnapshot(useCanvasStore.getState().getSnapshot());
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

  // ── Poly-drawn object (concrete-pad, brick-wall) ──────────────────
  if (obj.points && obj.points.length >= 4) {
    // Brick wall: open polyline — relative points, Group handles position
    if (obj.objectType === 'brick-wall') {
      return (
        <Group id={obj.id} x={obj.x} y={obj.y} draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={onSelect} onTap={onSelect}>
          <BrickWallObject points={obj.points} isSelected={isSelected} capSide={obj.capSide ?? 'top'} curved={obj.curved ?? true} />
        </Group>
      );
    }


    const curved = obj.curved ?? false;
    const closed = obj.objectType !== ('brick-wall' as string);
    const pts = obj.points!;
    const pathData = curved
      ? catmullRomSvgPath(pts, closed)
      : pts.reduce((d, v, i) => {
          if (i % 2 !== 0) return d;
          return d + (i === 0 ? `M ${v} ${pts[i+1]}` : ` L ${v} ${pts[i+1]}`);
        }, '') + (closed ? ' Z' : '');
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
        {obj.objectType === 'concrete-pad'  && <ConcretePadObject   points={obj.points} curved={curved} />}
        {obj.objectType === 'pool-freeform' && <FreeformPoolObject  points={obj.points} curved={curved} />}
        {obj.objectType === 'building'      && <BuildingObject      points={obj.points!} entranceEdge={obj.entranceEdge ?? 0} />}
        <Path
          data={pathData}
          fill="transparent"
          stroke={isSelected ? '#FFD700' : 'transparent'}
          strokeWidth={isSelected ? 2 : 0}
          hitStrokeWidth={10}
        />
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
      {obj.objectType === 'house' && (
        <HouseObject
          width={obj.width} height={obj.height}
          houseStyle={obj.houseStyle ?? 'rectangle'}
          houseFlipX={obj.houseFlipX ?? false}
        />
      )}
      {/* Hit area — building without points is stale data, skip it so it can't be selected */}
      {obj.objectType !== 'building' && (
        obj.objectType === 'shed' || obj.objectType === 'house'
          ? <Rect x={0} y={0} width={obj.width} height={obj.height} fill="white" opacity={0.01} />
          : <Ellipse x={hw} y={hh} radiusX={hw} radiusY={hh} fill="white" opacity={0.01} />
      )}

      {/* Selection outline */}
      {isSelected && obj.objectType !== 'shed' && obj.objectType !== 'building' && obj.objectType !== 'house' && (
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
