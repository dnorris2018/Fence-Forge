import { useCanvasStore } from '../store/canvasStore';
import { useHistoryStore } from '../store/historyStore';

export function useHistory() {
  const getSnapshot = useCanvasStore(s => s.getSnapshot);
  const loadSnapshot = useCanvasStore(s => s.loadSnapshot);
  const { pushSnapshot, popUndo, popRedo } = useHistoryStore();

  function saveHistory() {
    pushSnapshot(getSnapshot());
  }

  function undo() {
    const next = popUndo(getSnapshot());
    if (next) loadSnapshot(next);
  }

  function redo() {
    const next = popRedo(getSnapshot());
    if (next) loadSnapshot(next);
  }

  return { saveHistory, undo, redo };
}
