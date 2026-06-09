import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';

interface Props { objectId: string; }

export function BuildingProperties({ objectId }: Props) {
  const obj          = useCanvasStore(s => s.objects[objectId]);
  const updateObject = useCanvasStore(s => s.updateObject);
  const deleteObject = useCanvasStore(s => s.deleteObject);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const { saveHistory } = useHistory();

  if (!obj) return null;

  const numEdges     = obj.points ? obj.points.length / 2 : 0;
  const entranceEdge = obj.entranceEdge ?? 0;

  function cycleEntrance(dir: 1 | -1) {
    if (numEdges < 2) return;
    saveHistory();
    updateObject(objectId, {
      entranceEdge: ((entranceEdge + dir) % numEdges + numEdges) % numEdges,
    });
  }

  function handleDelete() {
    saveHistory();
    deleteObject(objectId);
    clearSelection();
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">Building</p>

      {numEdges > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400">Entrance Wall</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cycleEntrance(-1)}
              className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              ←
            </button>
            <span className="text-xs text-gray-300 w-14 text-center">
              Wall {entranceEdge + 1} / {numEdges}
            </span>
            <button
              onClick={() => cycleEntrance(1)}
              className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleDelete}
        className="mt-auto py-1 px-3 rounded text-xs bg-red-800 hover:bg-red-700 text-white transition-colors"
      >
        Delete Building
      </button>
    </div>
  );
}
