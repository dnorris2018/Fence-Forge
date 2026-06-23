import { useState } from 'react';
import { Ruler } from 'lucide-react';

interface Props {
  onConfirm: (ft: number) => void;
  onCancel: () => void;
}

export function CalibrationDialog({ onConfirm, onCancel }: Props) {
  const [value, setValue] = useState('50');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ft = parseFloat(value);
    if (!isNaN(ft) && ft > 0) onConfirm(ft);
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-[var(--c-bg2)] border border-[var(--c-border2)] rounded-lg shadow-2xl p-5 w-72 pointer-events-auto">
        <div className="flex items-center gap-2 mb-3">
          <Ruler size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-[var(--c-text1)]">Set Scale</h3>
        </div>
        <p className="text-xs text-[var(--c-text3)] mb-4">
          Enter the real-world length of the line you just drew.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.1"
              step="0.1"
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              className="flex-1 bg-[var(--c-bg3)] text-[var(--c-text1)] text-sm rounded px-3 py-2 border border-gray-500 focus:border-cyan-400 outline-none"
              placeholder="e.g. 50"
            />
            <span className="text-sm text-[var(--c-text3)]">feet</span>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-[var(--c-text1)] text-xs font-bold py-2 rounded transition-colors"
            >
              Set Scale
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-[var(--c-bg3)] hover:bg-[var(--c-bg4)] text-[var(--c-text2)] text-xs font-bold py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
