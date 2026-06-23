import { useRef, useState } from 'react';
import { startDrag } from '../../hooks/useDragResize';
import { Upload, Ruler, MousePointer2, PenLine, Trash2, ChevronLeft, ChevronRight, Plus, X, GripVertical } from 'lucide-react';
import { useTakeoffStore } from '../../store/takeoffStore';
import { TakeoffCanvas } from './TakeoffCanvas';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
import { SCALE_PRESETS, detectPdfScale } from '../../utils/pdfScale';
import type { TakeoffLine } from '../../store/takeoffStore';

const LINE_COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];

function lineTotalFt(line: TakeoffLine, pixelsPerFt: number | null): number {
  if (!pixelsPerFt || line.points.length < 4) return 0;
  let total = 0;
  const n = line.points.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const x1 = line.points[i * 2], y1 = line.points[i * 2 + 1];
    const x2 = line.points[(i + 1) * 2], y2 = line.points[(i + 1) * 2 + 1];
    const seg = line.segments[i];
    if (seg?.curved) {
      let px = x1, py = y1, len = 0;
      for (let t = 1; t <= 20; t++) {
        const u = t / 20;
        const bx = (1-u)**3*x1 + 3*(1-u)**2*u*seg.cp1X + 3*(1-u)*u**2*seg.cp2X + u**3*x2;
        const by = (1-u)**3*y1 + 3*(1-u)**2*u*seg.cp1Y + 3*(1-u)*u**2*seg.cp2Y + u**3*y2;
        len += Math.sqrt((bx-px)**2 + (by-py)**2);
        px = bx; py = by;
      }
      total += len;
    } else {
      total += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
  }
  return total / pixelsPerFt;
}

// ── Self-contained column header — jump-free resize ──────────────────────────
function ColHeader({
  label, width, onResize,
  className = 'text-[var(--c-text3)] bg-[var(--c-bg1)]',
  children,
}: {
  label: string;
  width: number;
  onResize: (newWidth: number) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);

  function onHandleMouseDown(e: React.MouseEvent) {
    const th = thRef.current;
    if (!th) return;

    // Lock EVERY sibling th to its current rendered pixel width so the table
    // stops redistributing space — this prevents the jump on first mousemove.
    const allThs = Array.from(th.closest('tr')?.querySelectorAll('th') ?? []) as HTMLTableCellElement[];
    allThs.forEach(cell => {
      const w = cell.getBoundingClientRect().width;
      cell.style.width    = `${w}px`;
      cell.style.minWidth = `${w}px`;
      cell.style.maxWidth = `${w}px`;
    });

    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;

    startDrag(e, (clientX) => {
      const newW = Math.max(30, startW + (clientX - startX));
      th.style.width    = `${newW}px`;
      th.style.minWidth = `${newW}px`;
      th.style.maxWidth = `${newW}px`;
    }, () => {
      onResize(Math.round(th.getBoundingClientRect().width));
    });
  }

  return (
    <th
      ref={thRef}
      className={`relative text-left text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5 border-r border-[var(--c-border1)] select-none whitespace-nowrap ${className}`}
      style={{ width }}
    >
      {children ?? label}
      <span
        onMouseDown={onHandleMouseDown}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[var(--c-a-handle)] transition-colors z-10"
      />
    </th>
  );
}

interface CustomCol {
  id: string;
  label: string;
  type: 'text' | 'number';
  width: number;
}

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  color:      40,
  subject:   160,
  pageLabel: 110,
  pageIndex:  80,
  length:    110,
  segments:   80,
};

export function TakeoffView() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  // ── Bottom panel resize ───────────────────────────────────────────────────
  const [panelH, setPanelH]       = useState(200);
  const [panelOpen, setPanelOpen] = useState(true);
  const panelDivRef = useRef<HTMLDivElement>(null);

  function onPanelDragStart(e: React.MouseEvent) {
    const panel = panelDivRef.current;
    if (!panel) return;
    const startY = e.clientY;
    const startH = panel.getBoundingClientRect().height;
    startDrag(e,
      (_, clientY) => { panel.style.height = `${Math.min(600, Math.max(80, startH - (clientY - startY)))}px`; },
      () => setPanelH(Math.round(panel.getBoundingClientRect().height)),
      'row-resize',
    );
  }

  // ── Column widths — only committed to state on mouseup ───────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);

  // ── Custom columns ───────────────────────────────────────────────────────
  const [customCols, setCustomCols] = useState<CustomCol[]>([]);
  const customColsRef = useRef<CustomCol[]>([]);
  const [customData, setCustomData] = useState<Record<string, Record<string, string>>>({});
  const [addingCol, setAddingCol]   = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType]   = useState<'text' | 'number'>('text');

  function addCustomCol() {
    if (!newColLabel.trim()) return;
    const id = `custom_${Date.now()}`;
    const next = [...customColsRef.current, { id, label: newColLabel.trim(), type: newColType, width: 120 }];
    customColsRef.current = next;
    setCustomCols(next);
    setNewColLabel(''); setNewColType('text'); setAddingCol(false);
  }

  function removeCustomCol(id: string) {
    const next = customColsRef.current.filter(c => c.id !== id);
    customColsRef.current = next;
    setCustomCols(next);
    setCustomData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(lineId => { const r = { ...next[lineId] }; delete r[id]; next[lineId] = r; });
      return next;
    });
  }

  function setCell(lineId: string, colId: string, value: string) {
    setCustomData(prev => ({ ...prev, [lineId]: { ...(prev[lineId] ?? {}), [colId]: value } }));
  }

  // ── Store ────────────────────────────────────────────────────────────────
  const {
    pdfFileName, pdfPage, pdfTotalPages,
    activeTool, calibrating, pixelsPerFt,
    lines, selectedLineId, selectedSegIdx,
    activeColor, activeLabel,
    setActiveTool, setActiveColor, setActiveLabel,
    setPdf, setPdfPage,
    startCalibration, cancelCalibration,
    deleteLine, renameLine, clearAll, toggleSegmentCurved,
    activeStrokeWidth, setActiveStrokeWidth, setLineStrokeWidth,
    setScalePreset,
  } = useTakeoffStore();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
      const page = await doc.getPage(1);
      const vp = page.getViewport({ scale: 1 });
      setPdf('', file.name, vp.width, vp.height, doc.numPages, buffer);
      const ds = await detectPdfScale(buffer);
      if (ds) setScalePreset(ds);
    } finally { setLoading(false); }
  }

  async function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > pdfTotalPages) return;
    setLoading(true);
    try { setPdfPage(newPage); } finally { setLoading(false); }
  }

  const totalFt = lines.reduce((sum, l) => sum + lineTotalFt(l, pixelsPerFt), 0);

  // ── Left toolbar resize/collapse ─────────────────────────────────────────
  const [tbWidth, setTbWidth]         = useState(200);
  const [tbCollapsed, setTbCollapsed] = useState(false);
  const tbRef = useRef<HTMLDivElement>(null);
  const TB_MIN = 160, TB_MAX = 340;

  function onTbDragStart(e: React.MouseEvent) {
    const el = tbRef.current; if (!el) return;
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    startDrag(e,
      (clientX) => { el.style.width = `${Math.min(TB_MAX, Math.max(TB_MIN, startW + (clientX - startX)))}px`; },
      () => setTbWidth(Math.round(el.getBoundingClientRect().width)),
    );
  }

  const cw = colWidths;

  return (
    <div className="flex flex-row flex-1 min-h-0 bg-[var(--c-bg1)] text-[var(--c-text1)] overflow-hidden">

      {/* ── Left toolbar ─────────────────────────────────────────────────────── */}
      {tbCollapsed ? (
        <div className="flex flex-col items-center bg-[var(--c-bg2)] border-r border-[var(--c-border1)] shrink-0 py-2 gap-2" style={{ width: 28 }}>
          <button onClick={() => setTbCollapsed(false)} className="text-[var(--c-text3)] hover:text-[var(--c-accent)] transition-colors" title="Expand toolbar">▸</button>
        </div>
      ) : (
        <div ref={tbRef} style={{ width: tbWidth }} className="bg-[var(--c-bg2)] border-r border-[var(--c-border1)] flex flex-col shrink-0 overflow-y-auto relative text-[var(--c-text1)]">
          {/* Collapse button */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--c-border1)] shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--c-text3)]">Tools</span>
            <button onClick={() => setTbCollapsed(true)} className="text-[var(--c-text3)] hover:text-[var(--c-accent)] transition-colors text-xs" title="Collapse">◂</button>
          </div>

          <div className="flex flex-col gap-3 p-2 flex-1">
            {/* Upload + file */}
            <div className="flex flex-col gap-1">
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-2 py-2 rounded bg-emerald-600 hover:bg-[var(--c-accent)] text-[var(--c-text1)] text-xs font-semibold transition-colors w-full">
                <Upload size={13} /> Upload PDF
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              {pdfFileName && <span className="text-[10px] text-[var(--c-text3)] truncate px-1" title={pdfFileName}>{pdfFileName}</span>}
              {loading && <span className="text-[10px] text-[var(--c-text3)] animate-pulse px-1">Loading…</span>}
            </div>

            {/* Page nav */}
            {pdfTotalPages > 1 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-[var(--c-text3)] font-semibold px-1">Page</span>
                <div className="flex items-center gap-1 px-1">
                  <button onClick={() => handlePageChange(pdfPage - 1)} disabled={pdfPage <= 1}
                    className="p-1 rounded hover:bg-[var(--c-bg3)] disabled:opacity-30"><ChevronLeft size={13} /></button>
                  <span className="text-xs text-[var(--c-text2)] flex-1 text-center">{pdfPage} / {pdfTotalPages}</span>
                  <button onClick={() => handlePageChange(pdfPage + 1)} disabled={pdfPage >= pdfTotalPages}
                    className="p-1 rounded hover:bg-[var(--c-bg3)] disabled:opacity-30"><ChevronRight size={13} /></button>
                </div>
              </div>
            )}

            <div className="h-px bg-[var(--c-bg3)]" />

            {/* Tools */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--c-text3)] font-semibold px-1">Tool</span>
              <button onClick={() => setActiveTool('select')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${activeTool === 'select' ? 'bg-[var(--c-accent)] text-gray-900 font-semibold' : 'hover:bg-[var(--c-bg3)] text-[var(--c-text2)]'}`}>
                <MousePointer2 size={13} /> Select / Pan
              </button>
              <button onClick={() => setActiveTool('draw')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${activeTool === 'draw' ? 'bg-[var(--c-accent)] text-gray-900 font-semibold' : 'hover:bg-[var(--c-bg3)] text-[var(--c-text2)]'}`}>
                <PenLine size={13} /> Draw Line
              </button>
            </div>

            <div className="h-px bg-[var(--c-bg3)]" />

            {/* Scale */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--c-text3)] font-semibold px-1">Scale</span>
              <select value="" onChange={e => { if (e.target.value) setScalePreset(parseFloat(e.target.value)); }}
                className="bg-[var(--c-bg3)] text-xs text-[var(--c-text2)] rounded px-1.5 py-1 border border-[var(--c-border2)] focus:border-cyan-400 outline-none w-full">
                <option value="" disabled>{pixelsPerFt ? '✓ Scale Set' : 'Select Scale…'}</option>
                <optgroup label="Engineering">{SCALE_PRESETS.filter(p => p.label.includes('"=')).map(p => <option key={p.label} value={p.pixelsPerFt}>{p.label}</option>)}</optgroup>
                <optgroup label="Architectural">{SCALE_PRESETS.filter(p => !p.label.includes('"=')).map(p => <option key={p.label} value={p.pixelsPerFt}>{p.label}</option>)}</optgroup>
              </select>
              {!calibrating ? (
                <button onClick={startCalibration}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors border bg-cyan-800/40 border-cyan-700 text-cyan-400 hover:bg-cyan-700/50 w-full">
                  <Ruler size={13} /> Calibrate
                </button>
              ) : (
                <div className="flex flex-col gap-1 px-1">
                  <span className="text-xs text-cyan-400 animate-pulse">Click 2 points…</span>
                  <button onClick={cancelCalibration} className="text-xs text-[var(--c-text3)] hover:text-red-400 text-left">Cancel</button>
                </div>
              )}
            </div>

            <div className="h-px bg-[var(--c-bg3)]" />

            {/* Colors */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[var(--c-text3)] font-semibold px-1">Color</span>
              <div className="flex flex-wrap gap-1.5 px-1">
                {LINE_COLORS.map(c => (
                  <button key={c} onClick={() => setActiveColor(c)} className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: activeColor === c ? '#fff' : 'transparent', transform: activeColor === c ? 'scale(1.25)' : 'scale(1)' }} />
                ))}
              </div>
            </div>

            <div className="h-px bg-[var(--c-bg3)]" />

            {/* Stroke width */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[var(--c-text3)] font-semibold px-1">Thickness</span>
              <div className="flex flex-wrap gap-1 px-1">
                {[1, 2, 3, 5, 8].map(w => (
                  <button key={w} onClick={() => setActiveStrokeWidth(w)} title={`${w}px`}
                    className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${activeStrokeWidth === w ? 'bg-[var(--c-accent)]/30 border border-emerald-500' : 'hover:bg-[var(--c-bg3)] border border-transparent'}`}>
                    <div className="rounded-full bg-white" style={{ width: Math.min(w * 3, 22), height: Math.max(w, 1) }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-[var(--c-bg3)]" />

            {/* Label */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--c-text3)] font-semibold px-1">Line Label</span>
              <input type="text" value={activeLabel} onChange={e => setActiveLabel(e.target.value)}
                placeholder="Label…"
                className="bg-[var(--c-bg3)] text-xs text-[var(--c-text1)] rounded px-2 py-1 border border-[var(--c-border2)] focus:border-emerald-500 outline-none w-full" />
            </div>

            {pixelsPerFt && (
              <div className="px-1 py-1 bg-[var(--c-bg1)]/60 rounded text-center">
                <span className="text-[10px] text-[var(--c-text3)] block uppercase tracking-wide">Total</span>
                <span className="text-sm font-mono font-bold text-[var(--c-accent)]">{totalFt.toFixed(1)} ft</span>
              </div>
            )}

            <div className="flex-1" />

            {/* Clear */}
            <button onClick={() => { if (window.confirm('Clear all measurements?')) clearAll(); }}
              className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 rounded bg-red-900/40 hover:bg-red-700/60 text-red-400 border border-red-800/60 transition-colors text-xs" title="Clear all">
              <Trash2 size={13} /> Clear All
            </button>
          </div>

          {/* Drag handle — right edge */}
          <div onMouseDown={onTbDragStart}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--c-a-handle)] transition-colors z-10" />
        </div>
      )}

      {/* ── Main area (canvas + bottom panel) ────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── Canvas ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col bg-[var(--c-bg0)]">
        <TakeoffCanvas />
      </div>

      {/* ── Bottom panel ─────────────────────────────────────────────────────── */}
      <div ref={panelDivRef} className="shrink-0 bg-[var(--c-bg2)] border-t border-[var(--c-border2)] flex flex-col relative"
        style={{ height: panelOpen ? panelH : 32 }}>

        {/* Resize grip strip — sits right on the top border */}
        {panelOpen && (
          <div
            onMouseDown={onPanelDragStart}
            className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-emerald-400/50 transition-colors z-20"
          />
        )}

        {/* Header bar */}
        <div className="flex items-center gap-2 px-3 border-b border-[var(--c-border1)] shrink-0 bg-[var(--c-bg1)]" style={{ height: 32 }}>
          <button onClick={() => setPanelOpen(o => !o)}
            className="text-[var(--c-text3)] hover:text-[var(--c-accent)] transition-colors text-xs font-bold w-4"
            title={panelOpen ? 'Collapse' : 'Expand'}>
            {panelOpen ? '▾' : '▴'}
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--c-text3)]">Markups List</span>
          <span className="text-[10px] text-[var(--c-text4)]">({lines.length})</span>

          {panelOpen && (
            <>
              <div className="flex-1" />
              {!addingCol ? (
                <button onClick={() => setAddingCol(true)}
                  className="flex items-center gap-1 text-[10px] text-[var(--c-text3)] hover:text-[var(--c-accent)] transition-colors px-1.5 py-0.5 rounded border border-[var(--c-border1)] hover:border-emerald-500">
                  <Plus size={10} /> Add Column
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input autoFocus type="text" value={newColLabel} onChange={e => setNewColLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomCol(); if (e.key === 'Escape') setAddingCol(false); }}
                    placeholder="Column name"
                    className="bg-[var(--c-bg3)] text-[10px] text-[var(--c-text1)] rounded px-2 py-0.5 border border-[var(--c-border2)] focus:border-emerald-500 outline-none w-28" />
                  <select value={newColType} onChange={e => setNewColType(e.target.value as 'text' | 'number')}
                    className="bg-[var(--c-bg3)] text-[10px] text-[var(--c-text2)] rounded px-1 py-0.5 border border-[var(--c-border2)] outline-none">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                  </select>
                  <button onClick={addCustomCol} className="text-[10px] text-[var(--c-accent)] hover:text-[var(--c-accent2)] font-semibold">Add</button>
                  <button onClick={() => setAddingCol(false)} className="text-[10px] text-[var(--c-text3)] hover:text-red-400"><X size={10} /></button>
                </div>
              )}
              {pixelsPerFt && lines.length > 0 && (
                <span className="text-[10px] font-mono text-[var(--c-accent)] ml-3">Total: {totalFt.toFixed(2)} ft</span>
              )}
            </>
          )}
        </div>

        {/* Table */}
        {panelOpen && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <ColHeader label="Color"      width={cw.color}     onResize={w => setColWidths(p => ({...p, color: w}))}     />
                  <ColHeader label="Subject"    width={cw.subject}   onResize={w => setColWidths(p => ({...p, subject: w}))}   />
                  <ColHeader label="Page Label" width={cw.pageLabel} onResize={w => setColWidths(p => ({...p, pageLabel: w}))} />
                  <ColHeader label="Page"       width={cw.pageIndex} onResize={w => setColWidths(p => ({...p, pageIndex: w}))} />
                  <ColHeader label="Length"     width={cw.length}    onResize={w => setColWidths(p => ({...p, length: w}))}    />
                  <ColHeader label="Segments"   width={cw.segments}  onResize={w => setColWidths(p => ({...p, segments: w}))}  />
                  {customCols.map(col => (
                    <ColHeader
                      key={col.id}
                      label={col.label}
                      width={col.width}
                      className="text-[var(--c-accent)]/80 bg-[var(--c-bg1)]"
                      onResize={(w) => {
                        const next = customColsRef.current.map(c => c.id === col.id ? {...c, width: w} : c);
                        customColsRef.current = next;
                        setCustomCols([...next]);
                      }}
                    >
                      <span className="flex items-center gap-1 pr-3">
                        <GripVertical size={8} className="text-[var(--c-text4)] shrink-0" />
                        <span className="truncate">{col.label}</span>
                        <button onClick={() => removeCustomCol(col.id)} className="ml-auto text-[var(--c-text4)] hover:text-red-400 transition-colors shrink-0" title="Remove column">
                          <X size={8} />
                        </button>
                      </span>
                    </ColHeader>
                  ))}
                  {/* Filler — no explicit width so it gets all remaining space */}
                  <th className="bg-[var(--c-bg1)] border-0" />
                </tr>
              </thead>

              <tbody>
                {lines.length === 0 && (
                  <tr><td colSpan={6 + customCols.length} className="text-center text-[10px] text-[var(--c-text4)] py-8">
                    No measurements yet — draw lines on the canvas above.
                  </td></tr>
                )}
                {lines.map((line, i) => {
                  const ft = lineTotalFt(line, pixelsPerFt);
                  const isSelected = line.id === selectedLineId;
                  return (
                    <tr key={line.id}
                      onClick={() => useTakeoffStore.getState().selectLine(isSelected ? null : line.id)}
                      className={`border-b border-[var(--c-border1)]/40 cursor-pointer transition-colors ${isSelected ? 'bg-[var(--c-bg3)]' : 'hover:bg-[var(--c-bg3)]/40'}`}>

                      {/* Color swatch */}
                      <td className="px-2 py-1.5 border-r border-[var(--c-border1)]/50" style={{ width: cw.color }}>
                        <span className="w-4 h-4 rounded-full inline-block border border-black/30" style={{ background: line.color }} />
                      </td>

                      {/* Subject — inline rename */}
                      <td className="px-1 py-0.5 border-r border-[var(--c-border1)]/50" style={{ width: cw.subject, maxWidth: cw.subject, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <input
                          value={line.label}
                          onChange={e => renameLine(line.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          placeholder={`Line ${i + 1}`}
                          className="w-full bg-transparent text-[11px] text-[var(--c-text2)] outline-none focus:bg-[var(--c-bg3)]/60 rounded px-1 py-0.5 placeholder-gray-500 truncate"
                        />
                      </td>

                      {/* Page Label */}
                      <td className="px-2 py-1.5 border-r border-[var(--c-border1)]/50 text-[var(--c-text3)]" style={{ width: cw.pageLabel, maxWidth: cw.pageLabel, overflow: 'hidden' }}>
                        <span className="block truncate text-[10px]">{pdfFileName ? pdfFileName.replace(/\.pdf$/i, '') : '—'}</span>
                      </td>

                      {/* Page Index */}
                      <td className="px-2 py-1.5 border-r border-[var(--c-border1)]/50 text-[var(--c-text3)] text-center" style={{ width: cw.pageIndex }}>
                        <span className="text-[10px]">{line.page || '—'}</span>
                      </td>

                      {/* Length */}
                      <td className="px-2 py-1.5 border-r border-[var(--c-border1)]/50 font-mono text-[var(--c-text1)] text-right" style={{ width: cw.length }}>
                        {pixelsPerFt ? `${ft.toFixed(2)} ft` : <span className="text-[var(--c-text4)] text-[10px]">Set scale</span>}
                      </td>

                      {/* Segments */}
                      <td className="px-2 py-1.5 border-r border-[var(--c-border1)]/50 text-[var(--c-text3)] text-center" style={{ width: cw.segments }}>
                        <span className="text-[10px]">{line.segments.length}</span>
                      </td>

                      {/* Custom columns */}
                      {customCols.map(col => (
                        <td key={col.id} className="px-1 py-0.5 border-r border-[var(--c-border1)]/50" style={{ width: col.width }}>
                          <input
                            type={col.type === 'number' ? 'number' : 'text'}
                            value={customData[line.id]?.[col.id] ?? ''}
                            onChange={e => setCell(line.id, col.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="—"
                            className="w-full bg-transparent text-[11px] text-[var(--c-text2)] outline-none focus:bg-[var(--c-bg3)]/60 rounded px-1 py-0.5 placeholder-gray-700"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>

              {lines.length > 0 && (
                <tfoot>
                  <tr className="bg-[var(--c-bg1)] border-t border-[var(--c-border2)] sticky bottom-0">
                    <td colSpan={4} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--c-text3)] border-r border-[var(--c-border1)]">
                      Total — {lines.length} line{lines.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-2 py-1.5 font-mono font-bold text-[var(--c-accent)] text-right border-r border-[var(--c-border1)]" style={{ width: cw.length }}>
                      {pixelsPerFt ? `${totalFt.toFixed(2)} ft` : '—'}
                    </td>
                    <td colSpan={1 + customCols.length} className="border-r border-[var(--c-border1)]" />
                  </tr>
                </tfoot>
              )}
            </table>

            {/* Selected line detail bar */}
            {selectedLineId && (() => {
              const line = lines.find(l => l.id === selectedLineId);
              if (!line) return null;
              return (
                <div className="sticky bottom-0 border-t border-[var(--c-border1)] bg-[var(--c-bg2)] px-4 py-2 flex items-center gap-4 flex-wrap">
                  <span className="text-[10px] text-[var(--c-text2)] font-semibold"
                    style={{ borderLeft: `3px solid ${line.color}`, paddingLeft: 6 }}>
                    {line.label || 'Selected Line'}
                  </span>
                  {selectedSegIdx !== null && selectedSegIdx < line.segments.length && (
                    <button
                      onClick={() => toggleSegmentCurved(line.id, selectedSegIdx)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-colors border ${
                        line.segments[selectedSegIdx].curved
                          ? 'bg-[var(--c-a-glow)] border-emerald-500/60 text-[var(--c-accent)]'
                          : 'bg-[var(--c-bg4)]/50 border-[var(--c-border2)] text-[var(--c-text3)] hover:text-[var(--c-text2)]'}`}>
                      〜 Seg {selectedSegIdx + 1} — {line.segments[selectedSegIdx].curved ? 'Curved' : 'Straight'}
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--c-text3)]">Thickness</span>
                    <input type="range" min={1} max={12} step={1}
                      value={line.strokeWidth ?? 2}
                      onChange={e => setLineStrokeWidth(line.id, parseInt(e.target.value))}
                      className="w-20 h-1 accent-[var(--c-accent)]" />
                    <span className="text-[10px] text-[var(--c-text2)] font-mono w-6">{line.strokeWidth ?? 2}px</span>
                  </div>
                  <button onClick={() => deleteLine(line.id)}
                    className="ml-auto flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-900/40 hover:border-red-500/40 transition-colors">
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      </div> {/* end main area */}
    </div>
  );
}
