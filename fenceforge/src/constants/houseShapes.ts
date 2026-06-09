/** Normalized polygon points [x,y,...] in 0-1 space, CW winding, Y-down. */
export type HouseStyle =
  | 'rectangle'
  | 'l-shape'
  | 't-shape'
  | 'u-shape'
  | 'plus'
  | 'z-shape'
  | 'h-shape'
  | 'stepped-l';

export const HOUSE_STYLES: HouseStyle[] = [
  'rectangle', 'l-shape', 'stepped-l', 't-shape', 'u-shape', 'plus', 'z-shape', 'h-shape',
];

export const HOUSE_STYLE_LABELS: Record<HouseStyle, string> = {
  rectangle:  'Rectangle',
  'l-shape':  'L-Shape',
  'stepped-l':'Stepped L',
  't-shape':  'T-Shape',
  'u-shape':  'U-Shape',
  plus:       'Plus',
  'z-shape':  'Z-Shape',
  'h-shape':  'H-Shape',
};

/** Normalized footprint polygons (0–1 x,y). Apply flipX / scale to get world coords. */
export const HOUSE_SHAPE_POINTS: Record<HouseStyle, number[]> = {
  rectangle: [
    0,0,  1,0,  1,1,  0,1,
  ],
  // L: top-right corner cut out
  'l-shape': [
    0,0,  1,0,  1,0.5,  0.5,0.5,  0.5,1,  0,1,
  ],
  // Stepped-L: two steps cut from bottom-right
  'stepped-l': [
    0,0,  1,0,  1,0.4,  0.7,0.4,  0.7,0.7,  0.4,0.7,  0.4,1,  0,1,
  ],
  // T: horizontal bar with center stem
  't-shape': [
    0,0,  1,0,  1,0.4,  0.65,0.4,  0.65,1,  0.35,1,  0.35,0.4,  0,0.4,
  ],
  // U: open at bottom center
  'u-shape': [
    0,0,  1,0,  1,1,  0.65,1,  0.65,0.4,  0.35,0.4,  0.35,1,  0,1,
  ],
  // Plus / cross
  plus: [
    0.33,0,  0.67,0,
    0.67,0.33,  1,0.33,  1,0.67,
    0.67,0.67,  0.67,1,  0.33,1,
    0.33,0.67,  0,0.67,  0,0.33,  0.33,0.33,
  ],
  // Z: offset staggered shape
  'z-shape': [
    0,0,  0.6,0,  0.6,0.45,  1,0.45,  1,1,  0.4,1,  0.4,0.55,  0,0.55,
  ],
  // H: two side blocks joined by a center bridge
  'h-shape': [
    0,0,  0.35,0,  0.35,0.38,  0.65,0.38,  0.65,0,  1,0,
    1,1,  0.65,1,  0.65,0.62,  0.35,0.62,  0.35,1,  0,1,
  ],
};

/** Scale normalized points to world px, optionally mirroring X. */
export function buildHousePoints(
  style: HouseStyle,
  width: number,
  height: number,
  flipX: boolean,
): number[] {
  const norm = HOUSE_SHAPE_POINTS[style];
  const out: number[] = [];
  for (let i = 0; i < norm.length; i += 2) {
    const nx = flipX ? 1 - norm[i] : norm[i];
    out.push(nx * width, norm[i + 1] * height);
  }
  return out;
}
