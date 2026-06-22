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

  // Build fenceId → fenceType lookup early (needed for cluster classification)
  const fenceTypeByIdEarly = new Map<string, FenceTypeKey>(fenceList.map(f => [f.id, f.fenceType]));

  // For each cluster, classify how its post(s) should be counted:
  //  - 'end'    → a single fence's open endpoint, not touching anything else
  //  - 'corner' → multiple fences of the SAME type meeting at one point (or a closed
  //               single-fence loop) — shared, counted once
  //  - 'multi-end' → fences of DIFFERENT types meeting at the same point — each fence
  //               gets its own end post rather than a merged corner
  type ClusterKind = { kind: 'end' } | { kind: 'corner' } | { kind: 'multi-end'; fenceIds: string[] };
  const clusterKinds: ClusterKind[] = clusters.map(cluster => {
    const fenceIds = Array.from(new Set(cluster.map(i => endpoints[i].fenceId)));
    if (fenceIds.length === 1) {
      return { kind: cluster.length === 1 ? 'end' : 'corner' };
    }
    const types = new Set(fenceIds.map(id => fenceTypeByIdEarly.get(id)));
    if (types.size === 1) return { kind: 'corner' };
    return { kind: 'multi-end', fenceIds };
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

    // ── Internal (intermediate) vertices → corner or line post by angle ──
    for (let vi = 1; vi < n - 1; vi++) {
      const ax = f.points[(vi - 1) * 2] - f.points[vi * 2];
      const ay = f.points[(vi - 1) * 2 + 1] - f.points[vi * 2 + 1];
      const bx = f.points[(vi + 1) * 2] - f.points[vi * 2];
      const by = f.points[(vi + 1) * 2 + 1] - f.points[vi * 2 + 1];
      const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
      if (lenA === 0 || lenB === 0) continue;
      const angleDeg = Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / (lenA * lenB)))) * 180 / Math.PI;
      if (angleDeg < 135) acc.cornerPosts++;
      else acc.linePosts++;
    }

    // ── Line posts ────────────────────────────────────────────────────────
    const spacing = f.linePostSpacingFt ?? linePostSpacingFt(ft);
    const fixedSpacing = ft === 'aluminum-ornamental' || ft === 'steel-ornamental';
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
          acc.linePosts += fixedSpacing
            ? Math.floor(pieceFt / spacing)
            : Math.ceil(pieceFt / spacing) - 1;
        }
      }
    }
  }

  // ── Endpoint / corner posts — one pass per cluster, so a shared point between
  // multiple fences of the same type counts as a single corner post, while a
  // point shared between different fence types gives each its own end post. ──
  const fenceByIdForPosts = new Map<string, FenceLine>(fenceList.map(f => [f.id, f]));
  for (let ci = 0; ci < clusters.length; ci++) {
    const kind = clusterKinds[ci];
    const fenceId = endpoints[clusters[ci][0]].fenceId;
    if (kind.kind === 'end') {
      const ft = fenceTypeByIdEarly.get(fenceId)!;
      getType(ft, getFenceColor(fenceByIdForPosts.get(fenceId)!)).endPosts++;
    } else if (kind.kind === 'corner') {
      const ft = fenceTypeByIdEarly.get(fenceId)!;
      getType(ft, getFenceColor(fenceByIdForPosts.get(fenceId)!)).cornerPosts++;
    } else {
      for (const fid of kind.fenceIds) {
        const ft = fenceTypeByIdEarly.get(fid)!;
        getType(ft, getFenceColor(fenceByIdForPosts.get(fid)!)).endPosts++;
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

  // ── Totals — summed from byType, which already accounts for shared corners
  // vs. per-fence end posts via the cluster pass above. ──────────────────────
  let totalEndPosts = 0, totalCornerPosts = 0, totalLinePosts = 0;
  for (const acc of Object.values(byType) as FenceTypeSummary[]) {
    totalEndPosts    += acc.endPosts;
    totalCornerPosts += acc.cornerPosts;
    totalLinePosts   += acc.linePosts;
  }

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
