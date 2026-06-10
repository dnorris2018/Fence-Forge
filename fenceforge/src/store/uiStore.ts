import { create } from 'zustand';
import { MIN_ZOOM, MAX_ZOOM } from '../constants/canvas';

interface UiStore {
  zoom: number;
  panX: number;
  panY: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  snapSizeFt: number;
  sidebarTab: 'fences' | 'objects';
  /** Fence ID currently open in elevation view, or null for plan view */
  elevationFenceId: string | null;
  /** Index of the selected post in elevation view */
  elevationPostIdx: number;

  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setSnapSize: (ft: number) => void;
  setSidebarTab: (tab: 'fences' | 'objects') => void;
  openElevationView: (fenceId: string) => void;
  closeElevationView: () => void;
  setElevationPostIdx: (idx: number) => void;
  labelFontSize: number;
  setLabelFontSize: (size: number) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  gridVisible: true,
  snapEnabled: true,
  snapSizeFt: 1,
  sidebarTab: 'fences',
  elevationFenceId: null,
  elevationPostIdx: 0,
  labelFontSize: 11,

  setZoom: (z) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  toggleGrid: () => set(s => ({ gridVisible: !s.gridVisible })),
  toggleSnap: () => set(s => ({ snapEnabled: !s.snapEnabled })),
  setSnapSize: (ft) => set({ snapSizeFt: ft }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setLabelFontSize: (size) => set({ labelFontSize: size }),
  openElevationView: (fenceId) => set({ elevationFenceId: fenceId, elevationPostIdx: 0 }),
  closeElevationView: () => set({ elevationFenceId: null, elevationPostIdx: 0 }),
  setElevationPostIdx: (idx) => set({ elevationPostIdx: idx }),
}));
