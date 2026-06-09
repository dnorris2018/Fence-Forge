import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';

interface Props { objectId: string }

const LABELS: Record<string, string> = {
  'concrete-pad':  'Concrete Pad',
  'pool-freeform': 'Pool',
};

export function PolyObjectProperties({ objectId }: Props) {
  const obj          = useCanvasStore(s => s.objects[objectId]);
  const updateObject = useCanvasStore(s => s.updateObject);
  const deleteObject = useCanvasStore(s => s.deleteObject);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const { saveHistory } = useHistory();

  if (!obj) return null;

  const curved = obj.curved ?? false;
  const label  = LABELS[obj.objectType] ?? obj.objectType;

  function toggleCurved() {
    saveHistory();
    updateObject(objectId, { curved: !curved });
  }

  function handleDelete() {
    saveHistory();
    deleteObject(objectId);
    clearSelection();
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-400">Edge Style</p>
        <div className="flex gap-2">
          {([true, false] as const).map(c => (
            <button
              key={String(c)}
              onClick={() => { if (curved !== c) toggleCurved(); }}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                curved === c
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {c ? 'Curved' : 'Straight'}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleDelete}
        className="mt-auto py-1 px-3 rounded text-xs bg-red-800 hover:bg-red-700 text-white transition-colors"
      >
        Delete {label}
      </button>
    </div>
  );
}
