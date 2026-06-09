import { useRef, useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { useHistory } from '../../hooks/useHistory';
import { dist } from '../../utils/geometry';
import { PIXELS_PER_FOOT } from '../../constants/canvas';

const PAD_L = 48;
const PAD_R = 32;
const PAD_T = 60;
const PAD_B = 48;
const BASELINE_Y_FRAC = 0.72; // baseline sits 72% down the drawing area

function getElevations(points: number[], elevations?: number[]): number[] {
  const n = points.length / 2;
  if (elevations && elevations.length === n) return elevations;
  return new Array(n).fill(0);
}

function segDistances(points: number[]): number[] {
  const n = points.length / 2;
  const dists: number[] = [0];
  for (let i = 1; i < n; i++) {
    const d = dist(
      { x: points[(i - 1) * 2], y: points[(i - 1) * 2 + 1] },
      { x: points[i * 2],       y: points[i * 2 + 1] },
    );
    dists.push(dists[i - 1] + d);
  }
  return dists;
}

export function ElevationView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 400 });

  const { elevationFenceId, elevationPostIdx, closeElevationView, setElevationPostIdx } = useUiStore();
  const fence      = useCanvasStore(s => elevationFenceId ? s.fences[elevationFenceId] : null);
  const updateFence = useCanvasStore(s => s.updateFence);
  const { saveHistory } = useHistory();

  // Track SVG container size
  useEffect(() => {
    if (!svgRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: Math.max(200, width), h: Math.max(100, height) });
    });
    ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, []);

  if (!fence || !elevationFenceId) return null;

  const pts  = fence.points;
  const n    = pts.length / 2;
  const elevs = getElevations(pts, fence.elevations);
  const cumDist = segDistances(pts);
  const totalDist = cumDist[n - 1] || 1;

  const drawW = svgSize.w - PAD_L - PAD_R;
  const drawH = svgSize.h - PAD_T - PAD_B;
  const baselineY = PAD_T + drawH * BASELINE_Y_FRAC;

  // Elevation scale: 1 ft = elevScale px
  const maxElev = Math.max(...elevs, 0.1);
  const elevScale = (drawH * BASELINE_Y_FRAC - 20) / (maxElev || 1);

  function postX(i: number) { return PAD_L + (cumDist[i] / totalDist) * drawW; }
  function postY(i: number) { return baselineY - elevs[i] * elevScale; }

  function handlePostClick(i: number) { setElevationPostIdx(i); }

  function setElevation(val: number) {
    if (!fence) return;
    saveHistory();
    const newElevs = [...elevs];
    newElevs[elevationPostIdx] = Math.max(0, val);
    updateFence(elevationFenceId!, { elevations: newElevs });
  }

  function addPost() {
    if (!fence || n < 2) return;
    const i = Math.min(elevationPostIdx, n - 2); // segment between i and i+1
    saveHistory();
    const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const x2 = pts[(i + 1) * 2], y2 = pts[(i + 1) * 2 + 1];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const me = (elevs[i] + elevs[i + 1]) / 2;
    const newPts  = [...pts.slice(0, (i + 1) * 2), mx, my, ...pts.slice((i + 1) * 2)];
    const newElevs = [...elevs.slice(0, i + 1), me, ...elevs.slice(i + 1)];
    updateFence(elevationFenceId!, { points: newPts, elevations: newElevs });
    setElevationPostIdx(i + 1);
  }

  function removePost() {
    if (!fence || n <= 2) return;
    const i = elevationPostIdx;
    if (i === 0 || i === n - 1) return; // can't remove endpoints
    saveHistory();
    const newPts   = [...pts.slice(0, i * 2), ...pts.slice((i + 1) * 2)];
    const newElevs = [...elevs.slice(0, i), ...elevs.slice(i + 1)];
    updateFence(elevationFenceId!, { points: newPts, elevations: newElevs });
    setElevationPostIdx(Math.min(i, newPts.length / 2 - 1));
  }

  // Build polyline connecting posts
  const polyline = Array.from({ length: n }, (_, i) => `${postX(i)},${postY(i)}`).join(' ');

  // Segment distance labels
  const segLabels = Array.from({ length: n - 1 }, (_, i) => {
    const d = dist(
      { x: pts[i * 2], y: pts[i * 2 + 1] },
      { x: pts[(i + 1) * 2], y: pts[(i + 1) * 2 + 1] },
    );
    const labelX = (postX(i) + postX(i + 1)) / 2;
    const labelY = Math.min(postY(i), postY(i + 1)) - 12;
    return { labelX, labelY, text: (d / PIXELS_PER_FOOT).toFixed(1) + "'" };
  });

  const selectedElev = elevs[elevationPostIdx] ?? 0;

  return (
    <div className="flex flex-1 overflow-hidden bg-[#1a1f2e]">
      {/* ── Left settings panel ── */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 p-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Elevation Settings</p>
          <button
            onClick={closeElevationView}
            className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            title="Close elevation view"
          >✕</button>
        </div>

        {/* Post navigator */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400">Change Posts</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setElevationPostIdx(Math.max(0, elevationPostIdx - 1))}
              disabled={elevationPostIdx === 0}
              className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-sm flex items-center justify-center transition-colors"
            >−</button>
            <div className="flex-1 h-8 bg-gray-700 rounded flex items-center justify-center">
              <span className="text-sm text-white font-mono">{elevationPostIdx + 1}</span>
            </div>
            <button
              onClick={() => setElevationPostIdx(Math.min(n - 1, elevationPostIdx + 1))}
              disabled={elevationPostIdx === n - 1}
              className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-sm flex items-center justify-center transition-colors"
            >+</button>
          </div>
          <p className="text-[10px] text-gray-500">Post {elevationPostIdx + 1} of {n}</p>
        </div>

        {/* Elevation height */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400">Elevation Height (ft)</p>
          <input
            type="number"
            min={0}
            step={0.5}
            value={selectedElev}
            onChange={e => setElevation(parseFloat(e.target.value) || 0)}
            className="w-full bg-gray-700 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-teal-500"
          />
          <p className="text-[10px] text-gray-500 leading-snug">
            Height difference the post must accommodate.
          </p>
        </div>

        {/* Add / Remove post */}
        <div className="flex flex-col gap-1">
          <button
            onClick={addPost}
            disabled={n >= 50}
            className="py-1.5 rounded text-xs bg-teal-700 hover:bg-teal-600 disabled:opacity-30 text-white transition-colors"
          >
            + Add Post After
          </button>
          <button
            onClick={removePost}
            disabled={n <= 2 || elevationPostIdx === 0 || elevationPostIdx === n - 1}
            className="py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-gray-300 transition-colors"
          >
            Remove Post
          </button>
        </div>

        <div className="mt-auto">
          <p className="text-[10px] text-gray-600">
            {n} posts · {(totalDist / PIXELS_PER_FOOT).toFixed(1)} ft total
          </p>
        </div>
      </div>

      {/* ── SVG profile view ── */}
      <svg
        ref={svgRef}
        className="flex-1"
        style={{ display: 'block' }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = PAD_T + drawH * BASELINE_Y_FRAC * f;
          return (
            <line key={f}
              x1={PAD_L} y1={y} x2={PAD_L + drawW} y2={y}
              stroke="#2a3040" strokeWidth={1}
            />
          );
        })}

        {/* Baseline */}
        <line
          x1={PAD_L} y1={baselineY} x2={PAD_L + drawW} y2={baselineY}
          stroke="#3a4a5a" strokeWidth={1.5}
        />

        {/* Fence line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#2a8f88"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* Segment distance labels */}
        {segLabels.map((sl, i) => (
          <text key={i}
            x={sl.labelX} y={sl.labelY}
            textAnchor="middle"
            fontSize={10}
            fill="#e8a020"
            fontFamily="monospace"
          >
            {sl.text}
          </text>
        ))}

        {/* Posts */}
        {Array.from({ length: n }, (_, i) => {
          const x = postX(i);
          const y = postY(i);
          const selected = i === elevationPostIdx;
          return (
            <g key={i} onClick={() => handlePostClick(i)} style={{ cursor: 'pointer' }}>
              {/* Vertical drop line to baseline */}
              <line x1={x} y1={y} x2={x} y2={baselineY}
                stroke={selected ? '#e8a020' : '#3a5a6a'}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              {/* Post circle */}
              <circle
                cx={x} cy={y} r={selected ? 7 : 5}
                fill={selected ? '#e8a020' : '#2a8f88'}
                stroke={selected ? '#fff' : '#1a4a50'}
                strokeWidth={selected ? 2 : 1.5}
              />
              {/* Post number */}
              <text x={x} y={y - 12}
                textAnchor="middle"
                fontSize={9}
                fill={selected ? '#e8a020' : '#6a8a9a'}
                fontFamily="monospace"
              >
                {i + 1}
              </text>
              {/* Elevation label */}
              {elevs[i] > 0 && (
                <text x={x + 9} y={y + 4}
                  fontSize={9}
                  fill="#78c8c0"
                  fontFamily="monospace"
                >
                  +{elevs[i]}'
                </text>
              )}
            </g>
          );
        })}

        {/* Axis label */}
        <text x={PAD_L - 8} y={baselineY + 4}
          textAnchor="end" fontSize={9} fill="#4a6a7a" fontFamily="monospace"
        >0'</text>
        {maxElev > 0 && (
          <text x={PAD_L - 8} y={baselineY - maxElev * elevScale + 4}
            textAnchor="end" fontSize={9} fill="#4a6a7a" fontFamily="monospace"
          >{maxElev}'</text>
        )}
      </svg>
    </div>
  );
}
