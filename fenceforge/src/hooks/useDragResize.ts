/**
 * Simplest possible drag-resize: attach mousemove/mouseup to document.
 * Call this from a React onMouseDown handler.
 * Returns cleanup automatically on mouseup.
 */
export function startDrag(
  e: React.MouseEvent,
  onMove: (clientX: number, clientY: number) => void,
  onDone?: (clientX: number, clientY: number) => void,
  cursor = 'col-resize',
) {
  e.preventDefault();

  const prevCursor = document.body.style.cursor;
  const prevSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = 'none';

  function handleMove(mv: MouseEvent) {
    onMove(mv.clientX, mv.clientY);
  }

  function handleUp(mv: MouseEvent) {
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevSelect;
    document.removeEventListener('mousemove', handleMove);
    document.removeEventListener('mouseup', handleUp);
    onDone?.(mv.clientX, mv.clientY);
  }

  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleUp);
}
