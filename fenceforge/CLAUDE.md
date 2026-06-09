# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run preview   # Preview production build
```

No test suite is configured.

## Architecture

**FenceForge** is a React + Vite canvas drawing app for fence layout planning. Canvas rendering uses `react-konva` (Konva wrapped in a custom React reconciler). State is managed by Zustand v5.

### Critical rendering constraint

`useSyncExternalStore` (and therefore Zustand hooks) **do not trigger re-renders inside the Konva reconciler**. All store subscriptions must be lifted into `CanvasArea` (a real React DOM component) and passed as props into the Konva layer tree. Never call `useCanvasStore(...)` inside a component that renders Konva nodes.

### Three stores

- **`canvasStore`** — source of truth for fences, gates, objects, active tool mode, drawing state, and selection. `getSnapshot()`/`loadSnapshot()` are the history integration points.
- **`historyStore`** — undo/redo stacks of `CanvasSnapshot`. Call `pushSnapshot(current)` *before* any mutation. `popUndo(current)` takes the current state to push onto the redo stack.
- **`uiStore`** — zoom, pan, grid visibility, snap settings. Lives outside history.

### Coordinate system

`PIXELS_PER_FOOT = 20`. All element positions are stored in **world coordinates** (pixels). The Konva `Stage` `x/y/scaleX/scaleY` apply pan/zoom visually. Always use `stage.getRelativePointerPosition()` in event handlers — never `e.clientX/Y`.

### Layer order (CanvasArea → Stage children)

1. `GridLayer` — single `<Shape sceneFunc>` batch-draws all grid lines; uses `nativeCtx.lineWidth` not Konva `strokeWidth`
2. `ObjectLayer` — placeable objects (house, shed, wall, concrete-pad, pool, bush, tree, building)
3. `FenceLayer` — polyline fences with gradient strips and per-segment labels
4. `GateLayer` — gates (posts, swing arcs, panel lines)
5. `DrawingLayer` — rubber-band preview while drawing a fence
6. `SelectionLayer` — Konva `Transformer` for object resize/rotate; attaches via `stage.findOne('#id')` cross-layer lookup

### Fence drawing flow

`draw-fence` tool mode → `onMouseDown` appends snap-adjusted points to `drawingPoints` → `onMouseMove` updates `cursorPoint` for rubber-band preview → `onDblClick` calls `handleDblClick`. **Important**: double-click fires 2 `mousedown` events — the first places the intended last point, the second is a duplicate. `handleDblClick` strips the last point with `slice(0, -2)` before calling `addFence`.

### FenceSegment rendering

Each `FenceSegment` renders per-segment (not per-polyline):
- **Gradient strip**: one `<Shape sceneFunc>` per segment, gradient direction computed from that segment's perpendicular vector so the fade is correctly oriented on turns.
- **Gate gaps**: `buildSubSegments` splits `points` into multiple `<Line>` elements with gaps for each gate.
- **Labels**: one `<Text>` per segment showing segment length in feet, rotated to follow the segment angle.
- **Stroke width**: computed by `effectiveStrokeWidth(fence, baseWidth)` in `FenceSegment.tsx` — the `def.strokeWidth` from `FENCE_TYPES` is a fallback; most types override it from `fence.heightFt`.
- Accessing `createLinearGradient` requires `(ctx as any)._context as CanvasRenderingContext2D` — Konva's `Context` wrapper does not expose it directly.

### Fence data model — `FenceLine`

```typescript
interface FenceLine {
  id: string;
  points: number[];        // flat [x0,y0,x1,y1,...] world px
  fenceType: FenceTypeKey;
  finishSide: 'left' | 'right';
  heightFt?: FenceHeight;  // 4|5|6|8|10 — used by most types except wood-picket and vinyl
  fenceStyle?: FenceStyle; // 'ranch-rail' and 'wood-cap-board' only
}
```

### Fence types and their options

All height/style arrays live in `src/types/fence.ts`. `FenceProperties.tsx` drives pickers via two lookup tables (`HEIGHT_OPTIONS`, `STYLE_OPTIONS`) keyed by `FenceTypeKey`.

| Type key | Height options | Style options |
|---|---|---|
| `wood-privacy` | 6', 8' | — |
| `wood-shadowbox` | 6', 8' | — |
| `ranch-rail` | 4', 5' | 3 Board, 4 Board, Crossbuck |
| `wood-picket` | — | — |
| `wood-cap-board` | 6', 8' | Flush, Dado |
| `vinyl-*` | — | — |
| `chain-link-galv` / `chain-link-black` | 4', 5', 6', 8', 10' | — |
| `aluminum-flat-top` / `aluminum-spear-top` | 4', 5', 6' | — |

`addFence` in `canvasStore` sets appropriate defaults (`heightFt: 6`, `fenceStyle: '3-board'` / `'flush'`) for types that use them.

When a type change is made in `FenceProperties`, the new height/style carry over if valid for the new type; otherwise they reset to the new type's first option.

### Gate geometry

`computeGateGeometry` in `utils/gateGeometry.ts` derives all render positions from `gate.segmentIndex`, `gate.positionT` (0–1 along segment), `hingeSide`, `swingDirection`, and `widthFt`. The fence gap in `FenceSegment.buildSubSegments` uses `PIXELS_PER_FOOT * 0.3` padding beyond the gate half-width.

### Snap logic

`useCanvasInteraction` applies snapping before every point placement: vertex snap (within `SNAP_VERTEX_RADIUS = 12px` of any fence vertex or object corner) takes priority over grid snap. Grid snap rounds to the nearest `snapSizeFt × PIXELS_PER_FOOT`.

### Key constants (`src/constants/canvas.ts`)

| Constant | Value | Purpose |
|---|---|---|
| `PIXELS_PER_FOOT` | 20 | World-to-feet conversion |
| `GRADIENT_STRIP_WIDTH` | 40 | Width of finish-side gradient (px) |
| `SNAP_VERTEX_RADIUS` | 12 | Pixel radius for vertex snapping |
| `MAX_HISTORY` | 60 | Max undo steps |
| `MIN_ZOOM` / `MAX_ZOOM` | 0.1 / 12 | Stage scale bounds |

### HMR caveat

During development, editing a module can create multiple Zustand store instances (one per HMR version). Each instance registers its own event handlers, causing apparent event duplication in the console. This is dev-only; a full page reload (`location.reload()`) clears it. In dev mode, `window.__canvasStore` and `window.__historyStore` are exposed for console debugging.
