import type Konva from 'konva';

/** Module-level singleton so PDF export can access the Konva stage from anywhere. */
let _stage: Konva.Stage | null = null;

export function setGlobalStage(stage: Konva.Stage | null) {
  _stage = stage;
}

export function getGlobalStage(): Konva.Stage | null {
  return _stage;
}
