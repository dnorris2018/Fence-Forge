import { useState, useRef } from 'react';
import { startDrag } from '../../hooks/useDragResize';
import { useCanvasStore } from '../../store/canvasStore';
import { FenceProperties } from '../panels/FenceProperties';
import { GateProperties } from '../panels/GateProperties';
import { WallProperties } from '../panels/WallProperties';
import { PolyObjectProperties } from '../panels/PolyObjectProperties';
import { BuildingProperties } from '../panels/BuildingProperties';
import { HouseProperties } from '../panels/HouseProperties';
import { LabelTextProperties } from '../panels/LabelTextProperties';
import { MaterialList } from '../panels/MaterialList';

type RightTab = 'properties' | 'materials';

const MIN_W = 160;
const MAX_W = 480;
const DEFAULT_W = 224; // w-56

export function PropertiesPanel() {
  const [tab, setTab]             = useState<RightTab>('properties');
  const [width, setWidth]         = useState(DEFAULT_W);
  const [collapsed, setCollapsed] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  function onMouseDown(e: React.MouseEvent) {
    const el = divRef.current; if (!el) return;
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    startDrag(e,
      (clientX) => { el.style.width = `${Math.min(MAX_W, Math.max(MIN_W, startW - (clientX - startX)))}px`; },
      () => setWidth(Math.round(el.getBoundingClientRect().width)),
    );
  }

  const selectedId   = useCanvasStore(s => s.selectedId);
  const selectedType = useCanvasStore(s => s.selectedType);
  const objects      = useCanvasStore(s => s.objects);

  const selectedObj = selectedId && selectedType === 'object' ? objects[selectedId] : null;

  // ── Collapsed strip ───────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex flex-col items-center bg-[var(--c-bg2)] border-l border-[var(--c-border1)] shrink-0 py-2 gap-2" style={{ width: 28 }}>
        <button
          onClick={() => setCollapsed(false)}
          className="text-[var(--c-text3)] hover:text-[var(--c-accent)] transition-colors"
          title="Expand panel"
        >
          ◂
        </button>
      </div>
    );
  }

  return (
    <div ref={divRef} style={{ width }} className="bg-[var(--c-bg2)] border-l border-[var(--c-border1)] flex flex-col shrink-0 text-[var(--c-text1)] overflow-hidden relative">
      {/* Drag handle — left edge */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--c-a-handle)] transition-colors z-10"
        title="Drag to resize"
      />

      {/* Tab bar + collapse button */}
      <div className="flex border-b border-[var(--c-border1)] shrink-0">
        <button
          onClick={() => setCollapsed(true)}
          className="px-2 text-[var(--c-text3)] hover:text-[var(--c-accent)] transition-colors text-xs"
          title="Collapse panel"
        >
          ▸
        </button>
        {(['properties', 'materials'] as RightTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              tab === t ? 'bg-[var(--c-bg3)] text-[var(--c-accent)]' : 'text-[var(--c-text3)] hover:text-[var(--c-text2)]'
            }`}
          >
            {t === 'properties' ? 'Properties' : 'Line Items'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'materials' && <MaterialList />}

        {tab === 'properties' && (
          <>
            {(!selectedId || !selectedType) && (
              <div className="p-4">
                <p className="text-xs text-[var(--c-text3)] uppercase tracking-wide mb-2">Properties</p>
                <p className="text-xs text-[var(--c-text4)]">Select an element to see its properties.</p>
              </div>
            )}
            {selectedType === 'fence' && <FenceProperties fenceId={selectedId!} />}
            {selectedType === 'gate'  && <GateProperties  gateId={selectedId!} />}
            {selectedType === 'object' && selectedObj?.objectType === 'brick-wall' && (
              <WallProperties objectId={selectedId!} />
            )}
            {selectedType === 'object' && (selectedObj?.objectType === 'concrete-pad' || selectedObj?.objectType === 'pool-freeform') && (
              <PolyObjectProperties objectId={selectedId!} />
            )}
            {selectedType === 'object' && selectedObj?.objectType === 'building' && (
              <BuildingProperties objectId={selectedId!} />
            )}
            {selectedType === 'object' && selectedObj?.objectType === 'house' && (
              <HouseProperties objectId={selectedId!} />
            )}
            {selectedType === 'object' && selectedObj?.objectType === 'label-text' && (
              <LabelTextProperties objectId={selectedId!} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
