export type FenceCategory = 'wood' | 'vinyl' | 'chain-link' | 'ornamental';

export type FenceTypeKey =
  | 'wood-privacy'
  | 'ranch-rail'
  | 'wood-picket'
  | 'wood-cap-board'
  | 'vinyl-privacy'
  | 'vinyl-picket'
  | 'vinyl-ranch-rail'
  | 'chain-link-galv'
  | 'chain-link-black'
  | 'aluminum-ornamental'
  | 'steel-ornamental';

// Height option sets per fence category/type
export const WOOD_PRIVACY_HEIGHTS   = [6, 8]           as const;
export const RANCH_RAIL_HEIGHTS     = [4, 5]            as const;
export const CAP_BOARD_HEIGHTS      = [6, 8]            as const;
export const CHAIN_LINK_HEIGHTS     = [4, 5, 6, 8, 10]  as const;
export const ORNAMENTAL_HEIGHTS     = [4, 5, 6]         as const;

export type FenceHeight = 4 | 5 | 6 | 8 | 10;

// Style types per fence variant
export type WoodPrivacyStyle    = 'standard' | 'shadow-box' | 'board-on-board' | 'cross-board' | 'horizontal';
export type RanchRailStyle      = '3-board' | '4-board' | 'crossbuck' | '3-board-crossbuck';
export type CapBoardStyle       = 'flush' | 'dado' | 'board-on-board' | 'cross-board';
export type VinylPrivacyStyle   = '6-panel' | '8-panel';
export type VinylRanchRailStyle = '3-board' | '4-board';
export type OrnamentalStyle     = 'flat-top' | 'spear-top';

export type FenceStyle =
  | WoodPrivacyStyle
  | RanchRailStyle
  | CapBoardStyle
  | VinylPrivacyStyle
  | VinylRanchRailStyle
  | OrnamentalStyle;

// Style option arrays for picker UI
export const WOOD_PRIVACY_STYLES: { key: WoodPrivacyStyle; label: string }[] = [
  { key: 'standard',       label: 'Standard' },
  { key: 'shadow-box',     label: 'Shadow Box' },
  { key: 'board-on-board', label: 'Board on Board' },
  { key: 'cross-board',    label: 'Cross Board' },
  { key: 'horizontal',     label: 'Horizontal' },
];

export const RANCH_RAIL_STYLES: { key: RanchRailStyle; label: string }[] = [
  { key: '3-board',           label: '3 Board' },
  { key: '4-board',           label: '4 Board' },
  { key: 'crossbuck',         label: 'Crossbuck' },
  { key: '3-board-crossbuck', label: '3 Board Crossbuck' },
];

export const CAP_BOARD_STYLES: { key: CapBoardStyle; label: string }[] = [
  { key: 'flush',          label: 'Flush' },
  { key: 'dado',           label: 'Dado' },
  { key: 'board-on-board', label: 'Board on Board' },
  { key: 'cross-board',    label: 'Cross Board' },
];

export const VINYL_PRIVACY_STYLES: { key: VinylPrivacyStyle; label: string }[] = [
  { key: '6-panel', label: "6' Panel" },
  { key: '8-panel', label: "8' Panel" },
];

export const VINYL_RANCH_RAIL_STYLES: { key: VinylRanchRailStyle; label: string }[] = [
  { key: '3-board', label: '3 Board' },
  { key: '4-board', label: '4 Board' },
];

export const ORNAMENTAL_STYLES: { key: OrnamentalStyle; label: string }[] = [
  { key: 'flat-top',  label: 'Flat Top' },
  { key: 'spear-top', label: 'Spear Top' },
];

export interface FenceCurveData {
  curved: boolean;
  cp1X: number; cp1Y: number;
  cp2X: number; cp2Y: number;
}

export interface FenceLine {
  id: string;
  points: number[];        // flat [x0,y0,x1,y1,...] in world px
  fenceType: FenceTypeKey;
  finishSide: 'left' | 'right'; // fence-wide default, used when finishSides[i] is unset
  finishSides?: ('left' | 'right')[]; // per-segment override, indexed by segment
  heightFt?: FenceHeight;  // used by wood-privacy, ranch-rail, cap-board, chain-link, ornamental
  fenceStyle?: FenceStyle; // used by types with style variants
  color?: string;          // user-chosen hex color; falls back to fence type default
  /** Terrain elevation at each vertex in feet (same length as points/2). Default 0. */
  elevations?: number[];
  /** "Finished Side" label — independent of the line so it can be hidden or dragged, per segment. */
  finishLabelHiddenSegs?: boolean[];
  finishLabelOffsets?: { x: number; y: number }[];
  /** Per-segment bezier curve data (indexed by segment). */
  curveData?: FenceCurveData[];
  /** Line post spacing override in feet (ornamental only: 6 or 8). */
  linePostSpacingFt?: number;
}

/** The effective finish side for a given segment, falling back to the fence-wide default. */
export function getFinishSide(fence: FenceLine, segIdx: number): 'left' | 'right' {
  return fence.finishSides?.[segIdx] ?? fence.finishSide;
}

export interface FenceTypeDefinition {
  label: string;
  color: string;       // default color (used as fallback and sidebar swatch)
  strokeWidth: number; // base width; some types override via heightFt at render time
  category: FenceCategory;
}
