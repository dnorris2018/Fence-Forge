import type { ObjectType } from '../types';
import { PIXELS_PER_FOOT } from './canvas';

export const OBJECT_DEFAULTS: Record<ObjectType, { label: string; width: number; height: number; icon: string }> = {
  bush:          { label: 'Bush',         width:  5 * PIXELS_PER_FOOT, height:  5 * PIXELS_PER_FOOT, icon: '🌿' },
  tree:          { label: 'Tree',         width: 12 * PIXELS_PER_FOOT, height: 12 * PIXELS_PER_FOOT, icon: '🌳' },
  'concrete-pad': { label: 'Concrete Pad', width: 10 * PIXELS_PER_FOOT, height: 10 * PIXELS_PER_FOOT, icon: '⬜' },
  shed:           { label: 'Shed',         width:  8 * PIXELS_PER_FOOT, height: 10 * PIXELS_PER_FOOT, icon: '🏚' },
  'brick-wall':   { label: 'Wall',         width:  0,                   height:  0,                   icon: '🧱' },
  'pool-freeform':{ label: 'Pool',         width:  0,                   height:  0,                   icon: '🏊' },
  'building':      { label: 'Building',    width: 0,                    height: 0,                    icon: '🏢' },
  'house':         { label: 'House',       width: 30 * PIXELS_PER_FOOT, height: 20 * PIXELS_PER_FOOT, icon: '🏠' },
  'label-text':    { label: 'Text Label',  width: 10 * PIXELS_PER_FOOT, height:  3 * PIXELS_PER_FOOT, icon: '🔤' },
  'measure-line':  { label: 'Measure Line', width: 10 * PIXELS_PER_FOOT, height:  0,                  icon: '📏' },
  'power-outlet':  { label: 'Power',        width:  3 * PIXELS_PER_FOOT, height:  3 * PIXELS_PER_FOOT, icon: '⚡' },
  'water-spigot':  { label: 'Water Spigot', width:  3 * PIXELS_PER_FOOT, height:  3 * PIXELS_PER_FOOT, icon: '🚿' },
  'gas-line':      { label: 'Gas Line',     width:  0,                   height:  0,                   icon: '🔥' },
  'internet-line': { label: 'Internet Line',width:  0,                   height:  0,                   icon: '🌐' },
  'water-line':    { label: 'Water Line',   width:  0,                   height:  0,                   icon: '💧' },
};
