import { Group, Line, Text } from 'react-konva';
import type { PlaceableObject } from '../../types';
import { PIXELS_PER_FOOT } from '../../constants/canvas';

interface Props {
  obj: PlaceableObject;
  isSelected: boolean;
}

const STYLES: Record<string, { stroke: string; dash: number[]; label: string; labelColor: string }> = {
  'gas-line':      { stroke: '#f59e0b', dash: [12, 6], label: 'GAS',  labelColor: '#92400e' },
  'internet-line': { stroke: '#3b82f6', dash: [10, 5], label: 'DATA', labelColor: '#1e3a5f' },
  'water-line':    { stroke: '#06b6d4', dash: [8,  4], label: 'WATER', labelColor: '#164e63' },
};

export function UtilityLineObject({ obj, isSelected }: Props) {
  if (!obj.points || obj.points.length < 4) return null;
  const style = STYLES[obj.objectType as keyof typeof STYLES];
  if (!style) return null;

  const pts = obj.points;
  const strokeColor = isSelected ? '#FFD700' : style.stroke;
  const labelInterval = 8 * PIXELS_PER_FOOT;

  // Points are relative to the Group's x/y (obj.x/y is applied by the parent Group)
  const abs: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    abs.push({ x: pts[i], y: pts[i + 1] });
  }

  // Place labels at regular intervals along each segment
  const labels: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i < abs.length - 1; i++) {
    const ax = abs[i].x, ay = abs[i].y;
    const bx = abs[i + 1].x, by = abs[i + 1].y;
    const segLen = Math.hypot(bx - ax, by - ay);
    const angleDeg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    const displayAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;
    const count = Math.floor(segLen / labelInterval);
    for (let k = 1; k <= count; k++) {
      const t = (k / (count + 1));
      labels.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: displayAngle });
    }
  }

  const flatAbs = abs.flatMap(p => [p.x, p.y]);

  return (
    <Group>
      <Line
        points={flatAbs}
        stroke={strokeColor}
        strokeWidth={isSelected ? 4 : 3}
        dash={style.dash}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={14}
      />
      {labels.map((lbl, i) => (
        <Text
          key={i}
          x={lbl.x}
          y={lbl.y}
          text={style.label}
          fontSize={9}
          fontFamily="monospace"
          fontStyle="bold"
          fill={isSelected ? '#FFD700' : style.labelColor}
          rotation={lbl.angle}
          offsetX={style.label.length * 3}
          offsetY={10}
          listening={false}
        />
      ))}
    </Group>
  );
}
