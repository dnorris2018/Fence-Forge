import { useRef } from 'react';
import { Group, Line, Circle, Arc, Text } from 'react-konva';
import type Konva from 'konva';
import type { Gate, FenceLine } from '../../types';
import { getFinishSide } from '../../types';
import { FENCE_TYPES, getFenceColor } from '../../constants/fenceTypes';
import { computeGateGeometry } from '../../utils/gateGeometry';
import { closestSegmentOnFence } from '../../utils/geometry';

interface Props {
  gate: Gate;
  fence: FenceLine | undefined;
  isSelected: boolean;
  onSelect: () => void;
  updateGate?: (id: string, patch: Partial<Gate>) => void;
  onBeforeEdit?: () => void;
  labelFontSize?: number;
}

/** Project (x,y) onto the nearest point on the fence, honouring bezier curves */
function projectToFence(x: number, y: number, fence: FenceLine) {
  const result = closestSegmentOnFence(x, y, fence.points, fence.curveData);
  if (!result) return null;
  return { segIdx: result.segIndex, t: result.t, px: result.cx, py: result.cy };
}

export function GateElement({ gate, fence, isSelected, onSelect, updateGate, onBeforeEdit, labelFontSize = 11 }: Props) {
  const didPushHistory = useRef(false);
  const wasDragged = useRef(false);

  if (!fence) return null;

  const geo = computeGateGeometry(gate, fence.points, getFinishSide(fence, gate.segmentIndex), fence.curveData);
  if (!geo) return null;

  const def = FENCE_TYPES[gate.fenceType];
  if (!def) return null;
  // Gate panels take the color of the fence line they belong to
  const fenceColor = getFenceColor(fence);
  const color = isSelected ? '#FFD700' : fenceColor;
  const postColor = isSelected ? '#FFD700' : '#5A4A3A';
  const arcColor = '#888888';

  const isDouble = gate.gateType === 'double-swing';
  const canDrag = !!updateGate;

  function handleDragStart() {
    wasDragged.current = false;
    if (!didPushHistory.current) {
      onBeforeEdit?.();
      didPushHistory.current = true;
    }
  }

  function handleDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    if (!updateGate || !fence) return;
    wasDragged.current = true;
    const node = e.target as Konva.Group;
    // Use the actual pointer position in world coords — avoids stale closure issues
    // entirely (no dependence on gateCenterX/Y computed at render time)
    const stage = node.getStage();
    const pos = stage?.getRelativePointerPosition();
    if (pos) {
      const pt = projectToFence(pos.x, pos.y, fence);
      if (pt) updateGate(gate.id, { segmentIndex: pt.segIdx, positionT: pt.t });
    }
    // Reset group back to origin every frame
    node.position({ x: 0, y: 0 });
  }

  function handleDragEnd() {
    didPushHistory.current = false;
  }

  function handleClick() {
    if (!wasDragged.current) onSelect();
    wasDragged.current = false;
  }

  return (
    <Group
      draggable={canDrag}
      onClick={handleClick}
      onTap={onSelect}
      onDragStart={canDrag ? handleDragStart : undefined}
      onDragMove={canDrag ? handleDragMove : undefined}
      onDragEnd={canDrag ? handleDragEnd : undefined}
      onMouseEnter={canDrag ? (e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'move'; } : undefined}
      onMouseLeave={canDrag ? (e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; } : undefined}
    >
      {/* Hinge post */}
      <Circle
        x={geo.hingeX}
        y={geo.hingeY}
        radius={6}
        fill={postColor}
        stroke="#fff"
        strokeWidth={1}
        hitRadius={10}
      />

      {/* Latch post */}
      <Circle
        x={geo.latchX}
        y={geo.latchY}
        radius={6}
        fill={postColor}
        stroke="#fff"
        strokeWidth={1}
        hitRadius={10}
      />

      {/* Swing arc (dashed) — single gate */}
      {!isDouble && (
        <Arc
          x={geo.hingeX}
          y={geo.hingeY}
          innerRadius={geo.widthPx - 2}
          outerRadius={geo.widthPx + 2}
          angle={90}
          rotation={geo.arcStartAngle}
          stroke={arcColor}
          strokeWidth={1.5}
          dash={[5, 5]}
          fill="transparent"
          listening={false}
        />
      )}

      {/* Gate panel line — single */}
      {!isDouble && (
        <Line
          points={[geo.hingeX, geo.hingeY, geo.panelEndX, geo.panelEndY]}
          stroke={color}
          strokeWidth={def.strokeWidth}
          lineCap="round"
          hitStrokeWidth={12}
        />
      )}

      {/* Double gate: two panels */}
      {isDouble && (
        <>
          <Arc
            x={geo.hingeX}
            y={geo.hingeY}
            innerRadius={geo.widthPx / 2 - 2}
            outerRadius={geo.widthPx / 2 + 2}
            angle={90}
            rotation={geo.arcStartAngle}
            stroke={arcColor}
            strokeWidth={1.5}
            dash={[5, 5]}
            fill="transparent"
            listening={false}
          />
          <Arc
            x={geo.latchX}
            y={geo.latchY}
            innerRadius={geo.widthPx / 2 - 2}
            outerRadius={geo.widthPx / 2 + 2}
            angle={90}
            rotation={geo.arc2StartAngle}
            stroke={arcColor}
            strokeWidth={1.5}
            dash={[5, 5]}
            fill="transparent"
            listening={false}
          />
          <Line
            points={[geo.hingeX, geo.hingeY, geo.panelEnd1X, geo.panelEnd1Y]}
            stroke={color}
            strokeWidth={def.strokeWidth}
            lineCap="round"
            hitStrokeWidth={12}
          />
          <Line
            points={[geo.latchX, geo.latchY, geo.panelEnd2X, geo.panelEnd2Y]}
            stroke={color}
            strokeWidth={def.strokeWidth}
            lineCap="round"
            hitStrokeWidth={12}
          />
        </>
      )}

      {/* Hinge indicator bar */}
      <Line
        points={[
          geo.hingeX - Math.sin((geo.fenceAngleDeg * Math.PI) / 180) * 5,
          geo.hingeY + Math.cos((geo.fenceAngleDeg * Math.PI) / 180) * 5,
          geo.hingeX + Math.sin((geo.fenceAngleDeg * Math.PI) / 180) * 5,
          geo.hingeY - Math.cos((geo.fenceAngleDeg * Math.PI) / 180) * 5,
        ]}
        stroke={isSelected ? '#FFD700' : '#333'}
        strokeWidth={3}
        lineCap="round"
        listening={false}
      />

      {/* Metal frame — two parallel rails along each open leaf */}
      {gate.metalFrame && (() => {
        const frameColor = isSelected ? '#FFD700' : '#222';
        const railOffset = def.strokeWidth / 2 + 2;

        function leafRails(x1: number, y1: number, x2: number, y2: number) {
          const len = Math.hypot(x2 - x1, y2 - y1);
          if (len === 0) return null;
          const px = -(y2 - y1) / len * railOffset;
          const py = (x2 - x1) / len * railOffset;
          return (
            <>
              <Line points={[x1 + px, y1 + py, x2 + px, y2 + py]}
                stroke={frameColor} strokeWidth={2.5} lineCap="round" listening={false} />
              <Line points={[x1 - px, y1 - py, x2 - px, y2 - py]}
                stroke={frameColor} strokeWidth={2.5} lineCap="round" listening={false} />
            </>
          );
        }

        if (isDouble) {
          return (
            <>
              {leafRails(geo.hingeX, geo.hingeY, geo.panelEnd1X, geo.panelEnd1Y)}
              {leafRails(geo.latchX, geo.latchY, geo.panelEnd2X, geo.panelEnd2Y)}
            </>
          );
        }
        return leafRails(geo.hingeX, geo.hingeY, geo.panelEndX, geo.panelEndY);
      })()}

      {/* Gate width label — offset to the OPPOSITE side of the swing */}
      {(() => {
        const cx = (geo.hingeX + geo.latchX) / 2;
        const cy = (geo.hingeY + geo.latchY) / 2;
        const labelFlipped = geo.fenceAngleDeg > 90 || geo.fenceAngleDeg < -90;
        const labelAngle = labelFlipped ? geo.fenceAngleDeg + 180 : geo.fenceAngleDeg;
        const interiorSign = getFinishSide(fence, gate.segmentIndex) === 'left' ? -1 : 1;
        const swingSign = gate.swingDirection === 'inward' ? interiorSign : -interiorSign;
        const labelOffset = def.strokeWidth / 2 + labelFontSize + 1;
        const text = `${gate.widthFt}'`;
        return (
          <Text
            x={cx}
            y={cy}
            text={text}
            fontSize={labelFontSize}
            fontFamily="monospace"
            fill={isSelected ? '#FFD700' : '#444'}
            rotation={labelAngle}
            offsetX={text.length * (labelFontSize * 0.3)}
            offsetY={(labelFlipped ? -1 : 1) * swingSign * labelOffset}
            listening={false}
          />
        );
      })()}
    </Group>
  );
}
