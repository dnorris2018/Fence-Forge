import { Layer } from 'react-konva';
import type { PlaceableObject, SelectionType } from '../../types';
import { ObjectElement } from '../elements/ObjectElement';

interface Props {
  objects: Record<string, PlaceableObject>;
  selectedId: string | null;
  selectedType: SelectionType;
  setSelection: (id: string, type: SelectionType) => void;
}

export function ObjectLayer({ objects, selectedId, selectedType, setSelection }: Props) {
  return (
    <Layer>
      {Object.values(objects).map(obj => (
        <ObjectElement
          key={obj.id}
          obj={obj}
          isSelected={selectedType === 'object' && selectedId === obj.id}
          onSelect={() => setSelection(obj.id, 'object')}
        />
      ))}
    </Layer>
  );
}
