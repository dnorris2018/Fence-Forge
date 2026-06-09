import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';
import type { GateType, HingeSide, SwingDirection } from '../../types/gate';

interface Props { gateId: string; }

export function GateProperties({ gateId }: Props) {
  const gate = useCanvasStore(s => s.gates[gateId]);
  const updateGate = useCanvasStore(s => s.updateGate);
  const deleteGate = useCanvasStore(s => s.deleteGate);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const { saveHistory } = useHistory();

  if (!gate) return null;

  function patch<K extends keyof typeof gate>(key: K, value: typeof gate[K]) {
    saveHistory();
    updateGate(gateId, { [key]: value } as any);
  }

  function handleDelete() {
    saveHistory();
    deleteGate(gateId);
    clearSelection();
  }

  return (
    <div className="p-3 space-y-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">Gate</p>

      {/* Gate type */}
      <div>
        <p className="text-xs text-gray-400 mb-1">Type</p>
        <div className="flex gap-1">
          {(['single-swing', 'double-swing'] as GateType[]).map(t => (
            <button
              key={t}
              onClick={() => patch('gateType', t)}
              className={`flex-1 py-1 rounded text-xs transition-colors ${
                gate.gateType === t
                  ? 'bg-amber-500 text-gray-900 font-medium'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t === 'single-swing' ? 'Single' : 'Double'}
            </button>
          ))}
        </div>
      </div>

      {/* Width */}
      <div>
        <p className="text-xs text-gray-400 mb-1">Width (ft)</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={2}
            max={20}
            step={0.5}
            value={gate.widthFt}
            onChange={e => patch('widthFt', Math.max(2, Math.min(20, parseFloat(e.target.value) || gate.widthFt)))}
            className="w-20 px-2 py-1 rounded bg-gray-700 text-white text-sm border border-gray-600 focus:border-amber-400 outline-none"
          />
          <span className="text-xs text-gray-400">ft</span>
        </div>
        <div className="flex gap-1 mt-1">
          {(gate.gateType === 'double-swing' ? [8, 10, 12] : [3, 4, 5]).map(w => (
            <button key={w} onClick={() => patch('widthFt', w)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                gate.widthFt === w ? 'bg-amber-500/30 text-amber-300' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >{w}'</button>
          ))}
        </div>
      </div>

      {/* Hinge side */}
      <div>
        <p className="text-xs text-gray-400 mb-1">Hinge Side</p>
        <div className="flex gap-1">
          {(['left', 'right'] as HingeSide[]).map(side => (
            <button
              key={side}
              onClick={() => patch('hingeSide', side)}
              className={`flex-1 py-1 rounded text-xs capitalize transition-colors ${
                gate.hingeSide === side
                  ? 'bg-amber-500 text-gray-900 font-medium'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      {/* Swing direction */}
      <div>
        <p className="text-xs text-gray-400 mb-1">Opens</p>
        <div className="flex gap-1">
          {(['inward', 'outward'] as SwingDirection[]).map(dir => (
            <button
              key={dir}
              onClick={() => patch('swingDirection', dir)}
              className={`flex-1 py-1 rounded text-xs capitalize transition-colors ${
                gate.swingDirection === dir
                  ? 'bg-amber-500 text-gray-900 font-medium'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {dir}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleDelete}
        className="w-full py-1.5 rounded bg-red-900/50 hover:bg-red-800 text-red-300 text-xs font-medium transition-colors"
      >
        Delete Gate
      </button>
    </div>
  );
}
