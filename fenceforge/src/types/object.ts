export type ObjectType = 'bush' | 'tree' | 'concrete-pad' | 'shed' | 'brick-wall' | 'pool-freeform' | 'building' | 'house';
export type { HouseStyle } from '../constants/houseShapes';

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
  /** Index of the polygon edge that shows the entrance (building only, default 0) */
  entranceEdge?: number;
  /** House preset shape style */
  houseStyle?: import('../constants/houseShapes').HouseStyle;
  /** Mirror house footprint horizontally */
  houseFlipX?: boolean;
}

/** Object types placed by drawing a polygon rather than a single click */
export const POLY_OBJECT_TYPES: ObjectType[] = ['concrete-pad', 'brick-wall', 'pool-freeform', 'building'];
export function isPolyObjectType(t: ObjectType): boolean {
  return POLY_OBJECT_TYPES.includes(t);
}
