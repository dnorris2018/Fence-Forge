import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  icon?: string;
  submenu?: MenuEntry[];
}
export type MenuEntry = MenuItem | { separator: true };

interface Props {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
}

function SubMenu({ items, parentRect, onClose }: { items: MenuEntry[]; parentRect: DOMRect; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const menuW = 220;
  const menuH = items.length * 28 + 8;
  // Try to open to the right; flip left if it would overflow
  let left = parentRect.right + 2;
  if (left + menuW > window.innerWidth - 4) left = parentRect.left - menuW - 2;
  let top = parentRect.top;
  if (top + menuH > window.innerHeight - 4) top = window.innerHeight - menuH - 4;

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded shadow-2xl border border-gray-600 bg-[#2b2b2b] py-1 text-sm select-none"
      style={{ left, top }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) => {
        if ('separator' in item) return <div key={i} className="my-1 border-t border-gray-600" />;
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { if (!item.disabled && item.action) { item.action(); onClose(); } }}
            className={`w-full flex items-center justify-between px-3 py-1 text-left transition-colors ${
              item.disabled ? 'text-gray-600 cursor-default' : 'text-gray-200 hover:bg-gray-600 cursor-pointer'
            }`}
          >
            <span className="flex items-center gap-2">
              {item.icon && <span className="text-gray-400 w-4 text-center">{item.icon}</span>}
              {item.label}
            </span>
            {item.shortcut && <span className="ml-8 text-xs text-gray-500">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}

function MenuRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={rowRef}
      disabled={item.disabled}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => { if (!item.disabled && item.action) { item.action(); onClose(); } }}
      className={`w-full flex items-center justify-between px-3 py-1 text-left transition-colors ${
        item.disabled ? 'text-gray-600 cursor-default' : 'text-gray-200 hover:bg-gray-600 cursor-pointer'
      }`}
    >
      <span className="flex items-center gap-2">
        {item.icon && <span className="text-gray-400 w-4 text-center">{item.icon}</span>}
        {item.label}
      </span>
      <span className="ml-8 flex items-center gap-1">
        {item.shortcut && <span className="text-xs text-gray-500">{item.shortcut}</span>}
        {item.submenu && <span className="text-gray-400 text-xs">▶</span>}
      </span>
      {open && item.submenu && rowRef.current && (
        <SubMenu items={item.submenu} parentRect={rowRef.current.getBoundingClientRect()} onClose={onClose} />
      )}
    </button>
  );
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuW = 220, menuH = items.length * 28 + 8;
  const left = Math.min(x, window.innerWidth  - menuW - 4);
  const top  = Math.min(y, window.innerHeight - menuH - 4);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded shadow-2xl border border-gray-600 bg-[#2b2b2b] py-1 text-sm select-none"
      style={{ left, top }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) => {
        if ('separator' in item) return <div key={i} className="my-1 border-t border-gray-600" />;
        return <MenuRow key={i} item={item} onClose={onClose} />;
      })}
    </div>
  );
}
