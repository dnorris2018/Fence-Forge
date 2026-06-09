import type { FenceTypeKey, FenceTypeDefinition, FenceCategory, FenceLine } from '../types';

export const FENCE_TYPES: Record<FenceTypeKey, FenceTypeDefinition> = {

  // ─── WOOD ───────────────────────────────────────────────────────────────────
  'wood-privacy':   { label: 'Wood Privacy',   color: '#7A5C2A', strokeWidth: 6, category: 'wood' },
  'ranch-rail':     { label: 'Ranch Rail',      color: '#C4A265', strokeWidth: 3, category: 'wood' },
  'wood-picket':    { label: 'Wood Picket',     color: '#D4B896', strokeWidth: 3, category: 'wood' },
  'wood-cap-board': { label: 'Cap Board',       color: '#9C7840', strokeWidth: 5, category: 'wood' },

  // ─── VINYL ──────────────────────────────────────────────────────────────────
  'vinyl-privacy':    { label: 'Vinyl Privacy',    color: '#DCDCD8', strokeWidth: 6, category: 'vinyl' },
  'vinyl-picket':     { label: 'Vinyl Picket',     color: '#E2E2DE', strokeWidth: 3, category: 'vinyl' },
  'vinyl-ranch-rail': { label: 'Vinyl Ranch Rail', color: '#D8D8D4', strokeWidth: 3, category: 'vinyl' },

  // ─── CHAIN LINK ─────────────────────────────────────────────────────────────
  'chain-link-galv':  { label: 'Galv Chain Link',  color: '#8898A8', strokeWidth: 4, category: 'chain-link' },
  'chain-link-black': { label: 'Black Chain Link', color: '#2A2A2A', strokeWidth: 4, category: 'chain-link' },

  // ─── ORNAMENTAL ─────────────────────────────────────────────────────────────
  'aluminum-ornamental': { label: 'Aluminum Ornamental', color: '#5A7A9C', strokeWidth: 4, category: 'ornamental' },
  'steel-ornamental':    { label: 'Steel Ornamental',    color: '#5A6878', strokeWidth: 4, category: 'ornamental' },

};

// Returns the active color for a fence line.
// Uses the user-chosen color if set, otherwise the type's default.
export function getFenceColor(fence: FenceLine): string {
  return fence.color ?? FENCE_TYPES[fence.fenceType]?.color ?? '#888888';
}

// ─── Category list (drives sidebar grouping) ──────────────────────────────────
export const FENCE_CATEGORIES: { key: FenceCategory; label: string }[] = [
  { key: 'wood',       label: 'Wood' },
  { key: 'vinyl',      label: 'Vinyl' },
  { key: 'chain-link', label: 'Chain Link' },
  { key: 'ornamental', label: 'Ornamental' },
];
