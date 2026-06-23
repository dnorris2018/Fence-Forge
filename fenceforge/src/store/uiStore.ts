import { create } from 'zustand';
import { MIN_ZOOM, MAX_ZOOM } from '../constants/canvas';
import type { ThemeKey } from '../constants/themes';
import { DEFAULT_THEME } from '../constants/themes';

interface UiStore {
  zoom: number;
  panX: number;
  panY: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  snapSizeFt: number;
  sidebarTab: 'fences' | 'objects' | 'projects';
  elevationFenceId: string | null;
  elevationPostIdx: number;
  selectedPolySegment: number | null;
  labelFontSize: number;
  theme: ThemeKey;

  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setSnapSize: (ft: number) => void;
  setSidebarTab: (tab: 'fences' | 'objects' | 'projects') => void;
  openElevationView: (fenceId: string) => void;
  closeElevationView: () => void;
  setElevationPostIdx: (idx: number) => void;
  setSelectedPolySegment: (idx: number | null) => void;
  setLabelFontSize: (size: number) => void;
  setTheme: (key: ThemeKey) => void;
}

function loadTheme(): ThemeKey {
  try { return (localStorage.getItem('ff-theme') as ThemeKey) ?? DEFAULT_THEME; } catch { return DEFAULT_THEME; }
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
  selectedPolySegment: null,
  labelFontSize: 11,
  theme: loadTheme(),

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
  setSelectedPolySegment: (idx) => set({ selectedPolySegment: idx }),
  setTheme: (key) => {
    try { localStorage.setItem('ff-theme', key); } catch {}
    set({ theme: key });
  },
}));
