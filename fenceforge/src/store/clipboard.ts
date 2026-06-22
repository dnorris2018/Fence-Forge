import type { FenceLine, Gate, PlaceableObject } from '../types';

type ClipboardItem =
  | { kind: 'fence';  data: Omit<FenceLine, 'id'> }
  | { kind: 'object'; data: Omit<PlaceableObject, 'id'> }
  | { kind: 'gate';   data: Omit<Gate, 'id'> };

let _clip: ClipboardItem | null = null;

export function setClipboard(item: ClipboardItem | null) { _clip = item; }
export function getClipboard(): ClipboardItem | null { return _clip; }
