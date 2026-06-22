import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { FenceLine, FenceTypeKey, FenceHeight, FenceStyle, Gate, PlaceableObject, ObjectType, ToolMode, SelectionType } from '../types';
import type { GateType } from '../types/gate';
import { FENCE_TYPES } from '../constants/fenceTypes';
import { OBJECT_DEFAULTS } from '../constants/objectTypes';

export interface CanvasSnapshot {
  fences: Record<string, FenceLine>;
  gates: Record<string, Gate>;
  objects: Record<string, PlaceableObject>;
}

interface CanvasStore {
  fences: Record<string, FenceLine>;
  gates: Record<string, Gate>;
  objects: Record<string, PlaceableObject>;

  toolMode: ToolMode;
  activeFenceType: FenceTypeKey;
  activeObjectType: ObjectType;
  activeGateType: GateType;

  drawingPoints: number[];
  cursorPoint: [number, number] | null;

  selectedId: string | null;
  selectedType: SelectionType;

  addFence: (pts: number[], fenceType: FenceTypeKey) => string;
  updateFence: (id: string, patch: Partial<FenceLine>) => void;
  deleteFence: (id: string) => void;

  addGate: (gate: Omit<Gate, 'id'>) => string;
  updateGate: (id: string, patch: Partial<Gate>) => void;
  deleteGate: (id: string) => void;

  addObject: (objectType: ObjectType, x: number, y: number, polyPoints?: number[]) => string;
  finishPolyObject: () => string | null;
  updateObject: (id: string, patch: Partial<PlaceableObject>) => void;
  deleteObject: (id: string) => void;

  setToolMode: (mode: ToolMode) => void;
  setActiveFenceType: (t: FenceTypeKey) => void;
  setActiveObjectType: (t: ObjectType) => void;
  setActiveGateType: (t: GateType) => void;

  appendDrawingPoint: (x: number, y: number) => void;
  setCursorPoint: (pt: [number, number] | null) => void;
  finishDrawing: () => string | null;
  cancelDrawing: () => void;

  setSelection: (id: string | null, type: SelectionType) => void;
  clearSelection: () => void;

  loadSnapshot: (snap: CanvasSnapshot) => void;
  getSnapshot: () => CanvasSnapshot;
}

export const useCanvasStore = create<CanvasStore>()(persist((set, get) => ({
  fences: {},
  gates: {},
  objects: {},

  toolMode: 'pan',
  activeFenceType: 'wood-privacy',
  activeObjectType: 'bush',
  activeGateType: 'single-swing',

  drawingPoints: [],
  cursorPoint: null,

  selectedId: null,
  selectedType: null,

  addFence: (pts, fenceType) => {
    const id = nanoid();
    const extras: { heightFt?: FenceHeight; fenceStyle?: FenceStyle } = {};
    switch (fenceType) {
      case 'wood-privacy':     extras.heightFt = 6; extras.fenceStyle = 'standard'; break;
      case 'wood-cap-board':   extras.heightFt = 6; extras.fenceStyle = 'flush';      break;
      case 'ranch-rail':       extras.heightFt = 4; extras.fenceStyle = '3-board';    break;
      case 'vinyl-privacy':    extras.fenceStyle = '6-panel';  break;
      case 'vinyl-ranch-rail': extras.fenceStyle = '3-board';  break;
      case 'chain-link-galv':
      case 'chain-link-black': extras.heightFt = 6; break;
      case 'aluminum-ornamental':
      case 'steel-ornamental': extras.heightFt = 6; extras.fenceStyle = 'flat-top'; break;
    }
    const defaultColor = FENCE_TYPES[fenceType]?.color ?? '#888888';
    set(s => ({
      fences: { ...s.fences, [id]: { id, points: pts, fenceType, finishSide: 'left', color: defaultColor, ...extras } },
    }));
    return id;
  },
  updateFence: (id, patch) =>
    set(s => ({ fences: { ...s.fences, [id]: { ...s.fences[id], ...patch } } })),
  deleteFence: (id) =>
    set(s => {
      const fences = { ...s.fences };
      delete fences[id];
      const gates = Object.fromEntries(
        Object.entries(s.gates).filter(([, g]) => g.fenceId !== id)
      );
      return { fences, gates };
    }),

  addGate: (gate) => {
    const id = nanoid();
    set(s => ({ gates: { ...s.gates, [id]: { ...gate, id } } }));
    return id;
  },
  updateGate: (id, patch) =>
    set(s => ({ gates: { ...s.gates, [id]: { ...s.gates[id], ...patch } } })),
  deleteGate: (id) =>
    set(s => { const gates = { ...s.gates }; delete gates[id]; return { gates }; }),

  addObject: (objectType, x, y, polyPoints?) => {
    const id = nanoid();
    const def = OBJECT_DEFAULTS[objectType];
    const baseX = polyPoints ? x : x - def.width  / 2;
    const baseY = polyPoints ? y : y - def.height / 2;
    const obj: PlaceableObject = {
      id, objectType,
      x: baseX,
      y: baseY,
      width: def.width,
      height: def.height,
      rotation: 0,
      label: def.label,
      ...(polyPoints ? { points: polyPoints, curved: false } : {}),
      ...(objectType === 'brick-wall' ? { capSide: 'top' as const }       : {}),
      ...(objectType === 'building'   ? { entranceEdge: 0 }              : {}),
      ...(objectType === 'house'      ? { houseStyle: 'rectangle' as const, houseFlipX: false } : {}),
      ...(objectType === 'measure-line' ? { lineEndX: baseX + def.width, lineEndY: baseY } : {}),
    };
    set(s => ({ objects: { ...s.objects, [id]: obj } }));
    return id;
  },
  finishPolyObject: () => {
    const { drawingPoints, activeObjectType, addObject } = get();
    const minPts = (activeObjectType === 'brick-wall' || activeObjectType === 'gas-line' || activeObjectType === 'internet-line' || activeObjectType === 'water-line') ? 4 : 6;
    if (drawingPoints.length < minPts) {
      set({ drawingPoints: [], cursorPoint: null, toolMode: 'select' });
      return null;
    }
    let minX = Infinity, minY = Infinity;
    for (let i = 0; i < drawingPoints.length; i += 2) {
      minX = Math.min(minX, drawingPoints[i]);
      minY = Math.min(minY, drawingPoints[i + 1]);
    }
    const relPoints = drawingPoints.map((v, i) => v - (i % 2 === 0 ? minX : minY));
    const id = addObject(activeObjectType, minX, minY, relPoints);
    set({ drawingPoints: [], cursorPoint: null, toolMode: 'select' });
    return id;
  },
  updateObject: (id, patch) =>
    set(s => ({ objects: { ...s.objects, [id]: { ...s.objects[id], ...patch } } })),
  deleteObject: (id) =>
    set(s => { const objects = { ...s.objects }; delete objects[id]; return { objects }; }),

  setToolMode: (mode) => set({ toolMode: mode }),
  setActiveFenceType: (t) => set({ activeFenceType: t }),
  setActiveObjectType: (t) => set({ activeObjectType: t }),
  setActiveGateType: (t) => set({ activeGateType: t }),

  appendDrawingPoint: (x, y) =>
    set(s => ({ drawingPoints: [...s.drawingPoints, x, y] })),
  setCursorPoint: (pt) => set({ cursorPoint: pt }),
  finishDrawing: () => {
    const { drawingPoints, activeFenceType, addFence } = get();
    if (drawingPoints.length < 4) { set({ drawingPoints: [], cursorPoint: null }); return null; }
    const id = addFence(drawingPoints, activeFenceType);
    set({ drawingPoints: [], cursorPoint: null, toolMode: 'select' });
    return id;
  },
  cancelDrawing: () => set({ drawingPoints: [], cursorPoint: null }),

  setSelection: (id, type) => set({ selectedId: id, selectedType: type }),
  clearSelection: () => set({ selectedId: null, selectedType: null }),

  loadSnapshot: (snap) => set({ fences: snap.fences, gates: snap.gates, objects: snap.objects }),
  getSnapshot: () => {
    const { fences, gates, objects } = get();
    return {
      fences:  JSON.parse(JSON.stringify(fences)),
      gates:   JSON.parse(JSON.stringify(gates)),
      objects: JSON.parse(JSON.stringify(objects)),
    };
  },
}), {
  name: 'fenceforge-canvas',
  partialize: (s) => ({ fences: s.fences, gates: s.gates, objects: s.objects }),
}));
