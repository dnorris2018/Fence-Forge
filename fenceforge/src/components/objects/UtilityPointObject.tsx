import { Group, Circle, Rect, Text, Line } from 'react-konva';

interface Props {
  width: number;
  height: number;
  objectType: 'power-outlet' | 'water-spigot';
  isSelected: boolean;
}

export function UtilityPointObject({ width, height, objectType, isSelected }: Props) {
  const s = Math.min(width, height);
  const cx = s / 2, cy = s / 2;
  const sel = '#FFD700';

  if (objectType === 'power-outlet') {
    const r = s * 0.47;
    // Three filled shapes — arms taper from kink width to a point at each tip.
    // Vertical kink offsets give clean horizontal step edges with no diagonal protrusions.
    // Single 6-point polygon — horizontal kink offsets make this non-self-intersecting.
    // Outer kink corners protrude left/right (classic Z bolt look), tips are sharp points.
    const hw = s * 0.11;
    const klx = cx - s * 0.13, kly = cy - s * 0.04;
    const krx = cx + s * 0.13, kry = cy + s * 0.04;
    const utx = cx + s * 0.22, uty = cy - s * 0.37;
    const ltx = cx - s * 0.22, lty = cy + s * 0.37;
    return (
      <Group>
        <Circle x={cx} y={cy} radius={r} fill="#92400e"
          stroke={isSelected ? sel : '#78350f'}
          strokeWidth={isSelected ? 2.5 : 1.5} />
        <Line
          points={[
            utx,       uty,        // upper tip
            klx + hw,  kly,        // kink-left right side
            krx + hw,  kry,        // kink-right right side
            ltx,       lty,        // lower tip
            krx - hw,  kry,        // kink-right left side
            klx - hw,  kly,        // kink-left left side
          ]}
          closed fill="#fde047" strokeWidth={0} />
        <Text x={0} y={s + 3} text="POWER" fontSize={8} fontFamily="monospace" fontStyle="bold"
          fill={isSelected ? sel : '#92400e'} width={s} align="center" listening={false} />
      </Group>
    );
  }

  // Water Spigot — side-view hose bib
  const pipeW = s * 0.18, pipeColor = '#60a5fa';
  const borderColor = isSelected ? sel : '#1d4ed8';
  return (
    <Group>
      <Rect x={s * 0.41} y={s * 0.08} width={pipeW} height={s * 0.38}
        fill={pipeColor} stroke={borderColor} strokeWidth={1.5} />
      <Rect x={s * 0.28} y={s * 0.40} width={s * 0.44} height={pipeW}
        fill={pipeColor} stroke={borderColor} strokeWidth={1.5} />
      <Rect x={s * 0.18} y={s * 0.50} width={pipeW} height={s * 0.26}
        fill={pipeColor} stroke={borderColor} strokeWidth={1.5} cornerRadius={s * 0.04} />
      <Rect x={s * 0.30} y={s * 0.10} width={s * 0.40} height={s * 0.14}
        fill="#93c5fd" stroke={borderColor} strokeWidth={1.5} cornerRadius={s * 0.07} />
      <Circle x={s * 0.50} y={s * 0.17} radius={s * 0.055} fill={borderColor} />
      <Circle x={s * 0.27} y={s * 0.82} radius={s * 0.07} fill="#bfdbfe" stroke={borderColor} strokeWidth={1} />
      <Text x={0} y={s + 3} text="SPIGOT" fontSize={8} fontFamily="monospace" fontStyle="bold"
        fill={isSelected ? sel : '#1d4ed8'} width={s} align="center" listening={false} />
    </Group>
  );
}
