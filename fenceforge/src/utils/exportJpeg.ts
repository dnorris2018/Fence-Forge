import { getGlobalStage } from './stageRef';
import { CANVAS_BG } from '../constants/canvas';
import { useUiStore } from '../store/uiStore';

export function exportToJpeg(): void {
  const stage = getGlobalStage();
  if (!stage) return;

  const { gridVisible, toggleGrid } = useUiStore.getState();
  if (gridVisible) toggleGrid();

  // Wait one frame for React to re-render without the grid
  requestAnimationFrame(() => {
    const konvaDataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });

    if (gridVisible) toggleGrid();

    // Composite onto a solid background (JPEG has no alpha channel)
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg', 0.92);
      a.download = `fenceforge-${new Date().toISOString().slice(0, 10)}.jpg`;
      a.click();
    };
    img.src = konvaDataUrl;
  });
}
