import type { FenceLine, Gate, FenceTypeKey } from '../types';
import { PIXELS_PER_FOOT } from '../constants/canvas';
import { dist } from './geometry';
import { getFenceColor } from '../constants/fenceTypes';

const SNAP_R = 14; // px — two vertices are the "same post" if this close

/** Line-post spacing in feet per fence type.
 *  Where a type supports multiple spacings (6 or 8 ft) the smaller value is
 *  used so the material count is the conservative (higher) estimate. */
export function linePostSpacingFt(fenceType: FenceTypeKey): number {
  switch (fenceType) {
    case 'wood-privacy':
    case 'ranch-rail':
    case 'wood-picket':
    case 'wood-cap-board':
      return 7.5;
    case 'chain-link-galv':
    case 'chain-link-black':
      return 10;
    case 'aluminum-ornamental':
    case 'steel-ornamental':
      return 6;
    case 'vinyl-privacy':
      return 6;
    case 'vinyl-picket':
      return 8;
    case 'vinyl-ranch-rail':
      return 8;
    default:
      return 8;
  }
}

export interface GateInfo {
  id: string;
  gateType: 'single-swing' | 'double-swing';
  widthFt: number;
  heightFt?: number;
  fenceStyle?: string;
  swingDirection: 'inward' | 'outward';
}

export interface FenceTypeSummary {
  color:       string;
  linearFt:    number;
  endPosts:    number;
  cornerPosts: number;
  linePosts:   number;
  gatePosts:   number;
  gates:       GateInfo[];
  concreteBags: number;
}

export interface MaterialSummary {
  byType:        Partial<Record<FenceTypeKey, FenceTypeSummary>>;
  gatePosts:     number;
  singleGates:   number;
  doubleGates:   number;
  totalLinearFt: number;
  totalEndPosts:    number;
  totalCornerPosts: number;
  totalLinePosts:   number;
  totalPosts:    number;
  concreteBags:  number;
}

export function computeMaterials(
  fences: Record<string, FenceLine>,
  gates:  Record<string, Gate>,
): MaterialSummary {
  const fenceList = Object.values(fences);
  const gateList  = Object.values(gates);

  // ── Cluster all endpoints to find shared post locations ───────────────────
  const endpoints: { x: number; y: number; fenceId: string; isFirst: boolean }[] = [];
  for (const f of fenceList) {
    const n = f.points.length / 2;
    if (n < 2) continue;
    endpoints.push({ x: f.points[0], y: f.points[1], fenceId: f.id, isFirst: true });
    endpoints.push({ x: f.points[(n - 1) * 2], y: f.points[(n - 1) * 2 + 1], fenceId: f.id, isFirst: false });
  }

  const clusters: number[][] = [];
  const assigned = new Array(endpoints.length).fill(-1);
  for (let i = 0; i < endpoints.length; i++) {
    if (assigned[i] !== -1) continue;
    const cluster = [i];
    assigned[i] = clusters.length;
    for (let j = i + 1; j < endpoints.length; j++) {
      if (assigned[j] !== -1) continue;
      if (dist(endpoints[i], endpoints[j]) < SNAP_R) {
        cluster.push(j);
        assigned[j] = clusters.length;
      }
    }
    clusters.push(cluster);
  }

  // Map fenceId → cluster index for each of its endpoints
  const fenceEndpointClusters = new Map<string, number[]>(); // fenceId → [clusterA, clusterB]
  for (let i = 0; i < endpoints.length; i++) {
    const { fenceId } = endpoints[i];
    const list = fenceEndpointClusters.get(fenceId) ?? [];
    list.push(assigned[i]);
    fenceEndpointClusters.set(fenceId, list);
  }

  // For each cluster: is it an end post (1 fence only) or corner?
  const clusterIsEnd: boolean[] = clusters.map(cluster => {
    const uniqueFences = new Set(cluster.map(i => endpoints[i].fenceId));
    return uniqueFences.size === 1 && cluster.length === 1;
  });

  // ── Per-type accumulators ─────────────────────────────────────────────────
  const byType: Partial<Record<FenceTypeKey, FenceTypeSummary>> = {};
  function getType(t: FenceTypeKey, color?: string): FenceTypeSummary {
    if (!byType[t]) byType[t] = { color: color ?? '#888888', linearFt: 0, endPosts: 0, cornerPosts: 0, linePosts: 0, gatePosts: 0, gates: [], concreteBags: 0 };
    return byType[t]!;
  }

  // Build fenceId → fenceType lookup for gate assignment
  const fenceTypeById = new Map<string, FenceTypeKey>(fenceList.map(f => [f.id, f.fenceType]));

  for (const f of fenceList) {
    const ft = f.fenceType;
    const acc  = getType(ft, getFenceColor(f));
    const n    = f.points.length / 2;
    if (n < 2) continue;

    // ── Linear footage ────────────────────────────────────────────────────
    for (let i = 0; i < n - 1; i++) {
      acc.linearFt += dist(
        { x: f.points[i * 2],       y: f.points[i * 2 + 1] },
        { x: f.points[(i + 1) * 2], y: f.points[(i + 1) * 2 + 1] },
      ) / PIXELS_PER_FOOT;
    }

    // ── Endpoint posts ────────────────────────────────────────────────────
    const epClusters = fenceEndpointClusters.get(f.id) ?? [];
    const seenEpClusters = new Set<number>();
    for (const ci of epClusters) {
      if (seenEpClusters.has(ci)) continue; // closed fence: both endpoints same cluster
      seenEpClusters.add(ci);
      if (clusterIsEnd[ci]) acc.endPosts++;
      else                   acc.cornerPosts++;
    }

    // ── Internal (intermediate) vertices → corner posts ───────────────────
    acc.cornerPosts += Math.max(0, n - 2);

    // ── Line posts ────────────────────────────────────────────────────────
    const spacing = linePostSpacingFt(ft);
    for (let si = 0; si < n - 1; si++) {
      const x1 = f.points[si * 2],       y1 = f.points[si * 2 + 1];
      const x2 = f.points[(si + 1) * 2], y2 = f.points[(si + 1) * 2 + 1];
      const segFt = dist({ x: x1, y: y1 }, { x: x2, y: y2 }) / PIXELS_PER_FOOT;
      if (segFt === 0) continue;

      const gaps = gateList
        .filter(g => g.fenceId === f.id && g.segmentIndex === si)
        .map(g => {
          const halfFrac = (g.widthFt / 2) / segFt;
          return { t0: Math.max(0, g.positionT - halfFrac), t1: Math.min(1, g.positionT + halfFrac) };
        })
        .sort((a, b) => a.t0 - b.t0);

      const pieces: number[] = [];
      let prev = 0;
      for (const gap of gaps) {
        if (gap.t0 > prev) pieces.push((gap.t0 - prev) * segFt);
        prev = gap.t1;
      }
      if (prev < 1) pieces.push((1 - prev) * segFt);

      for (const pieceFt of pieces) {
        if (pieceFt > spacing) {
          acc.linePosts += Math.ceil(pieceFt / spacing) - 1;
        }
      }
    }
  }

  // ── Per-type concrete ─────────────────────────────────────────────────────
  for (const acc of Object.values(byType) as FenceTypeSummary[]) {
    acc.concreteBags = Math.ceil((acc.endPosts + acc.cornerPosts + acc.gatePosts) * 1 + acc.linePosts * 0.5);
  }

  // ── Gates — assign to their fence's type ─────────────────────────────────
  const fenceById = new Map<string, FenceLine>(fenceList.map(f => [f.id, f]));
  let singleGates = 0, doubleGates = 0;
  for (const g of gateList) {
    const ft = fenceTypeById.get(g.fenceId);
    if (ft) {
      const acc = getType(ft);
      const parentFence = fenceById.get(g.fenceId);
      acc.gates.push({
        id: g.id,
        gateType: g.gateType,
        widthFt: g.widthFt,
        heightFt: parentFence?.heightFt,
        fenceStyle: parentFence?.fenceStyle,
        swingDirection: g.swingDirection,
      });
      acc.gatePosts += 2;
    }
    if (g.gateType === 'single-swing') singleGates++;
    else doubleGates++;
  }
  const gatePosts = (singleGates + doubleGates) * 2;

  // ── Totals (deduplicated by cluster for posts) ─────────────────────────────
  let totalEndPosts = 0, totalCornerPosts = 0;
  for (const cluster of clusters) {
    const uniqueFences = new Set(cluster.map(i => endpoints[i].fenceId));
    if (uniqueFences.size === 1 && cluster.length === 1) totalEndPosts++;
    else totalCornerPosts++;
  }
  // Add all internal vertices across all fences
  for (const f of fenceList) totalCornerPosts += Math.max(0, f.points.length / 2 - 2);

  let totalLinePosts = 0;
  for (const acc of Object.values(byType) as FenceTypeSummary[]) totalLinePosts += acc.linePosts;

  const totalLinearFt = Object.values(byType).reduce((s, a) => s + (a?.linearFt ?? 0), 0);
  const totalPosts    = totalEndPosts + totalCornerPosts + totalLinePosts + gatePosts;
  const concreteBags  = Math.ceil((totalEndPosts + totalCornerPosts + gatePosts) * 1 + totalLinePosts * 0.5);

  return {
    byType,
    gatePosts, singleGates, doubleGates,
    totalLinearFt,
    totalEndPosts, totalCornerPosts, totalLinePosts,
    totalPosts, concreteBags,
  };
}
