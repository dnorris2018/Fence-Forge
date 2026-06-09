import { Layer } from 'react-konva';
import type { Gate, FenceLine } from '../../types';
import type { SelectionType } from '../../types';
import { GateElement } from '../elements/GateElement';

interface Props {
  gates: Record<string, Gate>;
  fences: Record<string, FenceLine>;
  selectedId: string | null;
  selectedType: SelectionType;
  setSelection: (id: string | null, type: SelectionType) => void;
  updateGate?: (id: string, patch: Partial<Gate>) => void;
  onBeforeEdit?: () => void;
}

export function GateLayer({ gates, fences, selectedId, selectedType, setSelection, updateGate, onBeforeEdit }: Props) {
  return (
    <Layer>
      {Object.values(gates).map(gate => (
        <GateElement
          key={gate.id}
          gate={gate}
          fence={fences[gate.fenceId]}
          isSelected={selectedType === 'gate' && selectedId === gate.id}
          onSelect={() => setSelection(gate.id, 'gate')}
          updateGate={updateGate}
          onBeforeEdit={onBeforeEdit}
        />
      ))}
    </Layer>
  );
}
