import { Layer } from 'react-konva';
import type { FenceLine, Gate } from '../../types';
import type { SelectionType } from '../../types';
import { FenceSegment } from '../elements/FenceSegment';

interface Props {
  fences: Record<string, FenceLine>;
  gates: Record<string, Gate>;
  selectedId: string | null;
  selectedType: SelectionType;
  setSelection: (id: string | null, type: SelectionType) => void;
  updateFence: (id: string, patch: Partial<FenceLine>) => void;
  onBeforeEdit: () => void;
  snapEnabled: boolean;
  snapSizeFt: number;
}

export function FenceLayer({
  fences, gates, selectedId, selectedType, setSelection,
  updateFence, onBeforeEdit, snapEnabled, snapSizeFt,
}: Props) {
  const fenceList = Object.values(fences);

  return (
    <Layer>
      {fenceList.map(fence => {
        const fenceGates = Object.values(gates).filter(g => g.fenceId === fence.id);
        const isSelected = selectedType === 'fence' && selectedId === fence.id;

        // Vertices from all OTHER fences — used for vertex-snap while dragging
        const otherVertices: [number, number][] = isSelected
          ? fenceList
              .filter(f => f.id !== fence.id)
              .flatMap(f => {
                const verts: [number, number][] = [];
                for (let i = 0; i < f.points.length; i += 2) {
                  verts.push([f.points[i], f.points[i + 1]]);
                }
                return verts;
              })
          : [];

        return (
          <FenceSegment
            key={fence.id}
            fence={fence}
            gates={fenceGates}
            isSelected={isSelected}
            onSelect={() => setSelection(fence.id, 'fence')}
            updateFence={updateFence}
            onBeforeEdit={onBeforeEdit}
            snapEnabled={snapEnabled}
            snapSizeFt={snapSizeFt}
            otherVertices={otherVertices}
          />
        );
      })}
    </Layer>
  );
}
