import type { FenceTypeKey } from './fence';

export type GateType = 'single-swing' | 'double-swing';
export type HingeSide = 'left' | 'right';
export type SwingDirection = 'inward' | 'outward';

export interface Gate {
  id: string;
  fenceId: string;
  segmentIndex: number;      // which sub-segment of the polyline
  positionT: number;         // 0..1 along that segment
  gateType: GateType;
  hingeSide: HingeSide;
  swingDirection: SwingDirection;
  widthFt: number;
  fenceType: FenceTypeKey;
  metalFrame?: boolean;
}
