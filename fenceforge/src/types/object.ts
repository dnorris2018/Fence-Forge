export type ObjectType = 'bush' | 'tree' | 'concrete-pad' | 'shed' | 'brick-wall' | 'pool-freeform' | 'building' | 'house' | 'label-text' | 'measure-line' | 'power-outlet' | 'water-spigot' | 'gas-line' | 'internet-line' | 'water-line';
export type { HouseStyle } from '../constants/houseShapes';

export interface SegmentCurveData {
  curved: boolean;
  cp1X: number; cp1Y: number;
  cp2X: number; cp2Y: number;
}

export interface PlaceableObject {
  id: string;
  objectType: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
  /** Polygon vertices in local coords (relative to x, y). Present for drawn objects. */
  points?: number[];
  /** Which end of the wall carries the concrete cap (wall objects only) */
  capSide?: 'top' | 'bottom';
  /** Whether poly-drawn object uses smooth Catmull-Rom curves (default true) */
  curved?: boolean;
  /** Per-segment bezier curve overrides. When set, takes precedence over `curved`. */
  segmentCurveData?: SegmentCurveData[];
  /** Index of the polygon edge that shows the entrance (building only, default 0) */
  entranceEdge?: number;
  /** House preset shape style */
  houseStyle?: import('../constants/houseShapes').HouseStyle;
  /** Mirror house footprint horizontally */
  houseFlipX?: boolean;
  /** Arrow tip in world coordinates — label-text only (stays fixed when box moves) */
  arrowTipX?: number;
  arrowTipY?: number;
  /** End point in world coordinates — measure-line only (x,y is the start point) */
  lineEndX?: number;
  lineEndY?: number;
}

/** Object types placed by drawing a polygon rather than a single click */
export const POLY_OBJECT_TYPES: ObjectType[] = ['concrete-pad', 'brick-wall', 'pool-freeform', 'building', 'gas-line', 'internet-line', 'water-line'];
export function isPolyObjectType(t: ObjectType): boolean {
  return POLY_OBJECT_TYPES.includes(t);
}
