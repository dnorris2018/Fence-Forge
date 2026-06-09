import { create } from 'zustand';
import type { CanvasSnapshot } from './canvasStore';
import { MAX_HISTORY } from '../constants/canvas';

interface HistoryStore {
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  pushSnapshot: (snap: CanvasSnapshot) => void;
  popUndo: (current: CanvasSnapshot) => CanvasSnapshot | null;
  popRedo: (current: CanvasSnapshot) => CanvasSnapshot | null;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],

  pushSnapshot: (snap) =>
    set(s => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap],
      future: [],
    })),

  popUndo: (current) => {
    const { past } = get();
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    set(s => ({
      past: s.past.slice(0, -1),
      future: [...s.future, current],
    }));
    return prev;
  },

  popRedo: (current) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[future.length - 1];
    set(s => ({
      future: s.future.slice(0, -1),
      past: [...s.past.slice(-(MAX_HISTORY - 1)), current],
    }));
    return next;
  },

  clear: () => set({ past: [], future: [] }),
}));
