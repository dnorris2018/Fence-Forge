import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { computeMaterials } from '../../utils/materials';
import { FENCE_TYPES } from '../../constants/fenceTypes';
import type { FenceTypeKey, FenceHeight, FenceStyle } from '../../types';

// ── Label helpers ────────────────────────────────────────────────────────────

/** "3-board" → "3-Board", "crossbuck" → "Crossbuck" */
function styleLabel(style?: string): string {
  if (!style) return '';
  return style
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('-');
}

/** Build a full display name: "6' Wood Privacy" or "5' Ranch Rail 3-Board" */
function fenceDisplayName(type: FenceTypeKey, heightFt?: number, fenceStyle?: string): string {
  const typeName = FENCE_TYPES[type]?.label ?? type;
  const parts: string[] = [];
  if (heightFt) parts.push(`${heightFt}'`);
  parts.push(typeName);
  const sl = styleLabel(fenceStyle);
  if (sl) parts.push(sl);
  return parts.join(' ');
}


// ── Small UI components ──────────────────────────────────────────────────────

interface RowProps { label: string; value: string | number; sub?: string; highlight?: boolean }
function Row({ label, value, sub, highlight }: RowProps) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[var(--c-border1)]/40 pl-2">
      <div>
        <span className={`text-xs ${highlight ? 'text-[var(--c-accent2)] font-semibold' : 'text-[var(--c-text2)]'}`}>{label}</span>
        {sub && <p className="text-[10px] text-[var(--c-text4)] leading-none mt-0.5">{sub}</p>}
      </div>
      <span className={`text-xs font-mono font-semibold ml-2 shrink-0 ${highlight ? 'text-[var(--c-accent2)]' : 'text-[var(--c-text1)]'}`}>
        {value}
      </span>
    </div>
  );
}

function Divider({ title }: { title: string }) {
  return (
    <p className="text-[10px] text-[var(--c-text3)] uppercase tracking-widest font-semibold mt-4 mb-1">
      {title}
    </p>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MaterialList() {
  const fences = useCanvasStore(s => s.fences);
  const gates  = useCanvasStore(s => s.gates);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (Object.keys(fences).length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs text-[var(--c-text3)]">Draw fences to see the material list.</p>
      </div>
    );
  }

  const m = computeMaterials(fences, gates);
  const typeEntries = Object.entries(m.byType) as [FenceTypeKey, NonNullable<typeof m.byType[FenceTypeKey]>][];
  typeEntries.sort((a, b) => b[1].linearFt - a[1].linearFt);

  function toggle(type: string) {
    setCollapsed(c => ({ ...c, [type]: !c[type] }));
  }

  return (
    <div className="p-3 text-[var(--c-text1)]">

      {typeEntries.map(([type, acc]) => {
        const def = FENCE_TYPES[type];
        const open = !collapsed[type];

        // Collect distinct heights and styles for this type's fences
        const fencesOfType = Object.values(fences).filter(f => f.fenceType === type);
        const heights = [...new Set(fencesOfType.map(f => f.heightFt).filter((h): h is FenceHeight => h != null))].sort((a,b) => a-b);
        const styles  = [...new Set(fencesOfType.map(f => f.fenceStyle).filter((s): s is FenceStyle => !!s))];

        const heightStr = heights.length > 0 ? heights.map(h => `${h}'`).join('/') : '';
        const styleStr  = styles.length === 1 ? styleLabel(styles[0]) : '';
        const sectionTitle = [heightStr, def?.label ?? type, styleStr].filter(Boolean).join(' ').toUpperCase();

        // For per-row labels (use single height/style if unambiguous)
        const singleHeight = heights.length === 1 ? heights[0] : undefined;
        const singleStyle  = styles.length  === 1 ? styles[0]  : undefined;

        return (
          <div key={type} className="mt-2">
            {/* Collapsible section header */}
            <button
              onClick={() => toggle(type)}
              className="w-full flex items-center gap-2 py-1.5 px-1 rounded transition-colors text-left"
              style={{ background: `${acc.color}22`, borderLeft: `3px solid ${acc.color}` }}
            >
              <span
                className="w-3.5 h-3.5 rounded shrink-0 border border-black/30 shadow-sm"
                style={{ background: acc.color }}
              />
              <span className="text-[11px] text-[var(--c-text1)] font-bold tracking-wide flex-1">
                {sectionTitle}
              </span>
              <span className="text-[10px] text-[var(--c-text2)] font-mono mr-1">
                {acc.linearFt.toFixed(1)} ft
              </span>
              <span className="text-[var(--c-text3)] text-xs">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <div className="border-l border-[var(--c-border1)] ml-1.5 pl-1">
                {/* Linear footage — height + type + style */}
                <Row
                  label={fenceDisplayName(type, singleHeight, singleStyle)}
                  value={`${acc.linearFt.toFixed(1)} ft`}
                />

                {/* Posts — include height in label */}
                {acc.endPosts > 0 && (
                  <Row label={`${fenceDisplayName(type, singleHeight, singleStyle)} End Post`} value={acc.endPosts} />
                )}
                {acc.cornerPosts > 0 && (
                  <Row label={`${fenceDisplayName(type, singleHeight, singleStyle)} Corner Post`} value={acc.cornerPosts} />
                )}
                <Row
                  label={`${fenceDisplayName(type, singleHeight, singleStyle)} Line Post`}
                  value={acc.linePosts}
                />
                {acc.gatePosts > 0 && (
                  <Row label={`${fenceDisplayName(type, singleHeight, singleStyle)} Gate Post`} value={acc.gatePosts} />
                )}

                {/* Gates — grouped by description, qty in right column */}
                {(() => {
                  const grouped = new Map<string, number>();
                  for (const g of acc.gates) {
                    const gTypeName = g.gateType === 'single-swing' ? 'Single' : 'Double';
                    const dir = g.swingDirection === 'inward' ? 'In' : 'Out';
                    const key = [
                      fenceDisplayName(type, g.heightFt, g.fenceStyle),
                      `${g.widthFt}'`,
                      gTypeName,
                      dir,
                    ].join(' ');
                    grouped.set(key, (grouped.get(key) ?? 0) + 1);
                  }
                  return [...grouped.entries()].map(([label, qty]) => (
                    <Row key={label} label={label} value={qty} />
                  ));
                })()}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Totals ── */}
      <Divider title="Totals" />
      <Row label="Total Linear Ft"       value={`${m.totalLinearFt.toFixed(1)} ft`} highlight />
      <Row label="End Posts"             value={m.totalEndPosts} />
      <Row label="Corner Posts"          value={m.totalCornerPosts} />
      <Row label="Line Posts"            value={m.totalLinePosts} />
      <Row label="Gate Posts"            value={m.gatePosts} />
      <Row label="Total Posts"           value={m.totalPosts} highlight />
    </div>
  );
}
