import { useEffect, useRef } from 'react';
import { Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { SelectionType } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';

interface Props {
  stageRef: React.RefObject<Konva.Stage | null>;
  selectedId: string | null;
  selectedType: SelectionType;
}

export function SelectionLayer({ stageRef, selectedId, selectedType }: Props) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (selectedType === 'object' && selectedId) {
      const obj = useCanvasStore.getState().objects[selectedId];
      // Attach Transformer only for rect-based objects (no polygon points, not a measure line)
      if (obj && !obj.points && obj.objectType !== 'measure-line') {
        const node = stage.findOne('#' + selectedId);
        if (node) {
          tr.nodes([node]);
          tr.getLayer()?.batchDraw();
          return;
        }
      }
    }

    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, selectedType]);

  return (
    <Layer>
      <Transformer
        ref={transformerRef}
        rotateEnabled
        enabledAnchors={[
          'top-left', 'top-center', 'top-right',
          'middle-left', 'middle-right',
          'bottom-left', 'bottom-center', 'bottom-right',
        ]}
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 20 || newBox.height < 20) return oldBox;
          return newBox;
        }}
      />
    </Layer>
  );
}
