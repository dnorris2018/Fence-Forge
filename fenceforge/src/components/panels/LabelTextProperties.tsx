import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';

interface Props { objectId: string; }

export function LabelTextProperties({ objectId }: Props) {
  const obj = useCanvasStore(s => s.objects[objectId]);
  const updateObject = useCanvasStore(s => s.updateObject);
  const deleteObject = useCanvasStore(s => s.deleteObject);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const { saveHistory } = useHistory();

  if (!obj) return null;

  function handleTextChange(value: string) {
    saveHistory();
    updateObject(objectId, { label: value });
  }

  function handleDelete() {
    saveHistory();
    deleteObject(objectId);
    clearSelection();
  }

  return (
    <div className="p-3 space-y-4">
      <p className="text-xs text-[var(--c-text3)] uppercase tracking-wide">Text Label</p>

      <div>
        <p className="text-xs text-[var(--c-text3)] mb-1">Text</p>
        <textarea
          value={obj.label ?? ''}
          onChange={e => handleTextChange(e.target.value)}
          rows={4}
          placeholder="Type your text here…"
          className="w-full px-2 py-1.5 rounded bg-[var(--c-bg3)] text-[var(--c-text1)] text-sm border border-[var(--c-border2)] focus:border-emerald-400 outline-none resize-y"
        />
      </div>

      <button
        onClick={handleDelete}
        className="w-full py-1.5 rounded bg-red-900/50 hover:bg-red-800 text-red-300 text-xs font-medium transition-colors"
      >
        Delete
      </button>
    </div>
  );
}
