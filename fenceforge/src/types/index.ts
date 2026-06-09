export * from './fence';
export * from './gate';
export * from './object';

export type ToolMode = 'select' | 'draw-fence' | 'draw-poly-object' | 'place-object' | 'place-gate' | 'pan';
export type SelectionType = 'fence' | 'gate' | 'object' | null;
