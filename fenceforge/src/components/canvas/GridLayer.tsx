import { Layer, Shape } from 'react-konva';
import { PIXELS_PER_FOOT, GRID_COLOR, GRID_MAJOR_COLOR } from '../../constants/canvas';
import type Konva from 'konva';

interface Props {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
  snapSizeFt: number;
  gridVisible: boolean;
}

export function GridLayer({ width, height, zoom, panX, panY, snapSizeFt, gridVisible }: Props) {
  if (!gridVisible) return null;

  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(ctx: Konva.Context) => {
          const nativeCtx = (ctx as any)._context as CanvasRenderingContext2D;
          const step = snapSizeFt * PIXELS_PER_FOOT;
          const majorStep = step * 5;

          const x0 = -panX / zoom;
          const y0 = -panY / zoom;
          const x1 = x0 + width / zoom;
          const y1 = y0 + height / zoom;

          const startX = Math.floor(x0 / step) * step;
          const startY = Math.floor(y0 / step) * step;

          nativeCtx.save();
          nativeCtx.lineWidth = 1 / zoom;

          for (let x = startX; x <= x1; x += step) {
            const isMajor = Math.abs(x % majorStep) < 0.01;
            nativeCtx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_COLOR;
            nativeCtx.beginPath();
            nativeCtx.moveTo(x, y0);
            nativeCtx.lineTo(x, y1);
            nativeCtx.stroke();
          }

          for (let y = startY; y <= y1; y += step) {
            const isMajor = Math.abs(y % majorStep) < 0.01;
            nativeCtx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_COLOR;
            nativeCtx.beginPath();
            nativeCtx.moveTo(x0, y);
            nativeCtx.lineTo(x1, y);
            nativeCtx.stroke();
          }

          nativeCtx.restore();
        }}
        width={width}
        height={height}
      />
    </Layer>
  );
}
