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
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-5 w-72 pointer-events-auto">
        <div className="flex items-center gap-2 mb-3">
          <Ruler size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Set Scale</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
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
              className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-500 focus:border-cyan-400 outline-none"
              placeholder="e.g. 50"
            />
            <span className="text-sm text-gray-400">feet</span>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 rounded transition-colors"
            >
              Set Scale
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
