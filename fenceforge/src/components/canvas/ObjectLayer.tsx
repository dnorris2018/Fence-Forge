import { Layer } from 'react-konva';
import type { PlaceableObject, SelectionType } from '../../types';
import { ObjectElement } from '../elements/ObjectElement';
import { LabelTextArrow } from '../objects/LabelTextObject';

interface Props {
  objects: Record<string, PlaceableObject>;
  selectedId: string | null;
  selectedType: SelectionType;
  setSelection: (id: string, type: SelectionType) => void;
  selectedPolySegment: number | null;
  setSelectedPolySegment: (idx: number | null) => void;
}

export function ObjectLayer({ objects, selectedId, selectedType, setSelection, selectedPolySegment, setSelectedPolySegment }: Props) {
  const objList = Object.values(objects);
  return (
    <Layer>
      {/* Arrows rendered first (behind boxes) */}
      {objList.filter(o => o.objectType === 'label-text').map(obj => (
        <LabelTextArrow
          key={`arrow-${obj.id}`}
          obj={obj}
          isSelected={selectedType === 'object' && selectedId === obj.id}
        />
      ))}

      {objList.map(obj => (
        <ObjectElement
          key={obj.id}
          obj={obj}
          isSelected={selectedType === 'object' && selectedId === obj.id}
          onSelect={() => { setSelection(obj.id, 'object'); setSelectedPolySegment(null); }}
          selectedPolySegment={selectedType === 'object' && selectedId === obj.id ? selectedPolySegment : null}
          onSelectSegment={(idx) => { setSelection(obj.id, 'object'); setSelectedPolySegment(idx); }}
        />
      ))}
    </Layer>
  );
}
